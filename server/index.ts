process.env.NODE_ENV ??= (import.meta.url.endsWith('.ts') ? 'development' : 'production');

import path from 'path';
import express, { Request, Response } from 'express';
import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { config } from './config';
import { DocStore } from './repositories/docStore';
import { MemoryDocStore } from './repositories/memoryStore';
import { FirestoreDocStore } from './repositories/firestoreStore';
import { seedMemoryStore } from './repositories/seed';
import { TokenVerifier, devVerifier, createFirebaseVerifier } from './auth';
import { createApp } from './app';

async function bootstrap() {
  // 1. Initialise Firebase Admin SDK only when needed
  let adminApp: App | null = null;
  if (config.AUTH_MODE === 'firebase' || config.DATA_BACKEND === 'firestore') {
    const existingApps = getApps();
    if (existingApps.length === 0) {
      adminApp = initializeApp({
        projectId: config.FIREBASE_PROJECT_ID,
      });
      console.log(`[Firebase Admin] Initialized with Project ID: ${config.FIREBASE_PROJECT_ID}`);
    } else {
      adminApp = existingApps[0]!;
    }
  }

  // 2. Resolve Token Verifier
  const verifyToken: TokenVerifier =
    config.AUTH_MODE === 'firebase'
      ? createFirebaseVerifier(adminApp ? getAuth(adminApp) : getAuth())
      : devVerifier;

  // 3. Resolve Data Store
  const store: DocStore =
    config.DATA_BACKEND === 'firestore'
      ? new FirestoreDocStore(adminApp ? getFirestore(adminApp) : getFirestore())
      : new MemoryDocStore();

  // Seed memory store only; never seed Firestore automatically
  if (config.DATA_BACKEND === 'memory') {
    await seedMemoryStore(store);
  }

  // 4. Build Express Application
  const app = createApp({
    config,
    store,
    verifyToken,
  });

  // 5. Mount Frontend Assets (Vite Middleware in Dev, Static in Prod)
  if (config.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('[Server] Mounted Vite development middlewares.');
  } else {
    const distPath = new URL('../dist', import.meta.url).pathname;
    app.use(
      express.static(distPath, {
        maxAge: '1y',
        immutable: true,
        index: false,
      })
    );
    app.get('*', (_req: Request, res: Response) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
    console.log('[Server] Serving production static bundle from dist/.');
  }

  // 6. Bind Server Listener
  const HOST = '0.0.0.0';
  const server = app.listen(config.PORT, HOST, () => {
    console.log(`====================================================`);
    console.log(`🚀 FieldOps MW Enterprise Server Running on http://${HOST}:${config.PORT}`);
    console.log(`🌍 Environment: ${config.NODE_ENV}`);
    console.log(`🛡️  Auth Mode: ${config.AUTH_MODE.toUpperCase()}`);
    console.log(`💾 Data Backend: ${config.DATA_BACKEND.toUpperCase()}`);
    console.log(`🤖 Gemini AI Model: ${config.GEMINI_MODEL}`);
    console.log(`====================================================`);
  });

  // 7. Graceful Shutdown Handlers with 10-second forced-exit timeout
  const shutdown = (signal: string) => {
    console.log(`\n[Server] Received ${signal}. Initiating graceful shutdown...`);
    const forcedTimer = setTimeout(() => {
      console.error('[Server] Forced shutdown timeout (10s) reached. Exiting immediately.');
      process.exit(1);
    }, 10000);
    forcedTimer.unref();

    server.close(() => {
      clearTimeout(forcedTimer);
      console.log('[Server] All active HTTP connections terminated cleanly. Exit complete.');
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // 8. Prevent Process Crash on Unhandled Promise Rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('[Server] Unhandled Promise Rejection at:', promise, 'reason:', reason);
  });
}

bootstrap().catch((err) => {
  console.error('[Server Fatal Bootstrap Error]:', err);
  process.exit(1);
});
