import { Component, type ErrorInfo, type ReactNode } from "react";

import { toAppError, type AppError } from "@/lib/errors/app-error";
import { reportError } from "@/lib/errors/report";

/**
 * Error boundary for React-owned routes (Phase 0D).
 *
 * Scope is deliberately narrow: it catches render/lifecycle throws inside the
 * React tree, reports one structured record with a correlation reference, and
 * offers the two recoveries that are always safe — retry the render, or reload.
 * It does not attempt to wrap or rewrite the imperative prototype runtime;
 * that layer is protected by `guardMount` instead.
 */

interface Props {
  children: ReactNode;
  /** Named so the record says which area failed. */
  area?: string;
}

interface State {
  error: AppError | null;
}

export class RouteErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(): Partial<State> {
    /* Placeholder: the classified error is attached in componentDidCatch, which
       is also where reporting happens exactly once. */
    return {};
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    const app = toAppError(error, {
      operation: `render:${this.props.area ?? "route"}`,
      category: "navigation",
      code: "render_failed",
      severity: "high",
      userMessage: "This screen didn't load. Your saved work is unaffected.",
      context: { componentStack: String(info?.componentStack ?? "").slice(0, 400) },
    });
    reportError(app, { operation: app.operation });
    this.setState({ error: app });
  }

  private reset = () => this.setState({ error: null });

  private reload = () => {
    if (typeof window !== "undefined") window.location.reload();
  };

  override render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div
        role="alert"
        style={{
          minHeight: "60vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          fontFamily: "'DM Sans', system-ui, sans-serif",
        }}
      >
        <div style={{ maxWidth: 440, textAlign: "center" }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 8px" }}>
            This Screen Didn't Load
          </h1>
          <p style={{ margin: "0 0 6px", color: "#4a4a4a", fontSize: 14.5, lineHeight: 1.5 }}>
            {error.userMessage}
          </p>
          <p style={{ margin: "0 0 20px", color: "#8a8a8a", fontSize: 12.5 }}>
            Reference {error.correlationId}
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button
              type="button"
              onClick={this.reset}
              style={{
                border: 0,
                borderRadius: 999,
                background: "#CC0000",
                color: "#fff",
                padding: "10px 22px",
                fontWeight: 700,
                fontSize: 13.5,
                cursor: "pointer",
              }}
            >
              Try Again
            </button>
            <button
              type="button"
              onClick={this.reload}
              style={{
                border: "1px solid rgba(0,0,0,.16)",
                borderRadius: 999,
                background: "transparent",
                padding: "10px 22px",
                fontWeight: 600,
                fontSize: 13.5,
                cursor: "pointer",
              }}
            >
              Reload Page
            </button>
          </div>
        </div>
      </div>
    );
  }
}
