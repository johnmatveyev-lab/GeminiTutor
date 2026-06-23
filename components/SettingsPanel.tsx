import React from 'react';
import { cn } from '../lib/utils';
import { TUTOR_TYPES, AVAILABLE_VOICES, AI_INTERVIEW_LEVELS } from '../constants';

export const SettingsPanel: React.FC<{
  isSettingsOpen: boolean;
  setIsSettingsOpen: (v: boolean) => void;
  isSidebarCollapsed: boolean;
  selectedTutorId: string;
  setSelectedTutorId: (v: string) => void;
  selectedVoice: string;
  setSelectedVoice: (v: string) => void;
  interviewLevel: string;
  setInterviewLevel: (v: string) => void;
  theme: 'dark' | 'light';
  setTheme: (v: 'dark' | 'light') => void;
  shortcutKey: string;
  setShortcutKey: (v: string) => void;
  resetTestState: () => void;
  isRecordingKey: boolean;
  setIsRecordingKey: (v: boolean) => void;
  isGoogleSearchEnabled: boolean;
  setIsGoogleSearchEnabled: (v: boolean) => void;
  isCodeExecutionEnabled: boolean;
  setIsCodeExecutionEnabled: (v: boolean) => void;
}> = ({
  isSettingsOpen,
  setIsSettingsOpen,
  isSidebarCollapsed,
  selectedTutorId,
  setSelectedTutorId,
  selectedVoice,
  setSelectedVoice,
  interviewLevel,
  setInterviewLevel,
  theme,
  setTheme,
  shortcutKey,
  setShortcutKey,
  resetTestState,
  isRecordingKey,
  setIsRecordingKey,
  isGoogleSearchEnabled,
  setIsGoogleSearchEnabled,
  isCodeExecutionEnabled,
  setIsCodeExecutionEnabled,
}) => {
  if (!isSettingsOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[120]" onClick={() => setIsSettingsOpen(false)} />
      <div className={cn(
        'fixed bottom-20 z-[130] w-80 rounded-2xl bg-[#171a21]/96 border border-white/18 backdrop-blur-xl shadow-2xl p-4 space-y-4',
        isSidebarCollapsed ? 'left-20' : 'left-72'
      )}>
        <div>
          <p className="text-xs text-white/45 mb-1">Choose Tutor</p>
          <select
            value={selectedTutorId}
            onChange={(e) => setSelectedTutorId(e.target.value)}
            className="w-full h-10 rounded-xl bg-black/40 border border-white/14 px-3 text-sm"
          >
            {TUTOR_TYPES.map((tutor) => (
              <option key={tutor.id} value={tutor.id}>{tutor.name}</option>
            ))}
          </select>
        </div>
        <div>
          <p className="text-xs text-white/45 mb-1">Voice</p>
          <select
            value={selectedVoice}
            onChange={(e) => setSelectedVoice(e.target.value)}
            className="w-full h-10 rounded-xl bg-black/40 border border-white/14 px-3 text-sm"
          >
            {AVAILABLE_VOICES.map((voice) => (
              <option key={voice} value={voice}>{voice}</option>
            ))}
          </select>
        </div>
        {selectedTutorId === 'ai-interviewer' && (
          <div>
            <p className="text-xs text-white/45 mb-1">Interview Level</p>
            <select
              value={interviewLevel}
              onChange={(e) => setInterviewLevel(e.target.value)}
              className="w-full h-10 rounded-xl bg-black/40 border border-white/14 px-3 text-sm"
            >
              {AI_INTERVIEW_LEVELS.map((level) => (
                <option key={level.id} value={level.id}>{level.label}</option>
              ))}
            </select>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setTheme('dark')}
            className={cn('h-10 rounded-xl text-sm', theme === 'dark' ? 'bg-blue-600 text-white' : 'bg-white/10 text-white/75')}
          >
            Dark
          </button>
          <button
            onClick={() => setTheme('light')}
            className={cn('h-10 rounded-xl text-sm', theme === 'light' ? 'bg-blue-600 text-white' : 'bg-white/10 text-white/75')}
          >
            Light
          </button>
        </div>

        <div className="border-t border-white/5 pt-3 space-y-3">
          <h3 className="text-xs font-medium text-white/50 mb-1">Capabilities (API Tools)</h3>
          
          <div className="flex items-center justify-between py-1">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-white/90">Google Search</span>
              <span className="text-[10px] text-white/40">Requires Paid Tier key</span>
            </div>
            <button
              type="button"
              onClick={() => setIsGoogleSearchEnabled(!isGoogleSearchEnabled)}
              className={cn(
                "w-11 h-6 rounded-full transition-colors relative outline-none cursor-pointer",
                isGoogleSearchEnabled ? "bg-blue-600" : "bg-white/10 border border-white/10"
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform shadow-md",
                  isGoogleSearchEnabled ? "translate-x-5" : "translate-x-0"
                )}
              />
            </button>
          </div>

          <div className="flex items-center justify-between py-1">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-white/90">Python Code Execution</span>
              <span className="text-[10px] text-white/40">Run code in sandbox</span>
            </div>
            <button
              type="button"
              onClick={() => setIsCodeExecutionEnabled(!isCodeExecutionEnabled)}
              className={cn(
                "w-11 h-6 rounded-full transition-colors relative outline-none cursor-pointer",
                isCodeExecutionEnabled ? "bg-blue-600" : "bg-white/10 border border-white/10"
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform shadow-md",
                  isCodeExecutionEnabled ? "translate-x-5" : "translate-x-0"
                )}
              />
            </button>
          </div>
        </div>

        <div className="border-t border-white/5 pt-3">
          <h3 className="text-xs font-medium text-white/50 mb-2">Quick Start Shortcut</h3>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setIsRecordingKey(true); }}
            onKeyDown={(e) => {
              if (isRecordingKey) {
                e.preventDefault();
                e.stopPropagation();
                setShortcutKey(e.code);
                setIsRecordingKey(false);
              }
            }}
            onBlur={() => setIsRecordingKey(false)}
            className={cn(
              'w-full text-left bg-black/40 border border-white/14 rounded-xl px-3 py-2 text-sm font-medium text-white transition-all duration-150 flex justify-between items-center cursor-pointer',
              isRecordingKey
                ? 'border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/30 glow-primary'
                : 'hover:bg-[var(--glass-bg-hover)]'
            )}
          >
            <span>{isRecordingKey ? 'Press any key...' : shortcutKey || 'None'}</span>
            {!isRecordingKey && (
              <span className="text-[10px] text-white/30 bg-white/10 px-1.5 py-0.5 rounded">Edit</span>
            )}
          </button>

          <button
            type="button"
            data-testid="reset-test-state"
            onClick={() => { resetTestState(); setIsSettingsOpen(false); }}
            className="w-full mt-3 text-center bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm font-medium text-white/80 transition-all duration-150 hover:bg-white/10 cursor-pointer"
          >
            Reset Test State
          </button>
        </div>
      </div>
    </>
  );
};