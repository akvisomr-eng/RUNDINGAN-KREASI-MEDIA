import { NextResponse } from 'next/server';
import { getSql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const timestamp = new Date().toISOString();

  try {
    const sql = getSql();
    await sql`SELECT 1`;

    return NextResponse.json({
      status: 'ok',
      service: 'rundingan-kreasi-media',
      checks: { database: 'ok' },
      timestamp,
    });
  } catch {
    return NextResponse.json(
      {
        status: 'error',
        service: 'rundingan-kreasi-media',
        checks: { database: 'unavailable' },
        timestamp,
      },
      { status: 503 },
    );
  }
}
