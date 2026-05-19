import React, { useState } from 'react';
import { cn } from '../lib/utils';
import { ChatSession } from '../types';

interface SessionListProps {
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onCreateSession: () => void;
  onDeleteSession: (sessionId: string) => void;
  onRenameSession?: (sessionId: string, newName: string) => void;
}

export const SessionList: React.FC<SessionListProps> = ({
  sessions,
  currentSessionId,
  onSelectSession,
  onCreateSession,
  onDeleteSession,
  onRenameSession
}) => {
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

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

  const handleStartEdit = (session: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(session.id);
    setEditingName(session.name);
  };

  const handleSaveEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (editingSessionId && editingName.trim() && onRenameSession) {
      onRenameSession(editingSessionId, editingName.trim());
    }
    setEditingSessionId(null);
    setEditingName('');
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(null);
    setEditingName('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit(e as any);
    } else if (e.key === 'Escape') {
      handleCancelEdit(e as any);
    }
  };

  return (
    <div className="flex flex-col h-full glass-card rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-5 py-4 border-b border-white/5 flex items-center justify-between">
        <h2 className="text-xs font-medium text-white/50">Sessions</h2>
        <button
          onClick={onCreateSession}
          className="p-1.5 hover:bg-white/10 rounded-lg transition-colors duration-150 text-white/40 hover:text-white"
          title="New Session"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-1">
        {sessions.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-white/30 text-center px-4">
            <svg className="w-8 h-8 mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <p className="text-xs">No sessions yet. Click + to start.</p>
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              className={cn(
                'group relative p-3.5 rounded-xl cursor-pointer transition-all duration-150',
                currentSessionId === session.id
                  ? 'bg-[var(--color-primary-muted)] border border-[var(--color-primary)]/15'
                  : 'hover:bg-white/[0.04] border border-transparent'
              )}
              onClick={() => onSelectSession(session.id)}
              onDoubleClick={(e) => handleStartEdit(session, e)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  {editingSessionId === session.id ? (
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={handleKeyDown}
                      onBlur={handleCancelEdit}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full bg-white/10 border border-white/15 rounded-lg px-2.5 py-1.5 text-white text-sm outline-none focus:border-[var(--color-primary)] transition-colors"
                      autoFocus
                    />
                  ) : (
                    <>
                      <h3 className="text-sm font-medium text-white/85 truncate mb-0.5">
                        {session.name}
                      </h3>
                      <div className="flex items-center gap-1.5 text-[10px] text-white/30">
                        <span>{formatDate(session.updatedAt)}</span>
                        <span>&middot;</span>
                        <span>{session.transcriptions.length} msg</span>
                        <span>&middot;</span>
                        <span>{formatDuration(session.duration)}</span>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-0.5 shrink-0">
                  {editingSessionId === session.id ? (
                    <>
                      <button
                        onClick={handleSaveEdit}
                        className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/40 hover:text-[var(--color-success)]"
                        title="Save"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/40 hover:text-[var(--color-danger)]"
                        title="Cancel"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </>
                  ) : (
                    <>
                      {onRenameSession && (
                        <button
                          onClick={(e) => handleStartEdit(session, e)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-white/10 rounded-lg transition-all text-white/25 hover:text-white/60"
                          title="Rename"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); onDeleteSession(session.id); }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-white/10 rounded-lg transition-all text-white/25 hover:text-[var(--color-danger)]"
                        title="Delete"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
