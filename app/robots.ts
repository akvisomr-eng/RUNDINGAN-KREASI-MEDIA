import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/cms', '/api/'] }],
    sitemap: 'https://rundingan-kreasi-media.vercel.app/sitemap.xml',
  };
}
