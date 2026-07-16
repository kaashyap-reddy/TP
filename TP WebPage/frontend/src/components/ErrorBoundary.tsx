import { Component, ErrorInfo, ReactNode } from 'react';
import { reportError } from '../utils/monitoring';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * App-wide safety net: without this, any uncaught render error anywhere in the tree takes down
 * the whole app to a blank white screen (React's default with no boundary). This shows a plain
 * recoverable fallback instead, and is the hook point for error tracking (see utils/monitoring.ts).
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled render error:', error, info.componentStack);
    reportError(error, { componentStack: info.componentStack ?? undefined });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-sm text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h1>
          <p className="text-sm text-gray-500 mb-6">
            An unexpected error occurred. Try reloading the page — if it keeps happening, contact support.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
          >
            Reload page
          </button>
        </div>
      </div>
    );
  }
}
