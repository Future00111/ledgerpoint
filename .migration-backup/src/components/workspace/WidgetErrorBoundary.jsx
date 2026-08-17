import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

const isDev = !!(import.meta && import.meta.env && import.meta.env.DEV);

// Per-widget error boundary for Workspace cards. If a single widget throws
// during render, this catches it so the rest of the Workspace keeps loading.
// The failing component name is logged to the console; in developer mode the
// error message and a short reference id are shown under the fallback message.
export default class WidgetErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, ref: null };
  }

  static getDerivedStateFromError(error) {
    const ref = 'WSW-' + Math.random().toString(36).slice(2, 8).toUpperCase();
    return { hasError: true, error, ref };
  }

  componentDidCatch(error, info) {
    const { name } = this.props;
    console.error(
      `[Workspace Widget] "${name || 'unknown'}" failed to load:`,
      error,
      info && info.componentStack ? info.componentStack : ''
    );
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, ref: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-destructive">Unable to load this widget.</p>
              {isDev && (
                <p className="text-xs text-muted-foreground mt-1 break-all">
                  {this.props.name ? `${this.props.name}: ` : ''}
                  {this.state.error && this.state.error.message ? this.state.error.message : 'Unknown error'}
                  {this.state.ref ? ` (ref: ${this.state.ref})` : ''}
                </p>
              )}
            </div>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={this.handleRetry}>
              <RotateCcw className="w-3 h-3" /> Retry
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}