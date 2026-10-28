import { z } from 'zod';
import firebaseConfigJson from '../firebase-applet-config.json' with { type: 'json' };

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  // 'firebase' verifies Firebase ID tokens; 'dev' accepts `Bearer dev:<seedUserId>` for local demos only.
  AUTH_MODE: z.enum(['firebase', 'dev']).optional(),
  // 'firestore' persists through the Admin SDK; 'memory' is a seeded, process-local store for dev/tests.
  DATA_BACKEND: z.enum(['firestore', 'memory']).optional(),
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIRESTORE_DATABASE_ID: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-3.8-flash'),
  AI_RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(20),
  API_RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(300),
});

export interface AppConfig {
  env: 'development' | 'test' | 'production';
  isProduction: boolean;
  port: number;
  authMode: 'firebase' | 'dev';
  dataBackend: 'firestore' | 'memory';
  firebaseProjectId: string;
  firestoreDatabaseId: string | undefined;
  geminiApiKey: string | undefined;
  geminiModel: string;
  aiRateLimitPerMin: number;
  apiRateLimitPerMin: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  const e = parsed.data;
  const isProduction = e.NODE_ENV === 'production';

  const authMode = e.AUTH_MODE ?? (isProduction ? 'firebase' : 'dev');
  const dataBackend = e.DATA_BACKEND ?? (isProduction ? 'firestore' : 'memory');

  // Fail closed: the demo identity scheme and the throwaway store must never reach production.
  if (isProduction && authMode === 'dev') {
    throw new Error('AUTH_MODE=dev is not allowed when NODE_ENV=production');
  }
  if (isProduction && dataBackend === 'memory') {
    throw new Error('DATA_BACKEND=memory is not allowed when NODE_ENV=production');
  }

  return {
    env: e.NODE_ENV,
    isProduction,
    port: e.PORT,
    authMode,
    dataBackend,
    firebaseProjectId: e.FIREBASE_PROJECT_ID || firebaseConfigJson.projectId,
    firestoreDatabaseId: e.FIRESTORE_DATABASE_ID || firebaseConfigJson.firestoreDatabaseId || undefined,
    geminiApiKey: e.GEMINI_API_KEY || undefined,
    geminiModel: e.GEMINI_MODEL,
    aiRateLimitPerMin: e.AI_RATE_LIMIT_PER_MIN,
    apiRateLimitPerMin: e.API_RATE_LIMIT_PER_MIN,
  };
}
