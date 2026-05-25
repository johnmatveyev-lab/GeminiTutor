import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { cn } from './lib/utils';
import {
  MODEL_NAME,
  TUTOR_TYPES,
  AVAILABLE_VOICES,
  AI_INTERVIEW_LEVELS,
  AUDIO_CONFIG,
  FRAME_RATE,
  JPEG_QUALITY,
  ADAPTIVE_QUALITY
} from './constants';
import { SessionStatus, Transcription, ChatSession } from './types';
import {
  decode,
  decodeAudioData,
  createBlob
} from './services/audioUtils';
import {
  loadSessions,
  saveSessions,
  loadCurrentSessionId,
  saveCurrentSessionId
} from './services/storageUtils';
import {
  getBrowserInfo,
  getCompatibilityMessage
} from './services/browserUtils';

const isE2EMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('e2e');
const USER_NAME = 'User';

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const Toast: React.FC<{
  visible: boolean;
  variant?: 'error' | 'warning' | 'info' | 'success';
  title: string;
  message?: string;
  onClose: () => void;
  className?: string;
}> = ({ visible, variant = 'info', title, message, onClose, className }) => {
  if (!visible) return null;

  const variantStyles = {
    error: 'border-[var(--color-danger)]/20 glow-danger',
    warning: 'border-[var(--color-warning)]/20 glow-warning',
    info: 'border-[var(--color-primary)]/20 glow-primary',
    success: 'border-[var(--color-success)]/20 glow-success',
  };

  return (
    <div className={cn(
      'glass-strong px-5 py-3 rounded-full flex items-center gap-3 max-w-md',
      'animate-slide-in-top',
      variantStyles[variant],
      className
    )}>
      <svg className="w-4 h-4 flex-shrink-0 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        {variant === 'error' && (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        )}
        {variant === 'warning' && (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        )}
        {variant === 'info' && (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        )}
        {variant === 'success' && (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        )}
      </svg>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white/90">{title}</p>
        {message && <p className="text-xs text-white/60 mt-0.5">{message}</p>}
      </div>
      <button
        onClick={onClose}
        className="p-1 hover:bg-white/10 rounded-full transition-colors duration-150"
      >
        <svg className="w-3.5 h-3.5 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};

const App: React.FC = () => {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const storedTheme = localStorage.getItem('theme_preference');
    return storedTheme === 'light' ? 'light' : 'dark';
  });
  const [status, setStatus] = useState<SessionStatus>(SessionStatus.IDLE);
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    return loadSessions();
  });
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(() => {
    return loadCurrentSessionId();
  });

  const currentSession = sessions.find(s => s.id === currentSessionId) || null;
  const transcriptions = currentSession?.transcriptions || [];

  const [selectedTutorId, setSelectedTutorId] = useState(() => {
    return currentSession?.tutorId || localStorage.getItem('selected_tutor_id') || TUTOR_TYPES[0].id;
  });

  const [selectedVoice, setSelectedVoice] = useState(() => {
    return currentSession?.voice || localStorage.getItem('selected_voice') || 'Puck';
  });

  const [shortcutKey, setShortcutKey] = useState(() => {
    return localStorage.getItem('shortcut_key') || 'F1';
  });
  const [interviewLevel, setInterviewLevel] = useState(() => {
    return localStorage.getItem('ai_interview_level') || 'mid';
  });

  
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRecordingKey, setIsRecordingKey] = useState(false);

  const [sessionDuration, setSessionDuration] = useState(() => {
    return currentSession?.duration || 0;
  });

  useEffect(() => { localStorage.setItem('selected_tutor_id', selectedTutorId); }, [selectedTutorId]);
  useEffect(() => { localStorage.setItem('selected_voice', selectedVoice); }, [selectedVoice]);
  useEffect(() => { localStorage.setItem('shortcut_key', shortcutKey); }, [shortcutKey]);
  useEffect(() => { localStorage.setItem('ai_interview_level', interviewLevel); }, [interviewLevel]);
  
  useEffect(() => {
    localStorage.setItem('theme_preference', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
  useEffect(() => { saveCurrentSessionId(currentSessionId); }, [currentSessionId]);

  const transcriptionsRef = useRef(transcriptions);
  transcriptionsRef.current = transcriptions;

  const sessionDurationRef = useRef(sessionDuration);
  sessionDurationRef.current = sessionDuration;

  const selectedTutorIdRef = useRef(selectedTutorId);
  selectedTutorIdRef.current = selectedTutorId;

  const selectedVoiceRef = useRef(selectedVoice);
  selectedVoiceRef.current = selectedVoice;

  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;

  const currentSessionIdRef = useRef(currentSessionId);
  currentSessionIdRef.current = currentSessionId;

  const [showAutoSaveToast, setShowAutoSaveToast] = useState(false);
  const transcriptScrollRef = useRef<HTMLDivElement>(null);
  const appShellRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  const updateCurrentSession = useCallback((updates: Partial<ChatSession>) => {
    if (!currentSessionIdRef.current) return;

    setSessions(prev => {
      return prev.map(session => {
        if (session.id === currentSessionIdRef.current) {
          if (updates.transcriptions && updates.transcriptions.length > 0 && session.name.startsWith('New Session')) {
            const firstTranscription = updates.transcriptions[0];
            if (firstTranscription.text) {
              const truncatedText = firstTranscription.text.length > 30
                ? firstTranscription.text.substring(0, 30) + '...'
                : firstTranscription.text;
              updates.name = truncatedText;
            }
          }

          return { ...session, ...updates, updatedAt: Date.now() };
        }
        return session;
      });
    });
  }, []);

  const renameSession = useCallback((sessionId: string, newName: string) => {
    setSessions(prev => {
      return prev.map(session => {
        if (session.id === sessionId) {
          return { ...session, name: newName, updatedAt: Date.now() };
        }
        return session;
      });
    });
  }, []);

  useEffect(() => {
    let saveInterval: number;
    let toastTimeout: number;

    if (status === SessionStatus.ACTIVE) {
      saveInterval = window.setInterval(() => {
        const currentSession = sessionsRef.current.find(s => s.id === currentSessionIdRef.current);
        if (currentSession) {
          const success = saveSessions(sessionsRef.current);
          saveCurrentSessionId(currentSessionIdRef.current || '');

          if (success) {
            setShowAutoSaveToast(true);
            if (toastTimeout) window.clearTimeout(toastTimeout);
            toastTimeout = window.setTimeout(() => setShowAutoSaveToast(false), 3000);
          } else {
            console.warn('Failed to save sessions to localStorage');
          }
        }
      }, 60000);
    }

    const handleBeforeUnload = () => {
      saveSessions(sessionsRef.current);
      saveCurrentSessionId(currentSessionIdRef.current || '');
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      if (saveInterval) window.clearInterval(saveInterval);
      if (toastTimeout) window.clearTimeout(toastTimeout);
      window.removeEventListener('beforeunload', handleBeforeUnload);

      saveSessions(sessionsRef.current);
      saveCurrentSessionId(currentSessionIdRef.current || '');
    };
  }, [status]);

  const [activeInputText, setActiveInputText] = useState('');
  const [activeOutputText, setActiveOutputText] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [queuedChatAfterStart, setQueuedChatAfterStart] = useState<string | null>(null);

  const createNewSession = useCallback(() => {
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateString = now.toLocaleDateString([], { month: 'short', day: 'numeric' });

    const newSession: ChatSession = {
      id: Date.now().toString(),
      name: `New Session ${dateString} at ${timeString}`,
      transcriptions: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      duration: 0,
      tutorId: selectedTutorId,
      voice: selectedVoice
    };

    setSessions(prev => [...prev, newSession]);
    setCurrentSessionId(newSession.id);
    setSessionDuration(0);
    setActiveInputText('');
    setActiveOutputText('');
  }, [selectedTutorId, selectedVoice]);

  const selectSession = useCallback((sessionId: string) => {
    if (status === SessionStatus.ACTIVE) {
      setPendingSessionId(sessionId);
      setSessionSwitchWarning(true);
      return;
    }

    setCurrentSessionId(sessionId);
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      setSessionDuration(session.duration);
      setSelectedTutorId(session.tutorId);
      setSelectedVoice(session.voice);
      setActiveInputText('');
      setActiveOutputText('');
    }
  }, [sessions, status]);

  const confirmSessionSwitch = useCallback(() => {
    if (pendingSessionId === null && currentSessionId) {
      stopSession();
      setSessions(prev => prev.filter(s => s.id !== currentSessionId));

      const remainingSessions = sessions.filter(s => s.id !== currentSessionId);
      if (remainingSessions.length > 0) {
        setCurrentSessionId(remainingSessions[0].id);
        const session = remainingSessions[0];
        setSessionDuration(session.duration);
        setSelectedTutorId(session.tutorId);
        setSelectedVoice(session.voice);
        setActiveInputText('');
        setActiveOutputText('');
      } else {
        setCurrentSessionId(null);
        setSessionDuration(0);
        setActiveInputText('');
        setActiveOutputText('');
      }

      setPendingSessionId(null);
      setSessionSwitchWarning(false);
      return;
    }

    if (pendingSessionId) {
      stopSession();
      setCurrentSessionId(pendingSessionId);
      const session = sessions.find(s => s.id === pendingSessionId);
      if (session) {
        setSessionDuration(session.duration);
        setSelectedTutorId(session.tutorId);
        setSelectedVoice(session.voice);
        setActiveInputText('');
        setActiveOutputText('');
      }
      setPendingSessionId(null);
      setSessionSwitchWarning(false);
    }
  }, [currentSessionId, sessions]);

  const cancelSessionSwitch = useCallback(() => {
    setPendingSessionId(null);
    setSessionSwitchWarning(false);
  }, []);

  const deleteSession = useCallback((sessionId: string) => {
    if (currentSessionId === sessionId && status === SessionStatus.ACTIVE) {
      setSessionSwitchWarning(true);
      setPendingSessionId(null);
      return;
    }

    setSessions(prev => prev.filter(s => s.id !== sessionId));

    if (currentSessionId === sessionId) {
      const remainingSessions = sessions.filter(s => s.id !== sessionId);
      if (remainingSessions.length > 0) {
        selectSession(remainingSessions[0].id);
      } else {
        setCurrentSessionId(null);
        setSessionDuration(0);
        setActiveInputText('');
        setActiveOutputText('');
      }
    }
  }, [currentSessionId, sessions, status, selectSession]);

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text) return;

    if (!currentSessionId) {
      createNewSession();
    }

    if (status === SessionStatus.CONNECTING) {
      setConnectionError('Session is still connecting. Please wait a second and try again.');
      return;
    }

    if (status !== SessionStatus.ACTIVE || !sessionRef.current) {
      setQueuedChatAfterStart(text);
      setChatInput('');
      void startSession();
      return;
    }

    const sent = sendClientTurn(text);
    if (!sent) {
      setConnectionError('Message could not be sent. Please restart the session and try again.');
      return;
    }

    addUserTranscription(text, 'user-text');
    setChatInput('');
  };

  useEffect(() => {
    let timer: number;
    if (status === SessionStatus.ACTIVE) {
      timer = window.setInterval(() => {
        setSessionDuration(s => {
          const newDuration = s + 1;
          updateCurrentSession({ duration: newDuration });
          return newDuration;
        });
      }, 1000);
    }
    return () => { if (timer) clearInterval(timer); }
  }, [status, updateCurrentSession]);

  const [isMuted, setIsMuted] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [networkQuality, setNetworkQuality] = useState<'high' | 'medium' | 'low'>('medium');
  const isMutedRef = useRef(isMuted);
  const statusRef = useRef(status);
  const isScreenSharingRef = useRef(isScreenSharing);
  const lastShiftTimeRef = useRef<number>(0);
  const micStreamRef = useRef<MediaStream | null>(null);
  const retryTimeoutRef = useRef<number | null>(null);
  const manualSessionStopRef = useRef(false);
  const isStoppingSessionRef = useRef(false);

  statusRef.current = status;
  isScreenSharingRef.current = isScreenSharing;

  useEffect(() => {
    isMutedRef.current = isMuted;
    if (micStreamRef.current) {
      micStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !isMuted;
      });
    }
  }, [isMuted]);

  useEffect(() => {
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (!connection) return;

    const updateNetworkQuality = () => {
      const effectiveType = connection.effectiveType;
      const downlink = connection.downlink;

      if (effectiveType === '4g' && downlink > 5) {
        setNetworkQuality('high');
      } else if (effectiveType === '3g' || downlink < 1.5) {
        setNetworkQuality('low');
      } else {
        setNetworkQuality('medium');
      }
    };

    updateNetworkQuality();
    connection.addEventListener('change', updateNetworkQuality);
    return () => connection.removeEventListener('change', updateNetworkQuality);
  }, []);

  const aiRef = useRef<any>(null);
  const sessionRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const currentInputText = useRef('');
  const currentOutputText = useRef('');

  const selectedTutor = TUTOR_TYPES.find(t => t.id === selectedTutorId) || TUTOR_TYPES[0];

  const stopSession = useCallback(() => {
    if (isStoppingSessionRef.current) return;
    isStoppingSessionRef.current = true;
    manualSessionStopRef.current = true;
    if (retryTimeoutRef.current) {
      window.clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    audioSourcesRef.current.forEach(source => {
      try { source.stop(); source.disconnect(); } catch (e) { console.warn('Error stopping audio source:', e); }
    });
    audioSourcesRef.current.clear();

    if (sessionRef.current) {
      try { sessionRef.current.close(); } catch (e) { console.warn('Error closing session:', e); }
      sessionRef.current = null;
    }

    if (inputAudioCtxRef.current) {
      try { inputAudioCtxRef.current.close(); } catch (e) { console.warn('Error closing input audio context:', e); }
      inputAudioCtxRef.current = null;
    }
    if (outputAudioCtxRef.current) {
      try { outputAudioCtxRef.current.close(); } catch (e) { console.warn('Error closing output audio context:', e); }
      outputAudioCtxRef.current = null;
    }

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => {
        try { track.stop(); } catch (e) { console.warn('Error stopping mic track:', e); }
      });
      micStreamRef.current = null;
    }

    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => {
        try { track.stop(); } catch (e) { console.warn('Error stopping video track:', e); }
      });
      videoRef.current.srcObject = null;
    }

    nextStartTimeRef.current = 0;
    setIsScreenSharing(false);
    setQueuedChatAfterStart(null);
    setStatus(SessionStatus.IDLE);
    setRetryCount(0);
    isStoppingSessionRef.current = false;
  }, []);

  const resetTestState = useCallback(() => {
    localStorage.removeItem('selected_tutor_id');
    localStorage.removeItem('selected_voice');
    localStorage.removeItem('shortcut_key');
    localStorage.removeItem('ai_interview_level');
    localStorage.removeItem('theme_preference');
    localStorage.removeItem('gemini_tutor_sessions');
    setSelectedTutorId(TUTOR_TYPES[0].id);
    setSelectedVoice('Puck');
    setShortcutKey('F1');
    setInterviewLevel('mid');
    setTheme('dark');
    setQueuedChatAfterStart(null);
    setCurrentSessionId(null);
    setSessions([]);
    setSessionDuration(0);
  }, []);

  const [errorNotification, setErrorNotification] = useState(false);
  const [apiKeyError, setApiKeyError] = useState(false);
  const [sessionSwitchWarning, setSessionSwitchWarning] = useState(false);
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
  const [screenShareError, setScreenShareError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    if (errorNotification) {
      const t = setTimeout(() => setErrorNotification(false), 5000);
      return () => clearTimeout(t);
    }
  }, [errorNotification]);

  useEffect(() => {
    if (!transcriptScrollRef.current) return;
    transcriptScrollRef.current.scrollTop = transcriptScrollRef.current.scrollHeight;
  }, [transcriptions, activeInputText, activeOutputText]);

  useEffect(() => {
    const shell = appShellRef.current;
    if (!shell) return;

    let frame = 0;
    let currentX = 56;
    let currentY = 50;
    let targetX = 56;
    let targetY = 50;

    const animate = () => {
      currentX += (targetX - currentX) * 0.08;
      currentY += (targetY - currentY) * 0.08;
      shell.style.setProperty('--spotlight-x', `${currentX.toFixed(2)}%`);
      shell.style.setProperty('--spotlight-y', `${currentY.toFixed(2)}%`);
      frame = window.requestAnimationFrame(animate);
    };

    const handlePointerMove = (event: PointerEvent) => {
      targetX = (event.clientX / window.innerWidth) * 100;
      targetY = (event.clientY / window.innerHeight) * 100;
    };

    const recenter = () => {
      targetX = 56;
      targetY = 50;
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerleave', recenter);
    frame = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerleave', recenter);
    };
  }, []);

  useEffect(() => {
    if (!process.env.API_KEY && process.env.NODE_ENV === 'production') {
      setApiKeyError(true);
    }
  }, []);

  useEffect(() => {
    const browserInfo = getBrowserInfo();
    const compatibilityMessage = getCompatibilityMessage();
    if (compatibilityMessage) {
      console.warn('Browser compatibility issue:', compatibilityMessage);
    }
  }, []);

  const playErrorSound = useCallback(() => {
    if (!outputAudioCtxRef.current) return;
    try {
      const ctx = outputAudioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) { }
  }, []);

  const sendClientTurn = useCallback((text: string) => {
    const session = sessionRef.current;
    if (!session) return false;

    const payload = {
      clientContent: { turns: [{ role: 'user', parts: [{ text }] }], turnComplete: true }
    };

    try {
      if (typeof session.send === 'function') {
        session.send(payload);
        return true;
      }
      if (typeof session.sendClientContent === 'function') {
        session.sendClientContent(payload.clientContent);
        return true;
      }
      console.error('Session does not expose a supported text send method.', Object.keys(session || {}));
      return false;
    } catch (error) {
      console.error('Failed to send client turn:', error);
      return false;
    }
  }, []);

  const sendSessionText = useCallback((text: string) => {
    return sendClientTurn(text);
  }, [sendClientTurn]);

  const addUserTranscription = useCallback((text: string, suffix = 'user-text') => {
    if (!currentSessionIdRef.current) return;
    const currentSession = sessionsRef.current.find(s => s.id === currentSessionIdRef.current);
    if (!currentSession) return;
    const newTranscription: Transcription = {
      id: `${Date.now()}-${suffix}`,
      role: 'user',
      text,
      timestamp: Date.now()
    };
    updateCurrentSession({
      transcriptions: [...currentSession.transcriptions, newTranscription]
    });
  }, [updateCurrentSession]);

  const addModelTranscription = useCallback((text: string, suffix = 'model-text') => {
    if (!currentSessionIdRef.current) return;
    const currentSession = sessionsRef.current.find(s => s.id === currentSessionIdRef.current);
    if (!currentSession) return;
    const newTranscription: Transcription = {
      id: `${Date.now()}-${suffix}`,
      role: 'model',
      text,
      timestamp: Date.now()
    };
    updateCurrentSession({
      transcriptions: [...currentSession.transcriptions, newTranscription]
    });
  }, [updateCurrentSession]);

  useEffect(() => {
    if (!queuedChatAfterStart || status !== SessionStatus.ACTIVE || !sessionRef.current) return;

    const queuedText = queuedChatAfterStart.trim();
    if (!queuedText) {
      setQueuedChatAfterStart(null);
      return;
    }

    const sent = sendClientTurn(queuedText);
    if (!sent) {
      setConnectionError('Message could not be sent. Please restart the session and try again.');
      return;
    }

addUserTranscription(queuedText, 'user-text');
    setQueuedChatAfterStart(null);
  }, [queuedChatAfterStart, status, sendClientTurn, addUserTranscription]);

const handleMessage = async (message: LiveServerMessage) => {

    const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
    if (audioData && outputAudioCtxRef.current) {
      const ctx = outputAudioCtxRef.current;
      nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
      try {
        const buffer = await decodeAudioData(decode(audioData), ctx, AUDIO_CONFIG.outputSampleRate, 1);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.onended = () => { try { source.disconnect(); audioSourcesRef.current.delete(source); } catch (e) { console.warn('Error cleaning up audio source:', e); } };
        source.onerror = (error) => { console.warn('Audio source error:', error); try { source.disconnect(); audioSourcesRef.current.delete(source); } catch (e) { console.warn('Error cleaning up failed audio source:', e); } };
        source.start(nextStartTimeRef.current);
        nextStartTimeRef.current += buffer.duration;
        audioSourcesRef.current.add(source);
      } catch (audioError) { console.error('Error processing audio data:', audioError); }
    }

    if (message.serverContent?.inputTranscription) {
      currentInputText.current += message.serverContent.inputTranscription.text;
      setActiveInputText(currentInputText.current);
    }
    if (message.serverContent?.outputTranscription) {
      let newlyGeneratedText = message.serverContent.outputTranscription.text;
      currentOutputText.current += newlyGeneratedText;
      if (currentOutputText.current.includes('[ERROR]')) {
        currentOutputText.current = currentOutputText.current.replace('[ERROR]', '');
        setErrorNotification(true);
        playErrorSound();
      }
      setActiveOutputText(currentOutputText.current);
    }

    if (message.serverContent?.turnComplete) {
      const newTranscriptions: Transcription[] = [];
      if (currentInputText.current.trim()) {
        newTranscriptions.push({ id: Date.now().toString() + '-user', role: 'user', text: currentInputText.current, timestamp: Date.now() });
      }
      if (currentOutputText.current.trim()) {
        newTranscriptions.push({ id: Date.now().toString() + '-model', role: 'model', text: currentOutputText.current, timestamp: Date.now() });
      }
      if (newTranscriptions.length > 0 && currentSessionIdRef.current) {
        const currentSession = sessionsRef.current.find(s => s.id === currentSessionIdRef.current);
        if (currentSession) {
          updateCurrentSession({ transcriptions: [...currentSession.transcriptions, ...newTranscriptions] });
        }
      }
      currentInputText.current = '';
      currentOutputText.current = '';
      setActiveInputText('');
      setActiveOutputText('');
    }

    if (message.serverContent?.interrupted) {
      audioSourcesRef.current.forEach(s => { try { s.stop(); } catch (e) { } });
      audioSourcesRef.current.clear();
      nextStartTimeRef.current = 0;
    }
  };

  const startSession = async () => {
    try {
      manualSessionStopRef.current = false;
      if (retryTimeoutRef.current) {
        window.clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      if (isE2EMode) {
        setStatus(SessionStatus.ACTIVE);
        setSessionDuration(0);
        setConnectionError(null);
        if (!currentSessionIdRef.current) createNewSession();
        sessionRef.current = {
          send: () => undefined,
          sendRealtimeInput: () => undefined,
          sendToolResponse: () => undefined,
          close: () => undefined
        };
        return;
      }
      const browserInfo = getBrowserInfo();
      if (!browserInfo.supportsWebAudio) {
        setConnectionError('Your browser doesn\'t support Web Audio API. Please use a modern browser like Chrome, Firefox, Safari, or Edge.');
        setStatus(SessionStatus.ERROR);
        return;
      }
      if (!browserInfo.supportsMediaDevices) {
        setConnectionError('Your browser doesn\'t support media devices. Please allow microphone access and use a modern browser.');
        setStatus(SessionStatus.ERROR);
        return;
      }
      if (!process.env.API_KEY) {
        setApiKeyError(true);
        setStatus(SessionStatus.ERROR);
        return;
      }

      setStatus(SessionStatus.CONNECTING);
      setSessionDuration(0);
      setConnectionError(null);

      if (!currentSessionId) { createNewSession(); }

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      aiRef.current = ai;

      let inputCtx: AudioContext;
      let outputCtx: AudioContext;

      try {
        inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: AUDIO_CONFIG.inputSampleRate });
        outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: AUDIO_CONFIG.outputSampleRate });
        if (inputCtx.state === 'suspended') { await inputCtx.resume(); }
        if (outputCtx.state === 'suspended') { await outputCtx.resume(); }
      } catch (audioError) {
        console.error('Failed to create AudioContext:', audioError);
        setStatus(SessionStatus.ERROR);
        setConnectionError('Failed to initialize audio. Please check your browser permissions.');
        return;
      }

      inputAudioCtxRef.current = inputCtx;
      outputAudioCtxRef.current = outputCtx;

      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = micStream;
      micStream.getAudioTracks().forEach(track => { track.enabled = !isMutedRef.current; });

      const currentSessionData = sessionsRef.current.find(s => s.id === currentSessionIdRef.current);
      const historyContext = currentSessionData?.transcriptions && currentSessionData.transcriptions.length > 0
        ? `\n\nPREVIOUS CONVERSATION HISTORY:\n${currentSessionData.transcriptions.slice(-20).map(t => `${t.role === 'user' ? 'User' : 'Tutor'}: ${t.text}`).join('\n')}`
        : '';
      const baseInstruction = selectedTutor?.systemInstruction || TUTOR_TYPES[0].systemInstruction;
      const selectedInterviewLevel = AI_INTERVIEW_LEVELS.find(level => level.id === interviewLevel) || AI_INTERVIEW_LEVELS[1];
      const interviewLevelInstruction = selectedTutorIdRef.current === 'ai-interviewer'
        ? `\n\nINTERVIEW LEVEL:\n- Level: ${selectedInterviewLevel.label}\n- Difficulty guidance: ${selectedInterviewLevel.difficultyGuidance}\n\nINTERVIEW WRAP-UP REQUIREMENTS:\nAt the end of the interview, provide a detailed breakdown with these exact sections:\n1) Interview Overview\n2) Key Points Observed\n3) Category Scores (AI Dev, AI Systems, Frontend, Backend, AI Product/Design) each from 1-10\n4) Overall Score (0-100)\n5) Strengths\n6) Gaps and Risks\n7) Actionable Suggestions for Improvement (prioritized)\n8) Hiring Signal (Strong Yes / Yes / Mixed / No)\nAlso include a short final summary paragraph.`
        : '';
      const systemInstruction = baseInstruction + interviewLevelInstruction + historyContext + `\n\nCRITICAL INSTRUCTION: If you detect the user made a mistake in their coding or input based on their speech or screen share, you MUST start your spoken response with the exact uppercase string "[ERROR]". This will trigger the UI to highlight the error.`;

      const sessionPromise = ai.live.connect({
        model: MODEL_NAME,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: systemInstruction,
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedVoice } } },
          inputAudioTranscription: {},
          outputAudioTranscription: {}
        },
        callbacks: {
          onopen: () => {
            console.log('Session opened');
            setStatus(SessionStatus.ACTIVE);
            setRetryCount(0);
            const source = inputCtx.createMediaStreamSource(micStream);
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            processor.onaudioprocess = (e) => {
              if (isMutedRef.current) return;
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              sessionRef.current?.sendRealtimeInput({ audio: pcmBlob });
            };
            source.connect(processor);
            processor.connect(inputCtx.destination);
          },
          onmessage: handleMessage,
          onerror: (err) => {
            if (manualSessionStopRef.current) return;
            console.error('Session error:', err);
            setStatus(SessionStatus.ERROR);
            const maxRetries = 3;
            if (retryCount < maxRetries) {
              const backoffDelay = Math.min(1000 * Math.pow(2, retryCount), 10000);
              setConnectionError(`Connection failed. Retrying in ${backoffDelay / 1000} seconds... (${retryCount + 1}/${maxRetries})`);
              retryTimeoutRef.current = window.setTimeout(() => {
                if (manualSessionStopRef.current) return;
                setRetryCount(prev => prev + 1);
                void startSession();
              }, backoffDelay);
            } else {
              setConnectionError('Failed to connect after multiple attempts. Please check your internet connection and try again.');
            }
          },
          onclose: () => {
            console.log('Session closed');
            if (manualSessionStopRef.current) return;
            stopSession();
          }
        }
      });

      sessionRef.current = await sessionPromise;

      if (selectedTutorIdRef.current === 'ai-interviewer' && sessionRef.current) {
        sendSessionText('Begin the mock interview now. Introduce yourself, explain the interview topics, then start with the first interview question.');
      }
    } catch (err) {
      console.error('Failed to start session:', err);
      setStatus(SessionStatus.ERROR);
      if (err instanceof Error) {
        if (err.message.includes('network') || err.message.includes('fetch')) {
          setConnectionError('Network error. Please check your internet connection.');
        } else if (err.message.includes('API')) {
          setConnectionError('API error. Please check your API key configuration.');
        } else {
          setConnectionError(`Failed to start session: ${err.message}`);
        }
      } else {
        setConnectionError('An unexpected error occurred. Please try again.');
      }
    }
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      try {
        if (videoRef.current?.srcObject) {
          const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
          tracks.forEach(track => { try { track.stop(); } catch (e) { console.warn('Error stopping video track:', e); } });
          videoRef.current.srcObject = null;
        }
        setIsScreenSharing(false);
        setScreenShareError(null);
      } catch (error) {
        console.error('Error stopping screen share:', error);
        setScreenShareError('Failed to stop screen sharing. Please try again.');
      }
      return;
    }

    try {
      if (isE2EMode) {
        setIsScreenSharing(true);
        setScreenShareError(null);
        return;
      }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        throw new Error('Screen sharing is not supported in your browser');
      }
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' } as any,
        audio: false
      });
      if (videoRef.current) {
        videoRef.current.srcObject = screenStream;
        screenStream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false);
          if (videoRef.current) { videoRef.current.srcObject = null; }
          setScreenShareError(null);
        };
        setIsScreenSharing(true);
        setScreenShareError(null);
      }
    } catch (error: any) {
      console.error('Screen share error:', error);
      let errorMessage = 'Failed to start screen sharing';
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Screen sharing permission was denied. Please allow screen sharing and try again.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No screen source found. Please make sure you have a screen to share.';
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'Screen source is not readable. It may be in use by another application.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      setScreenShareError(errorMessage);
      setTimeout(() => { setScreenShareError(null); }, 5000);
    }
  };

  useEffect(() => {
    let interval: number | undefined;
    if (isScreenSharing && status === SessionStatus.ACTIVE) {
      const settings = ADAPTIVE_QUALITY[networkQuality];
      const adaptiveFrameRate = settings.fps;
      const adaptiveQuality = settings.quality;
      interval = window.setInterval(() => {
        if (!videoRef.current || !canvasRef.current || !sessionRef.current) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (ctx && video.videoWidth > 0) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => {
            if (blob && sessionRef.current) {
              const reader = new FileReader();
              reader.onloadend = () => {
                if (sessionRef.current) {
                  const base64 = (reader.result as string).split(',')[1];
                  sessionRef.current.sendRealtimeInput({ video: { data: base64, mimeType: 'image/jpeg' } });
                }
              };
              reader.readAsDataURL(blob);
            }
          }, 'image/jpeg', adaptiveQuality);
        }
      }, 1000 / adaptiveFrameRate);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isScreenSharing, status, networkQuality]);

  const keyboardHandlerStateRef = useRef({
status, isScreenSharing, shortcutKey, stopSession, startSession, toggleScreenShare, isRecordingKey, isSettingsOpen, setIsSettingsOpen
  });

  useEffect(() => {
    keyboardHandlerStateRef.current = { status, isScreenSharing, shortcutKey, stopSession, startSession, toggleScreenShare, isRecordingKey, isSettingsOpen };
  }, [status, isScreenSharing, shortcutKey, stopSession, startSession, toggleScreenShare, isRecordingKey, isSettingsOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const { status, isScreenSharing, shortcutKey, stopSession, startSession, toggleScreenShare, isRecordingKey, isSettingsOpen, setIsSettingsOpen } = keyboardHandlerStateRef.current;
      if (isRecordingKey) return;
      
      if (e.key === 'Escape') {
        if (isSettingsOpen) {
          setIsSettingsOpen(false);
          e.preventDefault();
          return;
        }
      }

      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT' || activeEl.getAttribute('contenteditable') === 'true')) {
        return;
      }

      if (e.key === 'Shift') {
        const now = Date.now();
        if (now - lastShiftTimeRef.current < 500) {
          if (status === SessionStatus.ACTIVE) { stopSession(); }
          else if (status === SessionStatus.IDLE) { startSession(); if (!isScreenSharing) toggleScreenShare(); }
          lastShiftTimeRef.current = 0;
        } else { lastShiftTimeRef.current = now; }
      }
      if (!shortcutKey || shortcutKey === 'None') return;
      if (e.code === shortcutKey || e.key === shortcutKey) {
        e.preventDefault();
        if (status === SessionStatus.ACTIVE) { stopSession(); }
        else if (status === SessionStatus.IDLE) { startSession(); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const selectedTutorMeta = TUTOR_TYPES.find((t) => t.id === selectedTutorId) || TUTOR_TYPES[0];
  const modeTutorItems = [
    { id: 'generalist', label: 'Tutor' },
    { id: 'language-coach', label: 'Language Coach' },
    { id: 'drill-sergeant', label: 'Drill Sergeant' },
    { id: 'ged-tutor', label: 'GED Prep' },
  ];
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

  const anyToastVisible = connectionError || screenShareError || apiKeyError || errorNotification || showAutoSaveToast;

  return (
    <div
      ref={appShellRef}
      style={{ '--spotlight-x': '56%', '--spotlight-y': '50%' } as React.CSSProperties}
      className="flex h-screen bg-transparent text-[var(--color-text-primary)] overflow-hidden relative font-[Inter,system-ui,sans-serif]"
    >
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-0 z-0',
          theme === 'light'
            ? 'bg-[radial-gradient(ellipse_80%_62%_at_50%_42%,rgba(59,130,246,0.14)_0%,rgba(59,130,246,0.06)_35%,rgba(255,255,255,0)_76%)]'
            : 'bg-[radial-gradient(ellipse_82%_65%_at_50%_40%,rgba(21,63,220,0.22)_0%,rgba(13,34,91,0.16)_35%,rgba(0,0,0,0)_78%)]'
        )}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 transition-opacity duration-500"
        style={{
          background: theme === 'light'
            ? 'radial-gradient(36% 30% at var(--spotlight-x) var(--spotlight-y), rgba(59,130,246,0.28) 0%, rgba(59,130,246,0.12) 42%, rgba(255,255,255,0) 78%)'
            : 'radial-gradient(36% 30% at var(--spotlight-x) var(--spotlight-y), rgba(37,99,235,0.38) 0%, rgba(37,99,235,0.18) 42%, rgba(0,0,0,0) 78%)'
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-[16%] z-0 opacity-70 animate-[drift_16s_ease-in-out_infinite_alternate]"
        style={{
          background: theme === 'light'
            ? 'radial-gradient(circle at 28% 28%, rgba(99,102,241,0.17), rgba(255,255,255,0) 48%), radial-gradient(circle at 72% 68%, rgba(59,130,246,0.15), rgba(255,255,255,0) 46%)'
            : 'radial-gradient(circle at 28% 28%, rgba(99,102,241,0.28), rgba(0,0,0,0) 48%), radial-gradient(circle at 72% 68%, rgba(37,99,235,0.26), rgba(0,0,0,0) 46%)'
        }}
      />
      {/* === TOAST NOTIFICATIONS (consolidated, single instance each) === */}
      {anyToastVisible && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-3">
          <Toast visible={!!connectionError} variant="error" title="Connection Error" message={connectionError || undefined} onClose={() => setConnectionError(null)} />
          <Toast visible={!!apiKeyError} variant="error" title="API Key Missing" message="Please configure GEMINI_API_KEY in environment variables" onClose={() => setApiKeyError(false)} />
          <Toast visible={errorNotification && !connectionError && !apiKeyError} variant="error" title="Error Detected" message="Let's fix that." onClose={() => setErrorNotification(false)} />
          <Toast visible={!!screenShareError} variant="warning" title="Screen Share Error" message={screenShareError || undefined} onClose={() => setScreenShareError(null)} />
          <Toast visible={showAutoSaveToast && !connectionError && !screenShareError} variant="success" title="Auto-saved" onClose={() => setShowAutoSaveToast(false)} />
        </div>
      )}

      {/* === SESSION SWITCH WARNING DIALOG === */}
      {sessionSwitchWarning && (
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
      )}

      {/* === MAIN LAYOUT === */}
      <div className="relative z-10 flex w-full h-full overflow-hidden">
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
                    if (item.id === 'search') {
                      chatInputRef.current?.focus();
                      return;
                    }
                    if (item.id === 'library') {
                      setIsSettingsOpen(true);
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
              <div className="px-5 pt-5">
                <p className="text-xs uppercase tracking-wider text-white/35 mb-2">Modes</p>
                <div className="space-y-1.5">
                  {modeTutorItems.map((mode) => {
                    const tutor = TUTOR_TYPES.find((t) => t.id === mode.id);
                    if (!tutor) return null;
                    return (
                      <button
                        key={mode.id}
                        onClick={() => setSelectedTutorId(mode.id)}
                        className={cn(
                          'w-full text-left px-3 py-2 rounded-xl transition-colors text-sm',
                          selectedTutorId === mode.id ? 'bg-white/12 text-white' : 'text-white/70 hover:bg-white/8'
                        )}
                      >
                        {mode.label}
                      </button>
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
                    <button
                      key={session.id}
                      onClick={() => selectSession(session.id)}
                      className={cn(
                        'w-full text-left px-2 py-1.5 rounded-lg text-sm transition-colors truncate',
                        currentSessionId === session.id ? 'text-white/95 bg-white/8' : 'text-white/60 hover:text-white/90 hover:bg-white/6'
                      )}
                    >
                      {session.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-auto px-3 pb-5">
              <div className="flex items-center justify-between">
                {!isSidebarCollapsed && (
                  <div className="text-sm text-white/65 truncate pr-2">
                    <div className="font-medium text-white/85">{USER_NAME}</div>
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

        <main className="flex-1 relative overflow-hidden">
          {isSettingsOpen && (
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
          )}

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
                      'px-6 h-12 rounded-full border transition-colors shadow-[0_12px_34px_rgba(0,0,0,0.32)]',
                      status === SessionStatus.ACTIVE
                        ? 'bg-red-500/20 border-red-400/30 text-red-200'
                        : 'bg-blue-600/85 hover:bg-blue-500 text-white border-blue-400/30'
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
              {transcriptions.map((item) => {
                const isUser = item.role === 'user';
                return (
                  <div key={item.id} className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
                    <div className={cn(
                      'max-w-[78%] px-5 py-3 rounded-3xl text-[15px] leading-relaxed shadow-sm',
                      isUser
                        ? 'bg-blue-600 text-white rounded-br-xl'
                        : 'bg-white/5 text-white/90 border border-white/10 rounded-bl-xl'
                    )}>
                      {item.text}
                    </div>
                  </div>
                );
              })}
              {activeInputText && (
                <div className="flex justify-end">
                  <div className="max-w-[78%] px-5 py-3 rounded-3xl rounded-br-xl bg-blue-500/80 text-white">
                    {activeInputText}
                  </div>
                </div>
              )}
              {activeOutputText && (
                <div className="flex justify-start">
                  <div className="max-w-[78%] px-5 py-3 rounded-3xl rounded-bl-xl bg-white/5 border border-white/10 text-white/90">
                    {activeOutputText}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="absolute left-1/2 -translate-x-1/2 bottom-7 w-[92%] max-w-5xl z-20">
            <form
              onSubmit={handleSendChat}
              className="h-16 rounded-full bg-[#1b1e24]/96 border border-white/12 shadow-[0_18px_48px_rgba(0,0,0,0.46)] flex items-center gap-3 px-4"
            >
              <button
                type="button"
                onClick={toggleScreenShare}
                data-testid="screen-share-toggle"
                className="w-10 h-10 rounded-full text-white/80 hover:bg-white/10 transition-colors text-2xl leading-none shrink-0"
                title={isScreenSharing ? 'Stop screen share' : 'Share screen'}
              >
                +
              </button>
              <input
                ref={chatInputRef}
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={isE2EMode ? 'Type a message...' : `Ask ${selectedTutorMeta.name}...`}
                className="flex-1 basis-0 min-w-[180px] bg-transparent border-none outline-none text-white placeholder:text-white/40 text-base md:text-lg"
              />
              <select
                value={selectedTutorId}
                onChange={(e) => setSelectedTutorId(e.target.value)}
                className="h-10 rounded-full bg-black/25 border border-white/12 px-4 text-sm text-white/85 max-w-[180px]"
              >
                {TUTOR_TYPES.map((tutor) => (
                  <option key={tutor.id} value={tutor.id} className="text-black">
                    {tutor.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setIsMuted((prev) => !prev)}
                className={cn(
                  'w-10 h-10 rounded-full transition-colors',
                  isMuted ? 'bg-red-500/20 text-red-300' : 'text-white/80 hover:bg-white/10'
                )}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                <svg className="w-5 h-5 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 1v11m0 0a3 3 0 003-3V6a3 3 0 10-6 0v3a3 3 0 003 3zM5 10a7 7 0 0014 0M12 19v4m-4 0h8" />
                </svg>
              </button>
              <button
                type="submit"
                data-testid="chat-send"
                disabled={!chatInput.trim() || status === SessionStatus.CONNECTING}
                className={cn(
                  'h-10 px-5 rounded-full text-sm font-medium transition-colors',
                  chatInput.trim() && status !== SessionStatus.CONNECTING
                    ? 'bg-blue-600 hover:bg-blue-500 text-white'
                    : 'bg-white/10 text-white/35'
                )}
              >
                Send
              </button>
            </form>
            <div className="flex items-center justify-center gap-3 mt-3">
<button
                type="button"
                onClick={status === SessionStatus.ACTIVE ? stopSession : startSession}
                data-testid={status === SessionStatus.ACTIVE ? "end-session" : "footer-start-session"}
                className={cn(
                  'h-10 px-5 rounded-full text-sm transition-colors border',
                  status === SessionStatus.ACTIVE
                    ? 'bg-red-500/20 border-red-400/30 text-red-200'
                    : 'bg-white/10 border-white/15 text-white/85 hover:bg-white/15'
                )}
              >
                {status === SessionStatus.ACTIVE ? 'End Session' : 'Start Session'}
              </button>
            </div>
          </div>

          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </main>
      </div>
    </div>
  );
};

export default App;
