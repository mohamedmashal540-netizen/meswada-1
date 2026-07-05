import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/common/GlassCard";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Catches uncaught render/lifecycle errors anywhere below it in the tree
 * and shows a recoverable fallback instead of a fully blank/broken page.
 *
 * Note: error boundaries only catch errors during rendering, lifecycle
 * methods, and constructors of the tree below them — not errors inside
 * event handlers, async code, or server-side rendering. Those still need
 * their own try/catch (which most of this app's fetch calls already have).
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // In a real deployment this is where you'd forward to an error
    // tracking service (Sentry, etc). For now, log to the console.
    console.error("Uncaught application error:", error, errorInfo);
  }

  private handleReload = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center p-4">
          <GlassCard className="max-w-md space-y-4 p-8 text-center">
            <h1 className="text-lg font-semibold">Something went wrong</h1>
            <p className="text-sm text-muted-foreground">
              An unexpected error occurred. You can try reloading the page.
            </p>
            <Button onClick={this.handleReload}>Reload page</Button>
          </GlassCard>
        </div>
      );
    }

    return this.props.children;
  }
}
