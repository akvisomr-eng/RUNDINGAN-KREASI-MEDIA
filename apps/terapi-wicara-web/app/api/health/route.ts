import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Kesehatan sistem + status penjadwal agen.
 *
 * Sebelumnya endpoint ini hanya melaporkan bahwa proses hidup. Itu tidak
 * menjawab pertanyaan yang sebenarnya penting bagi operator klinik: "apakah
 * agen AI benar-benar bekerja, atau hanya diam?" Sekarang endpoint ini
 * melaporkan denyut nadi penjadwal dari basis data.
 */

async function schedulerStatus() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SECRET_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    return { available: false, reason: 'Supabase belum dikonfigurasi' };
  }

  try {
    const res = await fetch(`${url}/rest/v1/rpc/tw_ai_scheduler_status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: '{}',
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) {
      return { available: false, reason: `RPC gagal (HTTP ${res.status})` };
    }

    const data = (await res.json()) as Record<string, unknown>;
    return { available: true, ...data };
  } catch (e) {
    return { available: false, reason: (e as Error).message };
  }
}

export async function GET() {
  const scheduler = await schedulerStatus();

  return NextResponse.json({
    status: 'healthy',
    module: 'terapi-wicara-web-and-simklinik',
    regulations: [
      'UU No. 17 Tahun 2023 tentang Kesehatan',
      'UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP)',
      'Permenkes No. 24 Tahun 2022 tentang Rekam Medis Elektronik & SATUSEHAT',
      'Permenkes No. 81 Tahun 2014 tentang Standar Pelayanan Terapi Wicara',
      'Permenkes No. 34 Tahun 2022 tentang Akreditasi Klinik',
    ],
    supabaseConfigured: Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ),
    scheduler,
    timestamp: new Date().toISOString(),
  });
}
