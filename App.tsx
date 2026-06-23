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
import { SessionStatus, Transcription, ChatSession, Attachment } from './types';
import { fileToDataURL, fileToText, extractTextFromPDF } from './services/fileUtils';
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
import { Toast } from './components/Toast';
import { SessionSwitchModal } from './components/Modals';
import { SessionSidebar } from './components/SessionSidebar';
import { SettingsPanel } from './components/SettingsPanel';
import { ChatInput } from './components/ChatInput';
import { TranscriptionList } from './components/TranscriptionList';
import { ScreenShare } from './components/ScreenShare';

const isE2EMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('e2e');
const USER_NAME = 'User';

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const playSessionSound = (type: 'start' | 'end') => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    const now = ctx.currentTime;
    if (type === 'start') {
      // Ascending pleasant chime
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
      
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.15, now + 0.05);
      gain.gain.setValueAtTime(0.15, now + 0.25);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      
      osc.start(now);
      osc.stop(now + 0.5);
    } else {
      // Descending pleasant chime
      osc.type = 'sine';
      osc.frequency.setValueAtTime(783.99, now); // G5
      osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
      osc.frequency.setValueAtTime(523.25, now + 0.2); // C5
      
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.05);
      gain.gain.setValueAtTime(0.12, now + 0.25);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      
      osc.start(now);
      osc.stop(now + 0.5);
    }
    
    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 600);
  } catch (e) {
    console.warn('Could not play session sound:', e);
  }
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

  const [isGoogleSearchEnabled, setIsGoogleSearchEnabled] = useState(() => {
    return localStorage.getItem('is_google_search_enabled') === 'true';
  });
  const [isCodeExecutionEnabled, setIsCodeExecutionEnabled] = useState(() => {
    return localStorage.getItem('is_code_execution_enabled') !== 'false';
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
  useEffect(() => { localStorage.setItem('is_google_search_enabled', String(isGoogleSearchEnabled)); }, [isGoogleSearchEnabled]);
  useEffect(() => { localStorage.setItem('is_code_execution_enabled', String(isCodeExecutionEnabled)); }, [isCodeExecutionEnabled]);
  
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
  const [isThinking, setIsThinking] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [queuedChatAfterStart, setQueuedChatAfterStart] = useState<string | null>(null);

  const onAttachFiles = useCallback(async (files: FileList) => {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      try {
        if (file.type.startsWith('image/')) {
          const dataUrl = await fileToDataURL(file);
          setAttachments(prev => [...prev, { id, name: file.name, type: 'image', dataUrl }]);
        } else if (file.type === 'application/pdf') {
          const textContent = await extractTextFromPDF(file);
          setAttachments(prev => [...prev, { id, name: file.name, type: 'pdf', textContent }]);
        } else {
          // Default to text file reading
          const textContent = await fileToText(file);
          setAttachments(prev => [...prev, { id, name: file.name, type: 'text', textContent }]);
        }
      } catch (err) {
        console.error('Failed to attach file:', err);
      }
    }
  }, []);

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
    setAttachments([]);
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
      setAttachments([]);
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
        setAttachments([]);
      } else {
        setCurrentSessionId(null);
        setSessionDuration(0);
        setActiveInputText('');
        setActiveOutputText('');
        setAttachments([]);
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
        setAttachments([]);
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
    if (!text && attachments.length === 0) return;

    if (!currentSessionId) {
      createNewSession();
    }

    if (status === SessionStatus.CONNECTING) {
      setConnectionError('Session is still connecting. Please wait a second and try again.');
      return;
    }

    // Process document texts
    let payloadText = text;
    const docAttachments = attachments.filter(a => a.type === 'pdf' || a.type === 'text');
    if (docAttachments.length > 0) {
      if (!payloadText) {
        payloadText = "Analyze the attached documents.";
      }
      payloadText += "\n\n[Attached Files Content]:";
      docAttachments.forEach(doc => {
        payloadText += `\n\n--- File: ${doc.name} ---\n${doc.textContent}`;
      });
    }

    if (status !== SessionStatus.ACTIVE || !sessionRef.current) {
      setQueuedChatAfterStart(payloadText || "Start");
      setChatInput('');
      void startSession();
      return;
    }

    // Active session: send attached images
    const imgAttachments = attachments.filter(a => a.type === 'image' && a.dataUrl);
    imgAttachments.forEach(img => {
      try {
        const base64 = img.dataUrl!.split(',')[1];
        sessionRef.current?.sendRealtimeInput({
          video: { data: base64, mimeType: 'image/jpeg' }
        });
      } catch (err) {
        console.error('Failed to send image attachment:', err);
      }
    });

    const sentText = payloadText || "Analyze the attached images.";
    const sent = sendClientTurn(sentText);
    if (!sent) {
      setConnectionError('Message could not be sent. Please restart the session and try again.');
      return;
    }

    // Generate nice display text for the chat UI
    let displayUiText = text;
    if (attachments.length > 0) {
      if (!displayUiText) {
        displayUiText = "Sent attachments";
      }
      displayUiText += `\n\n📎 Attached files: ${attachments.map(a => a.name).join(', ')}`;
    }

    addUserTranscription(displayUiText, 'user-text');
    setChatInput('');
    setAttachments([]);
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
  const screenStreamRef = useRef<MediaStream | null>(null);
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
    playSessionSound('end');
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
    if (screenStreamRef.current) {
      const tracks = screenStreamRef.current.getTracks();
      tracks.forEach(track => {
        try { track.stop(); } catch (e) { console.warn('Error stopping screen track:', e); }
      });
      screenStreamRef.current = null;
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

    setIsThinking(true);

    if (isE2EMode) {
      setTimeout(() => {
        const tutor = selectedTutorIdRef.current;
        const tutorMeta = TUTOR_TYPES.find(t => t.id === tutor) || TUTOR_TYPES[0];
        
        if (tutor === 'ai-interviewer') {
          addModelTranscription(
            `Here is the mock interview wrap-up report:
 
1) Interview Overview: The candidate demonstrated excellent knowledge of software engineering principles.
2) Key Points Observed: Strong code styling, great system design choices.
3) Category Scores:
   - AI Dev: 8/10
   - AI Systems: 7/10
   - Frontend: 9/10
   - Backend: 8/10
   - AI Product/Design: 9/10
4) Overall Score: 85/100
5) Strengths:
   - Exceptional clarity in explaining trade-offs.
   - Solid understanding of state management.
6) Gaps and Risks:
   - Could focus more on database scaling under high load.
7) Actionable Suggestions:
   - Study write-through and write-behind cache strategies.
   - Deep dive into sharding options.
8) Hiring Signal: Strong Yes`,
            'mock-report'
          );
        } else if (tutor === 'claude-code-tutor') {
          addModelTranscription(
            `I am the Claude Code Tutor. Claude Code is a command-line agentic coding assistant by Anthropic.
You can launch interactive sessions with 'claude' or continue discussions with 'claude -c'.
For automated code review, use '/code-review' or run 'claude -p "query"' in your CI/CD pipeline.
Let me know what you want to build or how I can help you set up 'CLAUDE.md'!`,
            'mock-reply'
          );
        } else if (tutor === 'adhd-tutor') {
          addModelTranscription(
            `Hello, I am your ADHD Mock Specialist doctor. I am here to help you practice and organize your thoughts for your upcoming ADHD evaluation. Let's do a mock diagnostic interview. To begin, can you tell me what symptoms or challenges first made you suspect you might have ADHD, and how they impact your day-to-day life?`,
            'mock-reply'
          );
        } else {
          addModelTranscription(
            `Hi, this is a simulated reply in E2E mode from ${tutorMeta.name}. How can I assist you today?`,
            'mock-reply'
          );
        }
        setIsThinking(false);
      }, 600);
    }
  }, [updateCurrentSession, addModelTranscription, setIsThinking]);

  useEffect(() => {
    if (!queuedChatAfterStart || status !== SessionStatus.ACTIVE || !sessionRef.current) return;

    const queuedText = queuedChatAfterStart.trim();
    if (!queuedText) {
      setQueuedChatAfterStart(null);
      return;
    }

    // Send queued images if any
    const imgAttachments = attachments.filter(a => a.type === 'image' && a.dataUrl);
    imgAttachments.forEach(img => {
      try {
        const base64 = img.dataUrl!.split(',')[1];
        sessionRef.current?.sendRealtimeInput({
          video: { data: base64, mimeType: 'image/jpeg' }
        });
      } catch (err) {
        console.error('Failed to send queued image:', err);
      }
    });

    const sent = sendClientTurn(queuedText);
    if (!sent) {
      setConnectionError('Message could not be sent. Please restart the session and try again.');
      return;
    }

    // Prepare display text for UI
    let displayUiText = queuedText;
    if (displayUiText.includes('[Attached Files Content]:')) {
      displayUiText = displayUiText.split('[Attached Files Content]:')[0].trim();
    }
    if (attachments.length > 0) {
      if (!displayUiText) {
        displayUiText = "Sent attachments";
      }
      displayUiText += `\n\n📎 Attached files: ${attachments.map(a => a.name).join(', ')}`;
    }

    addUserTranscription(displayUiText, 'user-text');
    setQueuedChatAfterStart(null);
    setAttachments([]);
  }, [queuedChatAfterStart, status, sendClientTurn, addUserTranscription, attachments]);

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
      setIsThinking(false);
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
      setIsThinking(false);
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
      setIsThinking(false);
    }

    if (message.serverContent?.interrupted) {
      audioSourcesRef.current.forEach(s => {
        try {
          const ctx = outputAudioCtxRef.current;
          if (ctx) {
            const gainNode = ctx.createGain();
            gainNode.gain.setValueAtTime(1, ctx.currentTime);
            gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.05);
            s.connect(gainNode);
            gainNode.connect(ctx.destination);
          }
          s.stop();
        } catch (e) { }
      });
      audioSourcesRef.current.clear();
      nextStartTimeRef.current = 0;
      setIsThinking(false);
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
        playSessionSound('start');
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

      const toolsConfig: any[] = [];
      if (isGoogleSearchEnabled) {
        toolsConfig.push({ googleSearch: {} });
      }
      if (isCodeExecutionEnabled) {
        toolsConfig.push({ codeExecution: {} });
      }

      const sessionPromise = ai.live.connect({
        model: MODEL_NAME,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: systemInstruction,
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedVoice } } },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          tools: toolsConfig
        },
        callbacks: {
          onopen: () => {
            console.log('Session opened');
            setStatus(SessionStatus.ACTIVE);
            playSessionSound('start');
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
            console.error('Session error detailed event:', err);
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
          onclose: (event) => {
            console.log('Session closed event details:', {
              code: event?.code,
              reason: event?.reason,
              wasClean: event?.wasClean
            });
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
        if (screenStreamRef.current) {
          const tracks = screenStreamRef.current.getTracks();
          tracks.forEach(track => { try { track.stop(); } catch (e) { console.warn('Error stopping screen track:', e); } });
          screenStreamRef.current = null;
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
      screenStreamRef.current = screenStream;
      setIsScreenSharing(true);
      setScreenShareError(null);
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

  useEffect(() => {
    if (isScreenSharing && screenStreamRef.current && videoRef.current) {
      videoRef.current.srcObject = screenStreamRef.current;
      screenStreamRef.current.getVideoTracks()[0].onended = () => {
        setIsScreenSharing(false);
        if (videoRef.current) { videoRef.current.srcObject = null; }
        screenStreamRef.current = null;
        setScreenShareError(null);
      };
    }
  }, [isScreenSharing]);

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
    { id: 'claude-code-tutor', label: 'Claude Code' },
    { id: 'adhd-tutor', label: 'ADHD Mock Specialist' },
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
      {/* === TOAST NOTIFICATIONS === */}
      {anyToastVisible && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-3">
          <Toast visible={!!connectionError} variant="error" title="Connection Error" message={connectionError || undefined} onClose={() => setConnectionError(null)} />
          <Toast visible={!!apiKeyError} variant="error" title="API Key Missing" message="Please configure GEMINI_API_KEY in environment variables" onClose={() => setApiKeyError(false)} />
          <Toast visible={errorNotification && !connectionError && !apiKeyError} variant="error" title="Error Detected" message="Let's fix that." onClose={() => setErrorNotification(false)} />
          <Toast visible={!!screenShareError} variant="warning" title="Screen Share Error" message={screenShareError || undefined} onClose={() => setScreenShareError(null)} />
          <Toast visible={showAutoSaveToast && !connectionError && !screenShareError} variant="success" title="Auto-saved" onClose={() => setShowAutoSaveToast(false)} />
        </div>
      )}

      <SessionSwitchModal
        sessionSwitchWarning={sessionSwitchWarning}
        pendingSessionId={pendingSessionId}
        cancelSessionSwitch={cancelSessionSwitch}
        confirmSessionSwitch={confirmSessionSwitch}
      />

      {/* === MAIN LAYOUT === */}
      <div className="relative z-10 flex w-full h-full overflow-hidden">
        <SessionSidebar
          isSidebarCollapsed={isSidebarCollapsed}
          setIsSidebarCollapsed={setIsSidebarCollapsed}
          createNewSession={createNewSession}
          selectedTutorId={selectedTutorId}
          setSelectedTutorId={setSelectedTutorId}
          sessions={sessions}
          currentSessionId={currentSessionId}
          selectSession={selectSession}
          status={status}
          sessionDuration={sessionDuration}
          formatTime={formatTime}
          selectedTutorMeta={selectedTutorMeta}
          setIsSettingsOpen={setIsSettingsOpen}
          USER_NAME={USER_NAME}
          networkQuality={networkQuality}
          renameSession={renameSession}
        />

        <main className="flex-1 relative overflow-hidden">
          <SettingsPanel
            isSettingsOpen={isSettingsOpen}
            setIsSettingsOpen={setIsSettingsOpen}
            isSidebarCollapsed={isSidebarCollapsed}
            selectedTutorId={selectedTutorId}
            setSelectedTutorId={setSelectedTutorId}
            selectedVoice={selectedVoice}
            setSelectedVoice={setSelectedVoice}
            interviewLevel={interviewLevel}
            setInterviewLevel={setInterviewLevel}
            theme={theme}
            setTheme={setTheme}
            shortcutKey={shortcutKey}
            setShortcutKey={setShortcutKey}
            resetTestState={resetTestState}
            isRecordingKey={isRecordingKey}
            setIsRecordingKey={setIsRecordingKey}
            isGoogleSearchEnabled={isGoogleSearchEnabled}
            setIsGoogleSearchEnabled={setIsGoogleSearchEnabled}
            isCodeExecutionEnabled={isCodeExecutionEnabled}
            setIsCodeExecutionEnabled={setIsCodeExecutionEnabled}
          />

          <TranscriptionList
            transcriptions={transcriptions}
            activeInputText={activeInputText}
            activeOutputText={activeOutputText}
            status={status}
            stopSession={stopSession}
            startSession={startSession}
            toggleScreenShare={toggleScreenShare}
            isScreenSharing={isScreenSharing}
            selectedTutorMeta={selectedTutorMeta}
            transcriptScrollRef={transcriptScrollRef}
            currentSession={currentSession}
            videoRef={videoRef}
            isThinking={isThinking}
          />

          <ChatInput
            chatInput={chatInput}
            setChatInput={setChatInput}
            handleSendChat={handleSendChat}
            toggleScreenShare={toggleScreenShare}
            isScreenSharing={isScreenSharing}
            selectedTutorId={selectedTutorId}
            setSelectedTutorId={setSelectedTutorId}
            isMuted={isMuted}
            setIsMuted={setIsMuted}
            status={status}
            stopSession={stopSession}
            startSession={startSession}
            chatInputRef={chatInputRef}
            sessionDuration={sessionDuration}
            selectedTutorMeta={selectedTutorMeta}
            isE2EMode={isE2EMode}
            formatTime={formatTime}
            attachments={attachments}
            setAttachments={setAttachments}
            onAttachFiles={onAttachFiles}
          />

          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </main>
      </div>
    </div>
  );
};

export default App;