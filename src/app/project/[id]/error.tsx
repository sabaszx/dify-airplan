"use client";

import { useEffect } from "react";

/**
 * Route-level error boundary for the project editor. A malformed project, floor,
 * catalog, or antenna-pattern record produces a recoverable error screen rather
 * than an unhandled client exception that blanks the app. See override §7.2.
 */
export default function ProjectError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[editor] route error", { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-lg font-semibold">The editor hit a problem</h1>
      <p className="max-w-md text-sm text-base-muted">
        This project could not be opened. It may contain incomplete or unsupported data. Your saved
        data was not modified.
      </p>
      <div className="flex gap-2">
        <button className="btn btn-primary" onClick={() => reset()}>
          Retry
        </button>
        <a className="btn" href="/">
          Back to projects
        </a>
      </div>
    </div>
  );
}
