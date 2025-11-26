// types.ts

export enum Persona {
  Rishi = 'Rishi',
  Girl = 'Girl', // Renamed from Mother
  Teacher = 'Teacher',
  GenZ = 'GenZ',
}

export type Sender = 'user' | 'ai';

export interface ChatMessage {
  sender: Sender;
  text: string;
}

export interface PersonaConfig {
  id: Persona;
  name: string;
  icon: string;
  initialGreeting: string;
  systemInstruction: string;
  allowedEmojis: boolean; // Indicates if emojis are allowed in AI response
}