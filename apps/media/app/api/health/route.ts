import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const checks = {
    application: "ok",
    databaseConfigured: Boolean(process.env.DATABASE_URL),
    enterpriseCoreConfigured: Boolean(
      process.env.CORE_API_BASE_URL && process.env.CORE_SERVICE_TOKEN,
    ),
  };

  return NextResponse.json(
    {
      service: "rundingan-media",
      status: "ok",
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
