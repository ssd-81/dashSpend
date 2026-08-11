import { Component, type ErrorInfo, type ReactNode } from "react";
import { WarningCircle } from "@phosphor-icons/react";
import { Button } from "./ui";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches render errors anywhere below it and shows a recoverable page
 * instead of letting React unmount the tree to a blank screen.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled render error:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-[100dvh] items-center justify-center bg-surface px-4 py-10">
          <div className="w-full max-w-sm rounded-xl border border-line bg-panel p-6 text-center shadow-sm shadow-black/[0.03]">
            <WarningCircle size={30} weight="fill" className="mx-auto text-bad" aria-hidden />
            <h1 className="mt-3 text-base font-semibold tracking-tight text-ink">Something went wrong</h1>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-3">
              This page hit an unexpected error. Reload to continue — your data is safe.
            </p>
            <Button
              variant="primary"
              className="mt-5 w-full"
              onClick={() => window.location.reload()}
            >
              Reload page
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
