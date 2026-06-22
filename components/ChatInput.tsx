import React from 'react';
import { cn } from '../lib/utils';
import { SessionStatus } from '../types';
import { TUTOR_TYPES } from '../constants';

export const ChatInput: React.FC<{
  chatInput: string;
  setChatInput: (v: string) => void;
  handleSendChat: (e: React.FormEvent) => void;
  toggleScreenShare: () => void;
  isScreenSharing: boolean;
  selectedTutorId: string;
  setSelectedTutorId: (v: string) => void;
  isMuted: boolean;
  setIsMuted: (v: boolean) => void;
  status: SessionStatus;
  stopSession: () => void;
  startSession: () => void;
  chatInputRef: React.RefObject<HTMLInputElement | null>;
  sessionDuration: number;
  selectedTutorMeta: { name: string };
  isE2EMode: boolean;
  formatTime: (s: number) => string;
}> = ({
  chatInput,
  setChatInput,
  handleSendChat,
  toggleScreenShare,
  isScreenSharing,
  selectedTutorId,
  setSelectedTutorId,
  isMuted,
  setIsMuted,
  status,
  stopSession,
  startSession,
  chatInputRef,
  sessionDuration,
  selectedTutorMeta,
  isE2EMode,
  formatTime,
}) => {
  return (
    <div className="absolute left-1/2 -translate-x-1/2 bottom-7 w-[92%] max-w-5xl z-20">
      <form
        onSubmit={handleSendChat}
        className="h-16 rounded-full bg-[#1b1e24]/96 border border-white/12 shadow-[0_18px_48px_rgba(0,0,0,0.46)] flex items-center gap-3 px-4"
      >
        <button
          type="button"
          onClick={toggleScreenShare}
          data-testid="screen-share-toggle"
          className="w-10 h-10 rounded-full text-white/80 hover:bg-white/10 transition-colors text-2xl leading-none shrink-0"
          title={isScreenSharing ? 'Stop screen share' : 'Share screen'}
        >
          +
        </button>
        <input
          ref={chatInputRef}
          type="text"
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          placeholder={isE2EMode ? 'Type a message...' : `Ask ${selectedTutorMeta.name}...`}
          className="flex-1 basis-0 min-w-[180px] bg-transparent border-none outline-none text-white placeholder:text-white/40 text-base md:text-lg"
        />
        <select
          value={selectedTutorId}
          onChange={(e) => setSelectedTutorId(e.target.value)}
          className="h-10 rounded-full bg-black/25 border border-white/12 px-4 text-sm text-white/85 max-w-[180px]"
        >
          {TUTOR_TYPES.map((tutor) => (
            <option key={tutor.id} value={tutor.id} className="text-black">
              {tutor.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setIsMuted((prev) => !prev)}
          className={cn(
            'w-10 h-10 rounded-full transition-colors',
            isMuted ? 'bg-red-500/20 text-red-300' : 'text-white/80 hover:bg-white/10'
          )}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          <svg className="w-5 h-5 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 1v11m0 0a3 3 0 003-3V6a3 3 0 10-6 0v3a3 3 0 003 3zM5 10a7 7 0 0014 0M12 19v4m-4 0h8" />
          </svg>
        </button>
        <button
          type="submit"
          data-testid="chat-send"
          disabled={!chatInput.trim() || status === SessionStatus.CONNECTING}
          className={cn(
            'h-10 px-5 rounded-full text-sm font-medium transition-colors',
            chatInput.trim() && status !== SessionStatus.CONNECTING
              ? 'bg-blue-600 hover:bg-blue-500 text-white'
              : 'bg-white/10 text-white/35'
          )}
        >
          Send
        </button>
      </form>
      <div className="flex items-center justify-center gap-3 mt-3">
        <button
          type="button"
          onClick={status === SessionStatus.ACTIVE ? stopSession : startSession}
          data-testid={status === SessionStatus.ACTIVE ? "end-session" : "footer-start-session"}
          className={cn(
            'h-10 px-6 rounded-full text-sm font-semibold border transition-all duration-200 hover:scale-105 active:scale-95 shadow-[0_4px_16px_rgba(0,0,0,0.25)] cursor-pointer',
            status === SessionStatus.ACTIVE
              ? 'bg-gradient-to-r from-rose-500 to-red-600 text-white border-rose-400/30 shadow-[0_0_24px_rgba(239,68,68,0.3)] animate-pulse-red'
              : 'bg-gradient-to-r from-emerald-500 to-green-600 text-white border-emerald-400/30 hover:shadow-[0_0_24px_rgba(16,185,129,0.35)]'
          )}
        >
          {status === SessionStatus.ACTIVE ? 'End Session' : 'Start Session'}
        </button>
      </div>
      <canvas style={{ display: 'none' }} />
    </div>
  );
};