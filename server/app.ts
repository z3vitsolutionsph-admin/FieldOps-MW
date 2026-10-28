import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import { z } from 'zod';
import { Config } from './config';
import { DocStore } from './repositories/docStore';
import { TokenVerifier, createAuthenticate, requirePermission, requireAnyPermission } from './auth';
import { AuditService } from './services/auditService';
import { WorkOrderService } from './services/workOrderService';
import { SyncService } from './services/syncService';
import {
  AiService,
  GeminiTextModel,
  aiAskSchema,
  aiInspectPhotoSchema,
  aiAsBuiltSummarySchema,
  aiParseTssrSchema,
} from './services/aiService';
import { HttpError, ok, badRequest, notFound, asyncHandler } from './http';
import { parse } from './validate';
import {
  createWorkOrderSchema,
  patchWorkOrderSchema,
  transitionWorkOrderSchema,
} from './domain/schemas';
import { InventoryItem } from '../src/types/fieldops';

export interface AppDependencies {
  config: Config;
  store: DocStore;
  verifyToken: TokenVerifier;
  aiService?: AiService;
}

export function createApp({ config, store, verifyToken, aiService: injectedAiService }: AppDependencies) {
  const app = express();
  const startTime = Date.now();

  const auditService = new AuditService(store);
  const workOrderService = new WorkOrderService(store, auditService);
  const syncService = new SyncService(store, auditService);

  const aiService =
    injectedAiService ||
    new AiService(
      config.GEMINI_API_KEY
        ? new GeminiTextModel(config.GEMINI_API_KEY, config.GEMINI_MODEL)
        : null
    );

  // In-process telemetry accumulator
  const telemetry = {
    totalRequests: 0,
    endpointHits: {} as Record<string, number>,
    errorCount: 0,
  };

  // 1. Core Platform Security Settings
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // 2. Helmet with Report-Only CSP
  app.use(
    helmet({
      frameguard: false,
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: {
        reportOnly: true,
        directives: {
          defaultSrc: ["'self'"],
          fontSrc: ["'self'", 'https://fonts.googleapis.com', 'https://fonts.gstatic.com'],
          scriptSrc: [
            "'self'",
            'https://apis.google.com',
            'https://www.gstatic.com',
            "'unsafe-inline'",
            "'unsafe-eval'",
          ],
          styleSrc: ["'self'", 'https://fonts.googleapis.com', "'unsafe-inline'"],
          connectSrc: [
            "'self'",
            'https://*.googleapis.com',
            'https://*.firebaseio.com',
            'https://api.open-meteo.com',
            'wss:',
          ],
          frameSrc: ["'self'", 'https://*.firebaseapp.com', 'https://accounts.google.com'],
          imgSrc: ["'self'", 'https:', 'data:', 'blob:'],
          frameAncestors: [
            "'self'",
            'https://aistudio.google.com',
            'https://*.googleusercontent.com',
          ],
          upgradeInsecureRequests: null,
        },
      },
    })
  );

  // 3. Request Logging & Correlation ID
  app.use((req: Request, res: Response, next: NextFunction) => {
    const reqStart = Date.now();
    const requestId = crypto.randomUUID();
    req.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);

    telemetry.totalRequests++;
    const routeKey = `${req.method} ${req.path}`;
    telemetry.endpointHits[routeKey] = (telemetry.endpointHits[routeKey] || 0) + 1;

    res.on('finish', () => {
      if (req.path.startsWith('/api')) {
        const durationMs = Date.now() - reqStart;
        const logLine = {
          requestId,
          method: req.method,
          path: req.path,
          status: res.statusCode,
          durationMs,
          uid: req.user?.uid || 'anonymous',
        };
        console.log(JSON.stringify(logLine));
      }
    });

    next();
  });

  // 4. Route-Specific Body-Size Limits (Specific registered before general)
  app.use('/api/ai/inspect-photo', express.json({ limit: '8mb' }));
  app.use('/api/ai/parse-tssr', express.json({ limit: '1mb' }));
  app.use('/api/sync', express.json({ limit: '10mb' }));
  app.use(express.json({ limit: '256kb' }));
  app.use(express.urlencoded({ extended: true, limit: '256kb' }));

  // 5. Pre-Authentication Per-IP Rate Limiter on /api
  const perIpLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: config.API_RATE_LIMIT_PER_MIN * 2,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: 'Too many requests from this IP address, please try again shortly.',
      code: 'IP_RATE_LIMIT_EXCEEDED',
      timestamp: new Date().toISOString(),
    },
  });
  app.use('/api', perIpLimiter);

  // 6. Public Health Probes (no authentication required)
  app.get('/api/health', (_req: Request, res: Response) => {
    return ok(res, {
      status: 'HEALTHY',
      version: '4.0.0',
      uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    });
  });

  app.get(
    '/api/health/ready',
    asyncHandler(async (_req: Request, res: Response) => {
      const isUp = await store.ping();
      if (isUp) {
        return res.status(200).json({ database: 'UP' });
      } else {
        return res.status(503).json({ database: 'DOWN' });
      }
    })
  );

  // 7. Authentication Layer for All Other /api Routes
  const authenticate = createAuthenticate(verifyToken);
  app.use('/api', authenticate);

  // 8. Post-Authentication Per-User Rate Limiter
  const perUserLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: config.API_RATE_LIMIT_PER_MIN,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => req.user?.uid || 'anonymous',
    message: {
      success: false,
      error: 'User account request rate limit exceeded. Please slow down.',
      code: 'USER_RATE_LIMIT_EXCEEDED',
      timestamp: new Date().toISOString(),
    },
  });
  app.use('/api', perUserLimiter);

  // 9. Dedicated Per-User AI Rate Limiter
  const perUserAiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: config.AI_RATE_LIMIT_PER_MIN,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => req.user?.uid || 'anonymous',
    message: {
      success: false,
      error: 'AI operations rate limit exceeded. Please wait a minute before sending further AI prompts.',
      code: 'AI_RATE_LIMIT_EXCEEDED',
      timestamp: new Date().toISOString(),
    },
  });
  app.use('/api/ai', perUserAiLimiter);

  // =========================================================================
  // PROTECTED API ENDPOINTS
  // =========================================================================

  // GET /api/me: Returns current authenticated user profile
  app.get('/api/me', (req: Request, res: Response) => {
    return ok(res, req.user);
  });

  // GET /api/metrics: Requires MANAGE_USERS_ROLES
  app.get(
    '/api/metrics',
    requirePermission('MANAGE_USERS_ROLES'),
    asyncHandler(async (req: Request, res: Response) => {
      const workOrders = await store.list(req.user!.orgId, 'work_orders');
      const inventory = await store.list(req.user!.orgId, 'inventory');
      const auditLogs = await auditService.list(req.user!.orgId);

      return ok(res, {
        uptime: Math.floor((Date.now() - startTime) / 1000),
        totalRequests: telemetry.totalRequests,
        errorCount: telemetry.errorCount,
        topEndpoints: telemetry.endpointHits,
        workOrdersCount: workOrders.length,
        inventoryCount: inventory.length,
        auditLogsCount: auditLogs.length,
      });
    })
  );

  // GET /api/audit-logs: Requires VIEW_AUDIT_LOGS
  app.get(
    '/api/audit-logs',
    requirePermission('VIEW_AUDIT_LOGS'),
    asyncHandler(async (req: Request, res: Response) => {
      const logs = await auditService.list(req.user!.orgId);
      return ok(res, logs);
    })
  );

  // Work Orders API
  app.get(
    '/api/work-orders',
    asyncHandler(async (req: Request, res: Response) => {
      const { type, status, siteRole, assigneeId } = req.query;
      const list = await workOrderService.list(req.user!, {
        type: typeof type === 'string' ? type : undefined,
        status: typeof status === 'string' ? status : undefined,
        siteRole: typeof siteRole === 'string' ? siteRole : undefined,
        assigneeId: typeof assigneeId === 'string' ? assigneeId : undefined,
      });
      return ok(res, list);
    })
  );

  app.get(
    '/api/work-orders/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const wo = await workOrderService.getById(req.user!, req.params.id);
      return ok(res, wo);
    })
  );

  app.post(
    '/api/work-orders',
    requirePermission('CREATE_WORK_ORDER'),
    asyncHandler(async (req: Request, res: Response) => {
      const body = parse(createWorkOrderSchema, req.body);
      const created = await workOrderService.create(req.user!, body);
      return ok(res, created, 201);
    })
  );

  app.patch(
    '/api/work-orders/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const body = parse(patchWorkOrderSchema, req.body);
      const updated = await workOrderService.patch(req.user!, req.params.id, body);
      return ok(res, updated);
    })
  );

  app.post(
    '/api/work-orders/:id/transition',
    asyncHandler(async (req: Request, res: Response) => {
      // Reject any 'role' field passed in body with 400
      if ('role' in (req.body || {})) {
        throw badRequest("The 'role' field is not allowed in transition body; role is determined strictly from token claims");
      }
      const body = parse(transitionWorkOrderSchema, req.body);
      const updated = await workOrderService.transition(req.user!, req.params.id, body);
      return ok(res, updated);
    })
  );

  app.delete(
    '/api/work-orders/:id',
    requirePermission('EDIT_WORK_ORDER_SETTINGS'),
    asyncHandler(async (req: Request, res: Response) => {
      await workOrderService.delete(req.user!, req.params.id);
      return ok(res, { deleted: true });
    })
  );

  // Sites, Hops, and TSSR Approvals
  app.get(
    '/api/sites',
    asyncHandler(async (req: Request, res: Response) => {
      const sites = await store.list(req.user!.orgId, 'sites');
      return ok(res, sites);
    })
  );

  app.get(
    '/api/sites/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const site = await store.get(req.user!.orgId, 'sites', req.params.id);
      if (!site) {
        throw notFound(`Site '${req.params.id}' not found`);
      }
      return ok(res, site);
    })
  );

  app.get(
    '/api/hops',
    asyncHandler(async (req: Request, res: Response) => {
      const hops = await store.list(req.user!.orgId, 'hops');
      return ok(res, hops);
    })
  );

  app.get(
    '/api/tssr-approvals',
    asyncHandler(async (req: Request, res: Response) => {
      const approvals = await store.list(req.user!.orgId, 'tssr_approvals');
      return ok(res, approvals);
    })
  );

  // Battery Telemetry Curve
  app.get(
    '/api/battery-cache/:siteId',
    requirePermission('BATTERY_TELEMETRY'),
    asyncHandler(async (req: Request, res: Response) => {
      const now = Date.now();
      const readings = [];

      for (let i = 24; i >= 0; i--) {
        const timestamp = new Date(now - i * 3600 * 1000).toISOString();
        const hourLabel = `${new Date(now - i * 3600 * 1000).getHours().toString().padStart(2, '0')}:00`;
        const baseVoltage = 53.8;
        const dischargeDrop = i > 8 && i < 14 ? (14 - i) * 0.45 : 0;
        const voltage = parseFloat((baseVoltage - dischargeDrop + (Math.random() * 0.15 - 0.07)).toFixed(2));
        const stateOfCharge = Math.max(78, Math.min(100, Math.round(99 - dischargeDrop * 4)));
        const tempCelsius = parseFloat((27.5 + Math.sin(i / 3) * 3.5).toFixed(1));
        const currentAmps = parseFloat((14.2 + (Math.random() * 1.5 - 0.75)).toFixed(2));

        readings.push({
          hour: hourLabel,
          timestamp,
          voltageV: voltage,
          stateOfChargePct: stateOfCharge,
          temperatureC: tempCelsius,
          loadCurrentA: currentAmps,
          isDischarging: dischargeDrop > 0,
        });
      }

      return ok(res, {
        siteId: req.params.siteId,
        nominalVoltage: -48,
        bankModel: 'ZTE ZXESM 7x100Ah Lithium-Iron (LiFePO4)',
        nominalCapacityAh: 700,
        healthState: 'HEALTHY (98.2% SOH)',
        simulated: true,
        cachedReadings: readings,
      });
    })
  );

  // Inventory & Asset Verification
  app.get(
    '/api/inventory',
    requireAnyPermission('QR_INVENTORY_SCAN', 'MANAGE_INVENTORY_LEDGER', 'SIGN_CHAIN_OF_CUSTODY'),
    asyncHandler(async (req: Request, res: Response) => {
      const items = await store.list<InventoryItem>(req.user!.orgId, 'inventory');
      return ok(res, items);
    })
  );

  const verifyInventorySchema = z
    .object({
      barcode: z.string().optional(),
      assetTag: z.string().optional(),
      serialNumber: z.string().optional(),
    })
    .refine((data) => data.barcode || data.assetTag || data.serialNumber, {
      message: 'Barcode, assetTag, or serialNumber is required',
    });

  app.post(
    '/api/inventory/verify',
    requireAnyPermission('QR_INVENTORY_SCAN', 'MANAGE_INVENTORY_LEDGER', 'SIGN_CHAIN_OF_CUSTODY'),
    asyncHandler(async (req: Request, res: Response) => {
      const body = parse(verifyInventorySchema, req.body);
      const codeRaw = (body.barcode || body.assetTag || body.serialNumber || '').trim();
      if (!codeRaw) {
        throw badRequest('Barcode or asset tag query is required');
      }
      const codeUpper = codeRaw.toUpperCase();

      // Exact-match query on assetTag
      let matchedItems = await store.list<InventoryItem>(req.user!.orgId, 'inventory', {
        filters: [{ field: 'assetTag', op: '==', value: codeRaw }],
        limit: 1,
      });

      if (matchedItems.length === 0 && codeUpper !== codeRaw) {
        matchedItems = await store.list<InventoryItem>(req.user!.orgId, 'inventory', {
          filters: [{ field: 'assetTag', op: '==', value: codeUpper }],
          limit: 1,
        });
      }

      // Exact-match query on serialNumber
      if (matchedItems.length === 0) {
        matchedItems = await store.list<InventoryItem>(req.user!.orgId, 'inventory', {
          filters: [{ field: 'serialNumber', op: '==', value: codeRaw }],
          limit: 1,
        });
      }

      if (matchedItems.length === 0 && codeUpper !== codeRaw) {
        matchedItems = await store.list<InventoryItem>(req.user!.orgId, 'inventory', {
          filters: [{ field: 'serialNumber', op: '==', value: codeUpper }],
          limit: 1,
        });
      }

      if (matchedItems.length > 0) {
        return ok(res, {
          found: true,
          verified: true,
          item: matchedItems[0],
          status: 'VERIFIED_IN_DECOMMISSION_MANIFEST',
        });
      }

      return ok(res, {
        found: false,
        verified: false,
        query: codeRaw,
        status: 'UNKNOWN_ASSET_TAG_REQUIRES_MANUAL_AUDIT',
      });
    })
  );

  // Sync Gateway API
  const syncBatchSchema = z.object({
    mutations: z.array(z.any()).max(200, 'Batch maximum is 200 mutations'),
  });

  const handleSyncBatch = asyncHandler(async (req: Request, res: Response) => {
    const body = parse(syncBatchSchema, req.body);
    const result = await syncService.processBatch(req.user!, body.mutations);
    return ok(res, result);
  });

  app.post('/api/sync/batch', handleSyncBatch);
  app.post('/api/sync', handleSyncBatch);

  app.get('/api/sync/status', (_req: Request, res: Response) => {
    return ok(res, {
      gatewayStatus: 'ONLINE_ACTIVE',
      supportedCollections: ['work_orders', 'inventory', 'tickets', 'photos', 'tssr_approvals', 'audit_logs'],
    });
  });

  // AI Endpoints
  app.get('/api/ai/status', (_req: Request, res: Response) => {
    return ok(res, { available: aiService.isAvailable() });
  });

  app.post(
    '/api/ai/ask',
    asyncHandler(async (req: Request, res: Response) => {
      const body = parse(aiAskSchema, req.body);
      const answer = await aiService.ask(body.query, body.context);
      return ok(res, answer);
    })
  );

  app.post(
    '/api/ai/inspect-photo',
    requirePermission('PHOTO_CAPTURE_UPLOAD'),
    asyncHandler(async (req: Request, res: Response) => {
      const body = parse(aiInspectPhotoSchema, req.body);
      const result = await aiService.inspectPhoto(body.photoTitle, body.imageBase64, body.mimeType);
      return ok(res, result);
    })
  );

  app.post(
    '/api/ai/as-built-summary',
    asyncHandler(async (req: Request, res: Response) => {
      const body = parse(aiAsBuiltSummarySchema, req.body);
      const result = await aiService.asBuiltSummary(body);
      return ok(res, result);
    })
  );

  app.post(
    '/api/ai/parse-tssr',
    requirePermission('UPLOAD_TSSR'),
    asyncHandler(async (req: Request, res: Response) => {
      const body = parse(aiParseTssrSchema, req.body);
      const result = await aiService.parseTssr(body.rawText, body.fileName);
      return ok(res, result);
    })
  );

  // 10. Unknown /api Route Catch-All -> 404 JSON
  app.all('/api/*', (req: Request, _res: Response, next: NextFunction) => {
    next(notFound(`Endpoint ${req.method} ${req.path} not found`));
  });

  // 11. Global Error Handling Middleware
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    telemetry.errorCount++;

    if (err instanceof HttpError) {
      return res.status(err.status).json({
        success: false,
        error: err.message,
        code: err.code,
        details: err.details,
        timestamp: new Date().toISOString(),
      });
    }

    if (err?.type === 'entity.too.large') {
      return res.status(413).json({
        success: false,
        error: 'Payload too large',
        code: 'PAYLOAD_TOO_LARGE',
        timestamp: new Date().toISOString(),
      });
    }

    if (err?.type === 'entity.parse.failed') {
      return res.status(400).json({
        success: false,
        error: 'Malformed JSON payload',
        code: 'MALFORMED_JSON',
        timestamp: new Date().toISOString(),
      });
    }

    console.error('[Internal Server Error]:', err?.message || err, err?.stack || '');
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString(),
    });
  });

  return app;
}
