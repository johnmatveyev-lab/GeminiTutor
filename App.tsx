import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { cn } from './lib/utils';
import { Header } from './components/Header';
import { TranscriptionList } from './components/TranscriptionList';
import { SessionList } from './components/SessionList';
import { ScreenShare } from './components/ScreenShare';
import { ControlPanel } from './components/ControlPanel';
import {
  MODEL_NAME,
  TUTOR_TYPES,
  AI_INTERVIEW_LEVELS,
  AUDIO_CONFIG,
  FRAME_RATE,
  JPEG_QUALITY,
  ADAPTIVE_QUALITY,
  BROWSER_CONTROL_INSTRUCTION
} from './constants';
import { SessionStatus, Transcription, TutorType, ChatSession } from './types';
import {
  decode,
  decodeAudioData,
  createBlob,
  encode
} from './services/audioUtils';
import {
  loadSessions,
  saveSessions,
  loadCurrentSessionId,
  saveCurrentSessionId,
  getLocalStorageUsage
} from './services/storageUtils';
import {
  getBrowserInfo,
  getCompatibilityMessage,
  showCompatibilityWarning
} from './services/browserUtils';

const GOOGLE_HOME_URL = 'https://www.google.com';
const BROWSER_CONTROL_BRIDGE_URL = 'http://127.0.0.1:8787';
const isE2EMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('e2e');

const URL_PATTERN = /((?:https?:\/\/)?(?:www\.)?[a-z0-9][a-z0-9-]*(?:\.[a-z0-9][a-z0-9-]*)+)/i;
const BROWSER_CONTEXT_PATTERN = /\b(browser|chrome|google|web|website|internet|online|site|url|page)\b/i;
const BROWSER_ACTION_PATTERN = /\b(search|look\s+up|lookup|research|browse|open|visit|go\s+to|navigate|use|find)\b/i;
const SEARCH_REQUEST_PATTERN = /\b(search|google|look\s+up|lookup|research)\b.+\b(for|about|on)\b/i;

type BrowserToolCall = {
  id?: string;
  name?: string;
  args?: Record<string, unknown>;
};

type BrowserControlBridgeResult = {
  ok: boolean;
  output?: unknown;
  error?: string;
};

const BROWSER_CONTROL_TOOL = {
  functionDeclarations: [
    {
      name: 'browser_control',
      description: 'Control the confirmed Chrome Browser Control window through the local bridge. Only call after Browser Control is enabled and the user has confirmed a browser task.',
      parametersJsonSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['open_url', 'search', 'show_home', 'snapshot', 'click_element', 'click_text', 'type', 'key', 'scroll', 'wait'],
            description: 'The browser action to perform.'
          },
          url: {
            type: 'string',
            description: 'Absolute or domain URL to open when action is open_url.'
          },
          query: {
            type: 'string',
            description: 'Google search query when action is search.'
          },
          elementId: {
            type: 'string',
            description: 'Element id from a previous snapshot when action is click_element.'
          },
          text: {
            type: 'string',
            description: 'Text to type, or visible text to click when action is click_text.'
          },
          key: {
            type: 'string',
            description: 'Keyboard key to press, such as Enter, Tab, Escape, ArrowDown, or Backspace.'
          },
          deltaY: {
            type: 'number',
            description: 'Vertical scroll amount in pixels when action is scroll.'
          },
          ms: {
            type: 'number',
            description: 'Milliseconds to wait when action is wait.'
          }
        },
        required: ['action']
      }
    }
  ]
};

const isBrowserTaskRequest = (text: string) => {
  const normalized = text.trim();
  if (!normalized) return false;

  return (
    URL_PATTERN.test(normalized) ||
    (BROWSER_CONTEXT_PATTERN.test(normalized) && BROWSER_ACTION_PATTERN.test(normalized)) ||
    SEARCH_REQUEST_PATTERN.test(normalized)
  );
};

const normalizeUrl = (value: string) => {
  const trimmed = value.replace(/[),.;!?]+$/, '');
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

const getBrowserLaunchUrl = (task?: string) => {
  if (!task?.trim()) return GOOGLE_HOME_URL;

  const urlMatch = task.match(URL_PATTERN);
  if (urlMatch?.[1]) {
    return normalizeUrl(urlMatch[1]);
  }

  const query = task
    .replace(/\b(use|using|the|a|an|browser|chrome|google|web|website|internet|online)\b/gi, ' ')
    .replace(/\b(search\s+for|look\s+up|lookup|research|browse|open|visit|go\s+to|navigate\s+to|find)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return query
    ? `https://www.google.com/search?q=${encodeURIComponent(query)}`
    : GOOGLE_HOME_URL;
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

  const [isBrowserControlSkillEnabled, setIsBrowserControlSkillEnabled] = useState(() => {
    return localStorage.getItem('browser_control_skill_enabled') === 'true';
  });

  const [sessionDuration, setSessionDuration] = useState(() => {
    return currentSession?.duration || 0;
  });

  useEffect(() => { localStorage.setItem('selected_tutor_id', selectedTutorId); }, [selectedTutorId]);
  useEffect(() => { localStorage.setItem('selected_voice', selectedVoice); }, [selectedVoice]);
  useEffect(() => { localStorage.setItem('shortcut_key', shortcutKey); }, [shortcutKey]);
  useEffect(() => { localStorage.setItem('ai_interview_level', interviewLevel); }, [interviewLevel]);
  useEffect(() => { localStorage.setItem('browser_control_skill_enabled', String(isBrowserControlSkillEnabled)); }, [isBrowserControlSkillEnabled]);
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
    if (!text || !sessionRef.current || status !== SessionStatus.ACTIVE || !currentSessionId) return;

    const shouldInterceptAsBrowserTask =
      isBrowserTaskRequest(text) &&
      isBrowserControlSkillEnabledRef.current &&
      isScreenSharingRef.current &&
      isBrowserControlEnabledRef.current;

    if (shouldInterceptAsBrowserTask) {
      setPendingBrowserTask(text);
      return;
    }

    const sent = sendClientTurn(text);
    if (!sent) {
      setConnectionError('Message could not be sent. Please restart the session and try again.');
      return;
    }

    const currentSessionData = sessionsRef.current.find(s => s.id === currentSessionId);
    const newTranscription: Transcription = {
      id: Date.now().toString() + '-user-text',
      role: 'user',
      text,
      timestamp: Date.now()
    };

    updateCurrentSession({
      transcriptions: [...(currentSessionData?.transcriptions || []), newTranscription]
    });

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
  const [isBrowserControlEnabled, setIsBrowserControlEnabled] = useState(false);
  const [browserControlBridgeReady, setBrowserControlBridgeReady] = useState(false);
  const [pendingBrowserTask, setPendingBrowserTask] = useState<string | null>(null);
  const [browserControlError, setBrowserControlError] = useState<string | null>(null);
  const [networkQuality, setNetworkQuality] = useState<'high' | 'medium' | 'low'>('medium');
  const isMutedRef = useRef(isMuted);
  const statusRef = useRef(status);
  const isScreenSharingRef = useRef(isScreenSharing);
  const isBrowserControlEnabledRef = useRef(isBrowserControlEnabled);
  const isBrowserControlSkillEnabledRef = useRef(isBrowserControlSkillEnabled);
  const lastShiftTimeRef = useRef<number>(0);
  const micStreamRef = useRef<MediaStream | null>(null);
  const retryTimeoutRef = useRef<number | null>(null);
  const manualSessionStopRef = useRef(false);
  const isStoppingSessionRef = useRef(false);

  statusRef.current = status;
  isScreenSharingRef.current = isScreenSharing;
  isBrowserControlEnabledRef.current = isBrowserControlEnabled;
  isBrowserControlSkillEnabledRef.current = isBrowserControlSkillEnabled;

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
    setIsBrowserControlEnabled(false);
    setPendingBrowserTask(null);
    setStatus(SessionStatus.IDLE);
    setRetryCount(0);
    isStoppingSessionRef.current = false;
  }, []);

  const resetTestState = useCallback(() => {
    localStorage.removeItem('selected_tutor_id');
    localStorage.removeItem('selected_voice');
    localStorage.removeItem('shortcut_key');
    localStorage.removeItem('ai_interview_level');
    localStorage.removeItem('browser_control_skill_enabled');
    localStorage.removeItem('theme_preference');
    localStorage.removeItem('gemini_tutor_sessions');
    setSelectedTutorId(TUTOR_TYPES[0].id);
    setSelectedVoice('Puck');
    setShortcutKey('F1');
    setInterviewLevel('mid');
    setIsBrowserControlSkillEnabled(false);
    setTheme('dark');
    setIsBrowserControlEnabled(false);
    setPendingBrowserTask(null);
    setBrowserControlError(null);
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
    if (browserControlError) {
      const t = setTimeout(() => setBrowserControlError(null), 6000);
      return () => clearTimeout(t);
    }
  }, [browserControlError]);

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

  const ensureBrowserControlPrerequisites = useCallback((requireScreenShare = true) => {
    if (!isBrowserControlSkillEnabled) {
      setBrowserControlError('Enable Browser Control Skill in Settings before using browser control.');
      return false;
    }
    if (status !== SessionStatus.ACTIVE || !sessionRef.current) {
      setBrowserControlError('Start a live session before turning on Browser Control.');
      return false;
    }
    if (requireScreenShare && !isScreenSharing) {
      setBrowserControlError('Share your Chrome browser window first so the agent can see the browser while control is on.');
      return false;
    }
    return true;
  }, [isBrowserControlSkillEnabled, isScreenSharing, status]);

  const checkBrowserControlBridge = useCallback(async () => {
    if (isE2EMode) {
      setBrowserControlBridgeReady(true);
      return true;
    }
    try {
      const response = await fetch(`${BROWSER_CONTROL_BRIDGE_URL}/status`);
      const result = await response.json();
      const isReady = Boolean(result.ok);
      setBrowserControlBridgeReady(isReady);
      if (!isReady) {
        setIsBrowserControlEnabled(false);
      }
      return isReady;
    } catch (error) {
      setBrowserControlBridgeReady(false);
      setIsBrowserControlEnabled(false);
      return false;
    }
  }, []);

  const runBrowserControlBridgeAction = useCallback(async (args: Record<string, unknown>): Promise<BrowserControlBridgeResult> => {
    try {
      const response = await fetch(`${BROWSER_CONTROL_BRIDGE_URL}/browser-control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args)
      });
      const result = await response.json();
      setBrowserControlBridgeReady(Boolean(result.ok));
      return result;
    } catch (error) {
      setBrowserControlBridgeReady(false);
      return {
        ok: false,
        error: 'Browser Control bridge is not running. Restart the app with npm run dev so the local bridge starts with Vite.'
      };
    }
  }, []);

  useEffect(() => {
    checkBrowserControlBridge();
    const interval = window.setInterval(() => {
      void checkBrowserControlBridge();
    }, 3000);
    return () => window.clearInterval(interval);
  }, [checkBrowserControlBridge]);

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

  const toggleBrowserControl = useCallback(() => {
    void (async () => {
      if (isBrowserControlEnabled) {
        setIsBrowserControlEnabled(false);
        sendSessionText('BROWSER CONTROL DISABLED BY USER. Stop browser-control actions and return to normal tutoring.');
        return;
      }
      if (!ensureBrowserControlPrerequisites(false)) return;
      if (isE2EMode) {
        setIsBrowserControlEnabled(true);
        setBrowserControlError(null);
        return;
      }
      const bridgeReady = await checkBrowserControlBridge();
      if (!bridgeReady) {
        setBrowserControlError('Browser Control bridge is not running. Restart with npm run dev so the local Chrome bridge starts.');
        return;
      }
      const result = await runBrowserControlBridgeAction({ action: 'show_home' });
      if (!result.ok) {
        setBrowserControlError(result.error || 'Browser Control bridge could not open Chrome.');
        return;
      }
      setIsBrowserControlEnabled(true);
      setBrowserControlError(null);
      sendSessionText(isScreenSharing
        ? 'BROWSER CONTROL ENABLED BY USER. The local Chrome bridge is ready. The shared browser view is visible to you. Ask for confirmation before any browser task unless a task is already explicitly confirmed.'
        : 'BROWSER CONTROL WINDOW OPENED BY USER. The local Chrome bridge is ready, but the user has not shared the controlled Chrome window yet. Ask the user to share that Chrome window before using browser_control.');
    })();
  }, [checkBrowserControlBridge, ensureBrowserControlPrerequisites, isBrowserControlEnabled, isScreenSharing, runBrowserControlBridgeAction, sendSessionText]);

  const confirmBrowserTask = useCallback(() => {
    void (async () => {
      const task = pendingBrowserTask?.trim();
      if (!task) return;
      if (!ensureBrowserControlPrerequisites()) return;
      const bridgeReady = await checkBrowserControlBridge();
      if (!bridgeReady) {
        setBrowserControlError('Browser Control bridge is not running. Restart with npm run dev so the local Chrome bridge starts.');
        return;
      }
      const launchUrl = getBrowserLaunchUrl(task);
      const result = await runBrowserControlBridgeAction({ action: 'open_url', url: launchUrl });
      if (!result.ok) {
        setBrowserControlError(result.error || 'Browser Control bridge could not open Chrome.');
        return;
      }
      setIsBrowserControlEnabled(true);
      setBrowserControlError(null);
      setPendingBrowserTask(null);
      setChatInput('');
      addUserTranscription(`Browser task: ${task}`, 'browser-task');
      sendSessionText(`BROWSER TASK CONFIRMED BY USER.\nTask: ${task}\nProceed with this browser task now using the browser_control tool and the visible Chrome/browser context. Keep the actions scoped to this task and ask before doing anything outside it.`);
    })();
  }, [addUserTranscription, checkBrowserControlBridge, ensureBrowserControlPrerequisites, pendingBrowserTask, runBrowserControlBridgeAction, sendSessionText]);

  const cancelBrowserTask = useCallback(() => { setPendingBrowserTask(null); }, []);

  const handleBrowserToolCalls = useCallback(async (functionCalls: BrowserToolCall[]) => {
    const functionResponses = await Promise.all(functionCalls.map(async (call) => {
      const responseName = call.name || 'browser_control';
      if (call.name !== 'browser_control') {
        return { id: call.id, name: responseName, response: { error: `Unknown browser control tool: ${responseName}` } };
      }
      if (!isBrowserControlSkillEnabledRef.current || statusRef.current !== SessionStatus.ACTIVE || !isScreenSharingRef.current || !isBrowserControlEnabledRef.current) {
        return { id: call.id, name: responseName, response: { error: 'Browser Control is not active. Ask the user to enable the Browser Control Skill in Settings, start a session, share the controlled Chrome window, and confirm the browser task.' } };
      }
      const result = await runBrowserControlBridgeAction(call.args || {});
      if (result.ok) {
        const outputText = typeof result.output === 'object' && result.output !== null
          ? JSON.stringify(result.output)
          : String(result.output ?? 'completed');
        addModelTranscription(`Browser action completed: ${outputText}`, 'browser-action');
      }
      return { id: call.id, name: responseName, response: result.ok ? { output: result.output } : { error: result.error || 'Browser Control bridge action failed.' } };
    }));
    sessionRef.current?.sendToolResponse({ functionResponses });
  }, [addModelTranscription, runBrowserControlBridgeAction]);

  const handleMessage = async (message: LiveServerMessage) => {
    if (message.toolCall?.functionCalls?.length) {
      void handleBrowserToolCalls(message.toolCall.functionCalls);
    }

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
      const systemInstruction = baseInstruction + interviewLevelInstruction + BROWSER_CONTROL_INSTRUCTION + historyContext + `\n\nCRITICAL INSTRUCTION: If you detect the user made a mistake in their coding or input based on their speech or screen share, you MUST start your spoken response with the exact uppercase string "[ERROR]". This will trigger the UI to highlight the error.`;

      const sessionPromise = ai.live.connect({
        model: MODEL_NAME,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: systemInstruction,
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedVoice } } },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          tools: [BROWSER_CONTROL_TOOL]
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
        setIsBrowserControlEnabled(false);
        setPendingBrowserTask(null);
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
          setIsBrowserControlEnabled(false);
          setPendingBrowserTask(null);
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
    status, isScreenSharing, shortcutKey, stopSession, startSession, toggleScreenShare
  });

  useEffect(() => {
    keyboardHandlerStateRef.current = { status, isScreenSharing, shortcutKey, stopSession, startSession, toggleScreenShare };
  }, [status, isScreenSharing, shortcutKey, stopSession, startSession, toggleScreenShare]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const { status, isScreenSharing, shortcutKey, stopSession, startSession, toggleScreenShare } = keyboardHandlerStateRef.current;
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

  const anyToastVisible = connectionError || screenShareError || browserControlError || apiKeyError || errorNotification || showAutoSaveToast;

  return (
    <div className="flex flex-col h-screen bg-transparent text-[var(--color-text-primary)] overflow-hidden relative">
      {/* === TOAST NOTIFICATIONS (consolidated, single instance each) === */}
      {anyToastVisible && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-3">
          <Toast visible={!!connectionError} variant="error" title="Connection Error" message={connectionError || undefined} onClose={() => setConnectionError(null)} />
          <Toast visible={!!apiKeyError} variant="error" title="API Key Missing" message="Please configure GEMINI_API_KEY in environment variables" onClose={() => setApiKeyError(false)} />
          <Toast visible={errorNotification && !connectionError && !apiKeyError} variant="error" title="Error Detected" message="Let's fix that." onClose={() => setErrorNotification(false)} />
          <Toast visible={!!screenShareError} variant="warning" title="Screen Share Error" message={screenShareError || undefined} onClose={() => setScreenShareError(null)} />
          <Toast visible={!!browserControlError} variant="info" title="Browser Control" message={browserControlError || undefined} onClose={() => setBrowserControlError(null)} />
          <Toast visible={showAutoSaveToast && !connectionError && !screenShareError && !browserControlError} variant="success" title="Auto-saved" onClose={() => setShowAutoSaveToast(false)} />
        </div>
      )}

      {/* === BROWSER TASK CONFIRMATION DIALOG === */}
      {pendingBrowserTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-card rounded-2xl p-6 max-w-md mx-4 animate-scale-in glow-primary">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[var(--color-primary-muted)] flex items-center justify-center">
                <svg className="w-5 h-5 text-[var(--color-primary-light)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold">Use Browser Control?</h3>
            </div>
            <p className="text-sm text-white/60 mb-4 leading-relaxed">
              Confirm that the agent should use the shared Chrome browser for this request.
            </p>
            <div className="glass rounded-xl px-4 py-3 text-sm text-white/80 mb-5 max-h-28 overflow-y-auto">
              {pendingBrowserTask}
            </div>
            <div className="flex gap-3">
              <button
                onClick={cancelBrowserTask}
                data-testid="browser-task-cancel"
                className="flex-1 px-4 py-2.5 glass hover:bg-[var(--glass-bg-hover)] rounded-xl font-medium transition-colors duration-150"
              >
                Cancel
              </button>
              <button
                onClick={confirmBrowserTask}
                data-testid="browser-task-confirm"
                className="flex-1 px-4 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-xl font-medium transition-colors duration-150 glow-primary"
              >
                Confirm
              </button>
            </div>
          </div>
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
      <div className="relative z-10 flex flex-col h-full">
        <div className="shrink-0 px-5 pt-5 pb-3">
        <Header
            status={status}
            selectedTutorId={selectedTutorId}
            onTutorSelect={setSelectedTutorId}
            sessionDuration={sessionDuration}
            selectedVoice={selectedVoice}
            onVoiceSelect={setSelectedVoice}
            shortcutKey={shortcutKey}
            onShortcutKeyChange={setShortcutKey}
            isBrowserControlSkillEnabled={isBrowserControlSkillEnabled}
          onBrowserControlSkillChange={setIsBrowserControlSkillEnabled}
          browserControlBridgeReady={browserControlBridgeReady}
          onResetTestState={resetTestState}
          theme={theme}
          onThemeChange={setTheme}
          interviewLevel={interviewLevel}
          onInterviewLevelChange={setInterviewLevel}
        />
        </div>

        <main className="flex-1 flex flex-col md:flex-row overflow-hidden px-4 md:px-5 pb-24 md:pb-28 gap-3 md:gap-4 max-w-6xl mx-auto w-full">
          {/* Left: Sessions & Screen */}
          <div className="flex-1 flex flex-col gap-4 overflow-hidden min-w-0 md:min-h-0">
            <div className="shrink-0 max-h-[180px] md:shrink md:max-h-none md:flex-1 overflow-hidden">
              <SessionList
              sessions={sessions}
              currentSessionId={currentSessionId}
              onSelectSession={selectSession}
              onCreateSession={createNewSession}
              onDeleteSession={deleteSession}
              onRenameSession={renameSession}
            />
            </div>
            <ScreenShare
              videoRef={videoRef}
              isSharing={isScreenSharing}
              onToggle={toggleScreenShare}
              isBrowserControlEnabled={isBrowserControlEnabled}
            />
          </div>

          {/* Right: Transcript & Chat */}
          <div className="w-full md:w-[380px] shrink-0 flex flex-col gap-4 overflow-hidden min-h-0">
            <div className="flex-1 overflow-hidden min-h-0">
              <TranscriptionList
                transcriptions={transcriptions}
                status={status}
                activeInputText={activeInputText}
                activeOutputText={activeOutputText}
                onClear={() => {
                  if (currentSessionId) {
                    updateCurrentSession({ transcriptions: [] });
                    setSessionDuration(0);
                  }
                }}
              />
            </div>
            <form
              onSubmit={handleSendChat}
              className="shrink-0 glass-input rounded-2xl p-1.5 flex items-center gap-2 relative z-10"
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={status === SessionStatus.ACTIVE ? "Type a message..." : "Start session to chat"}
                disabled={status !== SessionStatus.ACTIVE}
                className="flex-1 bg-transparent border-none outline-none text-white px-4 py-2.5 text-sm placeholder:text-white/25 disabled:opacity-40"
              />
              <button
                type="submit"
                data-testid="chat-send"
                disabled={!chatInput.trim() || status !== SessionStatus.ACTIVE}
                className={cn(
                  'w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-150 shrink-0',
                  chatInput.trim() && status === SessionStatus.ACTIVE
                    ? 'bg-[var(--color-primary)] text-white glow-primary hover:bg-[var(--color-primary-hover)]'
                    : 'bg-white/5 text-white/30'
                )}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </form>
          </div>

          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </main>

        <ControlPanel
          status={status}
          isMuted={isMuted}
          onToggleMute={() => setIsMuted(!isMuted)}
          onStart={startSession}
          onStop={stopSession}
          onToggleScreen={toggleScreenShare}
          isScreenSharing={isScreenSharing}
          onToggleBrowserControl={toggleBrowserControl}
          isBrowserControlEnabled={isBrowserControlEnabled}
          isBrowserControlSkillEnabled={isBrowserControlSkillEnabled}
          isBrowserControlBridgeReady={browserControlBridgeReady}
        />
      </div>
    </div>
  );
};

export default App;
