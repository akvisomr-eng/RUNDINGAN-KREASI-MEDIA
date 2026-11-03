import { NextResponse } from 'next/server';
export function GET() {
  return NextResponse.json({ status: 'ok', service: 'rundingan-kreasi-media', timestamp: new Date().toISOString() });
}
