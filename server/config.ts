import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables from .env if present
dotenv.config();

// Read defaults from firebase-applet-config.json
let defaultProjectId = '';
let defaultDatabaseId = '';

try {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    defaultProjectId = raw.projectId || '';
    defaultDatabaseId = raw.firestoreDatabaseId || '';
  }
} catch {
  // Ignore read error if file does not exist
}

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    AUTH_MODE: z.enum(['firebase', 'dev']).optional(),
    DATA_BACKEND: z.enum(['firestore', 'memory']).optional(),
    FIREBASE_PROJECT_ID: z.string().default(defaultProjectId),
    FIRESTORE_DATABASE_ID: z.string().default(defaultDatabaseId),
    GEMINI_API_KEY: z.string().optional().default(process.env.GEMINI_API_KEY || ''),
    GEMINI_MODEL: z.string().default('gemini-3.8-flash'),
    AI_RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(20),
    API_RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(300),
  })
  .refine(
    (data) => {
      const authMode = data.AUTH_MODE || (data.NODE_ENV === 'production' ? 'firebase' : 'dev');
      return !(data.NODE_ENV === 'production' && authMode === 'dev');
    },
    {
      message: 'Invalid configuration: Production environment cannot run with AUTH_MODE=dev. Set AUTH_MODE=firebase.',
      path: ['AUTH_MODE'],
    }
  )
  .refine(
    (data) => {
      const dataBackend = data.DATA_BACKEND || (data.NODE_ENV === 'production' ? 'firestore' : 'memory');
      return !(data.NODE_ENV === 'production' && dataBackend === 'memory');
    },
    {
      message: 'Invalid configuration: Production environment cannot run with DATA_BACKEND=memory. Set DATA_BACKEND=firestore.',
      path: ['DATA_BACKEND'],
    }
  )
  .transform((data) => {
    const authMode = data.AUTH_MODE || (data.NODE_ENV === 'production' ? 'firebase' : 'dev');
    const dataBackend = data.DATA_BACKEND || (data.NODE_ENV === 'production' ? 'firestore' : 'memory');

    return {
      ...data,
      AUTH_MODE: authMode as 'firebase' | 'dev',
      DATA_BACKEND: dataBackend as 'firestore' | 'memory',
    };
  });

function loadConfig() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ FATAL: Invalid Server Environment Configuration:');
    for (const issue of result.error.issues) {
      console.error(`   - ${issue.path.join('.')}: ${issue.message}`);
    }
    throw new Error(`Invalid server configuration: ${result.error.message}`);
  }
  return result.data;
}

export const config = loadConfig();
export type Config = typeof config;
