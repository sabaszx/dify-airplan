"use client";

/**
 * Global error boundary — last-resort catch for the whole app so an uncaught
 * client exception renders a recoverable screen instead of a blank page.
 * See override §7.2.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, Segoe UI, Roboto, sans-serif",
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 12,
          background: "#0f1420",
          color: "#e6ebf5",
          textAlign: "center",
          padding: 24,
        }}
      >
        <h1 style={{ fontSize: 18 }}>Something went wrong</h1>
        <p style={{ maxWidth: 420, fontSize: 14, color: "#9aa7bd" }}>
          The application encountered an unexpected error. You can try again; your saved projects
          are unaffected.
        </p>
        {error?.digest && (
          <p style={{ fontSize: 11, color: "#5b6577" }}>Reference: {error.digest}</p>
        )}
        <button
          onClick={() => reset()}
          style={{
            border: "1px solid #273043",
            background: "#3b82f6",
            color: "#fff",
            borderRadius: 6,
            padding: "6px 14px",
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Reload
        </button>
      </body>
    </html>
  );
}
