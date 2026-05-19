import React, { useState, useEffect, ReactNode } from 'react';
import { cn } from '../lib/utils';

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
        <div className="glass-card rounded-2xl p-8 max-w-lg mx-4 animate-scale-in">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-danger-muted)] flex items-center justify-center">
              <svg className="w-5 h-5 text-[var(--color-danger)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold">Something went wrong</h2>
              <p className="text-sm text-white/50">An unexpected error occurred</p>
            </div>
          </div>

          {error && (
            <div className="mb-5 p-3 glass rounded-xl text-sm text-white/60 font-mono break-all">
              {error.message}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleReset}
              className="flex-1 px-4 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-xl font-medium transition-colors duration-150 glow-primary"
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="flex-1 px-4 py-2.5 glass hover:bg-[var(--glass-bg-hover)] rounded-xl font-medium transition-colors duration-150"
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
