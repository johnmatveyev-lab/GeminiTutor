import React, { useEffect, useRef, useState, useMemo } from 'react';
import { cn } from '../lib/utils';
import { Transcription, SessionStatus } from '../types';

interface TranscriptionListProps {
  transcriptions: Transcription[];
  status: SessionStatus;
  activeInputText: string;
  activeOutputText: string;
  onClear: () => void;
}

const VISIBLE_MESSAGE_COUNT = 50;

export const TranscriptionList: React.FC<TranscriptionListProps> = ({
  transcriptions,
  status,
  activeInputText,
  activeOutputText,
  onClear
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const prevTranscriptionsLength = useRef(transcriptions.length);

  const visibleTranscriptions = useMemo(() => {
    const total = transcriptions.length;
    if (total <= VISIBLE_MESSAGE_COUNT) {
      return transcriptions;
    }
    return transcriptions.slice(-VISIBLE_MESSAGE_COUNT);
  }, [transcriptions]);

  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      setIsUserScrolling(!isAtBottom);
    };

    scrollContainer.addEventListener('scroll', handleScroll);
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;

    const hasNewMessages = transcriptions.length > prevTranscriptionsLength.current;
    const hasNewActivity = activeInputText || activeOutputText;

    if (hasNewMessages || hasNewActivity) {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }

    prevTranscriptionsLength.current = transcriptions.length;
  }, [transcriptions, activeInputText, activeOutputText]);

  return (
    <div className="flex flex-col h-full glass-card rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-5 py-4 border-b border-white/5 flex items-center justify-between">
        <h2 className="text-xs font-medium text-white/50">Transcript</h2>
        <div className="flex items-center gap-2">
          <span className="text-[10px] px-2 py-0.5 glass rounded-md text-white/40">
            {transcriptions.length}
          </span>
          {transcriptions.length > VISIBLE_MESSAGE_COUNT && (
            <span className="text-[10px] px-2 py-0.5 bg-[var(--color-primary-muted)] rounded-md text-[var(--color-primary)]">
              Last {VISIBLE_MESSAGE_COUNT}
            </span>
          )}
          {transcriptions.length > 0 && (
            <button
              onClick={onClear}
              className="p-1 hover:bg-white/10 rounded-lg transition-colors duration-150 text-white/30 hover:text-[var(--color-danger)]"
              title="Clear History"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-5 space-y-4 scroll-smooth"
      >
        {/* Empty - active session */}
        {transcriptions.length === 0 && !activeInputText && !activeOutputText && status === SessionStatus.ACTIVE && (
          <div className="h-full flex flex-col items-center justify-center text-white/30 text-sm">
            Start speaking or performing a task...
          </div>
        )}

        {/* Empty - no session */}
        {transcriptions.length === 0 && !activeInputText && !activeOutputText && status !== SessionStatus.ACTIVE && (
          <div className="h-full flex flex-col items-center justify-center text-white/30 text-center px-4">
            <svg className="w-8 h-8 mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-xs leading-relaxed max-w-[180px]">Live dialogue will appear here during the session.</p>
          </div>
        )}

        {/* Message bubbles */}
        {visibleTranscriptions.map((t, i) => {
          const isUser = t.role === 'user';
          const isContinuous = i > 0 && visibleTranscriptions[i - 1].role === t.role;

          return (
            <div
              key={t.id}
              className={cn(
                'flex flex-col animate-slide-in-up',
                isUser ? 'items-end' : 'items-start',
                isContinuous ? '!mt-1.5' : ''
              )}
            >
              <div
                className={cn(
                  'max-w-[85%] px-4 py-3 text-sm leading-relaxed',
                  isUser
                    ? 'bg-[var(--color-primary)] text-white rounded-2xl rounded-br-md'
                    : 'glass text-white/90 rounded-2xl rounded-bl-md'
                )}
              >
                {!isContinuous && (
                  <div className="text-[10px] text-white/50 mb-1 font-medium">
                    {isUser ? 'You' : 'AI Tutor'}
                  </div>
                )}
                <p>{t.text}</p>
              </div>
              {!isContinuous && (
                <span className="text-[10px] text-white/20 px-2 mt-1">
                  {new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          );
        })}

        {/* Live input (user speaking) */}
        {activeInputText && (
          <div className="flex flex-col items-end animate-slide-in-up">
            <div className="max-w-[85%] px-4 py-3 text-sm leading-relaxed bg-[var(--color-primary)]/80 text-white rounded-2xl rounded-br-md border border-[var(--color-primary)]/40">
              <div className="text-[10px] text-white/60 mb-1 font-medium flex items-center gap-1.5">
                <svg className="w-3 h-3 text-white animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                Listening
              </div>
              <p className="opacity-90">{activeInputText}</p>
            </div>
          </div>
        )}

        {/* Live output (AI speaking) */}
        {activeOutputText && (
          <div className="flex flex-col items-start animate-slide-in-up">
            <div className="max-w-[85%] px-4 py-3 text-sm leading-relaxed glass rounded-2xl rounded-bl-md">
              <div className="text-[10px] text-white/40 mb-1 font-medium flex items-center gap-1.5">
                AI Tutor
                <span className="flex items-center gap-0.5 ml-1">
                  <span className="w-0.5 h-2 bg-white/30 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-0.5 h-3 bg-white/30 rounded-full animate-bounce" style={{ animationDelay: '120ms' }}></span>
                  <span className="w-0.5 h-1.5 bg-white/30 rounded-full animate-bounce" style={{ animationDelay: '240ms' }}></span>
                </span>
              </div>
              <p className="whitespace-pre-wrap">{activeOutputText}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
