import React, { useRef } from 'react';
import { cn } from '../lib/utils';
import { SessionStatus, Attachment } from '../types';
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
  attachments: Attachment[];
  setAttachments: React.Dispatch<React.SetStateAction<Attachment[]>>;
  onAttachFiles: (files: FileList) => void;
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
  attachments,
  setAttachments,
  onAttachFiles,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePaste = (e: React.ClipboardEvent) => {
    if (e.clipboardData?.files && e.clipboardData.files.length > 0) {
      e.preventDefault();
      onAttachFiles(e.clipboardData.files);
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(att => att.id !== id));
  };

  return (
    <div className="absolute left-1/2 -translate-x-1/2 bottom-7 w-[92%] max-w-5xl z-20">
      {/* Attachments Preview Tray */}
      {attachments.length > 0 && (
        <div data-testid="attachments-preview" className="mb-3 flex flex-wrap gap-2.5 px-4 py-2.5 rounded-2xl bg-black/45 backdrop-blur-md border border-white/8 max-h-36 overflow-y-auto">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="group relative flex items-center gap-2 pl-2 pr-8 py-1.5 rounded-xl bg-white/5 border border-white/8 text-xs text-white/85"
            >
              {att.type === 'image' && att.dataUrl ? (
                <img src={att.dataUrl} className="w-6 h-6 rounded object-cover" alt="attachment" />
              ) : att.type === 'pdf' ? (
                <span className="text-red-400 font-bold font-mono">PDF</span>
              ) : (
                <span className="text-blue-400 font-bold font-mono">TXT</span>
              )}
              <span className="max-w-[120px] truncate">{att.name}</span>
              <button
                type="button"
                onClick={() => removeAttachment(att.id)}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 rounded-full bg-white/10 hover:bg-red-500/20 text-white/50 hover:text-red-400 flex items-center justify-center transition-colors"
                title="Remove attachment"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}

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

        {/* File Attach Button (Paperclip) */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-10 h-10 rounded-full text-white/80 hover:bg-white/10 transition-colors flex items-center justify-center shrink-0"
          title="Attach file (image, PDF, text)"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,application/pdf,text/*"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) {
              onAttachFiles(e.target.files);
              e.target.value = ''; // Reset to allow same file selection again
            }
          }}
        />

        <input
          ref={chatInputRef}
          type="text"
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onPaste={handlePaste}
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
          disabled={(!chatInput.trim() && attachments.length === 0) || status === SessionStatus.CONNECTING}
          className={cn(
            'h-10 px-5 rounded-full text-sm font-medium transition-colors',
            (chatInput.trim() || attachments.length > 0) && status !== SessionStatus.CONNECTING
              ? 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer'
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