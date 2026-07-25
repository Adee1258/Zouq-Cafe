import { Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-orange-50 px-4">
          <div className="bg-white rounded-3xl shadow-lg p-8 max-w-md w-full text-center">
            <div className="text-6xl mb-4">😕</div>
            <h1 className="text-xl font-extrabold text-gray-900 mb-2">Something went wrong</h1>
            <p className="text-sm text-gray-500 mb-6">
              An unexpected error occurred. Please refresh the page.
            </p>
            {import.meta?.env?.DEV && this.state.error && (
              <pre className="text-left text-xs bg-red-50 border border-red-100 rounded-xl p-3 mb-4 overflow-auto text-red-600 max-h-32">
                {this.state.error.toString()}
              </pre>
            )}
            <button
              onClick={() => window.location.reload()}
              className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-6 py-3 rounded-xl transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
