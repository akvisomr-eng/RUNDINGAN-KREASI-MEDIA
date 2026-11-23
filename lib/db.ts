import 'server-only';
import postgres from 'postgres';

let cachedClient: ReturnType<typeof postgres> | undefined;

/** Server-only PostgreSQL client for the Supabase connection pooler. */
export function getSql() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured. Set the Supabase PostgreSQL pooler connection string.');
  }

  let databaseUser: string;
  try {
    databaseUser = decodeURIComponent(new URL(connectionString).username).toLowerCase();
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL.');
  }
  if (!/^rundingan_runtime_web(?:\.[a-z0-9-]+)?$/.test(databaseUser)) {
    throw new Error('DATABASE_URL must use the dedicated rundingan_runtime_web login; project-owner and service_role credentials bypass tenant RLS.');
  }

  // Supabase's transaction pooler is the preferred endpoint for short-lived
  // serverless requests. Disabling prepared statements is required by PgBouncer.
  cachedClient ??= postgres(connectionString, {
    ssl: 'require',
    prepare: false,
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  return cachedClient;
}
