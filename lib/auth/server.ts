import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getSupabaseEnv } from '@/lib/supabase/env';

export type AppUser = {
  id: string;
  email: string | null;
  name: string | null;
  user_metadata: Record<string, unknown>;
};

export async function createSupabaseServerClient() {
  const { url, publishableKey } = getSupabaseEnv();
  const cookieStore = await cookies();
  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot write cookies. The proxy refreshes sessions.
        }
      },
    },
  });
}

/** Compatibility-shaped, verified session accessor used by existing server routes. */
export const auth = {
  async getSession() {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    const raw = data.user;
    const user: AppUser | null = raw ? {
      id: raw.id,
      email: raw.email ?? null,
      name: typeof raw.user_metadata?.full_name === 'string'
        ? raw.user_metadata.full_name
        : typeof raw.user_metadata?.name === 'string'
          ? raw.user_metadata.name
          : raw.email ?? null,
      user_metadata: (raw.user_metadata ?? {}) as Record<string, unknown>,
    } : null;
    return { data: { user }, error };
  },
};
