import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  /**
   * Optional fallback to render instead of the default error UI.
   * Receives the error and a reset callback.
   */
  fallback?: (error: Error, reset: () => void) => ReactNode;
  /**
   * Scope label shown in the error UI and logged to console.
   * Use to identify which part of the tree caught the error.
   * e.g. "Dashboard", "Chat", "PlanDetail"
   */
  scope?: string;
}

interface State {
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const scope = this.props.scope ?? 'App';
    console.error(`[ErrorBoundary:${scope}]`, error, errorInfo);
    this.setState({ errorInfo });
  }

  reset = () => {
    this.setState({ error: null, errorInfo: null });
  };

  render() {
    const { error } = this.state;
    const { children, fallback, scope } = this.props;

    if (error) {
      if (fallback) return fallback(error, this.reset);

      return (
        <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="rounded-full bg-destructive/10 p-4">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              {scope ? `${scope} ran into a problem` : 'Something went wrong'}
            </p>
            <p className="max-w-xs text-xs text-muted-foreground">
              {error.message || 'An unexpected error occurred.'}
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={this.reset} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              Try again
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { window.location.href = '/'; }} className="gap-1.5">
              <Home className="h-3.5 w-3.5" />
              Go home
            </Button>
          </div>
        </div>
      );
    }

    return children;
  }
}
