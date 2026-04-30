
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
  JPEG_QUALITY 
} from './constants';
import { SessionStatus, Transcription, TutorType, ChatSession } from './types';
import { 
  decode, 
  decodeAudioData, 
  createBlob, 
  encode 
} from './services/audioUtils';

const App: React.FC = () => {
  const [status, setStatus] = useState<SessionStatus>(SessionStatus.IDLE);
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    try {
      const saved = localStorage.getItem('chat_sessions');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem('current_session_id');
      return saved || null;
    } catch {
      return null;
    }
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
    localStorage.setItem('current_session_id', currentSessionId || '');
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
          return { ...session, ...updates, updatedAt: Date.now() };
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
          localStorage.setItem('chat_sessions', JSON.stringify(sessionsRef.current));
          localStorage.setItem('current_session_id', currentSessionIdRef.current || '');
          
          setShowAutoSaveToast(true);
          if (toastTimeout) window.clearTimeout(toastTimeout);
          toastTimeout = window.setTimeout(() => setShowAutoSaveToast(false), 3000);
        }
      }, 60000);
    }

    const handleBeforeUnload = () => {
      localStorage.setItem('chat_sessions', JSON.stringify(sessionsRef.current));
      localStorage.setItem('current_session_id', currentSessionIdRef.current || '');
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      if (saveInterval) window.clearInterval(saveInterval);
      if (toastTimeout) window.clearTimeout(toastTimeout);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      localStorage.setItem('chat_sessions', JSON.stringify(sessionsRef.current));
      localStorage.setItem('current_session_id', currentSessionIdRef.current || '');
    };
  }, [status]);

  const [activeInputText, setActiveInputText] = useState('');
  const [activeOutputText, setActiveOutputText] = useState('');
  const [chatInput, setChatInput] = useState('');

  const createNewSession = useCallback(() => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      name: `Session ${sessions.length + 1}`,
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
  }, [sessions.length, selectedTutorId, selectedVoice]);

  const selectSession = useCallback((sessionId: string) => {
    setCurrentSessionId(sessionId);
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      setSessionDuration(session.duration);
      setSelectedTutorId(session.tutorId);
      setSelectedVoice(session.voice);
      setActiveInputText('');
      setActiveOutputText('');
    }
  }, [sessions]);

  const deleteSession = useCallback((sessionId: string) => {
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
  }, [currentSessionId, sessions, selectSession]);

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text || !sessionRef.current || status !== SessionStatus.ACTIVE || !currentSessionId) return;

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
  const isMutedRef = useRef(isMuted);
  const lastShiftTimeRef = useRef<number>(0);
  const micStreamRef = useRef<MediaStream | null>(null);
  


  useEffect(() => {
    isMutedRef.current = isMuted;
    if (micStreamRef.current) {
      micStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !isMuted;
      });
    }
  }, [isMuted]);

  const [isScreenSharing, setIsScreenSharing] = useState(false);
  
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
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    
    audioSourcesRef.current.forEach(source => source.stop());
    audioSourcesRef.current.clear();
    
    if (inputAudioCtxRef.current) {
      inputAudioCtxRef.current.close();
      inputAudioCtxRef.current = null;
    }
    if (outputAudioCtxRef.current) {
      outputAudioCtxRef.current.close();
      outputAudioCtxRef.current = null;
    }

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    }

    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }

    setIsScreenSharing(false);
    setStatus(SessionStatus.IDLE);
  }, []);

  const [errorNotification, setErrorNotification] = useState(false);

  // Auto-hide error notification after 5s
  useEffect(() => {
    if (errorNotification) {
      const t = setTimeout(() => setErrorNotification(false), 5000);
      return () => clearTimeout(t);
    }
  }, [errorNotification]);

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
    } catch(e) {}
  }, []);

  const handleMessage = async (message: LiveServerMessage) => {
    // 1. Audio Playback
    const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
    if (audioData && outputAudioCtxRef.current) {
      const ctx = outputAudioCtxRef.current;
      nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
      
      const buffer = await decodeAudioData(
        decode(audioData),
        ctx,
        AUDIO_CONFIG.outputSampleRate,
        1
      );
      
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.onended = () => audioSourcesRef.current.delete(source);
      
      source.start(nextStartTimeRef.current);
      nextStartTimeRef.current += buffer.duration;
      audioSourcesRef.current.add(source);
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
        try { s.stop(); } catch (e) {}
      });
      audioSourcesRef.current.clear();
      nextStartTimeRef.current = 0;
    }
  };

  const startSession = async () => {
    try {
      setStatus(SessionStatus.CONNECTING);
      setSessionDuration(0);
      
      if (!currentSessionId) {
        createNewSession();
      }
      
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      aiRef.current = ai;

      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: AUDIO_CONFIG.inputSampleRate });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: AUDIO_CONFIG.outputSampleRate });
      inputAudioCtxRef.current = inputCtx;
      outputAudioCtxRef.current = outputCtx;

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
      const systemInstruction = baseInstruction + historyContext + `\n\nCRITICAL INSTRUCTION: If you detect the user made a mistake in their coding or input based on their speech or screen share, you MUST start your spoken response with the exact uppercase string "[ERROR]". This will trigger the UI to highlight the error.`;

      const sessionPromise = ai.live.connect({
        model: MODEL_NAME,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: systemInstruction,
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedVoice } }
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {}
        },
        callbacks: {
          onopen: () => {
            console.log('Session opened');
            setStatus(SessionStatus.ACTIVE);
            
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
    }
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
      setIsScreenSharing(false);
      return;
    }

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' } as any,
        audio: false
      });

      if (videoRef.current) {
        videoRef.current.srcObject = screenStream;
        screenStream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false);
          if (videoRef.current) {
            videoRef.current.srcObject = null;
          }
        };
        setIsScreenSharing(true);
      }

      screenStream.getVideoTracks()[0].onended = () => {
        setIsScreenSharing(false);
      };

    } catch (err) {
      console.error('Screen share error:', err);
    }
  };

  // Frame streaming effect
  useEffect(() => {
    let interval: number | undefined;
    if (isScreenSharing && status === SessionStatus.ACTIVE) {
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
            if (blob) {
              const reader = new FileReader();
              reader.onloadend = () => {
                const base64 = (reader.result as string).split(',')[1];
                sessionRef.current?.sendRealtimeInput({
                  video: { data: base64, mimeType: 'image/jpeg' }
                });
              };
              reader.readAsDataURL(blob);
            }
          }, 'image/jpeg', JPEG_QUALITY);
        }
      }, 1000 / FRAME_RATE);
    }
    return () => clearInterval(interval);
  }, [isScreenSharing, status]);

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
          />
          <ScreenShare 
            videoRef={videoRef} 
            isSharing={isScreenSharing} 
            onToggle={toggleScreenShare} 
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
      />


    </div>
  );
};

export default App;
