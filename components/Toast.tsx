import React from 'react';
import { cn } from '../lib/utils';

export const Toast: React.FC<{
  visible: boolean;
  variant?: 'error' | 'warning' | 'info' | 'success';
  title: string;
  message?: string;
  onClose: () => void;
  className?: string;
}> = ({ visible, variant = 'info', title, message, onClose, className }) => {
  if (!visible) return null;

  const variantStyles = {
    error: 'border-[var(--color-danger)]/20 glow-danger',
    warning: 'border-[var(--color-warning)]/20 glow-warning',
    info: 'border-[var(--color-primary)]/20 glow-primary',
    success: 'border-[var(--color-success)]/20 glow-success',
  };

  return (
    <div className={cn(
      'glass-strong px-5 py-3 rounded-full flex items-center gap-3 max-w-md',
      'animate-slide-in-top',
      variantStyles[variant],
      className
    )}>
      <svg className="w-4 h-4 flex-shrink-0 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        {variant === 'error' && (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        )}
        {variant === 'warning' && (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        )}
        {variant === 'info' && (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        )}
        {variant === 'success' && (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        )}
      </svg>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white/90">{title}</p>
        {message && <p className="text-xs text-white/60 mt-0.5">{message}</p>}
      </div>
      <button
        onClick={onClose}
        className="p-1 hover:bg-white/10 rounded-full transition-colors duration-150"
      >
        <svg className="w-3.5 h-3.5 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};