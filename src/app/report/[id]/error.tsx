"use client";

import { useEffect } from "react";

/**
 * Route-level error boundary for the report route. Catches render/runtime errors
 * so a malformed snapshot never produces a blank/crashed page. Provides a
 * recoverable retry action. See override §7.2.
 */
export default function ReportError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[report] route error", { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-lg font-semibold">The report could not be displayed</h1>
      <p className="max-w-md text-sm text-base-muted">
        Something went wrong while rendering this report. Your project data was not changed.
      </p>
      <div className="flex gap-2">
        <button className="btn btn-primary" onClick={() => reset()}>
          Try again
        </button>
        <a className="btn" href="/">
          Back to projects
        </a>
      </div>
    </div>
  );
}
