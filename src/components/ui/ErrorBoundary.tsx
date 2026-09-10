"use client";

import { Component, type ReactNode } from "react";

/**
 * Reusable client error boundary for wrapping self-contained subtrees (e.g. the
 * editor canvas or the 3D view). A failure inside `children` renders `fallback`
 * instead of crashing the whole page. See override §7.2 (3D failure must not
 * crash the app). Original component.
 */
interface Props {
  children: ReactNode;
  /** Fallback UI; receives the error and a reset callback. */
  fallback: (error: Error, reset: () => void) => ReactNode;
  /** Optional label used in structured logging. */
  label?: string;
  /** Called once when an error is captured (for structured reporting). */
  onError?: (error: Error) => void;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error): void {
    // Structured, sensitive-data-free log.
    console.error("[error-boundary]", {
      label: this.props.label ?? "unknown",
      message: error.message,
    });
    this.props.onError?.(error);
  }

  reset = (): void => this.setState({ error: null });

  render(): ReactNode {
    if (this.state.error) return this.props.fallback(this.state.error, this.reset);
    return this.props.children;
  }
}
