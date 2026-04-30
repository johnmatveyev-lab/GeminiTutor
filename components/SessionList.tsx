import React from 'react';
import { ChatSession } from '../types';

interface SessionListProps {
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onCreateSession: () => void;
  onDeleteSession: (sessionId: string) => void;
}

export const SessionList: React.FC<SessionListProps> = ({
  sessions,
  currentSessionId,
  onSelectSession,
  onCreateSession,
  onDeleteSession
}) => {
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="flex flex-col h-full bg-[#1C1C1E]/40 backdrop-blur-2xl rounded-[32px] border border-white/10 overflow-hidden shadow-2xl">
      <div className="px-6 py-5 border-b border-white/5 bg-white/5 backdrop-blur-md flex items-center justify-between z-10 relative">
        <h2 className="text-[13px] font-semibold text-white/90 uppercase tracking-widest">Sessions</h2>
        <button
          onClick={onCreateSession}
          className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/60 hover:text-white"
          title="New Session"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {sessions.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-white/40 text-center px-4">
            <svg className="w-10 h-10 mb-4 opacity-50 stroke-current" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <p className="text-[13px] leading-relaxed">No sessions yet.<br />Click + to start a new one.</p>
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              className={`group relative p-4 rounded-2xl cursor-pointer transition-all duration-200 ${
                currentSessionId === session.id
                  ? 'bg-[#0A84FF]/20 border border-[#0A84FF]/30'
                  : 'bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10'
              }`}
              onClick={() => onSelectSession(session.id)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-[14px] font-semibold text-white/90 truncate mb-1">
                    {session.name}
                  </h3>
                  <div className="flex items-center gap-2 text-[11px] text-white/50">
                    <span>{formatDate(session.updatedAt)}</span>
                    <span>•</span>
                    <span>{session.transcriptions.length} messages</span>
                    <span>•</span>
                    <span>{formatDuration(session.duration)}</span>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSession(session.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-white/10 rounded-lg transition-all text-white/40 hover:text-[#FF453A]"
                  title="Delete session"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
