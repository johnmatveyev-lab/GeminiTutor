
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { Header } from './components/Header';
import { TranscriptionList } from './components/TranscriptionList';
import { SessionList } from './components/SessionList';
import { ScreenShare } from './components/ScreenShare';
import { ControlPanel } from './components/ControlPanel';
import {
  MODEL_NAME,
  TUTOR_TYPES,
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

const App: React.FC = () => {
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

  const [isBrowserControlSkillEnabled, setIsBrowserControlSkillEnabled] = useState(() => {
    return localStorage.getItem('browser_control_skill_enabled') === 'true';
  });

  const [sessionDuration, setSessionDuration] = useState(() => {
    return currentSession?.duration || 0;
  });

  useEffect(() => {
    localStorage.setItem('selected_tutor_id', selectedTutorId);
  }, [selectedTutorId]);

  useEffect(() => {
    localStorage.setItem('selected_voice', selectedVoice);
  }, [selectedVoice]);

  useEffect(() => {
    localStorage.setItem('shortcut_key', shortcutKey);
  }, [shortcutKey]);

  useEffect(() => {
    localStorage.setItem('browser_control_skill_enabled', String(isBrowserControlSkillEnabled));
  }, [isBrowserControlSkillEnabled]);

  useEffect(() => {
    saveCurrentSessionId(currentSessionId);
  }, [currentSessionId]);

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
          // Auto-generate name from first transcription if not already customized
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
    // Prevent switching sessions during active session
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
    // If pendingSessionId is null, it means we're deleting the current session
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

    // Normal session switching
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSessionId, sessions]);

  const cancelSessionSwitch = useCallback(() => {
    setPendingSessionId(null);
    setSessionSwitchWarning(false);
  }, []);

  const deleteSession = useCallback((sessionId: string) => {
    // Prevent deleting the active session during an active session
    if (currentSessionId === sessionId && status === SessionStatus.ACTIVE) {
      setSessionSwitchWarning(true);
      setPendingSessionId(null); // Set to null to indicate deletion
      return;
    }

    setSessions(prev => prev.filter(s => s.id !== sessionId));
    
    // If we deleted the current session, select another one
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

    if (isBrowserTaskRequest(text)) {
      setPendingBrowserTask(text);
      return;
    }

    sessionRef.current.send({
      clientContent: {
        turns: [{ role: 'user', parts: [{ text }] }],
        turnComplete: true
      }
    });

    const newTranscription: Transcription = {
      id: Date.now().toString() + '-user-text',
      role: 'user',
      text,
      timestamp: Date.now()
    };

    updateCurrentSession({
      transcriptions: [...(currentSession?.transcriptions || []), newTranscription]
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
    return () => {
      if (timer) clearInterval(timer);
    }
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

  // Network quality detection
  useEffect(() => {
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (!connection) return;

    const updateNetworkQuality = () => {
      const effectiveType = connection.effectiveType;
      const downlink = connection.downlink;

      // Determine quality based on connection type and speed
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
    // Clean up audio sources
    audioSourcesRef.current.forEach(source => {
      try {
        source.stop();
        source.disconnect();
      } catch (e) {
        console.warn('Error stopping audio source:', e);
      }
    });
    audioSourcesRef.current.clear();

    // Clean up session
    if (sessionRef.current) {
      try {
        sessionRef.current.close();
      } catch (e) {
        console.warn('Error closing session:', e);
      }
      sessionRef.current = null;
    }

    // Clean up audio contexts
    if (inputAudioCtxRef.current) {
      try {
        inputAudioCtxRef.current.close();
      } catch (e) {
        console.warn('Error closing input audio context:', e);
      }
      inputAudioCtxRef.current = null;
    }
    if (outputAudioCtxRef.current) {
      try {
        outputAudioCtxRef.current.close();
      } catch (e) {
        console.warn('Error closing output audio context:', e);
      }
      outputAudioCtxRef.current = null;
    }

    // Clean up microphone stream
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (e) {
          console.warn('Error stopping mic track:', e);
        }
      });
      micStreamRef.current = null;
    }

    // Clean up video stream
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => {
        try {
          track.stop();
        } catch (e) {
          console.warn('Error stopping video track:', e);
        }
      });
      videoRef.current.srcObject = null;
    }

    // Reset audio timing
    nextStartTimeRef.current = 0;

    setIsScreenSharing(false);
    setIsBrowserControlEnabled(false);
    setPendingBrowserTask(null);
    setStatus(SessionStatus.IDLE);
  }, []);

  const [errorNotification, setErrorNotification] = useState(false);
  const [apiKeyError, setApiKeyError] = useState(false);
  const [sessionSwitchWarning, setSessionSwitchWarning] = useState(false);
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
  const [screenShareError, setScreenShareError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Auto-hide error notification after 5s
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

  // Check for API key on mount
  useEffect(() => {
    if (!process.env.API_KEY && process.env.NODE_ENV === 'production') {
      setApiKeyError(true);
    }
  }, []);

  // Check browser compatibility on mount
  useEffect(() => {
    const browserInfo = getBrowserInfo();
    const compatibilityMessage = getCompatibilityMessage();
    
    if (compatibilityMessage) {
      console.warn('Browser compatibility issue:', compatibilityMessage);
      // You could show a warning dialog here if needed
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
    try {
      const response = await fetch(`${BROWSER_CONTROL_BRIDGE_URL}/status`);
      const result = await response.json();
      const isReady = Boolean(result.ok);
      setBrowserControlBridgeReady(isReady);
      return isReady;
    } catch (error) {
      setBrowserControlBridgeReady(false);
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
  }, [checkBrowserControlBridge]);

  const sendSessionText = useCallback((text: string) => {
    sessionRef.current?.send({
      clientContent: {
        turns: [{ role: 'user', parts: [{ text }] }],
        turnComplete: true
      }
    });
  }, []);

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

  const toggleBrowserControl = useCallback(() => {
    void (async () => {
    if (isBrowserControlEnabled) {
      setIsBrowserControlEnabled(false);
      sendSessionText('BROWSER CONTROL DISABLED BY USER. Stop browser-control actions and return to normal tutoring.');
      return;
    }

    if (!ensureBrowserControlPrerequisites(false)) return;
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
  }, [
    checkBrowserControlBridge,
    ensureBrowserControlPrerequisites,
    isBrowserControlEnabled,
    isScreenSharing,
    runBrowserControlBridgeAction,
    sendSessionText
  ]);

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
    sendSessionText(`BROWSER TASK CONFIRMED BY USER.
Task: ${task}
Proceed with this browser task now using the browser_control tool and the visible Chrome/browser context. Keep the actions scoped to this task and ask before doing anything outside it.`);
    })();
  }, [
    addUserTranscription,
    checkBrowserControlBridge,
    ensureBrowserControlPrerequisites,
    pendingBrowserTask,
    runBrowserControlBridgeAction,
    sendSessionText
  ]);

  const cancelBrowserTask = useCallback(() => {
    setPendingBrowserTask(null);
  }, []);

  const handleBrowserToolCalls = useCallback(async (functionCalls: BrowserToolCall[]) => {
    const functionResponses = await Promise.all(functionCalls.map(async (call) => {
      const responseName = call.name || 'browser_control';

      if (call.name !== 'browser_control') {
        return {
          id: call.id,
          name: responseName,
          response: { error: `Unknown browser control tool: ${responseName}` }
        };
      }

      if (
        !isBrowserControlSkillEnabledRef.current ||
        statusRef.current !== SessionStatus.ACTIVE ||
        !isScreenSharingRef.current ||
        !isBrowserControlEnabledRef.current
      ) {
        return {
          id: call.id,
          name: responseName,
          response: {
            error: 'Browser Control is not active. Ask the user to enable the Browser Control Skill in Settings, start a session, share the controlled Chrome window, and confirm the browser task.'
          }
        };
      }

      const result = await runBrowserControlBridgeAction(call.args || {});

      return {
        id: call.id,
        name: responseName,
        response: result.ok
          ? { output: result.output }
          : { error: result.error || 'Browser Control bridge action failed.' }
      };
    }));

    sessionRef.current?.sendToolResponse({ functionResponses });
  }, [runBrowserControlBridgeAction]);

  const handleMessage = async (message: LiveServerMessage) => {
    if (message.toolCall?.functionCalls?.length) {
      void handleBrowserToolCalls(message.toolCall.functionCalls);
    }

    // 1. Audio Playback
    const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
    if (audioData && outputAudioCtxRef.current) {
      const ctx = outputAudioCtxRef.current;
      nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);

      try {
        const buffer = await decodeAudioData(
          decode(audioData),
          ctx,
          AUDIO_CONFIG.outputSampleRate,
          1
        );

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        
        // Clean up source when it finishes playing
        source.onended = () => {
          try {
            source.disconnect();
            audioSourcesRef.current.delete(source);
          } catch (e) {
            console.warn('Error cleaning up audio source:', e);
          }
        };

        // Handle source errors
        source.onerror = (error) => {
          console.warn('Audio source error:', error);
          try {
            source.disconnect();
            audioSourcesRef.current.delete(source);
          } catch (e) {
            console.warn('Error cleaning up failed audio source:', e);
          }
        };

        source.start(nextStartTimeRef.current);
        nextStartTimeRef.current += buffer.duration;
        audioSourcesRef.current.add(source);
      } catch (audioError) {
        console.error('Error processing audio data:', audioError);
      }
    }

    // 2. Transcription Logic
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
        newTranscriptions.push({
          id: Date.now().toString() + '-user',
          role: 'user',
          text: currentInputText.current,
          timestamp: Date.now()
        });
      }
      if (currentOutputText.current.trim()) {
        newTranscriptions.push({
          id: Date.now().toString() + '-model',
          role: 'model',
          text: currentOutputText.current,
          timestamp: Date.now()
        });
      }

      if (newTranscriptions.length > 0 && currentSessionIdRef.current) {
        const currentSession = sessionsRef.current.find(s => s.id === currentSessionIdRef.current);
        if (currentSession) {
          updateCurrentSession({
            transcriptions: [...currentSession.transcriptions, ...newTranscriptions]
          });
        }
      }

      currentInputText.current = '';
      currentOutputText.current = '';
      setActiveInputText('');
      setActiveOutputText('');
    }

    // 3. Interruption Handling
    if (message.serverContent?.interrupted) {
      audioSourcesRef.current.forEach(s => {
        try { s.stop(); } catch (e) { }
      });
      audioSourcesRef.current.clear();
      nextStartTimeRef.current = 0;
    }
  };

  const startSession = async () => {
    try {
      // Check browser compatibility
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

      // Check for API key
      if (!process.env.API_KEY) {
        setApiKeyError(true);
        setStatus(SessionStatus.ERROR);
        return;
      }

      setStatus(SessionStatus.CONNECTING);
      setSessionDuration(0);
      setConnectionError(null);

      if (!currentSessionId) {
        createNewSession();
      }

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      aiRef.current = ai;

      // Create AudioContext after user interaction to avoid autoplay issues
      let inputCtx: AudioContext;
      let outputCtx: AudioContext;
      
      try {
        inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: AUDIO_CONFIG.inputSampleRate });
        outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: AUDIO_CONFIG.outputSampleRate });
        
        // Resume AudioContext if it's suspended (browser autoplay policy)
        if (inputCtx.state === 'suspended') {
          await inputCtx.resume();
        }
        if (outputCtx.state === 'suspended') {
          await outputCtx.resume();
        }
      } catch (audioError) {
        console.error('Failed to create AudioContext:', audioError);
        setStatus(SessionStatus.ERROR);
        setConnectionError('Failed to initialize audio. Please check your browser permissions.');
        return;
      }
      
      inputAudioCtxRef.current = inputCtx;
      outputAudioCtxRef.current = outputCtx;

      // Get microphone stream
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = micStream;
      micStream.getAudioTracks().forEach(track => {
        track.enabled = !isMutedRef.current;
      });

      const currentSessionData = sessionsRef.current.find(s => s.id === currentSessionIdRef.current);
      const historyContext = currentSessionData?.transcriptions && currentSessionData.transcriptions.length > 0
        ? `\n\nPREVIOUS CONVERSATION HISTORY:\n${currentSessionData.transcriptions.slice(-20).map(t => `${t.role === 'user' ? 'User' : 'Tutor'}: ${t.text}`).join('\n')}`
        : '';
      const baseInstruction = selectedTutor?.systemInstruction || TUTOR_TYPES[0].systemInstruction;
      const systemInstruction = baseInstruction + BROWSER_CONTROL_INSTRUCTION + historyContext + `\n\nCRITICAL INSTRUCTION: If you detect the user made a mistake in their coding or input based on their speech or screen share, you MUST start your spoken response with the exact uppercase string "[ERROR]". This will trigger the UI to highlight the error.`;

      const sessionPromise = ai.live.connect({
        model: MODEL_NAME,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: systemInstruction,
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedVoice } }
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          tools: [BROWSER_CONTROL_TOOL]
        },
        callbacks: {
          onopen: () => {
            console.log('Session opened');
            setStatus(SessionStatus.ACTIVE);
            setRetryCount(0); // Reset retry count on successful connection

            // Microphone Streaming
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
            console.error('Session error:', err);
            setStatus(SessionStatus.ERROR);
            
            // Implement retry logic with exponential backoff
            const maxRetries = 3;
            if (retryCount < maxRetries) {
              const backoffDelay = Math.min(1000 * Math.pow(2, retryCount), 10000); // Max 10 seconds
              setConnectionError(`Connection failed. Retrying in ${backoffDelay / 1000} seconds... (${retryCount + 1}/${maxRetries})`);
              
              setTimeout(() => {
                setRetryCount(prev => prev + 1);
                startSession();
              }, backoffDelay);
            } else {
              setConnectionError('Failed to connect after multiple attempts. Please check your internet connection and try again.');
            }
          },
          onclose: () => {
            console.log('Session closed');
            stopSession();
          }
        }
      });

      sessionRef.current = await sessionPromise;

    } catch (err) {
      console.error('Failed to start session:', err);
      setStatus(SessionStatus.ERROR);
      
      // Provide user-friendly error messages
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
      // Stop screen sharing
      try {
        if (videoRef.current?.srcObject) {
          const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
          tracks.forEach(track => {
            try {
              track.stop();
            } catch (e) {
              console.warn('Error stopping video track:', e);
            }
          });
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

    // Start screen sharing
    try {
      // Check if getDisplayMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        throw new Error('Screen sharing is not supported in your browser');
      }

      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' } as any,
        audio: false
      });

      if (videoRef.current) {
        videoRef.current.srcObject = screenStream;
        
        // Handle user stopping the share via browser UI
        screenStream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false);
          setIsBrowserControlEnabled(false);
          setPendingBrowserTask(null);
          if (videoRef.current) {
            videoRef.current.srcObject = null;
          }
          setScreenShareError(null);
        };
        
        setIsScreenSharing(true);
        setScreenShareError(null);
      }
    } catch (error: any) {
      console.error('Screen share error:', error);
      
      // Provide user-friendly error messages
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
      
      // Auto-hide error after 5 seconds
      setTimeout(() => {
        setScreenShareError(null);
      }, 5000);
    }
  };

  // Frame streaming effect with adaptive quality
  useEffect(() => {
    let interval: number | undefined;
    if (isScreenSharing && status === SessionStatus.ACTIVE) {
      // Get adaptive settings based on network quality
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
            if (blob && sessionRef.current) { // Additional safety check
              const reader = new FileReader();
              reader.onloadend = () => {
                if (sessionRef.current) { // Additional safety check
                  const base64 = (reader.result as string).split(',')[1];
                  sessionRef.current.sendRealtimeInput({
                    video: { data: base64, mimeType: 'image/jpeg' }
                  });
                }
              };
              reader.readAsDataURL(blob);
            }
          }, 'image/jpeg', adaptiveQuality);
        }
      }, 1000 / adaptiveFrameRate);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isScreenSharing, status, networkQuality]);

  // Ref for keyboard handler state to avoid stale closures with empty dependency array
  const keyboardHandlerStateRef = useRef({
    status,
    isScreenSharing,
    shortcutKey,
    stopSession,
    startSession,
    toggleScreenShare
  });

  useEffect(() => {
    keyboardHandlerStateRef.current = {
      status,
      isScreenSharing,
      shortcutKey,
      stopSession,
      startSession,
      toggleScreenShare
    };
  }, [status, isScreenSharing, shortcutKey, stopSession, startSession, toggleScreenShare]);

  // Keyboard shortcut listener - Stable listener with empty dependency array for performance
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const {
        status,
        isScreenSharing,
        shortcutKey,
        stopSession,
        startSession,
        toggleScreenShare
      } = keyboardHandlerStateRef.current;

      // Shortcut toggle (Double Shift)
      if (e.key === 'Shift') {
        const now = Date.now();
        if (now - lastShiftTimeRef.current < 500) {
          // Double shift detected
          if (status === SessionStatus.ACTIVE) {
            stopSession();
          } else if (status === SessionStatus.IDLE) {
            startSession();
            // Automatically start screen sharing for tutor experience
            if (!isScreenSharing) toggleScreenShare();
          }
          lastShiftTimeRef.current = 0;
        } else {
          lastShiftTimeRef.current = now;
        }
      }

      // Legacy key shortcut
      if (!shortcutKey || shortcutKey === 'None') return;
      if (e.code === shortcutKey || e.key === shortcutKey) {
        e.preventDefault();
        if (status === SessionStatus.ACTIVE) {
          stopSession();
        } else if (status === SessionStatus.IDLE) {
          startSession();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []); // Empty dependency array

  return (
    <div className="flex flex-col h-screen bg-transparent text-white overflow-hidden relative">
      {/* Connection Error Toast */}
      {connectionError && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-50 bg-[#FF453A]/95 backdrop-blur-xl border border-white/20 text-white px-6 py-4 rounded-full flex items-center gap-3 shadow-[0_0_30px_rgba(255,69,58,0.3)] animate-in fade-in slide-in-from-top-4 duration-300 max-w-md">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="flex-1">
            <p className="text-sm font-semibold tracking-wide mb-1">Connection Error</p>
            <p className="text-xs text-white/80">{connectionError}</p>
          </div>
          <button 
            onClick={() => setConnectionError(null)}
            className="p-1 hover:bg-white/10 rounded-full transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Screen Share Error Toast */}
      {screenShareError && (
        <div className="absolute bottom-32 left-1/2 -translate-x-1/2 z-50 bg-[#FF9F0A]/95 backdrop-blur-xl border border-white/20 text-white px-6 py-4 rounded-full flex items-center gap-3 shadow-[0_0_30px_rgba(255,159,10,0.3)] animate-in fade-in slide-in-from-bottom-4 duration-300 max-w-md">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="flex-1">
            <p className="text-sm font-semibold tracking-wide mb-1">Screen Share Error</p>
            <p className="text-xs text-white/80">{screenShareError}</p>
          </div>
          <button 
            onClick={() => setScreenShareError(null)}
            className="p-1 hover:bg-white/10 rounded-full transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Browser Control Error Toast */}
      {browserControlError && (
        <div className="absolute bottom-32 left-1/2 -translate-x-1/2 z-50 bg-[#0A84FF]/95 backdrop-blur-xl border border-white/20 text-white px-6 py-4 rounded-full flex items-center gap-3 shadow-[0_0_30px_rgba(10,132,255,0.3)] animate-in fade-in slide-in-from-bottom-4 duration-300 max-w-md">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3a9 9 0 100 18 9 9 0 000-18z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.6 9h16.8M3.6 15h16.8M12 3c2.1 2.4 3.2 5.4 3.2 9S14.1 18.6 12 21c-2.1-2.4-3.2-5.4-3.2-9S9.9 5.4 12 3z" />
          </svg>
          <div className="flex-1">
            <p className="text-sm font-semibold tracking-wide mb-1">Browser Control</p>
            <p className="text-xs text-white/80">{browserControlError}</p>
          </div>
          <button 
            onClick={() => setBrowserControlError(null)}
            className="p-1 hover:bg-white/10 rounded-full transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Browser Task Confirmation Dialog */}
      {pendingBrowserTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#1C1C1E]/95 backdrop-blur-xl border border-[#0A84FF]/30 rounded-3xl p-6 shadow-[0_24px_80px_rgba(10,132,255,0.22)] max-w-md mx-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#0A84FF]/20 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-[#64D2FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3a9 9 0 100 18 9 9 0 000-18z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.6 9h16.8M3.6 15h16.8M12 3c2.1 2.4 3.2 5.4 3.2 9S14.1 18.6 12 21c-2.1-2.4-3.2-5.4-3.2-9S9.9 5.4 12 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white">Use Browser Control?</h3>
            </div>
            <p className="text-white/70 mb-4 leading-relaxed">
              Confirm that the agent should use the shared Chrome browser for this request.
            </p>
            <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white/85 mb-6 max-h-28 overflow-y-auto">
              {pendingBrowserTask}
            </div>
            <div className="flex gap-3">
              <button
                onClick={cancelBrowserTask}
                className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmBrowserTask}
                className="flex-1 px-4 py-3 bg-[#0A84FF] hover:bg-[#0071E3] text-white rounded-xl font-medium transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Session Switch Warning Dialog */}
      {sessionSwitchWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#1C1C1E]/95 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl max-w-md mx-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#FF9F0A]/20 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-[#FF9F0A]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white">
                {pendingSessionId === null ? 'Delete Active Session?' : 'Active Session in Progress'}
              </h3>
            </div>
            <p className="text-white/70 mb-6 leading-relaxed">
              {pendingSessionId === null 
                ? 'You have an active tutoring session. Deleting this session will end it and remove all data. Are you sure you want to continue?'
                : 'You have an active tutoring session. Switching sessions will end the current session. Are you sure you want to continue?'
              }
            </p>
            <div className="flex gap-3">
              <button
                onClick={cancelSessionSwitch}
                className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmSessionSwitch}
                className="flex-1 px-4 py-3 bg-[#FF9F0A] hover:bg-[#FF9F0A]/90 text-white rounded-xl font-medium transition-colors"
              >
                {pendingSessionId === null ? 'End & Delete' : 'End & Switch'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* API Key Error Toast */}
      {apiKeyError && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-50 bg-[#FF453A]/95 backdrop-blur-xl border border-white/20 text-white px-6 py-4 rounded-full flex items-center gap-3 shadow-[0_0_30px_rgba(255,69,58,0.3)] animate-in fade-in slide-in-from-top-4 duration-300 max-w-md">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="flex-1">
            <p className="text-sm font-semibold tracking-wide mb-1">API Key Missing</p>
            <p className="text-xs text-white/80">Please configure GEMINI_API_KEY in environment variables</p>
          </div>
          <button 
            onClick={() => setApiKeyError(false)}
            className="p-1 hover:bg-white/10 rounded-full transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Error Notification Toast */}
      {errorNotification && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-50 bg-[#FF453A]/90 backdrop-blur-xl border border-white/20 text-white px-6 py-3 rounded-full flex items-center gap-3 shadow-[0_0_30px_rgba(255,69,58,0.3)] animate-in fade-in slide-in-from-top-4 duration-300">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="text-sm font-semibold tracking-wide">Error Detected! Let's fix that.</span>
        </div>
      )}

      {/* Auto-save Toast */}
      {showAutoSaveToast && (
        <div className="absolute top-24 right-6 z-50 bg-[#34C759]/90 backdrop-blur-xl border border-white/20 text-white px-4 py-2 rounded-full flex items-center gap-2 shadow-[0_0_20px_rgba(52,199,89,0.2)] animate-in fade-in slide-in-from-top-4 duration-300">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-xs font-semibold tracking-wide uppercase">Auto-saved</span>
        </div>
      )}

      <div className="pt-6 px-6 relative z-20">
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
        />
      </div>

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden p-6 gap-6 relative z-10 pb-32 max-w-7xl mx-auto w-full">
        {/* Left Side: Sessions & Screen */}
        <div className="flex-1 flex flex-col gap-6 overflow-hidden">
          <SessionList
            sessions={sessions}
            currentSessionId={currentSessionId}
            onSelectSession={selectSession}
            onCreateSession={createNewSession}
            onDeleteSession={deleteSession}
            onRenameSession={renameSession}
          />
          <ScreenShare
            videoRef={videoRef}
            isSharing={isScreenSharing}
            onToggle={toggleScreenShare}
            isBrowserControlEnabled={isBrowserControlEnabled}
          />

        </div>

        {/* Right Side: Transcription & Chat History */}
        <div className="w-full md:w-96 flex flex-col gap-6 overflow-hidden">
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
            className="shrink-0 bg-[#1C1C1E]/40 backdrop-blur-2xl rounded-3xl border border-white/10 p-2 flex items-center gap-2 shadow-2xl relative z-10"
          >
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder={status === SessionStatus.ACTIVE ? "Type a message..." : "Start session to chat"}
              disabled={status !== SessionStatus.ACTIVE}
              className="flex-1 bg-transparent border-none outline-none text-white px-4 py-2 placeholder-white/30 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!chatInput.trim() || status !== SessionStatus.ACTIVE}
              className="w-10 h-10 rounded-full flex items-center justify-center bg-[#0A84FF] text-white disabled:opacity-50 disabled:bg-white/10 disabled:text-white/40 transition-colors"
            >
              <svg className="w-5 h-5 -ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </form>
        </div>
        {/* Hidden canvas for automated frame streaming */}
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
  );
};

export default App;
