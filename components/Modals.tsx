import React from 'react';
import { cn } from '../lib/utils';

export const SessionSwitchModal: React.FC<{
  sessionSwitchWarning: boolean;
  pendingSessionId: string | null;
  cancelSessionSwitch: () => void;
  confirmSessionSwitch: () => void;
}> = ({ sessionSwitchWarning, pendingSessionId, cancelSessionSwitch, confirmSessionSwitch }) => {
  if (!sessionSwitchWarning) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="glass-card rounded-2xl p-6 max-w-md mx-4 animate-scale-in">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-[var(--color-warning-muted)] flex items-center justify-center">
            <svg className="w-5 h-5 text-[var(--color-warning)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold">
            {pendingSessionId === null ? 'Delete Active Session?' : 'Active Session in Progress'}
          </h3>
        </div>
        <p className="text-sm text-white/60 mb-5 leading-relaxed">
          {pendingSessionId === null
            ? 'You have an active tutoring session. Deleting this session will end it and remove all data. Are you sure?'
            : 'You have an active tutoring session. Switching sessions will end the current session. Are you sure?'}
        </p>
        <div className="flex gap-3">
          <button
            onClick={cancelSessionSwitch}
            className="flex-1 px-4 py-2.5 glass hover:bg-[var(--glass-bg-hover)] rounded-xl font-medium transition-colors duration-150"
          >
            Cancel
          </button>
          <button
            onClick={confirmSessionSwitch}
            className="flex-1 px-4 py-2.5 bg-[var(--color-warning)] hover:bg-[var(--color-warning)]/90 text-white rounded-xl font-medium transition-colors duration-150 glow-warning"
          >
            {pendingSessionId === null ? 'End & Delete' : 'End & Switch'}
          </button>
        </div>
      </div>
    </div>
  );
};