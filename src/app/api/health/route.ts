import { NextResponse } from "next/server";

/**
 * Liveness probe. Returns 200 when the process is up. No dependency checks here
 * so a transient dependency outage does not cause restarts. See
 * steering/observability.md.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    {
      status: "ok",
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    },
    { status: 200 },
  );
}
