import { NextResponse } from 'next/server';

export async function GET() {
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
    timestamp: new Date().toISOString(),
  });
}
