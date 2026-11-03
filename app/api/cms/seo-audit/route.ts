import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/server';
import { runSeoAgents } from '@/lib/cms/seo-agents';

export async function POST(request: Request) {
  const { data } = await auth.getSession();
  if (!data?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const input = {
    title: typeof body.title === 'string' ? body.title : '',
    slug: typeof body.slug === 'string' ? body.slug : '',
    content: typeof body.content === 'string' ? body.content : '',
    seoTitle: typeof body.seoTitle === 'string' ? body.seoTitle : '',
    seoDescription: typeof body.seoDescription === 'string' ? body.seoDescription : '',
    focusKeyword: typeof body.focusKeyword === 'string' ? body.focusKeyword : '',
  };

  if (!input.title.trim() || !input.content.trim()) {
    return NextResponse.json({ error: 'Title and content are required for an SEO audit.' }, { status: 400 });
  }

  return NextResponse.json({ report: runSeoAgents(input) });
}
