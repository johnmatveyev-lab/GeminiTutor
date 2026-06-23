import React, { useState, useEffect } from 'react';
import { cn } from '../lib/utils';
import { SessionStatus, ChatSession } from '../types';
import { TUTOR_TYPES, TUTOR_CATEGORIES } from '../constants';
import { Avatar } from './Avatar';

const sidebarItems = [
  {
    id: 'new-chat',
    label: 'New chat',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 5v14m7-7H5" />
    )
  },
  {
    id: 'search',
    label: 'Search chats',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="m21 21-4.35-4.35M16 10.5a5.5 5.5 0 11-11 0 5.5 5.5 0 0111 0z" />
    )
  },
  {
    id: 'library',
    label: 'Library',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 19.5A2.5 2.5 0 016.5 17H20m-13.5 2.5V6A2.5 2.5 0 019 3.5h9A2 2 0 0120 5.5V17m-13.5 2.5H20M9.5 8H17" />
    )
  },
];

export const SessionSidebar: React.FC<{
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (v: boolean) => void;
  createNewSession: () => void;
  selectedTutorId: string;
  setSelectedTutorId: (v: string) => void;
  sessions: ChatSession[];
  currentSessionId: string | null;
  selectSession: (id: string) => void;
  status: SessionStatus;
  sessionDuration: number;
  formatTime: (s: number) => string;
  selectedTutorMeta: { name: string };
  setIsSettingsOpen: (v: boolean) => void;
  USER_NAME: string;
  networkQuality: 'high' | 'medium' | 'low';
  renameSession: (sessionId: string, newName: string) => void;
}> = ({
  isSidebarCollapsed,
  setIsSidebarCollapsed,
  createNewSession,
  selectedTutorId,
  setSelectedTutorId,
  sessions,
  currentSessionId,
  selectSession,
  status,
  sessionDuration,
  formatTime,
  selectedTutorMeta,
  setIsSettingsOpen,
  USER_NAME,
  networkQuality,
  renameSession,
}) => {
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {
      'coding-technical': true,
      'academics-general': false,
      'languages-writing': false,
      'support-personality': false,
    };
    
    const selectedCat = TUTOR_CATEGORIES.find(cat => cat.tutorIds.includes(selectedTutorId));
    if (selectedCat) {
      initial[selectedCat.id] = true;
    }
    return initial;
  });

  useEffect(() => {
    const selectedCat = TUTOR_CATEGORIES.find(cat => cat.tutorIds.includes(selectedTutorId));
    if (selectedCat) {
      setExpandedCategories(prev => ({
        ...prev,
        [selectedCat.id]: true
      }));
    }
  }, [selectedTutorId]);

  const toggleCategory = (catId: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [catId]: !prev[catId]
    }));
  };

  const qualityDotColor = networkQuality === 'high' ? 'bg-green-400' : networkQuality === 'medium' ? 'bg-yellow-400' : 'bg-red-400';

  const handleRenameStart = (session: ChatSession) => {
    setEditingSessionId(session.id);
    setEditName(session.name);
  };

  const handleRenameCommit = () => {
    if (editingSessionId && editName.trim()) {
      renameSession(editingSessionId, editName.trim());
    }
    setEditingSessionId(null);
    setEditName('');
  };

  return (
    <aside className={cn(
      'h-full border-r border-white/8 bg-black/35 backdrop-blur-2xl transition-all duration-300 ease-out',
      isSidebarCollapsed ? 'w-[74px]' : 'w-[300px]'
    )}>
      <div className="h-full flex flex-col">
        <div className="px-4 pt-5 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-cyan-300 via-blue-500 to-indigo-500 shadow-[0_0_24px_rgba(59,130,246,0.4)]" />
            {!isSidebarCollapsed && <span className="text-2xl font-semibold tracking-tight text-white/90">Gemini Tutor</span>}
          </div>
          <button
            onClick={() => setIsSidebarCollapsed((prev) => !prev)}
            className="w-8 h-8 rounded-xl glass hover:bg-white/10 transition-colors"
            title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg className="w-4 h-4 mx-auto text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isSidebarCollapsed ? "M13 5l7 7-7 7M5 5l7 7-7 7" : "M11 5l-7 7 7 7M19 5l-7 7 7 7"} />
            </svg>
          </button>
        </div>

        <div className="px-3">
          <button
            onClick={createNewSession}
            className="w-full h-11 rounded-2xl bg-white/10 hover:bg-white/15 text-white flex items-center justify-center gap-2 transition-colors shadow-[0_8px_24px_rgba(0,0,0,0.25)]"
          >
            <span className="text-xl leading-none">+</span>
            {!isSidebarCollapsed && <span className="font-medium">New Session</span>}
          </button>
        </div>

        <div className="px-3 pt-4 space-y-1">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                if (item.id === 'new-chat') {
                  createNewSession();
                  setIsSettingsOpen(false);
                  return;
                }
              }}
              className={cn(
                'w-full h-10 rounded-xl text-white/75 hover:bg-white/10 transition-colors flex items-center gap-2',
                isSidebarCollapsed ? 'justify-center px-0' : 'px-3'
              )}
              title={isSidebarCollapsed ? item.label : undefined}
            >
              <svg className="w-5 h-5 shrink-0 text-white/65" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {item.icon}
              </svg>
              {!isSidebarCollapsed && <span>{item.label}</span>}
            </button>
          ))}
        </div>

        {!isSidebarCollapsed && (
          <div className="px-5 pt-5 flex-shrink-0">
            <p className="text-xs uppercase tracking-wider text-white/35 mb-2">Categories</p>
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 select-none scrollbar-thin">
              {TUTOR_CATEGORIES.map((cat) => {
                const isExpanded = !!expandedCategories[cat.id];
                return (
                  <div key={cat.id} className="rounded-xl border border-white/5 bg-white/4 overflow-hidden">
                    <button
                      onClick={() => toggleCategory(cat.id)}
                      className="w-full px-3 py-2 flex items-center justify-between hover:bg-white/8 transition-colors text-left"
                    >
                      <span className="text-xs font-semibold text-white/85 tracking-wide">{cat.name}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-white/5 border border-white/8 text-white/45 font-mono">
                          {cat.tutorIds.length}
                        </span>
                        <svg
                          className={cn(
                            "w-3 h-3 text-white/40 transition-transform duration-200 ease-out",
                            isExpanded && "rotate-180"
                          )}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </button>
                    
                    {isExpanded && (
                      <div className="px-1 pb-1 pt-0.5 space-y-1 bg-black/10 border-t border-white/4">
                        {cat.tutorIds.map((tutorId) => {
                          const tutor = TUTOR_TYPES.find((t) => t.id === tutorId);
                          if (!tutor) return null;
                          const isSelected = selectedTutorId === tutorId;
                          return (
                            <button
                              key={tutorId}
                              onClick={() => setSelectedTutorId(tutorId)}
                              className={cn(
                                'w-full text-left px-2 py-1.5 rounded-lg transition-all duration-200 text-sm flex items-center gap-2',
                                isSelected
                                  ? 'bg-blue-600/90 text-white font-medium shadow-inner'
                                  : 'text-white/70 hover:bg-white/6 hover:text-white'
                              )}
                            >
                              <Avatar id={tutorId} className="w-5 h-5 rounded-full border border-white/10" />
                              <span className="truncate flex-1">{tutor.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!isSidebarCollapsed && (
          <div className="px-5 pt-6 min-h-0 flex-1 overflow-hidden">
            <p className="text-xs uppercase tracking-wider text-white/35 mb-2">Recents</p>
            <div className="space-y-1 overflow-y-auto max-h-full pr-1">
              {sessions.slice(0, 20).map((session) => (
                <div key={session.id} className="group flex items-center gap-1">
                  {editingSessionId === session.id ? (
                    <input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onBlur={handleRenameCommit}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleRenameCommit(); if (e.key === 'Escape') setEditingSessionId(null); }}
                      className="w-full bg-black/40 border border-white/14 rounded-lg px-2 py-1.5 text-sm text-white outline-none"
                    />
                  ) : (
                    <button
                      onClick={() => selectSession(session.id)}
                      onDoubleClick={() => handleRenameStart(session)}
                      className={cn(
                        'w-full text-left px-2 py-1.5 rounded-lg text-sm transition-colors truncate',
                        currentSessionId === session.id ? 'text-white/95 bg-white/8' : 'text-white/60 hover:text-white/90 hover:bg-white/6'
                      )}
                    >
                      {session.name}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-auto px-3 pb-5">
          <div className="flex items-center justify-between">
            {!isSidebarCollapsed && (
              <div className="text-sm text-white/65 truncate pr-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-white/85">{USER_NAME}</span>
                  <span className={cn('w-2 h-2 rounded-full', qualityDotColor)} title={`Network: ${networkQuality}`} />
                  <svg className="w-3.5 h-3.5 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.858 15.355-5.858 21.213 0" />
                  </svg>
                </div>
                <div className="text-xs text-white/50">
                  {status === SessionStatus.ACTIVE ? `Live · ${formatTime(sessionDuration)}` : `Ready · ${selectedTutorMeta.name}`}
                </div>
              </div>
            )}
            <button
              onClick={() => setIsSettingsOpen((prev) => !prev)}
              data-testid="settings-button"
              className="w-10 h-10 rounded-xl bg-white/8 hover:bg-white/12 border border-white/10 transition-colors shrink-0"
              title="Settings"
            >
              <svg className="w-5 h-5 mx-auto text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};