import 'server-only';
import { createNeonAuth } from '@neondatabase/auth/next/server';

type NeonAuthInstance = ReturnType<typeof createNeonAuth>;

let authInstance: NeonAuthInstance | undefined;

function getAuthInstance(): NeonAuthInstance {
  const baseUrl = process.env.NEON_AUTH_BASE_URL;
  const cookieSecret = process.env.NEON_AUTH_COOKIE_SECRET;

  if (!baseUrl) {
    throw new Error('NEON_AUTH_BASE_URL is not configured.');
  }
  if (!cookieSecret || cookieSecret.length < 32) {
    throw new Error('NEON_AUTH_COOKIE_SECRET must contain at least 32 characters.');
  }

  authInstance ??= createNeonAuth({
    baseUrl,
    cookies: { secret: cookieSecret, sessionDataTtl: 300 },
  });

  return authInstance;
}

// Defer environment validation until an auth method is actually used.
// This prevents Next.js from failing while collecting route metadata at build time.
export const auth = new Proxy({} as NeonAuthInstance, {
  get(_target, property) {
    const instance = getAuthInstance();
    const value = Reflect.get(instance, property, instance);
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});
