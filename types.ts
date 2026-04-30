
export interface Transcription {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  imageData?: string;
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
