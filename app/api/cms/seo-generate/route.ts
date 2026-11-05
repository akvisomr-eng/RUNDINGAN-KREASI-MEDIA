import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/server';
import { hasPermission } from '@/lib/auth/permissions';
import { generateSeoMetadata } from '@/lib/cms/seo-agents';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (origin) {
    try {
      if (!host || new URL(origin).host !== host) {
        return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
    }
  }

  const { data } = await auth.getSession();
  const user = data?.user;
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await hasPermission(user.id, 'cms.seo.audit'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const input = {
    title: typeof body.title === 'string' ? body.title.trim().slice(0, 180) : '',
    slug: typeof body.slug === 'string' ? body.slug.trim().slice(0, 180) : '',
    content: typeof body.content === 'string' ? body.content.slice(0, 50000) : '',
    excerpt: typeof body.excerpt === 'string' ? body.excerpt.trim().slice(0, 1000) : '',
    seoTitle: typeof body.seoTitle === 'string' ? body.seoTitle.trim().slice(0, 70) : '',
    seoDescription: typeof body.seoDescription === 'string' ? body.seoDescription.trim().slice(0, 200) : '',
    focusKeyword: typeof body.focusKeyword === 'string' ? body.focusKeyword.trim().slice(0, 80) : '',
  };

  if (input.title.length < 3 || input.content.trim().length < 20) {
    return NextResponse.json({ error: 'Judul dan isi artikel minimal 20 karakter diperlukan.' }, { status: 400 });
  }

  return NextResponse.json({
    draft: generateSeoMetadata(input),
    saved: false,
    requiresEditorReview: true,
  });
}
