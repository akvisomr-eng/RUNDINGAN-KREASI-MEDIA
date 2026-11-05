const DEFAULT_SITE_URL = 'https://rundingan-kreasi-media.vercel.app';

function normalizeSiteUrl(value?: string) {
  if (!value?.trim()) return DEFAULT_SITE_URL;
  try {
    return new URL(value.trim()).origin;
  } catch {
    return DEFAULT_SITE_URL;
  }
}

/**
 * Canonical public origin for all website SEO URLs.
 * Set NEXT_PUBLIC_SITE_URL to the verified custom domain when it is configured.
 */
export const SITE_URL = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
