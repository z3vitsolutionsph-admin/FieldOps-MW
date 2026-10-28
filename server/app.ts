import { randomUUID } from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { authenticate, type TokenVerifier } from './auth';
import type { AppConfig } from './config';
import { HttpError, ok } from './http';
import type { DocStore } from './repositories/docStore';
import { apiRoutes } from './routes';
import { AiService, type TextModel } from './services/aiService';
import { AuditService } from './services/auditService';
import { SyncService } from './services/syncService';
import { WorkOrderService } from './services/workOrderService';

export const API_VERSION = '4.0.0';

export interface AppDeps {
  config: AppConfig;
  store: DocStore;
  verifyToken: TokenVerifier;
  aiModel: TextModel | null;
}

export interface Services {
  config: AppConfig;
  store: DocStore;
  audit: AuditService;
  workOrders: WorkOrderService;
  sync: SyncService;
  ai: AiService;
}

export function createServices(deps: AppDeps): Services {
  const audit = new AuditService(deps.store);
  const workOrders = new WorkOrderService(deps.store, audit);
  return {
    config: deps.config,
    store: deps.store,
    audit,
    workOrders,
    sync: new SyncService(deps.store, workOrders, audit),
    ai: new AiService(deps.aiModel),
  };
}

/** Builds the API without listening or mounting the SPA, so tests can drive it directly. */
export function createApp(deps: AppDeps) {
  const services = createServices(deps);
  const app = express();
  const startTime = Date.now();

  app.disable('x-powered-by');
  app.set('trust proxy', 1); // Cloud Run sits behind one Google front end

  app.use(
    helmet({
      // The app is embedded in the AI Studio preview iframe, so framing stays allowed.
      frameguard: false,
      crossOriginEmbedderPolicy: false,
      // Report-only until every tile/font/weather origin has been exercised in production.
      contentSecurityPolicy: {
        reportOnly: true,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", 'https://apis.google.com', 'https://www.gstatic.com'],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
          connectSrc: [
            "'self'",
            'https://*.googleapis.com',
            'https://*.firebaseio.com',
            'https://api.open-meteo.com',
            'wss:',
          ],
          frameSrc: ["'self'", 'https://*.firebaseapp.com', 'https://accounts.google.com'],
          frameAncestors: ["'self'", 'https://aistudio.google.com', 'https://*.googleusercontent.com'],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: null, // not valid in a report-only policy
        },
      },
    })
  );

  app.use((req: Request, res: Response, next: NextFunction) => {
    const requestId = randomUUID();
    const start = Date.now();
    res.setHeader('X-Request-Id', requestId);
    res.on('finish', () => {
      if (!req.path.startsWith('/api') || deps.config.env === 'test') return;
      console.log(
        JSON.stringify({
          severity: res.statusCode >= 500 ? 'ERROR' : 'INFO',
          requestId,
          method: req.method,
          path: req.path,
          status: res.statusCode,
          durationMs: Date.now() - start,
          uid: req.user?.uid,
        })
      );
    });
    next();
  });

  // Larger bodies only where they are needed; body-parser skips already-parsed requests.
  app.use('/api/ai/inspect-photo', express.json({ limit: '8mb' }));
  app.use('/api/ai/parse-tssr', express.json({ limit: '1mb' }));
  app.use('/api/sync', express.json({ limit: '10mb' }));
  app.use(express.json({ limit: '256kb' }));

  // ---- Public probes (no internals exposed) -------------------------------
  app.get('/api/health', (_req, res) =>
    ok(res, { status: 'HEALTHY', version: API_VERSION, uptimeSeconds: Math.floor((Date.now() - startTime) / 1000) })
  );
  app.get('/api/health/ready', async (_req, res) => {
    const dbOk = await deps.store.ping();
    res.status(dbOk ? 200 : 503).json({ success: dbOk, data: { database: dbOk ? 'UP' : 'DOWN' } });
  });

  // Coarse per-IP ceiling in front of token verification; per-user limits apply after it.
  app.use(
    '/api',
    rateLimit({ windowMs: 60_000, limit: deps.config.apiRateLimitPerMin * 2, standardHeaders: 'draft-8', legacyHeaders: false })
  );
  app.use('/api', authenticate(deps.verifyToken), apiRoutes(services));

  app.use('/api', (_req, res) => res.status(404).json({ success: false, error: 'Not found', code: 'NOT_FOUND' }));

  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ success: false, error: err.message, code: err.code, details: err.details });
    }
    if (err?.type === 'entity.too.large') {
      return res.status(413).json({ success: false, error: 'Request body too large', code: 'PAYLOAD_TOO_LARGE' });
    }
    if (err?.type === 'entity.parse.failed') {
      return res.status(400).json({ success: false, error: 'Malformed JSON body', code: 'BAD_REQUEST' });
    }
    console.error(JSON.stringify({ severity: 'ERROR', path: req.path, message: err?.message, stack: err?.stack }));
    return res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL' });
  });

  return { app, services };
}
