import React from 'react';
import { cn } from '../lib/utils';
import { SessionStatus, Transcription, ChatSession } from '../types';

export const TranscriptionList: React.FC<{
  transcriptions: Transcription[];
  activeInputText: string;
  activeOutputText: string;
  status: SessionStatus;
  stopSession: () => void;
  startSession: () => void;
  toggleScreenShare: () => void;
  isScreenSharing: boolean;
  selectedTutorMeta: { name: string };
  transcriptScrollRef: React.RefObject<HTMLDivElement | null>;
  currentSession: ChatSession | null;
}> = ({
  transcriptions,
  activeInputText,
  activeOutputText,
  status,
  stopSession,
  startSession,
  toggleScreenShare,
  isScreenSharing,
  selectedTutorMeta,
  transcriptScrollRef,
  currentSession,
}) => {
  const exportTranscript = () => {
    if (!currentSession) return;
    const lines = currentSession.transcriptions.map(t => {
      const role = t.role === 'user' ? 'User' : 'Tutor';
      const time = new Date(t.timestamp).toLocaleTimeString();
      return `[${time}] ${role}: ${t.text}`;
    });
    const header = `Session: ${currentSession.name}\nDate: ${new Date(currentSession.createdAt).toLocaleString()}\nDuration: ${currentSession.duration}s\n${'='.repeat(50)}\n\n`;
    const content = header + lines.join('\n\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript-${currentSession.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      ref={transcriptScrollRef}
      className="absolute inset-0 overflow-y-auto px-5 md:px-20 lg:px-36 pt-16 md:pt-20 pb-44"
    >
      {isScreenSharing && (
        <div className="max-w-5xl mx-auto mb-8 rounded-3xl overflow-hidden border border-white/15 bg-black/40">
          <video autoPlay playsInline className="w-full h-[280px] md:h-[360px] object-contain bg-black/70" />
        </div>
      )}

      {transcriptions.length === 0 && !activeInputText && !activeOutputText && (
        <div className="h-full min-h-[420px] flex flex-col items-center justify-center text-center">
          <h2 className="text-4xl md:text-6xl font-medium tracking-tight text-white/90 mb-4">Hi there, what do you want to learn today?</h2>
          <p className="text-white/45 max-w-2xl text-lg mb-6">Start an immersive lesson with {selectedTutorMeta.name} and ask anything in text, voice, or shared-screen mode.</p>
          <div className="flex items-center gap-3">
            <button
              onClick={status === SessionStatus.ACTIVE ? stopSession : startSession}
              data-testid="start-session"
              className={cn(
                'px-6 h-12 rounded-full border transition-colors shadow-[0_12px_34px_rgba(0,0,0,0.32)]',
                status === SessionStatus.ACTIVE
                  ? 'bg-red-500/20 border-red-400/30 text-red-200'
                  : 'bg-blue-600/85 hover:bg-blue-500 text-white border-blue-400/30'
              )}
            >
              {status === SessionStatus.ACTIVE ? 'End Session' : 'Start Session'}
            </button>
            <button
              onClick={toggleScreenShare}
              className="px-6 h-12 rounded-full bg-white/8 hover:bg-white/14 text-white border border-white/12 transition-colors shadow-[0_12px_34px_rgba(0,0,0,0.32)]"
            >
              {isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
            </button>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto space-y-5">
        {transcriptions.length > 0 && currentSession && (
          <div className="flex justify-end mb-2">
            <button
              onClick={exportTranscript}
              className="px-3 py-1.5 rounded-full bg-white/8 hover:bg-white/14 text-white/70 hover:text-white text-xs border border-white/10 transition-colors flex items-center gap-1.5"
              title="Export transcript as .txt"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
              </svg>
              Export
            </button>
          </div>
        )}
        {transcriptions.map((item) => {
          const isUser = item.role === 'user';
          return (
            <div key={item.id} className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
              <div className={cn(
                'max-w-[78%] px-5 py-3 rounded-3xl text-[15px] leading-relaxed shadow-sm',
                isUser
                  ? 'bg-blue-600 text-white rounded-br-xl'
                  : 'bg-white/5 text-white/90 border border-white/10 rounded-bl-xl'
              )}>
                {item.text}
              </div>
            </div>
          );
        })}
        {activeInputText && (
          <div className="flex justify-end">
            <div className="max-w-[78%] px-5 py-3 rounded-3xl rounded-br-xl bg-blue-500/80 text-white">
              {activeInputText}
            </div>
          </div>
        )}
        {activeOutputText && (
          <div className="flex justify-start">
            <div className="max-w-[78%] px-5 py-3 rounded-3xl rounded-bl-xl bg-white/5 border border-white/10 text-white/90">
              {activeOutputText}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};