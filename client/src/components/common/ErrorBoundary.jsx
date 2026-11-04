import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Unhandled React Error caught by ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center space-y-6">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 border border-rose-100">
              <AlertTriangle className="h-8 w-8" />
            </div>

            <div>
              <h2 className="text-xl font-bold text-slate-900">Something Went Wrong</h2>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                An unexpected interface rendering exception occurred. The pharmacovigilance safety data has not been lost.
              </p>
            </div>

            {this.state.error && (
              <div className="text-left rounded-xl bg-slate-100 p-3.5 border border-slate-200 text-xs font-mono text-slate-700 max-h-36 overflow-y-auto">
                <span className="font-bold text-rose-700 block mb-1">
                  {this.state.error.name}: {this.state.error.message}
                </span>
                {this.state.errorInfo?.componentStack && (
                  <pre className="text-[10px] text-slate-500 whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack.slice(0, 300)}...
                  </pre>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="btn-primary text-xs flex items-center justify-center gap-2"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Reload Page
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                className="btn-secondary text-xs flex items-center justify-center gap-2"
              >
                <Home className="h-3.5 w-3.5" />
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

