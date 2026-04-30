
import React, { useState } from 'react';
import { SessionStatus, TutorType } from '../types';
import { TUTOR_TYPES, AVAILABLE_VOICES } from '../constants';

interface HeaderProps {
  status: SessionStatus;
  selectedTutorId: string;
  onTutorSelect: (id: string) => void;
  sessionDuration: number;
  selectedVoice: string;
  onVoiceSelect: (voice: string) => void;
  shortcutKey: string;
  onShortcutKeyChange: (key: string) => void;
}

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

export const Header: React.FC<HeaderProps> = ({ status, selectedTutorId, onTutorSelect, sessionDuration, selectedVoice, onVoiceSelect, shortcutKey, onShortcutKeyChange }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isRecordingKey, setIsRecordingKey] = useState(false);
  const getStatusColor = () => {
    switch (status) {
      case SessionStatus.ACTIVE: return 'bg-[#34C759] shadow-[#34C759]/40';
      case SessionStatus.CONNECTING: return 'bg-[#FF9F0A] shadow-[#FF9F0A]/40';
      case SessionStatus.ERROR: return 'bg-[#FF453A] shadow-[#FF453A]/40';
      default: return 'bg-white/20 shadow-transparent';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case SessionStatus.ACTIVE: return 'Live Guidance Active';
      case SessionStatus.CONNECTING: return 'Establishing Link...';
      case SessionStatus.ERROR: return 'Connection Error';
      default: return 'Tutor Offline';
    }
  };

  return (
    <header className="mx-auto max-w-4xl px-5 py-3 border border-[#05726e] flex justify-between items-center bg-[#000000] backdrop-blur-3xl rounded-full shadow-2xl transition-all duration-500 text-[#045846] font-[Georgia]">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-[#0095b1] border border-[#08f4ff] rounded-full flex items-center justify-center shadow-lg shadow-[#0A84FF]/20">
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white mb-0.5">Gemini Tutor</h1>
          <p className="text-[11px] uppercase tracking-wider text-white/50 font-medium">Real-time Visually Aware AI</p>
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        {(status === SessionStatus.ACTIVE || sessionDuration > 0) && (
          <div className={`font-mono font-medium text-[13px] px-3 py-1 bg-black/20 rounded-full transition-colors ${status === SessionStatus.ACTIVE ? 'text-white/80' : 'text-white/40'}`}>
            {formatTime(sessionDuration)}
          </div>
        )}

        <div className="flex items-center gap-2.5 bg-black/20 backdrop-blur-md px-4 py-2 rounded-full border border-white/5">
          <div className={`w-2.5 h-2.5 rounded-full ${getStatusColor()} shadow-md animate-pulse`} />
          <span className="text-[11px] font-semibold text-white/80 uppercase tracking-widest">
            {getStatusText()}
          </span>
        </div>

        {/* Settings Menu */}
        <div className="relative">
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-black/20 hover:bg-white/10 border border-white/5 transition-colors"
            title="Settings"
          >
            <svg className="w-5 h-5 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          
          {isMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)} />
              <div className="absolute right-0 top-14 w-72 bg-[#1C1C1E]/95 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden transform origin-top-right transition-all">
                <div className="p-4 border-b border-white/5">
                  <h3 className="text-[13px] font-semibold text-white/90 uppercase tracking-widest mb-1">Tutor Personality</h3>
                  <p className="text-[11px] text-white/50 leading-relaxed">Select the teaching style that works best for you. (Takes effect on next start)</p>
                </div>
                <div className="max-h-64 overflow-y-auto custom-scrollbar">
                  {TUTOR_TYPES.map(tutor => (
                    <button
                      key={tutor.id}
                      onClick={() => {
                        onTutorSelect(tutor.id);
                        setIsMenuOpen(false);
                      }}
                      className={`w-full text-left p-4 hover:bg-white/5 transition-colors flex flex-col gap-1 border-l-2 ${
                        selectedTutorId === tutor.id ? 'border-[#0A84FF] bg-white/5' : 'border-transparent'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[14px] font-medium text-white">{tutor.name}</span>
                        {selectedTutorId === tutor.id && (
                          <svg className="w-4 h-4 text-[#0A84FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className="text-[12px] text-white/60">{tutor.description}</span>
                    </button>
                  ))}
                </div>
                <div className="p-4 bg-black/20">
                  <h3 className="text-[13px] font-semibold text-white/90 uppercase tracking-widest mb-2 flex items-center justify-between">
                    <span>Voice</span>
                  </h3>
                  <div className="relative">
                    <select
                      value={selectedVoice}
                      onChange={(e) => onVoiceSelect(e.target.value)}
                      className="w-full appearance-none bg-white/5 border border-white/10 hover:border-white/20 rounded-xl px-4 py-2.5 text-[14px] font-medium text-white outline-none cursor-pointer transition-colors"
                    >
                      {AVAILABLE_VOICES.map(voice => (
                        <option key={voice} value={voice} className="bg-[#1C1C1E] text-white">
                          {voice}
                        </option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <svg className="w-4 h-4 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-black/20 border-t border-white/5">
                  <h3 className="text-[13px] font-semibold text-white/90 uppercase tracking-widest mb-2 flex items-center justify-between">
                    <span>Quick Start Shortcut</span>
                  </h3>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsRecordingKey(true);
                    }}
                    onKeyDown={(e) => {
                      if (isRecordingKey) {
                        e.preventDefault();
                        e.stopPropagation();
                        onShortcutKeyChange(e.code);
                        setIsRecordingKey(false);
                      }
                    }}
                    onBlur={() => setIsRecordingKey(false)}
                    className={`w-full text-left bg-white/5 border ${isRecordingKey ? 'border-[#0A84FF] ring-2 ring-[#0A84FF]/50' : 'border-white/10 hover:border-white/20'} rounded-xl px-4 py-2.5 text-[14px] font-medium text-white transition-colors flex justify-between items-center`}
                  >
                    <span>{isRecordingKey ? 'Press any key...' : shortcutKey || 'None'}</span>
                    {!isRecordingKey && (
                      <span className="text-[10px] uppercase text-white/50 bg-white/5 px-2 py-1 rounded">Edit</span>
                    )}
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
