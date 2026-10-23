import { config } from 'dotenv';
import { z } from 'zod';
config({ path: '../../.env', quiet: true });
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().url(), JWT_ACCESS_SECRET: z.string().min(32), JWT_REFRESH_SECRET: z.string().min(32),
  DB_POOL_MAX: z.coerce.number().int().min(2).max(20).default(process.env.VERCEL === '1' ? 3 : 10),
  CORS_ORIGINS: z.string().default('http://localhost:5173,https://localhost,http://localhost'),
});
export function readEnv() {
  const env = schema.parse(process.env);
  if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET || env.JWT_ACCESS_SECRET.startsWith('replace_') || env.JWT_REFRESH_SECRET.startsWith('replace_')) throw new Error('Configura secretos JWT diferentes y aleatorios con pnpm setup:local');
  return env;
}
