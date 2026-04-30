
import React from 'react';

interface ScreenShareProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  isSharing: boolean;
  onToggle: () => void;
}

export const ScreenShare: React.FC<ScreenShareProps> = ({ videoRef, isSharing, onToggle }) => {
  return (
    <div className={`relative flex-1 backdrop-blur-2xl rounded-[32px] overflow-hidden shadow-2xl group flex flex-col transition-all duration-700 border ${isSharing ? 'bg-black/60 border-[#FF453A]/30 shadow-[0_0_50px_rgba(255,69,58,0.15)]' : 'bg-[#1C1C1E]/40 border-white/10'}`}>
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        className={`w-full h-full object-contain ${isSharing ? 'opacity-100' : 'opacity-0'} transition-opacity duration-700`} 
      />
      
      {!isSharing && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-black/20">
          <div className="w-24 h-24 bg-white/5 border border-white/10 rounded-full flex items-center justify-center mb-8 backdrop-blur-md group-hover:scale-105 transition-transform duration-500 shadow-xl">
            <svg className="w-10 h-10 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-2xl font-semibold text-white mb-3 tracking-tight">Immersive Learning</h3>
          <p className="max-w-xs text-[15px] leading-relaxed text-white/50 mb-10 font-medium">
            Share your screen securely. Your AI tutor will see what you see to provide context-aware guidance.
          </p>
          <button 
            onClick={onToggle}
            className="px-8 py-4 bg-white text-black rounded-full font-semibold transition-all shadow-[0_4px_14px_0_rgba(255,255,255,0.39)] hover:shadow-[0_6px_20px_rgba(255,255,255,0.23)] hover:bg-white/90 active:scale-95 text-[15px]"
          >
            Share Screen
          </button>
        </div>
      )}

      {isSharing && (
        <div className="absolute top-6 right-6 flex gap-3 items-center">
          <div className="group/live flex items-center gap-2.5 bg-[#FF453A] text-white px-4 py-2 rounded-full shadow-[0_0_25px_rgba(255,69,58,0.5)] relative hover:shadow-[0_0_35px_rgba(255,69,58,0.7)] cursor-default transition-all duration-300 hover:scale-105 border border-white/20">
            <div className="relative flex items-center justify-center w-2.5 h-2.5">
              <div className="absolute w-full h-full bg-white rounded-full animate-ping opacity-75" style={{ animationDuration: '1.5s' }} />
              <div className="relative w-2 h-2 bg-white rounded-full" />
            </div>
            
            <div className="flex items-center">
              <span className="text-[12px] font-bold uppercase tracking-widest text-white transition-all duration-300 shadow-sm">
                Live
              </span>
              <span className="text-[12px] font-semibold uppercase tracking-widest text-white max-w-0 overflow-hidden whitespace-nowrap opacity-0 group-hover/live:max-w-[120px] group-hover/live:opacity-100 transition-all duration-500 ease-out group-hover/live:ml-2">
                Sharing
              </span>
            </div>
          </div>
          <button 
            onClick={onToggle}
            className="flex items-center gap-2 bg-[#FF453A]/20 hover:bg-[#FF453A] border border-[#FF453A]/50 text-[#FF453A] hover:text-white px-4 py-2 rounded-full backdrop-blur-xl transition-all duration-300 shadow-lg group/btn"
          >
            <svg className="w-4 h-4 transition-transform group-hover/btn:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span className="text-[13px] font-semibold tracking-wide">Stop Sharing</span>
          </button>
        </div>
      )}
    </div>
  );
};
