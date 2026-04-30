
import React from 'react';
import { SessionStatus } from '../types';

interface ControlPanelProps {
  status: SessionStatus;
  isMuted: boolean;
  onToggleMute: () => void;
  onStart: () => void;
  onStop: () => void;
  onToggleScreen: () => void;
  isScreenSharing: boolean;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  status,
  isMuted,
  onToggleMute,
  onStart,
  onStop,
  onToggleScreen,
  isScreenSharing
}) => {
  const isActive = status === SessionStatus.ACTIVE;
  const isConnecting = status === SessionStatus.CONNECTING;

  return (
    <div className="fixed bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-[#1C1C1E]/70 backdrop-blur-3xl border border-white/10 px-4 py-3 rounded-full shadow-[0_20px_40px_rgba(0,0,0,0.5)] z-50 transition-all duration-500 ease-out hover:scale-105">
      {/* Mic Button */}
      <button
        onClick={onToggleMute}
        disabled={!isActive}
        className={`w-14 h-14 flex items-center justify-center rounded-full transition-all duration-300 ${
          isMuted 
            ? 'bg-[#FF453A]/20 text-[#FF453A] border border-[#FF453A]/30' 
            : 'bg-white/5 text-white/90 hover:bg-white/15 border border-white/5 disabled:opacity-30 disabled:hover:bg-white/5'
        }`}
        title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
      >
        {isMuted ? (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M1 1l22 22" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        )}
      </button>

      {/* Main Start/Stop Button */}
      {isActive ? (
        <button
          onClick={onStop}
          className="px-8 h-14 bg-[#FF453A] hover:bg-[#FF3B30] text-white rounded-full font-semibold transition-all duration-300 flex items-center gap-3 shadow-lg shadow-[#FF453A]/20 active:scale-95 text-[13px] uppercase tracking-wider"
        >
          <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
          End Session
        </button>
      ) : (
        <button
          onClick={onStart}
          disabled={isConnecting}
          className="px-8 h-14 bg-white text-black hover:bg-white/90 disabled:bg-white/20 disabled:text-white/50 rounded-full font-semibold transition-all duration-300 flex items-center gap-2.5 shadow-lg shadow-white/10 active:scale-95 text-[13px] uppercase tracking-wider"
        >
          {isConnecting ? (
            <>
              <svg className="animate-spin h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Connecting
            </>
          ) : (
            <>
              <div className="w-2.5 h-2.5 bg-[#34C759] rounded-full shadow-[0_0_8px_#34C759]" />
              Start Lesson
            </>
          )}
        </button>
      )}

      {/* Screen Share Toggle */}
      <button
        onClick={onToggleScreen}
        className={`w-14 h-14 flex items-center justify-center rounded-full transition-all duration-300 ${
          isScreenSharing 
            ? 'bg-[#0A84FF]/20 text-[#0A84FF] border border-[#0A84FF]/30' 
            : 'bg-white/5 text-white/90 hover:bg-white/15 border border-white/5'
        }`}
        title={isScreenSharing ? "Stop Screen Share" : "Start Screen Share"}
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </button>
    </div>
  );
};
