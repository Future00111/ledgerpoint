import React from 'react';

export default class WidgetErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(e) {
    console.error('Widget error:', e);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 text-sm text-muted-foreground h-full flex flex-col items-center justify-center text-center">
          <p>This widget couldn't load.</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="text-primary text-xs underline mt-2"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}