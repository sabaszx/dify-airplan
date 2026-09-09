"use client";

import { useState, useCallback } from "react";

interface ConfirmState {
  message: string;
  resolve: (ok: boolean) => void;
}

/** Hook returning a `confirm(message)` that resolves true/false via a modal. */
export function useConfirm() {
  const [state, setState] = useState<ConfirmState | null>(null);

  const confirm = useCallback((message: string) => {
    return new Promise<boolean>((resolve) => setState({ message, resolve }));
  }, []);

  const dialog = state ? (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      role="dialog"
      aria-modal="true"
    >
      <div className="panel w-full max-w-sm p-5">
        <p className="mb-4 text-sm">{state.message}</p>
        <div className="flex justify-end gap-2">
          <button
            className="btn"
            onClick={() => {
              state.resolve(false);
              setState(null);
            }}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              state.resolve(true);
              setState(null);
            }}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, dialog };
}
