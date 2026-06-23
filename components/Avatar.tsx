import React from 'react';
import { cn } from '../lib/utils';

export const Avatar: React.FC<{
  id: string;
  className?: string;
}> = ({ id, className }) => {
  const baseClass = "relative overflow-hidden shrink-0 flex items-center justify-center shadow-md select-none";

  // Gradient background mapping
  const getGradient = (tutorId: string) => {
    switch (tutorId) {
      case 'generalist':
        return 'from-emerald-400 to-teal-600 text-white';
      case 'code-master':
        return 'from-amber-500 to-red-600 text-white';
      case 'language-coach':
        return 'from-pink-400 to-rose-600 text-white';
      case 'creative-muse':
        return 'from-purple-400 to-indigo-600 text-white';
      case 'drill-sergeant':
        return 'from-red-500 to-amber-600 text-white';
      case 'empath':
        return 'from-violet-400 to-fuchsia-600 text-white';
      case 'ged-tutor':
        return 'from-sky-400 to-blue-600 text-white';
      case 'ai-interviewer':
        return 'from-slate-500 to-slate-700 text-white';
      case 'google-certificate-tutor':
        return 'from-yellow-400 to-orange-500 text-white';
      case 'claude-code-tutor':
        return 'from-purple-600 to-violet-800 text-white';
      case 'adhd-tutor':
        return 'from-cyan-400 to-sky-600 text-white';
      case 'user':
        return 'from-blue-500 to-indigo-600 text-white';
      default:
        return 'from-gray-400 to-gray-600 text-white';
    }
  };

  // Icon mapping
  const renderIcon = (tutorId: string) => {
    switch (tutorId) {
      case 'generalist':
        return (
          // Book with sparkle stars
          <svg className="w-1/2 h-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2l1.2 2.4L15.6 5l-2.4 1.2L12 8.6 10.8 6.2 8.4 5l2.4-1.2z" className="animate-pulse" />
          </svg>
        );
      case 'code-master':
        return (
          // Code symbol </>
          <svg className="w-1/2 h-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
        );
      case 'language-coach':
        return (
          // Globe with chat bubbles
          <svg className="w-1/2 h-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        );
      case 'creative-muse':
        return (
          // Paint palette
          <svg className="w-1/2 h-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
          </svg>
        );
      case 'drill-sergeant':
        return (
          // Shield / Badge
          <svg className="w-1/2 h-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        );
      case 'empath':
        return (
          // Heart
          <svg className="w-1/2 h-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        );
      case 'ged-tutor':
        return (
          // Graduation cap
          <svg className="w-1/2 h-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path d="M12 14l9-5-9-5-9 5 9 5z" />
            <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0v6m0 0H9m3 0h3m-3-6a3 3 0 100-6 3 3 0 000 6z" />
          </svg>
        );
      case 'ai-interviewer':
        return (
          // Clipboard check
          <svg className="w-1/2 h-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        );
      case 'google-certificate-tutor':
        return (
          // Certificate / Badge / Award
          <svg className="w-1/2 h-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5a3 3 0 10-3 3h3zm0 0H9m3 0h3M5 9h14l1 12H4L5 9z" />
          </svg>
        );
      case 'claude-code-tutor':
        return (
          // Futuristic Terminal Block / Pulse
          <svg className="w-1/2 h-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        );
      case 'adhd-tutor':
        return (
          // Brain / Lightbulb with stethoscope
          <svg className="w-1/2 h-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        );
      case 'user':
        return (
          // Clean User Profile icon
          <svg className="w-1/2 h-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        );
      default:
        return (
          // Fallback user icon
          <svg className="w-1/2 h-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H3.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" />
          </svg>
        );
    }
  };

  return (
    <div className={cn("bg-gradient-to-br", getGradient(id), baseClass, className)}>
      {renderIcon(id)}
    </div>
  );
};
