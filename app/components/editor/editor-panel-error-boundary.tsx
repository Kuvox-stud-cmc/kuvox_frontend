import { Component, type ErrorInfo, type ReactNode } from "react";

import { classifyEditorRecoveryError } from "~/lib/editor/editor-recovery";

import { EditorIcon } from "./editor-ui";

interface EditorPanelErrorBoundaryProps {
  label: string;
  children: ReactNode;
}

interface EditorPanelErrorBoundaryState {
  error: Error | null;
}

export class EditorPanelErrorBoundary extends Component<
  EditorPanelErrorBoundaryProps,
  EditorPanelErrorBoundaryState
> {
  state: EditorPanelErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): EditorPanelErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error(`Editor panel crashed: ${this.props.label}`, error, info.componentStack);
    }
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    const recovery = classifyEditorRecoveryError(this.state.error);

    return (
      <section
        data-editor-panel-error-boundary={this.props.label}
        className="flex min-h-[120px] min-w-0 flex-1 flex-col items-center justify-center border border-outline-variant bg-surface-container-lowest p-4 text-center text-on-surface"
      >
        <EditorIcon className="text-[28px] text-error">report</EditorIcon>
        <p className="mt-2 text-body-sm font-semibold">{this.props.label} stopped responding</p>
        <p className="mt-1 max-w-[320px] text-label-md text-on-surface-variant">
          {recovery.message}
        </p>
        <button
          type="button"
          onClick={() => this.setState({ error: null })}
          className="mt-3 inline-flex h-8 items-center gap-1 rounded-[4px] bg-primary px-3 text-label-md font-semibold text-on-primary hover:opacity-90"
        >
          <EditorIcon className="text-[16px]">refresh</EditorIcon>
          Retry panel
        </button>
      </section>
    );
  }
}
