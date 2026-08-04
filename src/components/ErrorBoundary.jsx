import React from 'react';
import { AlertTriangle, RefreshCw, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { isDevMode, logError, friendlyError } from '@/lib/safeMessages';

// Global error boundary enforcing Customer Safe Mode: customers see a clear,
// friendly message with an internal error id and an optional "Report Problem"
// action. Developer mode additionally shows the technical stack.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null, errorId: null };
  }

  static getDerivedStateFromError(error) {
    return { error, errorId: 'ERR-' + Math.random().toString(36).slice(2, 8).toUpperCase() };
  }

  componentDidCatch(error, info) {
    logError(error, 'react-error-boundary', this.state.errorId);
    this.setState({ info });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReport = () => {
    toast({
      title: 'Problem reported',
      description: `Thanks — your report has been logged. Reference: ${this.state.errorId}`,
      type: 'success',
    });
  };

  render() {
    if (!this.state.error) return this.props.children;

    const dev = isDevMode(this.props.user);
    const friendly = friendlyError(this.state.error, 'render');

    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
        <div className="max-w-md w-full rounded-xl border bg-white p-8 shadow-lg text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-rose-50 flex items-center justify-center mb-4">
            <AlertTriangle className="w-6 h-6 text-rose-600" />
          </div>
          <h1 className="text-lg font-semibold text-foreground">{friendly.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{friendly.description}</p>
          <p className="mt-4 text-[11px] text-muted-foreground">
            Reference: <span className="font-mono">{this.state.errorId}</span>
          </p>
          <div className="mt-6 flex items-center justify-center gap-2">
            <Button onClick={this.handleReload} variant="default" size="sm">
              <RefreshCw className="w-4 h-4" />
              Try again
            </Button>
            <Button onClick={this.handleReport} variant="outline" size="sm">
              <Send className="w-4 h-4" />
              Report problem
            </Button>
          </div>
          {dev && (
            <details className="mt-6 text-left">
              <summary className="text-xs font-medium text-muted-foreground cursor-pointer">
                Technical details (developer mode)
              </summary>
              <pre className="mt-2 p-3 rounded-md bg-muted text-[11px] font-mono overflow-auto max-h-48 whitespace-pre-wrap break-words">
                {String(this.state.error && this.state.error.stack || this.state.error)}
                {this.state.info && this.state.info.componentStack
                  ? '\n\n' + this.state.info.componentStack
                  : ''}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  }
}

// Functional wrapper so the class boundary can access the auth user for
// developer-mode detection.
export function AppErrorBoundary({ children }) {
  const { user } = useAuth();
  return <ErrorBoundary user={user}>{children}</ErrorBoundary>;
}