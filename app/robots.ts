import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site-url';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/auth/', '/workspace/', '/admin/', '/cms/'] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
