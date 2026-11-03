import type { MetadataRoute } from 'next';
import { getSql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://rundingan-kreasi-media.vercel.app';
  const sql = getSql();
  const posts = await sql`
    SELECT slug, updated_at, published_at
    FROM cms_posts
    WHERE status = 'published'
    ORDER BY published_at DESC
  `;
  return [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    ...posts.map(post => ({
      url: `${baseUrl}/artikel/${post.slug}`,
      lastModified: new Date(String(post.updated_at)),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
  ];
}
