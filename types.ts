
export interface Transcription {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface ChatSession {
  id: string;
  name: string;
  transcriptions: Transcription[];
  createdAt: number;
  updatedAt: number;
  duration: number;
  tutorId: string;
  voice: string;
}

export enum SessionStatus {
  IDLE = 'idle',
  CONNECTING = 'connecting',
  ACTIVE = 'active',
  ERROR = 'error'
}

export interface AudioConfig {
  inputSampleRate: number;
  outputSampleRate: number;
}

export interface TutorType {
  id: string;
  name: string;
  description: string;
  systemInstruction: string;
  voiceName: string;
}
