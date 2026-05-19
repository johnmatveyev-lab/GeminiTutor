import React from 'react';
import { cn } from '../lib/utils';

interface ScreenShareProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  isSharing: boolean;
  onToggle: () => void;
  isBrowserControlEnabled?: boolean;
}

export const ScreenShare: React.FC<ScreenShareProps> = ({
  videoRef,
  isSharing,
  onToggle,
  isBrowserControlEnabled = false
}) => {
  return (
    <div className={cn(
      'relative flex-1 rounded-2xl overflow-hidden group flex flex-col transition-all duration-500 border',
      isBrowserControlEnabled
        ? 'glass-card border-[var(--color-primary)]/20 glow-primary'
        : isSharing
          ? 'glass-card border-white/10'
          : 'glass border-white/[0.06]'
    )}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className={cn(
          'w-full h-full object-contain transition-opacity duration-500',
          isSharing ? 'opacity-100' : 'opacity-0'
        )}
      />

      {/* Browser control blue overlay */}
      {isSharing && isBrowserControlEnabled && (
        <>
          <div className="absolute inset-0 pointer-events-none bg-[var(--color-primary)]/8 mix-blend-screen" />
          <div className="absolute inset-0 pointer-events-none ring-1 ring-inset ring-[var(--color-primary-light)]/20" />
        </>
      )}

      {/* Empty state */}
      {!isSharing && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-20 h-20 rounded-2xl glass flex items-center justify-center mb-6 group-hover:scale-[1.02] transition-transform duration-500">
            <svg className="w-9 h-9 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold mb-2">Immersive Learning</h3>
          <p className="max-w-xs text-sm text-white/40 leading-relaxed mb-8">
            Share your screen so your AI tutor can see what you see and provide context-aware guidance.
          </p>
          <button
            onClick={onToggle}
            className="px-6 py-3 bg-white text-black rounded-xl font-medium transition-all hover:bg-white/90 active:scale-[0.97] text-sm"
          >
            Share Screen
          </button>
        </div>
      )}

      {/* Live sharing overlay */}
      {isSharing && (
        <div className="absolute top-4 right-4 flex gap-2 items-center">
          {isBrowserControlEnabled && (
            <div className="flex items-center gap-2 glass-strong text-white px-3 py-1.5 rounded-lg glow-primary">
              <svg className="w-3.5 h-3.5 text-[var(--color-primary-light)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
              <span className="text-[11px] font-semibold text-white/90">
                Browser Control
              </span>
            </div>
          )}

          <div className="flex items-center gap-2 glass px-3 py-1.5 rounded-lg">
            <div className="relative flex items-center justify-center w-2 h-2">
              <div className="absolute w-full h-full bg-white rounded-full animate-ping opacity-60" style={{ animationDuration: '1.5s' }} />
              <div className="relative w-1.5 h-1.5 bg-white rounded-full" />
            </div>
            <span className="text-[11px] font-medium text-white/70">Live</span>
          </div>

          <button
            onClick={onToggle}
            className="flex items-center gap-1.5 glass hover:bg-[var(--color-danger-muted)] border border-[var(--color-danger)]/20 text-[var(--color-danger)] px-3 py-1.5 rounded-lg transition-all duration-200"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span className="text-[11px] font-medium">Stop</span>
          </button>
        </div>
      )}
    </div>
  );
};
