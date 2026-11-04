import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/server';
import { hasPermission } from '@/lib/auth/permissions';
import { getSql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const origin = request.headers.get('origin');
  const requestHost = request.headers.get('host');
  if (origin) {
    try {
      if (!requestHost || new URL(origin).host !== requestHost) {
        return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
    }
  }

  const { data } = await auth.getSession();
  const user = data?.user;
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!(await hasPermission(user.id, 'cms.posts.publish'))) {
    return NextResponse.json({ error: 'Forbidden', message: 'Izin publikasi artikel belum diberikan.' }, { status: 403 });
  }

  const { id } = await context.params;
  try {
    const sql = getSql();
    const rows = (await sql`
      WITH published AS (
        UPDATE cms_posts
        SET status = 'published',
            published_at = COALESCE(published_at, NOW()),
            updated_at = NOW(),
            updated_by = ${String(user.id)}
        WHERE id = ${id}::uuid
          AND status IN ('draft', 'review')
          AND length(trim(title)) >= 3
          AND length(trim(content)) >= 20
        RETURNING id, title, slug, status, published_at, updated_at
      ),
      audit AS (
        INSERT INTO audit_logs (
          organization_id, actor_user_id, action, resource_type, resource_id, after_data
        )
        SELECT
          o.id, ${String(user.id)}, 'publish', 'cms_post', p.id::text,
          jsonb_build_object('title', p.title, 'slug', p.slug, 'status', p.status)
        FROM organizations o
        CROSS JOIN published p
        WHERE o.slug = 'rundingan-kreasi-media'
        RETURNING id
      )
      SELECT id, title, slug, status, published_at, updated_at
      FROM published
    `) as unknown as Array<Record<string, unknown>>;

    if (!rows.length) {
      return NextResponse.json({
        error: 'Artikel tidak ditemukan, sudah dipublikasikan, atau belum memenuhi syarat minimum isi artikel.',
      }, { status: 409 });
    }

    return NextResponse.json({ post: rows[0] });
  } catch {
    return NextResponse.json({ error: 'Artikel gagal dipublikasikan. Periksa koneksi database dan hak akses CMS.' }, { status: 503 });
  }
}
