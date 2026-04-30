
import React, { useEffect, useRef } from 'react';
import { Transcription, SessionStatus } from '../types';

interface TranscriptionListProps {
  transcriptions: Transcription[];
  status: SessionStatus;
  activeInputText: string;
  activeOutputText: string;
  onClear: () => void;
}

export const TranscriptionList: React.FC<TranscriptionListProps> = ({ 
  transcriptions, 
  status, 
  activeInputText,
  activeOutputText,
  onClear 
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcriptions, activeInputText, activeOutputText]);

  return (
    <div className="flex flex-col h-full bg-[#1C1C1E]/40 backdrop-blur-2xl rounded-[32px] border border-white/10 overflow-hidden shadow-2xl relative">
      <div className="px-6 py-5 border-b border-white/5 bg-white/5 backdrop-blur-md flex items-center justify-between z-10 relative">
        <h2 className="text-[13px] font-semibold text-white/90 uppercase tracking-widest">Transcript</h2>
        <div className="flex items-center gap-3">
          <span className="text-[11px] px-2.5 py-1 bg-black/40 rounded-full text-white/60 font-medium">
            {transcriptions.length} Messages
          </span>
          {transcriptions.length > 0 && (
            <button 
              onClick={onClear} 
              className="p-1 hover:bg-white/10 rounded-full transition-colors text-white/40 hover:text-[#FF453A]"
              title="Clear History"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>
      
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth"
      >
        {transcriptions.length === 0 && !activeInputText && !activeOutputText && status === SessionStatus.ACTIVE && (
          <div className="h-full flex flex-col items-center justify-center text-white/40 italic text-[15px]">
            <p>Start speaking or performing a task...</p>
          </div>
        )}
        
        {transcriptions.length === 0 && !activeInputText && !activeOutputText && status !== SessionStatus.ACTIVE && (
          <div className="h-full flex flex-col items-center justify-center text-white/40 text-center px-4">
            <svg className="w-10 h-10 mb-4 opacity-50 stroke-current drop-shadow-md" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-[13px] leading-relaxed max-w-[200px]">Live dialogue will appear here during the session.</p>
          </div>
        )}

        {transcriptions.map((t, i) => {
          const isUser = t.role === 'user';
          // Check if previous message was same role to stack them tighter
          const isContinuous = i > 0 && transcriptions[i-1].role === t.role;
          
          return (
            <div 
              key={t.id} 
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} ${isContinuous ? '!mt-2' : ''}`}
            >
              <div 
                className={`max-w-[85%] px-5 py-3.5 text-[15px] shadow-sm backdrop-blur-md ${
                  isUser 
                    ? 'bg-[#0A84FF] text-white rounded-[24px] rounded-br-[8px]' 
                    : 'bg-[#2C2C2E]/80 text-white rounded-[24px] rounded-bl-[8px] border border-white/5'
                }`}
              >
                {!isContinuous && (
                  <div className="text-[10px] opacity-70 mb-1 font-semibold uppercase tracking-wider">
                    {isUser ? 'You' : 'AI Tutor'}
                  </div>
                )}
                <p className="leading-relaxed font-medium">{t.text}</p>
              </div>
              <span className={`text-[10px] text-white/30 px-2 mt-1.5 font-medium ${isContinuous ? 'hidden' : 'block'}`}>
                {new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          );
        })}

        {/* Live Input (User speaking right now) */}
        {activeInputText && (
          <div className="flex flex-col items-end animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="max-w-[85%] px-5 py-3.5 text-[15px] shadow-sm backdrop-blur-md bg-[#0A84FF]/80 text-white rounded-[24px] rounded-br-[8px] border border-[#0A84FF]/50 relative">
              <div className="text-[10px] opacity-80 mb-1.5 font-semibold uppercase tracking-wider flex items-center justify-end gap-2">
                <span className="flex items-center gap-1.5 text-white/90">
                  <svg className="w-3.5 h-3.5 text-white animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                  Listening
                </span>
                • You
              </div>
              <p className="leading-relaxed font-medium opacity-90">{activeInputText}</p>
            </div>
          </div>
        )}

        {/* Live Output (AI speaking right now) */}
        {activeOutputText && (
          <div className="flex flex-col items-start animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="max-w-[85%] px-5 py-3.5 shadow-sm backdrop-blur-md bg-[#2C2C2E] text-white rounded-[24px] rounded-bl-[8px] border border-white/5 relative">
              <div className="text-[10px] text-white/40 mb-1.5 font-semibold uppercase tracking-wider flex items-center gap-2">
                AI Tutor • 
                <span className="flex items-center gap-0.5">
                  <span className="w-1 h-2.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-1 h-3.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-1 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  <span className="w-1 h-2.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '100ms' }}></span>
                </span>
              </div>
              <p className="leading-relaxed whitespace-pre-wrap">{activeOutputText}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
