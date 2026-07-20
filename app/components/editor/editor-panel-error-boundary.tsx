import { Component, type ErrorInfo, type ReactNode } from "react";

import { classifyEditorRecoveryError } from "~/lib/editor/editor-recovery";

import { EditorIcon } from "./editor-ui";

interface EditorPanelErrorBoundaryProps {
  label: string;
  children: ReactNode;
  autoRetryAttempts?: number;
  autoRetryDelayMs?: number;
  fallbackMessage?: string;
}

interface EditorPanelErrorBoundaryState {
  error: Error | null;
  retryCount: number;
}

export class EditorPanelErrorBoundary extends Component<
  EditorPanelErrorBoundaryProps,
  EditorPanelErrorBoundaryState
> {
  state: EditorPanelErrorBoundaryState = { error: null, retryCount: 0 };
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  static getDerivedStateFromError(error: Error): Partial<EditorPanelErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error(`Editor panel crashed: ${this.props.label}`, error, info.componentStack);
    }

    const attempts = Math.max(0, this.props.autoRetryAttempts ?? 0);
    if (this.state.retryCount >= attempts) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.setState((state) => ({
        error: null,
        retryCount: state.retryCount + 1,
      }));
    }, Math.max(0, this.props.autoRetryDelayMs ?? 200));
  }

  componentWillUnmount() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    const autoRetryAttempts = Math.max(0, this.props.autoRetryAttempts ?? 0);
    if (this.state.retryCount < autoRetryAttempts) {
      return (
        <section
          data-editor-panel-loading-recovery={this.props.label}
          aria-live="polite"
          className="flex min-h-[120px] min-w-0 flex-1 flex-col items-center justify-center border border-outline-variant bg-surface-container-lowest p-4 text-center text-on-surface"
        >
          <EditorIcon className="animate-spin text-[30px] text-primary motion-reduce:animate-none">
            progress_activity
          </EditorIcon>
          <p className="mt-3 text-body-sm font-semibold">Loading {this.props.label.toLowerCase()}</p>
          <p className="mt-1 text-label-md text-on-surface-variant">Restoring the panel state.</p>
        </section>
      );
    }

    const recovery = classifyEditorRecoveryError(this.state.error);
    const fallbackMessage = this.props.fallbackMessage ?? recovery.message;

    return (
      <section
        data-editor-panel-error-boundary={this.props.label}
        className="flex min-h-[120px] min-w-0 flex-1 flex-col items-center justify-center border border-outline-variant bg-surface-container-lowest p-4 text-center text-on-surface"
      >
        <EditorIcon className="text-[28px] text-error">report</EditorIcon>
        <p className="mt-2 text-body-sm font-semibold">{this.props.label} stopped responding</p>
        <p className="mt-1 max-w-[320px] text-label-md text-on-surface-variant">
          {fallbackMessage}
        </p>
        <button
          type="button"
          onClick={() => this.setState({ error: null, retryCount: 0 })}
          className="mt-3 inline-flex h-8 items-center gap-1 rounded-[4px] bg-primary px-3 text-label-md font-semibold text-on-primary hover:opacity-90"
        >
          <EditorIcon className="text-[16px]">refresh</EditorIcon>
          Retry panel
        </button>
      </section>
    );
  }
}
