import React, { useState, useEffect, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

export const ErrorBoundary: React.FC<Props> = ({ children, fallback }) => {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error('Error caught by boundary:', event.error);
      setHasError(true);
      setError(event.error);
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  const handleReset = () => {
    setHasError(false);
    setError(null);
  };

  if (hasError) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
        <div className="bg-[#1C1C1E]/95 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl max-w-lg mx-4">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-[#FF453A]/20 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-[#FF453A]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white mb-1">Something went wrong</h2>
              <p className="text-white/60 text-sm">An unexpected error occurred</p>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-black/30 rounded-xl border border-white/5">
              <p className="text-white/70 text-sm font-mono break-all">
                {error.message}
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleReset}
              className="flex-1 px-4 py-3 bg-[#0A84FF] hover:bg-[#0A84FF]/90 text-white rounded-xl font-medium transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white font-medium transition-colors"
            >
              Reload Page
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
