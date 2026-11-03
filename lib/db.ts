import 'server-only';
import { neon } from '@neondatabase/serverless';

let cachedClient: ReturnType<typeof neon> | undefined;

export function getSql() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured.');
  }

  cachedClient ??= neon(connectionString);
  return cachedClient;
}
