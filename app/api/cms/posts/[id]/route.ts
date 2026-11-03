import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/server';
import { hasPermission } from '@/lib/auth/permissions';
import { getSql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { data } = await auth.getSession();
  const user = data?.user;
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await hasPermission(user.id, 'cms.posts.update'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await context.params;
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
    return NextResponse.json({ error: 'Title, slug, and content are required.' }, { status: 400 });
  }

  try {
    const sql = getSql();
    const rows = (await sql`
      UPDATE cms_posts
      SET title = ${title}, slug = ${slug}, excerpt = ${excerpt}, content = ${content},
          seo_title = ${seoTitle}, seo_description = ${seoDescription},
          focus_keyword = ${focusKeyword}, updated_by = ${String(user.id)}, updated_at = NOW()
      WHERE id = ${id}::uuid AND created_by = ${String(user.id)} AND status = 'draft'
      RETURNING id, title, slug, status, updated_at
    `) as unknown as Array<Record<string, unknown>>;
    if (!rows.length) return NextResponse.json({ error: 'Draft not found or you do not own permission to edit it.' }, { status: 404 });
    return NextResponse.json({ post: rows[0] });
  } catch {
    return NextResponse.json({ error: 'Could not update the draft. Check the CMS migration and slug uniqueness.' }, { status: 409 });
  }
}
