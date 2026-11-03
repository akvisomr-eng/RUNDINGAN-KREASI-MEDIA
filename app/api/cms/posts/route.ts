import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/server';
import { hasPermission } from '@/lib/auth/permissions';
import { getSql } from '@/lib/db';

export const dynamic = 'force-dynamic';

async function currentUser() {
  const { data } = await auth.getSession();
  return data?.user ?? null;
}

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await hasPermission(user.id, 'cms.posts.read'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const sql = getSql();
    const posts = (await sql`
      SELECT id, title, slug, excerpt, status, seo_title, seo_description,
             focus_keyword, created_at, updated_at, published_at
      FROM cms_posts
      ORDER BY updated_at DESC
      LIMIT 100
    `) as unknown as Array<Record<string, unknown>>;
    return NextResponse.json({ posts });
  } catch {
    return NextResponse.json({ error: 'CMS database is not ready. Apply the custom CMS migration first.' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await hasPermission(user.id, 'cms.posts.create'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const content = typeof body.content === 'string' ? body.content : '';
  const excerpt = typeof body.excerpt === 'string' ? body.excerpt.trim() : '';
  const focusKeyword = typeof body.focusKeyword === 'string' ? body.focusKeyword.trim() : '';
  const seoTitle = typeof body.seoTitle === 'string' ? body.seoTitle.trim() : '';
  const seoDescription = typeof body.seoDescription === 'string' ? body.seoDescription.trim() : '';
  const requestedSlug = typeof body.slug === 'string' ? body.slug : title;
  const slug = requestedSlug.toLowerCase().normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '').slice(0, 180);

  if (title.length < 3 || title.length > 180 || !slug || content.trim().length < 20) {
    return NextResponse.json({ error: 'Title (3–180 chars), a valid slug, and content (at least 20 chars) are required.' }, { status: 400 });
  }

  try {
    const sql = getSql();
    const rows = (await sql`
      INSERT INTO cms_posts
        (title, slug, excerpt, content, seo_title, seo_description, focus_keyword, created_by, updated_by)
      VALUES
        (${title}, ${slug}, ${excerpt}, ${content}, ${seoTitle}, ${seoDescription}, ${focusKeyword},
         ${String(user.id)}, ${String(user.id)})
      RETURNING id, title, slug, status, created_at, updated_at
    `) as unknown as Array<Record<string, unknown>>;
    return NextResponse.json({ post: rows[0] }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error && error.message.toLowerCase().includes('unique')
      ? 'Slug already exists. Choose a different slug.'
      : 'Could not save the draft. Confirm that the CMS migration has been applied.';
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
