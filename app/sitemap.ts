import type { MetadataRoute } from 'next';
import { getSql } from '@/lib/db';
import { SITE_URL } from '@/lib/site-url';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = SITE_URL;
  const entries: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
  ];

  try {
    const sql = getSql();
    const posts = (await sql`
      SELECT slug, updated_at
      FROM cms_posts
      WHERE status = 'published'
      ORDER BY published_at DESC
    `) as unknown as Array<{ slug: string; updated_at: string | Date }>;
    entries.push(...posts.map((post) => ({
      url: `${baseUrl}/artikel/${post.slug}`,
      lastModified: new Date(post.updated_at),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })));
  } catch {
    // Keep the homepage discoverable while the additive CMS migration is pending.
  }

  return entries;
}
