import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { createApp } from './app';
import { devVerifier, firebaseVerifier } from './auth';
import { loadConfig } from './config';
import { FirestoreDocStore } from './repositories/firestoreStore';
import { MemoryDocStore } from './repositories/memoryStore';
import { seedDemoData } from './repositories/seed';
import { geminiModel } from './services/aiService';

async function main() {
  // Fail closed: the bundled server (dist-server/*.mjs) is production unless told
  // otherwise; only running the TypeScript source defaults to development.
  process.env.NODE_ENV ??= import.meta.url.endsWith('.ts') ? 'development' : 'production';
  const config = loadConfig();

  // Admin SDK uses Application Default Credentials (the Cloud Run service account,
  // or GOOGLE_APPLICATION_CREDENTIALS locally). It is only initialised when needed.
  const needsAdmin = config.authMode === 'firebase' || config.dataBackend === 'firestore';
  const adminApp = needsAdmin
    ? (getApps()[0] ?? initializeApp({ projectId: config.firebaseProjectId }))
    : null;

  let store;
  if (config.dataBackend === 'firestore') {
    store = new FirestoreDocStore(
      config.firestoreDatabaseId ? getFirestore(adminApp!, config.firestoreDatabaseId) : getFirestore(adminApp!)
    );
  } else {
    store = new MemoryDocStore();
    await seedDemoData(store);
  }

  const verifyToken = config.authMode === 'firebase' ? firebaseVerifier(getAuth(adminApp!)) : devVerifier();
  const aiModel = config.geminiApiKey ? geminiModel(config.geminiApiKey, config.geminiModel) : null;

  const { app } = createApp({ config, store, verifyToken, aiModel });

  if (config.isProduction) {
    const distPath = fileURLToPath(new URL('../dist', import.meta.url));
    app.use(express.static(distPath, { index: false, maxAge: '1y', immutable: true }));
    // index.html must never be cached, or clients keep requesting stale hashed bundles.
    app.get('*', (_req, res) => res.setHeader('Cache-Control', 'no-cache').sendFile('index.html', { root: distPath }));
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  }

  const server = app.listen(config.port, '0.0.0.0', () => {
    console.log(
      `[fieldops] listening on :${config.port} env=${config.env} auth=${config.authMode} data=${config.dataBackend} ai=${aiModel ? 'on' : 'off'}`
    );
    if (config.authMode === 'dev') {
      console.warn('[fieldops] AUTH_MODE=dev: demo identities are accepted. Never expose this server publicly.');
    }
  });

  const shutdown = () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// The Google client libraries can reject internal promises (e.g. missing credentials)
// outside any request. Log them instead of letting one take the whole server down.
process.on('unhandledRejection', (reason) => {
  console.error(JSON.stringify({ severity: 'ERROR', message: 'Unhandled rejection', reason: String(reason) }));
});

main().catch((err) => {
  console.error('[fieldops] failed to start:', err);
  process.exit(1);
});
