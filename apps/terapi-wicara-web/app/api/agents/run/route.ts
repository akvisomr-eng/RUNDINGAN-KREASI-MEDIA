import { NextResponse } from 'next/server';
import {
  AGENT_KEYS,
  AgentKey,
  claimAndRun,
  getAgentHealth,
  prepareCycle,
} from '../../../../src/lib/ai/agentRuntime';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Endpoint orkestrasi agen AI.
 *
 * POST /api/agents/run
 *   body: { "agents": ["AGEN_KEAMANAN","AGEN_PENGUJI"] }
 *   - Tanpa body: menjalankan SEMUA agen berurutan (siklus penuh).
 *   - Dapat dipanggil oleh cron eksternal (GitHub Actions / Vercel Cron).
 *
 * GET /api/agents/run   → daftar agen yang tersedia + status kesiapan.
 */

function authorized(req: Request): boolean {
  const secret = process.env.AGENT_RUNNER_SECRET;
  if (!secret) return true; // belum dikonfigurasi: izinkan agar mudah diuji
  const header = req.headers.get('authorization') ?? '';
  return header === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  // Vercel Cron memanggil endpoint ini dengan GET setiap 2 jam & harian.
  if (req.headers.get('x-vercel-cron') === '1' || req.headers.get('user-agent')?.includes('vercel-cron')) {
    return runCycle([...AGENT_KEYS]);
  }

  const health = await getAgentHealth();

  return NextResponse.json({
    status: 'ok',
    agents: AGENT_KEYS,
    health,
    ready: Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
        (process.env.SUPABASE_SERVICE_ROLE_KEY ||
          process.env.SUPABASE_SECRET_KEY ||
          process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
    ),
    usage: 'POST dengan body {"agents":["AGEN_KEAMANAN"]} atau kosong untuk siklus penuh.',
  });
}

async function runCycle(requested: AgentKey[], dispatchFirst = true) {
  // Langkah 1 — penjadwal otonom: daftarkan tugas agen yang jatuh tempo dan
  // bersihkan tugas menggantung. Inilah yang membedakan sistem yang benar-benar
  // berjalan sendiri dari sistem yang menunggu tombol manusia.
  const prepared = dispatchFirst ? await prepareCycle(true) : null;

  const results = [];
  for (const key of requested) {
    const fromQueue = await claimAndRun(key);
    results.push(
      fromQueue ?? {
        agent: key,
        status: 'DILEWATI',
        summary: 'Tidak ada tugas ANTREAN untuk agen ini pada siklus ini.',
      }
    );
  }

  const executed = results.filter((r) => r.status === 'SELESAI').length;
  const failed = results.filter((r) => r.status === 'GAGAL').length;

  return NextResponse.json({
    status: 'ok',
    executed_at: new Date().toISOString(),
    prepared,
    summary: {
      dispatched: prepared?.dispatched ?? 0,
      executed,
      failed,
      skipped: results.length - executed - failed,
      expired_tasks_cleaned: prepared?.expiredTasks ?? 0,
    },
    results,
  });
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Tidak berwenang' }, { status: 401 });
  }

  let requested: AgentKey[] = [...AGENT_KEYS];
  try {
    const body = await req.json();
    if (Array.isArray(body?.agents) && body.agents.length) {
      requested = body.agents.filter((a: string) => (AGENT_KEYS as readonly string[]).includes(a));
    }
  } catch {
    /* body kosong — jalankan semua */
  }

  return runCycle(requested);
}
