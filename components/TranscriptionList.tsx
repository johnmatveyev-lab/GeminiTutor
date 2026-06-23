import React from 'react';
import { cn } from '../lib/utils';
import { SessionStatus, Transcription, ChatSession } from '../types';
import { Avatar } from './Avatar';

export const TranscriptionList: React.FC<{
  transcriptions: Transcription[];
  activeInputText: string;
  activeOutputText: string;
  status: SessionStatus;
  stopSession: () => void;
  startSession: () => void;
  toggleScreenShare: () => void;
  isScreenSharing: boolean;
  selectedTutorMeta: { id: string; name: string };
  transcriptScrollRef: React.RefObject<HTMLDivElement | null>;
  currentSession: ChatSession | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isThinking: boolean;
}> = ({
  transcriptions,
  activeInputText,
  activeOutputText,
  status,
  stopSession,
  startSession,
  toggleScreenShare,
  isScreenSharing,
  selectedTutorMeta,
  transcriptScrollRef,
  currentSession,
  videoRef,
  isThinking,
}) => {
  const [copied, setCopied] = React.useState(false);

  const getMarkdownContent = () => {
    if (!currentSession) return '';
    const lines = currentSession.transcriptions.map(t => {
      const role = t.role === 'user' ? 'User' : selectedTutorMeta.name;
      const time = new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      return `### [${time}] **${role}**\n\n> ${t.text}`;
    });
    const header = `# Session Transcript: ${currentSession.name}\n\n- **Date**: ${new Date(currentSession.createdAt).toLocaleString()}\n- **Duration**: ${currentSession.duration} seconds\n- **Tutor**: ${selectedTutorMeta.name}\n\n---\n\n## Conversation\n\n`;
    return header + lines.join('\n\n');
  };

  const exportTranscript = () => {
    if (!currentSession) return;
    const content = getMarkdownContent();
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript-${currentSession.id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyMarkdown = () => {
    if (!currentSession) return;
    const content = getMarkdownContent();
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
      console.warn('Clipboard write failed, falling back to visual success state:', err);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div
      ref={transcriptScrollRef}
      className="absolute inset-0 overflow-y-auto px-5 md:px-20 lg:px-36 pt-16 md:pt-20 pb-44"
    >
      {isScreenSharing && (
        <div className="max-w-5xl mx-auto mb-8 rounded-3xl overflow-hidden border border-white/15 bg-black/40">
          <video ref={videoRef} autoPlay playsInline className="w-full h-[280px] md:h-[360px] object-contain bg-black/70" />
        </div>
      )}

      {transcriptions.length === 0 && !activeInputText && !activeOutputText && (
        <div className="h-full min-h-[420px] flex flex-col items-center justify-center text-center">
          <h2 className="text-4xl md:text-6xl font-medium tracking-tight text-white/90 mb-4">Hi there, what do you want to learn today?</h2>
          <p className="text-white/45 max-w-2xl text-lg mb-6">Start an immersive lesson with {selectedTutorMeta.name} and ask anything in text, voice, or shared-screen mode.</p>
          <div className="flex items-center gap-3">
            <button
              onClick={status === SessionStatus.ACTIVE ? stopSession : startSession}
              data-testid="start-session"
              className={cn(
                'px-6 h-12 rounded-full font-semibold border transition-all duration-200 hover:scale-105 active:scale-95 shadow-[0_12px_34px_rgba(0,0,0,0.32)] cursor-pointer',
                status === SessionStatus.ACTIVE
                  ? 'bg-gradient-to-r from-rose-500 to-red-600 text-white border-rose-400/30 shadow-[0_0_24px_rgba(239,68,68,0.3)] animate-pulse-red'
                  : 'bg-gradient-to-r from-emerald-500 to-green-600 text-white border-emerald-400/30 hover:shadow-[0_0_24px_rgba(16,185,129,0.35)]'
              )}
            >
              {status === SessionStatus.ACTIVE ? 'End Session' : 'Start Session'}
            </button>
            <button
              onClick={toggleScreenShare}
              className="px-6 h-12 rounded-full bg-white/8 hover:bg-white/14 text-white border border-white/12 transition-colors shadow-[0_12px_34px_rgba(0,0,0,0.32)]"
            >
              {isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
            </button>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto space-y-5">
        {transcriptions.length > 0 && currentSession && (
          <div className="flex justify-end gap-2 mb-2">
            <button
              onClick={copyMarkdown}
              className="px-3 py-1.5 rounded-full bg-white/8 hover:bg-white/14 text-white/70 hover:text-white text-xs border border-white/10 transition-all flex items-center gap-1.5 cursor-pointer"
              title="Copy transcript as Markdown"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
              {copied ? 'Copied!' : 'Copy Markdown'}
            </button>
            <button
              onClick={exportTranscript}
              className="px-3 py-1.5 rounded-full bg-white/8 hover:bg-white/14 text-white/70 hover:text-white text-xs border border-white/10 transition-all flex items-center gap-1.5 cursor-pointer"
              title="Export transcript as .md Markdown file"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
              </svg>
              Download MD
            </button>
          </div>
        )}
        {transcriptions.map((item) => {
          const isUser = item.role === 'user';
          return (
            <div key={item.id} className={cn('flex items-end gap-2.5', isUser ? 'justify-end' : 'justify-start')}>
              {!isUser && <Avatar id={selectedTutorMeta.id} className="w-8 h-8 rounded-full border border-white/10 shadow-sm" />}
              <div className={cn(
                'max-w-[78%] px-5 py-3 rounded-3xl text-[15px] leading-relaxed shadow-sm',
                isUser
                  ? 'bg-blue-600 text-white rounded-br-xl'
                  : 'bg-white/5 text-white/90 border border-white/10 rounded-bl-xl'
              )}>
                {item.text}
              </div>
              {isUser && <Avatar id="user" className="w-8 h-8 rounded-full border border-white/10 shadow-sm" />}
            </div>
          );
        })}
        {activeInputText && (
          <div className="flex items-end gap-2.5 justify-end">
            <div className="max-w-[78%] px-5 py-3 rounded-3xl rounded-br-xl bg-blue-500/80 text-white shadow-sm">
              {activeInputText}
            </div>
            <Avatar id="user" className="w-8 h-8 rounded-full border border-white/10 shadow-sm" />
          </div>
        )}
        {activeOutputText && (
          <div className="flex items-end gap-2.5 justify-start">
            <Avatar id={selectedTutorMeta.id} className="w-8 h-8 rounded-full border border-white/10 shadow-sm" />
            <div className="max-w-[78%] px-5 py-3 rounded-3xl rounded-bl-xl bg-white/5 border border-white/10 text-white/90 shadow-sm">
              {activeOutputText}
            </div>
          </div>
        )}
        {isThinking && (
          <div className="flex items-end gap-2.5 justify-start">
            <Avatar id={selectedTutorMeta.id} className="w-8 h-8 rounded-full border border-white/10 shadow-sm" />
            <div className="max-w-[78%] px-5 py-4 rounded-3xl rounded-bl-xl bg-white/5 border border-white/10 text-white/90 flex items-center gap-1.5 shadow-sm min-w-[72px] justify-center">
              <span className="w-2.5 h-2.5 rounded-full bg-white/50 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2.5 h-2.5 rounded-full bg-white/50 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2.5 h-2.5 rounded-full bg-white/50 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}

        {/* Mock Interview Evaluation Report Dashboard */}
        {(() => {
          if (status !== SessionStatus.IDLE || selectedTutorMeta.id !== 'ai-interviewer' || transcriptions.length === 0) return null;
          
          // Helper to parse report
          const modelMessages = [...transcriptions].reverse().filter(t => t.role === 'model');
          let reportText = '';
          for (const msg of modelMessages) {
            const text = msg.text;
            if (
              (text.toLowerCase().includes('overall score') || text.toLowerCase().includes('score:')) && 
              (text.toLowerCase().includes('strengths') || text.toLowerCase().includes('gaps'))
            ) {
              reportText = text;
              break;
            }
          }
          
          if (!reportText) return null;
          
          try {
            // 1. Overall Score
            let overallScore: number | null = null;
            const scoreMatch = reportText.match(/(?:overall score|score)\s*(?:\(0-100\))?\s*:\s*(\d+)/i) || 
                               reportText.match(/(\d+)\s*\/\s*100/i) ||
                               reportText.match(/score\s*is\s*(\d+)/i);
            if (scoreMatch) {
              overallScore = parseInt(scoreMatch[1], 10);
            }
            
            // 2. Hiring Signal
            let hiringSignal: string | null = null;
            const signalMatch = reportText.match(/(?:hiring signal|signal|hiring recommendation)\s*:\s*([A-Za-z\s]+)/i);
            if (signalMatch) {
              hiringSignal = signalMatch[1].trim();
            }
            
            // 3. Category Scores
            const categoryScores: { category: string; score: number }[] = [];
            const categoryMatches = reportText.matchAll(/(AI Dev|AI Systems|Frontend|Backend|AI Product\/Design|Product\/Design|AI Product|Design Thinking)\s*:\s*(\d+)/gi);
            for (const match of categoryMatches) {
              categoryScores.push({
                category: match[1].trim(),
                score: parseInt(match[2], 10)
              });
            }
            
            // Fallback category parsing if matches list items
            if (categoryScores.length === 0) {
              const listLines = reportText.split('\n');
              for (const line of listLines) {
                const lineMatch = line.match(/(?:-\s*|\*\s*|\d+\.\s*)(AI Dev|AI Systems|Frontend|Backend|AI Product\/Design)\s*.*?(\d+)\s*\/\s*10/i);
                if (lineMatch) {
                  categoryScores.push({
                    category: lineMatch[1].trim(),
                    score: parseInt(lineMatch[2], 10)
                  });
                }
              }
            }
            
            // Helper to extract bullet points under a section name
            const extractBullets = (sectionNames: string[]): string[] => {
              const lines = reportText.split('\n');
              let inSection = false;
              const bullets: string[] = [];
              
              for (const line of lines) {
                const trimmed = line.trim();
                // Check if starting a new section
                const isHeader = sectionNames.some(name => new RegExp(`(?:\\d+\\)\\s*|##\\s*|\\*\\*|#\\s*)?${name}`, 'i').test(trimmed));
                const isOtherHeader = /^(?:\d+\)|##|#|\*\*)\s*[a-zA-Z\s]+(?::|\s*$)/.test(trimmed) && !isHeader;
                
                if (isHeader) {
                  inSection = true;
                  continue;
                } else if (isOtherHeader && inSection) {
                  inSection = false;
                }
                
                if (inSection && trimmed) {
                  if (trimmed.startsWith('-') || trimmed.startsWith('*') || /^\d+\./.test(trimmed)) {
                    bullets.push(trimmed.replace(/^[-*\s]+|^\d+\.\s*/, ''));
                  } else if (bullets.length > 0 && !trimmed.startsWith('#')) {
                    bullets[bullets.length - 1] += ' ' + trimmed;
                  }
                }
              }
              return bullets;
            };
            
            const strengths = extractBullets(['strengths', 'strong points']);
            const weaknesses = extractBullets(['gaps and risks', 'gaps', 'risks', 'weaknesses']);
            const improvements = extractBullets(['actionable suggestions', 'improvement', 'things to work on', 'next-step']);
            
            // Overview
            let overview: string | null = null;
            const overviewMatch = reportText.match(/(?:interview overview|overview)\s*:\s*([\s\S]*?)(?=\n\n|\n\d+\)|\n#|\n\*\*|$)/i);
            if (overviewMatch) {
              overview = overviewMatch[1].trim();
            }
            
            return (
              <div className="glass-card rounded-3xl p-6 border border-white/14 shadow-2xl space-y-6 animate-fade-in mb-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-white/10">
                  <div>
                    <h3 className="text-2xl font-bold tracking-tight text-white/90">Interview Performance Evaluation</h3>
                    <p className="text-xs text-white/45 mt-1">Generated based on your mock interview session</p>
                  </div>
                  <div className="flex items-center gap-4">
                    {overallScore !== null && (
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-xs uppercase tracking-wider text-white/35">Overall Score</p>
                          <p className="text-3xl font-extrabold text-blue-400">{overallScore}<span className="text-lg text-white/45">/100</span></p>
                        </div>
                        <div className="w-12 h-12 rounded-full border-2 border-blue-400/40 flex items-center justify-center relative">
                          <svg className="absolute inset-0 -rotate-90 w-full h-full" viewBox="0 0 36 36">
                            <path className="text-white/5" strokeWidth="2.5" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                            <path className="text-blue-500 transition-all duration-1000" strokeDasharray={`${overallScore}, 100`} strokeWidth="2.5" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                          </svg>
                          <span className="text-xs font-semibold text-white/90">{overallScore}</span>
                        </div>
                      </div>
                    )}
                    {hiringSignal && (
                      <div className="text-right bg-white/5 border border-white/10 rounded-2xl px-4 py-2">
                        <p className="text-[10px] uppercase tracking-wider text-white/35">Hiring Signal</p>
                        <span className={cn(
                          'text-sm font-bold',
                          hiringSignal.toLowerCase().includes('strong yes') ? 'text-green-400' :
                          hiringSignal.toLowerCase().includes('yes') ? 'text-emerald-300' :
                          hiringSignal.toLowerCase().includes('mixed') ? 'text-yellow-400' : 'text-red-400'
                        )}>
                          {hiringSignal}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {overview && (
                  <div className="text-sm text-white/70 leading-relaxed bg-white/5 rounded-2xl p-4 border border-white/8">
                    <span className="font-semibold text-white/90 block mb-1">Interview Overview:</span>
                    {overview}
                  </div>
                )}

                {categoryScores && categoryScores.length > 0 && (
                  <div>
                    <h4 className="text-sm uppercase tracking-wider text-white/45 mb-3 font-semibold">Category Breakdown</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {categoryScores.map((score, idx) => (
                        <div key={idx} className="space-y-1 bg-white/4 rounded-xl p-3 border border-white/5">
                          <div className="flex justify-between text-xs">
                            <span className="font-medium text-white/80">{score.category}</span>
                            <span className="font-bold text-blue-300">{score.score}/10</span>
                          </div>
                          <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full transition-all duration-500"
                              style={{ width: `${score.score * 10}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {strengths && strengths.length > 0 && (
                    <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-4 space-y-2">
                      <h4 className="text-sm font-semibold text-emerald-300 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        Key Strengths
                      </h4>
                      <ul className="text-xs text-white/75 space-y-1.5 list-disc pl-4">
                        {strengths.map((str, idx) => (
                          <li key={idx}>{str}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {weaknesses && weaknesses.length > 0 && (
                    <div className="bg-rose-500/5 border border-rose-500/10 rounded-2xl p-4 space-y-2">
                      <h4 className="text-sm font-semibold text-rose-300 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                        Gaps & Risks
                      </h4>
                      <ul className="text-xs text-white/75 space-y-1.5 list-disc pl-4">
                        {weaknesses.map((weak, idx) => (
                          <li key={idx}>{weak}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {improvements && improvements.length > 0 && (
                  <div className="bg-blue-500/5 border border-blue-500/10 rounded-2xl p-4 space-y-2">
                    <h4 className="text-sm font-semibold text-blue-300 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                      Suggestions for Improvement
                    </h4>
                    <ul className="text-xs text-white/75 space-y-1.5 list-decimal pl-4">
                      {improvements.map((imp, idx) => (
                        <li key={idx}>{imp}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          } catch (err) {
            console.error('Failed to parse report:', err);
            return null;
          }
        })()}
      </div>
    </div>
  );
};