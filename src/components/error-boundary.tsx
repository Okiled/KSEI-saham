import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-nebula px-8 py-12">
          <div className="rounded-2xl border border-rose/20 bg-panel/60 p-8 text-center shadow-panel">
            <div className="text-4xl mb-3">⚠️</div>
            <h2 className="text-lg font-semibold text-foreground">Terjadi Kesalahan</h2>
            <p className="mt-2 max-w-md text-sm text-muted">
              {this.state.error?.message ?? "Aplikasi mengalami error yang tidak terduga."}
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.href = "/";
              }}
              className="mt-4 rounded-full border border-teal/30 bg-teal/5 px-5 py-2 text-sm font-medium text-teal transition-colors hover:bg-teal/10"
            >
              Kembali ke Home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
