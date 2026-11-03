import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getSql } from '@/lib/db';

export const dynamic = 'force-dynamic';

type Article = {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  seo_title: string;
  seo_description: string;
  published_at: string | null;
};

async function getArticle(slug: string): Promise<Article | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT title, slug, excerpt, content, seo_title, seo_description, published_at
    FROM cms_posts
    WHERE slug = ${slug} AND status = 'published'
    LIMIT 1
  `;
  return (rows[0] as Article | undefined) ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) return { title: 'Artikel tidak ditemukan | Rundingan Kreasi Media', robots: { index: false, follow: false } };

  const title = article.seo_title || article.title;
  const description = article.seo_description || article.excerpt;
  const canonical = `https://rundingan-kreasi-media.vercel.app/artikel/${article.slug}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { type: 'article', title, description, url: canonical, publishedTime: article.published_at || undefined },
    twitter: { card: 'summary_large_image', title, description },
    robots: { index: true, follow: true },
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) notFound();

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.seo_description || article.excerpt,
    datePublished: article.published_at,
    publisher: { '@type': 'Organization', name: 'Rundingan Kreasi Media' },
    mainEntityOfPage: `https://rundingan-kreasi-media.vercel.app/artikel/${article.slug}`,
  };

  return (
    <main className="article-shell">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }} />
      <a className="article-back" href="/">← RUNDINGAN KREASI MEDIA</a>
      <article>
        <p className="article-kicker">RUNDINGAN / INSIGHT & STORIES</p>
        <h1>{article.title}</h1>
        {article.excerpt && <p className="article-excerpt">{article.excerpt}</p>}
        <div className="article-body">{article.content}</div>
      </article>
    </main>
  );
}
