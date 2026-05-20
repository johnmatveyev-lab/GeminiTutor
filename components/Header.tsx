import React, { useState } from 'react';
import { cn } from '../lib/utils';
import { SessionStatus, TutorType } from '../types';
import { TUTOR_TYPES, AVAILABLE_VOICES, AI_INTERVIEW_LEVELS } from '../constants';

interface HeaderProps {
  status: SessionStatus;
  selectedTutorId: string;
  onTutorSelect: (id: string) => void;
  sessionDuration: number;
  selectedVoice: string;
  onVoiceSelect: (voice: string) => void;
  shortcutKey: string;
  onShortcutKeyChange: (key: string) => void;
  isBrowserControlSkillEnabled: boolean;
  onBrowserControlSkillChange: (enabled: boolean) => void;
  browserControlBridgeReady: boolean;
  onResetTestState: () => void;
  theme: 'dark' | 'light';
  onThemeChange: (theme: 'dark' | 'light') => void;
  interviewLevel: string;
  onInterviewLevelChange: (level: string) => void;
}

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

export const Header: React.FC<HeaderProps> = ({
  status,
  selectedTutorId,
  onTutorSelect,
  sessionDuration,
  selectedVoice,
  onVoiceSelect,
  shortcutKey,
  onShortcutKeyChange,
  isBrowserControlSkillEnabled,
  onBrowserControlSkillChange,
  browserControlBridgeReady,
  onResetTestState,
  theme,
  onThemeChange,
  interviewLevel,
  onInterviewLevelChange
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isRecordingKey, setIsRecordingKey] = useState(false);

  const statusConfig = {
    [SessionStatus.ACTIVE]: { color: 'bg-[var(--color-success)]', shadow: 'shadow-[0_0_8px_var(--color-success)]', text: 'Live' },
    [SessionStatus.CONNECTING]: { color: 'bg-[var(--color-warning)]', shadow: 'shadow-[0_0_8px_var(--color-warning)]', text: 'Connecting' },
    [SessionStatus.ERROR]: { color: 'bg-[var(--color-danger)]', shadow: 'shadow-[0_0_8px_var(--color-danger)]', text: 'Error' },
    [SessionStatus.IDLE]: { color: 'bg-white/20', shadow: '', text: 'Offline' },
  };

  const currentStatus = statusConfig[status] || statusConfig[SessionStatus.IDLE];

  return (
    <header className="relative z-[120] mx-auto max-w-4xl glass-card rounded-2xl px-5 py-3 flex items-center justify-between">
      {/* Logo & Title */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[var(--color-primary-muted)] flex items-center justify-center">
          <svg className="w-5 h-5 text-[var(--color-primary-light)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>
        <div>
          <h1 className="text-base font-semibold tracking-tight">Gemini Tutor</h1>
          <p className="text-xs text-white/40">Real-time AI Guidance</p>
        </div>
      </div>

      {/* Status & Timer */}
      <div className="flex items-center gap-3">
        {(status === SessionStatus.ACTIVE || sessionDuration > 0) && (
          <span className={cn(
            'font-mono text-xs px-2.5 py-1 rounded-lg',
            status === SessionStatus.ACTIVE ? 'text-white/80 glass' : 'text-white/30'
          )}>
            {formatTime(sessionDuration)}
          </span>
        )}

        <div className="flex items-center gap-2 glass px-3 py-1.5 rounded-lg">
          <div className={cn('w-2 h-2 rounded-full', currentStatus.color, currentStatus.shadow, status === SessionStatus.ACTIVE && 'animate-pulse')} />
          <span className="text-xs font-medium text-white/60">{currentStatus.text}</span>
        </div>

        {/* Settings */}
        <div className="relative z-[130]">
          <button
            data-testid="settings-button"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="w-9 h-9 flex items-center justify-center rounded-xl glass hover:bg-[var(--glass-bg-hover)] transition-colors duration-150"
            title="Settings"
          >
            <svg className="w-4 h-4 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>

          {isMenuOpen && (
            <>
              <div className="fixed inset-0 z-[140]" onClick={() => setIsMenuOpen(false)} />
              <div className={cn(
                'absolute right-0 top-12 w-72 rounded-2xl z-[150] overflow-hidden animate-scale-in shadow-2xl',
                theme === 'light'
                  ? 'bg-white/90 border border-slate-300/80'
                  : 'bg-[#111318] border border-white/15'
              )}>
                {/* Tutor Section */}
                <div className="p-4 border-b border-white/5">
                  <h3 className="text-xs font-medium text-white/50 mb-1">Tutor Personality</h3>
                  <p className="text-[10px] text-white/30 leading-relaxed mb-3">Takes effect on next session start</p>
                  <div className="relative">
                    <select
                      value={selectedTutorId}
                      onChange={(e) => onTutorSelect(e.target.value)}
                      className="w-full appearance-none glass rounded-xl px-3 py-2 text-sm font-medium text-white outline-none cursor-pointer transition-colors hover:bg-[var(--glass-bg-hover)]"
                    >
                      {TUTOR_TYPES.map(tutor => (
                        <option key={tutor.id} value={tutor.id} className="bg-[var(--color-surface)] text-white">
                          {tutor.name}
                        </option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <svg className="w-3.5 h-3.5 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                  <div className="mt-2 px-3 py-2 glass rounded-xl">
                    <p className="text-[11px] text-white/60">
                      {(TUTOR_TYPES.find(t => t.id === selectedTutorId) || TUTOR_TYPES[0]).description}
                    </p>
                  </div>
                </div>

                {/* Voice Section */}
                <div className="p-4 border-b border-white/5">
                  <h3 className="text-xs font-medium text-white/50 mb-2">Voice</h3>
                  <div className="relative">
                    <select
                      value={selectedVoice}
                      onChange={(e) => onVoiceSelect(e.target.value)}
                      className="w-full appearance-none glass rounded-xl px-3 py-2 text-sm font-medium text-white outline-none cursor-pointer transition-colors hover:bg-[var(--glass-bg-hover)]"
                    >
                      {AVAILABLE_VOICES.map(voice => (
                        <option key={voice} value={voice} className="bg-[var(--color-surface)] text-white">{voice}</option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <svg className="w-3.5 h-3.5 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Theme Section */}
                <div className="p-4 border-b border-white/5">
                  <h3 className="text-xs font-medium text-white/50 mb-2">Appearance</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => onThemeChange('dark')}
                      className={cn(
                        'px-3 py-2 rounded-xl text-sm font-medium transition-colors duration-150',
                        theme === 'dark' ? 'bg-[var(--color-primary)] text-white' : 'glass text-white/70 hover:bg-[var(--glass-bg-hover)]'
                      )}
                    >
                      Dark
                    </button>
                    <button
                      type="button"
                      onClick={() => onThemeChange('light')}
                      className={cn(
                        'px-3 py-2 rounded-xl text-sm font-medium transition-colors duration-150',
                        theme === 'light' ? 'bg-[var(--color-primary)] text-white' : 'glass text-white/70 hover:bg-[var(--glass-bg-hover)]'
                      )}
                    >
                      Light
                    </button>
                  </div>
                </div>

                {selectedTutorId === 'ai-interviewer' && (
                  <div className="p-4 border-b border-white/5">
                    <h3 className="text-xs font-medium text-white/50 mb-2">Interview Level</h3>
                    <div className="relative">
                      <select
                        value={interviewLevel}
                        onChange={(e) => onInterviewLevelChange(e.target.value)}
                        className="w-full appearance-none glass rounded-xl px-3 py-2 text-sm font-medium text-white outline-none cursor-pointer transition-colors hover:bg-[var(--glass-bg-hover)]"
                      >
                        {AI_INTERVIEW_LEVELS.map(level => (
                          <option key={level.id} value={level.id} className="bg-[var(--color-surface)] text-white">
                            {level.label}
                          </option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                        <svg className="w-3.5 h-3.5 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                )}

                {/* Browser Control Skill */}
                <div className="p-4 border-b border-white/5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-xs font-medium text-white/50 mb-1">Browser Control Skill</h3>
                      <div className="flex items-center gap-1.5">
                        <span className={cn('w-1.5 h-1.5 rounded-full', browserControlBridgeReady ? 'bg-[var(--color-success)]' : 'bg-[var(--color-warning)]')} />
                        <span className="text-[10px] text-white/30">
                          {browserControlBridgeReady ? 'Bridge ready' : 'Bridge offline'}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      data-testid="browser-skill-toggle"
                      onClick={() => onBrowserControlSkillChange(!isBrowserControlSkillEnabled)}
                      className={cn(
                        'relative w-11 h-6 rounded-full border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40',
                        isBrowserControlSkillEnabled
                          ? 'bg-[var(--color-primary)] border-[var(--color-primary-light)]/40 glow-primary'
                          : 'bg-white/10 border-white/20'
                      )}
                      aria-pressed={isBrowserControlSkillEnabled}
                    >
                      <span
                        className={cn(
                          'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-[0_1px_6px_rgba(0,0,0,0.35)] transition-transform duration-200',
                          isBrowserControlSkillEnabled ? 'translate-x-[22px]' : 'translate-x-0.5'
                        )}
                      />
                    </button>
                  </div>
                </div>

                {/* Shortcut Key */}
                <div className="p-4">
                  <h3 className="text-xs font-medium text-white/50 mb-2">Quick Start Shortcut</h3>
                  <button
                    onClick={(e) => { e.stopPropagation(); setIsRecordingKey(true); }}
                    onKeyDown={(e) => {
                      if (isRecordingKey) {
                        e.preventDefault();
                        e.stopPropagation();
                        onShortcutKeyChange(e.code);
                        setIsRecordingKey(false);
                      }
                    }}
                    onBlur={() => setIsRecordingKey(false)}
                    className={cn(
                      'w-full text-left glass rounded-xl px-3 py-2 text-sm font-medium text-white transition-all duration-150 flex justify-between items-center',
                      isRecordingKey
                        ? 'border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/30 glow-primary'
                        : 'hover:bg-[var(--glass-bg-hover)]'
                    )}
                  >
                    <span>{isRecordingKey ? 'Press any key...' : shortcutKey || 'None'}</span>
                    {!isRecordingKey && (
                      <span className="text-[10px] text-white/30 glass px-1.5 py-0.5 rounded">Edit</span>
                    )}
                  </button>
                  <button
                    data-testid="reset-test-state"
                    onClick={() => { onResetTestState(); setIsMenuOpen(false); }}
                    className="w-full mt-3 text-left glass rounded-xl px-3 py-2 text-sm font-medium text-white/80 transition-all duration-150 hover:bg-[var(--glass-bg-hover)]"
                  >
                    Reset Test State
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
