import React from 'react';

export const ScreenShare: React.FC<{
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isScreenSharing: boolean;
}> = ({ videoRef, isScreenSharing }) => {
  if (!isScreenSharing) return null;

  return (
    <div className="max-w-5xl mx-auto mb-8 rounded-3xl overflow-hidden border border-white/15 bg-black/40">
      <video ref={videoRef} autoPlay playsInline className="w-full h-[280px] md:h-[360px] object-contain bg-black/70" />
    </div>
  );
};