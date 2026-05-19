import React from 'react';
import { cn } from '../lib/utils';
import { SessionStatus } from '../types';

interface ControlPanelProps {
  status: SessionStatus;
  isMuted: boolean;
  onToggleMute: () => void;
  onStart: () => void;
  onStop: () => void;
  onToggleScreen: () => void;
  isScreenSharing: boolean;
  onToggleBrowserControl: () => void;
  isBrowserControlEnabled: boolean;
  isBrowserControlSkillEnabled: boolean;
  isBrowserControlBridgeReady: boolean;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  status,
  isMuted,
  onToggleMute,
  onStart,
  onStop,
  onToggleScreen,
  isScreenSharing,
  onToggleBrowserControl,
  isBrowserControlEnabled,
  isBrowserControlSkillEnabled,
  isBrowserControlBridgeReady
}) => {
  const isActive = status === SessionStatus.ACTIVE;
  const isConnecting = status === SessionStatus.CONNECTING;
  const canUseBrowserControl = isActive && isBrowserControlSkillEnabled && isBrowserControlBridgeReady;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2.5 z-50 px-4 md:px-0 max-w-full">
      {/* Shortcut hint */}
      <div className="glass px-3 py-1 rounded-full hidden md:block">
        <span className="text-[10px] text-white/40 tracking-wide">
          <span className="text-white/50">Double Shift</span> to {isActive ? 'end' : 'start'}
        </span>
      </div>

      {/* Control dock */}
      <div className="glass-dock flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-full">
        {/* Mic */}
        <button
          onClick={onToggleMute}
          disabled={!isActive}
          className={cn(
            'w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center rounded-xl transition-all duration-200',
            isMuted
              ? 'bg-[var(--color-danger-muted)] text-[var(--color-danger)] border border-[var(--color-danger)]/20'
              : 'bg-white/5 text-white/80 hover:bg-white/10 border border-white/5 disabled:opacity-25'
          )}
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M1 1l22 22" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          )}
        </button>

        {/* Start / Stop */}
        {isActive ? (
          <button
            onClick={onStop}
            className="px-4 sm:px-6 h-11 sm:h-12 bg-[var(--color-danger)] hover:bg-[var(--color-danger-hover)] text-white rounded-xl font-medium transition-all duration-200 flex items-center gap-2 active:scale-[0.97] text-sm glow-danger"
          >
            <div className="w-2 h-2 bg-white rounded-full animate-pulse-soft" />
            End Session
          </button>
        ) : (
          <button
            onClick={onStart}
            disabled={isConnecting}
            className="px-4 sm:px-6 h-11 sm:h-12 bg-white text-black hover:bg-white/90 disabled:bg-white/15 disabled:text-white/40 rounded-xl font-medium transition-all duration-200 flex items-center gap-2 active:scale-[0.97] text-sm disabled:cursor-not-allowed"
          >
            {isConnecting ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Connecting
              </>
            ) : (
              <>
                <div className="w-2 h-2 bg-[var(--color-success)] rounded-full shadow-[0_0_6px_var(--color-success)]" />
                Start Lesson
              </>
            )}
          </button>
        )}

        {/* Screen Share */}
        <button
          onClick={onToggleScreen}
          className={cn(
            'w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center rounded-xl transition-all duration-200',
            isScreenSharing
              ? 'bg-[var(--color-primary-muted)] text-[var(--color-primary)] border border-[var(--color-primary)]/20 glow-primary'
              : 'bg-white/5 text-white/80 hover:bg-white/10 border border-white/5'
          )}
          title={isScreenSharing ? "Stop Screen Share" : "Start Screen Share"}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </button>

        {/* Browser Control */}
        <button
          onClick={onToggleBrowserControl}
          disabled={!canUseBrowserControl}
          className={cn(
            'w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center rounded-xl transition-all duration-200',
            isBrowserControlEnabled
              ? 'bg-[var(--color-primary-muted)] text-[var(--color-primary-light)] border border-[var(--color-primary-light)]/20 glow-primary'
              : 'bg-white/5 text-white/80 hover:bg-white/10 border border-white/5 disabled:opacity-25 disabled:hover:bg-white/5'
          )}
          title={
            isBrowserControlEnabled
              ? "Turn Off Browser Control"
              : !isActive
                ? "Start Session to Use Browser Control"
                : !isBrowserControlSkillEnabled
                  ? "Enable Browser Control Skill in Settings"
                  : !isBrowserControlBridgeReady
                    ? "Browser Control Bridge Offline"
                    : "Turn On Browser Control"
          }
          aria-pressed={isBrowserControlEnabled}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
          </svg>
        </button>
      </div>
    </div>
  );
};
