import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
const stages = ['idea', 'planned', 'drafting', 'review', 'approved_for_cms'] as const;
type Stage = typeof stages[number];
const toWorkStatus: Record<Stage, string> = {
  idea: 'draft', planned: 'in_progress', drafting: 'review', review: 'approved', approved_for_cms: 'completed'
};
const fromWorkStatus: Record<string, Stage> = {
  draft: 'idea', in_progress: 'planned', review: 'drafting', approved: 'review', completed: 'approved_for_cms'
};
const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });
function parseBrief(raw: unknown) {
  if (typeof raw !== 'string') return {};
  try { return JSON.parse(raw) as Record<string, unknown>; } catch { return { summary: raw }; }
}
function normalize(item: Record<string, unknown>) {
  const brief = parseBrief(item.description);
  return {
    id: item.id, reference_no: item.reference_no, title: item.title,
    description: typeof brief.summary === 'string' ? brief.summary : '',
    due_date: item.due_date, status: item.status, updated_at: item.updated_at,
    metadata: {
      ...((item.metadata && typeof item.metadata === 'object') ? item.metadata as Record<string, unknown> : {}),
      ...brief, seo_status: fromWorkStatus[String(item.status)] || 'idea'
    }
  };
}
async function forward(request: Request, method: string, body?: unknown) {
  const url = new URL('/api/admin/media', request.url);
  const headers = new Headers();
  const cookie = request.headers.get('cookie');
  const origin = request.headers.get('origin');
  if (cookie) headers.set('cookie', cookie);
  if (origin) headers.set('origin', origin);
  if (body !== undefined) headers.set('content-type', 'application/json');
  return fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store' });
}
export async function GET(request: Request) {
  const response = await forward(request, 'GET');
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return fail(data.error || 'Tidak dapat memuat rencana SEO.', response.status);
  const items = Array.isArray(data.workItems) ? data.workItems : [];
  const plans = items.filter((item: Record<string, unknown>) => item.category === 'SEO Content Plan').map(normalize);
  return NextResponse.json({ plans });
}
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return fail('Invalid JSON body.'); }
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 180) : '';
  const summary = typeof body.description === 'string' ? body.description.trim().slice(0, 1000) : '';
  const keyword = typeof body.focus_keyword === 'string' ? body.focus_keyword.trim().slice(0, 120) : '';
  const intent = typeof body.search_intent === 'string' ? body.search_intent : 'informational';
  const priority = typeof body.priority === 'string' ? body.priority : 'normal';
  const effort = typeof body.effort === 'string' ? body.effort : 'medium';
  const date = typeof body.proposed_publish_date === 'string' ? body.proposed_publish_date : '';
  if (title.length < 3 || !summary || !keyword || !['informational','commercial','transactional','navigational'].includes(intent) ||
      !['low','normal','high'].includes(priority) || !['low','medium','high'].includes(effort) ||
      (date && !/^\d{4}-\d{2}-\d{2}$/.test(date))) return fail('Periksa kembali topik, ringkasan, keyword, intent, prioritas, usaha, dan tanggal.');
  const brief = {
    workflow: 'website_seo_planner', summary, focus_keyword: keyword, search_intent: intent,
    topic_cluster: body.topic_cluster || '', pillar_topic: body.pillar_topic || '',
    priority, effort, business_relevance: body.business_relevance || '',
    internal_link_opportunities: body.internal_link_opportunities || ''
  };
  const response = await forward(request, 'POST', {
    action: 'create_work_item', title, category: 'SEO Content Plan',
    description: JSON.stringify(brief), due_date: date || null, budget_amount: 0,
    content_pillar: String(body.topic_cluster || '').slice(0, 120),
    content_goal: intent, target_audience: String(body.target_audience || '').slice(0, 300),
    editorial_stage: 'idea', delivery_format: effort, scheduled_at: date,
    publishing_mode: 'website_only'
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return fail(data.error || 'Rencana gagal disimpan.', response.status);
  return NextResponse.json({ plan: normalize(data.workItem || {}) }, { status: 201 });
}
export async function PATCH(request: Request) {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return fail('Invalid JSON body.'); }
  const id = typeof body.id === 'string' ? body.id : '';
  const stage = typeof body.seo_status === 'string' ? body.seo_status as Stage : 'idea';
  if (!id || !stages.includes(stage)) return fail('ID atau status rencana tidak valid.');
  const response = await forward(request, 'POST', { action: 'work_item_status', work_item_id: id, status: toWorkStatus[stage] });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return fail(data.error || 'Status rencana gagal diperbarui.', response.status);
  return NextResponse.json({ plan: data.workItem ? normalize(data.workItem) : null });
}
