import express, { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { Hop, InventoryItem, Site } from '../src/types/fieldops';
import { requirePermission, requireUser } from './auth';
import { asyncHandler, forbidden, notFound, ok } from './http';
import { parse } from './validate';
import {
  AiAsBuiltBody,
  AiAskBody,
  AiInspectPhotoBody,
  AiParseTssrBody,
  CreateWorkOrderBody,
  Id,
  InventoryVerifyBody,
  SyncBatchBody,
  TransitionBody,
  UpdateWorkOrderBody,
  WorkOrderListQuery,
} from './domain/schemas';
import { hasAnyPermission } from '../src/services/rbacService';
import type { Services } from './app';

type Row<T> = T & Record<string, unknown>;

const userKey = (req: express.Request) => req.user?.uid ?? 'anonymous';

export function apiRoutes(s: Services): Router {
  const r = Router();
  const startTime = Date.now();

  r.use(
    rateLimit({
      windowMs: 60_000,
      limit: s.config.apiRateLimitPerMin,
      keyGenerator: userKey,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
    })
  );
  const aiLimiter = rateLimit({
    windowMs: 60_000,
    limit: s.config.aiRateLimitPerMin,
    keyGenerator: userKey,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { success: false, error: 'AI request limit reached. Try again in a minute.', code: 'RATE_LIMITED' },
  });

  r.get('/me', (req, res) => ok(res, requireUser(req)));

  // ---- Work orders -------------------------------------------------------
  r.get(
    '/work-orders',
    asyncHandler(async (req, res) => ok(res, await s.workOrders.list(requireUser(req), parse(WorkOrderListQuery, req.query))))
  );
  r.get(
    '/work-orders/:id',
    asyncHandler(async (req, res) => ok(res, await s.workOrders.get(requireUser(req), parse(Id, req.params.id))))
  );
  r.post(
    '/work-orders',
    requirePermission('CREATE_WORK_ORDER'),
    asyncHandler(async (req, res) => ok(res, await s.workOrders.create(requireUser(req), parse(CreateWorkOrderBody, req.body)), 201))
  );
  r.patch(
    '/work-orders/:id',
    asyncHandler(async (req, res) =>
      ok(res, await s.workOrders.update(requireUser(req), parse(Id, req.params.id), parse(UpdateWorkOrderBody, req.body)))
    )
  );
  r.post(
    '/work-orders/:id/transition',
    asyncHandler(async (req, res) => {
      const body = parse(TransitionBody, req.body);
      const wo = await s.workOrders.transition(
        requireUser(req),
        parse(Id, req.params.id),
        body.newStatus,
        body.reason,
        body.expectedVersion
      );
      return ok(res, wo);
    })
  );
  r.delete(
    '/work-orders/:id',
    requirePermission('EDIT_WORK_ORDER_SETTINGS'),
    asyncHandler(async (req, res) => {
      await s.workOrders.delete(requireUser(req), parse(Id, req.params.id));
      return res.status(204).end();
    })
  );

  // ---- Sites, hops, telemetry --------------------------------------------
  r.get(
    '/sites',
    asyncHandler(async (req, res) => ok(res, await s.store.list<Row<Site>>(requireUser(req).orgId, 'sites')))
  );
  r.get(
    '/sites/:id',
    asyncHandler(async (req, res) => {
      const site = await s.store.get<Row<Site>>(requireUser(req).orgId, 'sites', parse(Id, req.params.id));
      if (!site) throw notFound(`Site '${req.params.id}' not found`);
      return ok(res, site);
    })
  );
  r.get(
    '/hops',
    asyncHandler(async (req, res) => ok(res, await s.store.list<Row<Hop>>(requireUser(req).orgId, 'hops')))
  );
  r.get(
    '/tssr-approvals',
    asyncHandler(async (req, res) => ok(res, await s.store.list(requireUser(req).orgId, 'tssr_approvals')))
  );
  r.get('/battery-cache/:siteId', requirePermission('BATTERY_TELEMETRY'), (req, res) =>
    ok(res, simulatedBatteryCurve(parse(Id, req.params.siteId)))
  );

  // ---- Inventory ---------------------------------------------------------
  const inventoryReaders = ['QR_INVENTORY_SCAN', 'MANAGE_INVENTORY_LEDGER', 'SIGN_CHAIN_OF_CUSTODY'] as const;
  const requireInventoryAccess: express.RequestHandler = (req, _res, next) =>
    next(hasAnyPermission(requireUser(req).role, [...inventoryReaders]) ? undefined : forbidden());

  r.get(
    '/inventory',
    requireInventoryAccess,
    asyncHandler(async (req, res) => ok(res, await s.store.list<Row<InventoryItem>>(requireUser(req).orgId, 'inventory')))
  );
  r.post(
    '/inventory/verify',
    requireInventoryAccess,
    asyncHandler(async (req, res) => {
      const body = parse(InventoryVerifyBody, req.body);
      const code = (body.barcode || body.assetTag || body.serialNumber || '').trim();
      const orgId = requireUser(req).orgId;
      // Exact-match lookups use single-field indexes; try as typed and upper-cased (tags are printed upper-case).
      let matched: Row<InventoryItem> | undefined;
      for (const field of ['assetTag', 'serialNumber']) {
        for (const value of new Set([code, code.toUpperCase()])) {
          matched ??= (await s.store.list<Row<InventoryItem>>(orgId, 'inventory', { filters: [{ field, op: '==', value }], limit: 1 }))[0];
        }
      }
      return ok(
        res,
        matched
          ? { found: true, verified: true, item: matched, status: 'VERIFIED_IN_DECOMMISSION_MANIFEST' }
          : { found: false, verified: false, query: code, status: 'UNKNOWN_ASSET_TAG_REQUIRES_MANUAL_AUDIT' }
      );
    })
  );

  // ---- Offline sync gateway ----------------------------------------------
  r.post(
    '/sync/batch',
    asyncHandler(async (req, res) => {
      const { mutations } = parse(SyncBatchBody, req.body);
      const results = await s.sync.applyBatch(requireUser(req), mutations);
      const processedIds = results.filter((x) => x.status === 'APPLIED').map((x) => x.id);
      return ok(res, { syncedCount: processedIds.length, processedIds, results, serverTimestamp: new Date().toISOString() });
    })
  );
  r.get(
    '/sync/status',
    asyncHandler(async (_req, res) =>
      ok(res, { gatewayStatus: (await s.store.ping()) ? 'ONLINE' : 'DEGRADED', backend: s.config.dataBackend })
    )
  );

  // ---- AI assistant (server-side key only) -------------------------------
  r.get('/ai/status', (_req, res) => ok(res, { available: s.ai.available }));
  r.post('/ai/ask', aiLimiter, asyncHandler(async (req, res) => ok(res, await s.ai.ask(parse(AiAskBody, req.body)))));
  r.post(
    '/ai/inspect-photo',
    aiLimiter,
    requirePermission('PHOTO_CAPTURE_UPLOAD'),
    asyncHandler(async (req, res) => ok(res, await s.ai.inspectPhoto(parse(AiInspectPhotoBody, req.body))))
  );
  r.post(
    '/ai/as-built-summary',
    aiLimiter,
    asyncHandler(async (req, res) => ok(res, await s.ai.asBuiltSummary(parse(AiAsBuiltBody, req.body))))
  );
  r.post(
    '/ai/parse-tssr',
    aiLimiter,
    requirePermission('UPLOAD_TSSR'),
    asyncHandler(async (req, res) => ok(res, await s.ai.parseTssr(parse(AiParseTssrBody, req.body))))
  );

  // ---- Audit & operations (restricted) -----------------------------------
  r.get(
    '/audit-logs',
    requirePermission('VIEW_AUDIT_LOGS'),
    asyncHandler(async (req, res) => ok(res, await s.audit.list(requireUser(req))))
  );
  r.get('/metrics', requirePermission('MANAGE_USERS_ROLES'), (_req, res) =>
    ok(res, {
      uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
      memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      authMode: s.config.authMode,
      dataBackend: s.config.dataBackend,
      aiAvailable: s.ai.available,
    })
  );

  return r;
}

/** Synthetic -48 V DC discharge curve. There is no telemetry feed yet; responses are flagged `simulated`. */
function simulatedBatteryCurve(siteId: string) {
  const now = Date.now();
  const readings = [];
  for (let i = 24; i >= 0; i--) {
    const t = new Date(now - i * 3600 * 1000);
    const dischargeDrop = i > 8 && i < 14 ? (14 - i) * 0.45 : 0;
    readings.push({
      hour: `${t.getHours().toString().padStart(2, '0')}:00`,
      timestamp: t.toISOString(),
      voltageV: +(53.8 - dischargeDrop + (Math.random() * 0.15 - 0.07)).toFixed(2),
      stateOfChargePct: Math.max(78, Math.min(100, Math.round(99 - dischargeDrop * 4))),
      temperatureC: +(27.5 + Math.sin(i / 3) * 3.5).toFixed(1),
      loadCurrentA: +(14.2 + (Math.random() * 1.5 - 0.75)).toFixed(2),
      isDischarging: dischargeDrop > 0,
    });
  }
  return { siteId, simulated: true, nominalVoltage: -48, nominalCapacityAh: 700, cachedReadings: readings };
}
