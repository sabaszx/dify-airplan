import { NextResponse } from "next/server";

/**
 * Readiness probe. Reports whether the app is ready to serve traffic, checking
 * configured dependencies. In the client-persisted MVP there are no required
 * runtime dependencies, so it reports ready and lists optional dependency status
 * for observability. See steering/observability.md.
 */
export const dynamic = "force-dynamic";

interface DependencyStatus {
  name: string;
  configured: boolean;
  required: boolean;
}

export function GET() {
  const checks: DependencyStatus[] = [
    { name: "database", configured: Boolean(process.env.DATABASE_URL), required: false },
    { name: "object-storage", configured: Boolean(process.env.STORAGE_BUCKET), required: false },
    { name: "auth", configured: Boolean(process.env.AUTH_SECRET), required: false },
  ];
  const ready = checks.every((c) => !c.required || c.configured);
  return NextResponse.json(
    { status: ready ? "ready" : "not-ready", checks, timestamp: new Date().toISOString() },
    { status: ready ? 200 : 503 },
  );
}
