// App.tsx
import React, { useState, useEffect, useCallback, useRef, MutableRefObject } from 'react';
import PersonaSelector from './components/PersonaSelector';
import ChatWindow from './components/ChatWindow';
import MessageInput from './components/MessageInput';
import { Persona, ChatMessage, PersonaConfig } from './types';
import { PERSONAS } from './constants';
import { sendMessageAndGetAudio } from './services/geminiService';
import { decode, decodeAudioData, encode } from './utils/audioUtils';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';

// Define a keyframe animation for the bouncing dots
const styleSheet = document.createElement('style');
styleSheet.type = 'text/css';
styleSheet.innerHTML = `
  @keyframes pulse-mic {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.05); opacity: 0.8; }
  }
  .animate-pulse-mic {
    animation: pulse-mic 1.5s infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }
  .animate-pulse {
    animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
`;
document.head.appendChild(styleSheet);

// Constants for Live API audio processing
const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;
const SCRIPT_PROCESSOR_BUFFER_SIZE = 4096; // Should be a power of 2

const App: React.FC = () => {
  const [activePersona, setActivePersona] = useState<Persona>(PERSONAS[0].id);
  const [chatHistories, setChatHistories] = useState<Map<Persona, ChatMessage[]>>(new Map());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false); // New state for microphone recording

  // Refs for audio contexts and nodes
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextAudioStartTimeRef = useRef<number>(0);
  const currentAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamSourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const scriptProcessorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const microphoneStreamRef = useRef<MediaStream | null>(null);
  const liveSessionPromiseRef: MutableRefObject<Promise<any> | null> = useRef(null);

  // Refs for accumulating transcription text
  const currentInputTranscriptionRef = useRef<string>('');
  const currentOutputTranscriptionRef = useRef<string>('');

  const getPersonaConfig = useCallback((personaId: Persona): PersonaConfig => {
    return PERSONAS.find(p => p.id === personaId) || PERSONAS[0]; // Fallback to first persona
  }, []);

  // Initialize output AudioContext and chat history for the first persona on mount
  useEffect(() => {
    if (!outputAudioContextRef.current) {
      outputAudioContextRef.current = new window.AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });
    }

    if (chatHistories.size === 0 && !chatHistories.has(activePersona)) {
      const initialPersonaConfig = getPersonaConfig(activePersona);
      setChatHistories((prev) =>
        new Map(prev).set(activePersona, [{ sender: 'ai', text: initialPersonaConfig.initialGreeting }])
      );
    }
    return () => {
      // Clean up output AudioContext on unmount
      if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
        outputAudioContextRef.current.close();
        outputAudioContextRef.current = null;
      }
      // Ensure recording is stopped if component unmounts while active
      if (isRecording) {
        handleToggleRecording();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Function to create a blob for Live API
  const createPcmBlob = useCallback((data: Float32Array): { data: string; mimeType: string } => {
    const l = data.length;
    const int16 = new Int192Array(l);
    for (let i = 0; i < l; i++) {
      int16[i] = data[i] * 32768; // Normalize float to 16-bit signed integer
    }
    return {
      data: encode(new Uint8Array(int16.buffer)),
      mimeType: `audio/pcm;rate=${INPUT_SAMPLE_RATE}`,
    };
  }, []);

  const playAudio = useCallback(async (audioBase64: string, ctx: AudioContext, sampleRate: number) => {
    if (!ctx || ctx.state === 'closed') return;

    // Clear previous audio if any. For Live API, the `onmessage` handles interruptions.
    // For static TTS, we might stop the previous if it's still playing.
    if (!isRecording && currentAudioSourceRef.current) {
      currentAudioSourceRef.current.stop();
      currentAudioSourceRef.current.disconnect();
      currentAudioSourceRef.current = null;
    }

    try {
      setIsSpeaking(true);
      const decodedBytes = decode(audioBase64);
      const audioBuffer = await decodeAudioData(
        decodedBytes,
        ctx,
        sampleRate,
        1 // Number of channels (mono)
      );

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      nextAudioStartTimeRef.current = Math.max(
        nextAudioStartTimeRef.current,
        ctx.currentTime
      );
      source.start(nextAudioStartTimeRef.current);
      nextAudioStartTimeRef.current += audioBuffer.duration;

      sourcesRef.current.add(source); // Add to set for potential interruption

      source.onended = () => {
        sourcesRef.current.delete(source);
        if (sourcesRef.current.size === 0) {
          setIsSpeaking(false);
          nextAudioStartTimeRef.current = 0; // Reset after all queued audio is played
        }
      };
      currentAudioSourceRef.current = source; // Keep track of the *last* source for static playback
    } catch (error) {
      console.error('Error playing audio:', error);
      setIsSpeaking(false);
    }
  }, [isRecording]);


  const handleToggleRecording = useCallback(async () => {
    if (isLoading || isSpeaking) return; // Prevent toggling if busy

    if (isRecording) {
      // Stop recording
      setIsRecording(false);
      setIsSpeaking(false);
      setIsLoading(false); // Ensure loading is off

      // Stop current AI speech playback
      for (const source of sourcesRef.current.values()) {
        source.stop();
      }
      sourcesRef.current.clear();
      nextAudioStartTimeRef.current = 0;

      // Close live session
      if (liveSessionPromiseRef.current) {
        liveSessionPromiseRef.current.then(session => session.close());
        liveSessionPromiseRef.current = null;
      }

      // Stop microphone stream and disconnect nodes
      if (microphoneStreamRef.current) {
        microphoneStreamRef.current.getTracks().forEach(track => track.stop());
        microphoneStreamRef.current = null;
      }
      if (mediaStreamSourceNodeRef.current) {
        mediaStreamSourceNodeRef.current.disconnect();
        mediaStreamSourceNodeRef.current = null;
      }
      if (scriptProcessorNodeRef.current) {
        scriptProcessorNodeRef.current.disconnect();
        scriptProcessorNodeRef.current.onaudioprocess = null;
        scriptProcessorNodeRef.current = null;
      }
      if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
        inputAudioContextRef.current.close();
        inputAudioContextRef.current = null;
      }
      // Reset transcription buffers
      currentInputTranscriptionRef.current = '';
      currentOutputTranscriptionRef.current = '';

    } else {
      // Start recording
      setIsLoading(true); // Indicate loading while connecting to Live API
      try {
        // Ensure API Key is selected before connecting to Live API
        if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
          const hasKey = await window.aistudio.hasSelectedApiKey();
          if (!hasKey) {
            await window.aistudio.openSelectKey();
            // If the user doesn't select a key or cancels, the process will naturally halt
            // A subsequent API call will trigger re-check.
          }
        }

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        microphoneStreamRef.current = stream;

        inputAudioContextRef.current = new window.AudioContext({ sampleRate: INPUT_SAMPLE_RATE });
        mediaStreamSourceNodeRef.current = inputAudioContextRef.current.createMediaStreamSource(stream);
        scriptProcessorNodeRef.current = inputAudioContextRef.current.createScriptProcessor(
          SCRIPT_PROCESSOR_BUFFER_SIZE,
          1, // input channels
          1  // output channels (not used for sending, but required)
        );

        mediaStreamSourceNodeRef.current.connect(scriptProcessorNodeRef.current);
        scriptProcessorNodeRef.current.connect(inputAudioContextRef.current.destination);

        // Always create a new GoogleGenAI instance for Live API to ensure it uses the most up-to-date API key.
        // This instance, like others, utilizes a single API key from `process.env.API_KEY`.
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
        const currentPersonaConfig = getPersonaConfig(activePersona);

        // Store the promise, and ensure sendRealtimeInput is called only after it resolves
        liveSessionPromiseRef.current = ai.live.connect({
          model: 'gemini-2.5-flash-native-audio-preview-09-2025',
          callbacks: {
            onopen: () => {
              console.debug('Live session opened');
              setIsRecording(true);
              setIsLoading(false); // Live session connected, no longer loading
              // Reset transcription buffers for new session
              currentInputTranscriptionRef.current = '';
              currentOutputTranscriptionRef.current = '';

              // Initialize message history for live session, if first message
              if (!chatHistories.has(activePersona) || chatHistories.get(activePersona)!.length === 0) {
                 setChatHistories((prev) =>
                    new Map(prev).set(activePersona, [{ sender: 'ai', text: currentPersonaConfig.initialGreeting }])
                 );
              }
            },
            onmessage: async (message: LiveServerMessage) => {
              // Process AI's audio output
              const base64EncodedAudioString = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
              if (base64EncodedAudioString && outputAudioContextRef.current) {
                await playAudio(base64EncodedAudioString, outputAudioContextRef.current, OUTPUT_SAMPLE_RATE);
              }

              // Accumulate AI's text output
              if (message.serverContent?.outputTranscription) {
                currentOutputTranscriptionRef.current += message.serverContent.outputTranscription.text;
              }

              // Accumulate user's transcribed input
              if (message.serverContent?.inputTranscription) {
                currentInputTranscriptionRef.current += message.serverContent.inputTranscription.text;
              }

              // Handle interruption (e.g., user speaks over AI)
              if (message.serverContent?.interrupted) {
                for (const source of sourcesRef.current.values()) {
                  source.stop();
                }
                sourcesRef.current.clear();
                nextAudioStartTimeRef.current = 0;
                setIsSpeaking(false);
                // Clear any partial transcriptions
                currentInputTranscriptionRef.current = '';
                currentOutputTranscriptionRef.current = '';
              }

              if (message.serverContent?.turnComplete) {
                // Commit accumulated user input to chat history
                const fullInputTranscription = currentInputTranscriptionRef.current.trim();
                if (fullInputTranscription) {
                  setChatHistories(prev => {
                      return new Map(prev).set(activePersona, [...(prev.get(activePersona) || []), { sender: 'user', text: fullInputTranscription }]);
                  });
                }
                currentInputTranscriptionRef.current = ''; // Clear for next turn

                // Commit accumulated AI output to chat history
                const fullOutputTranscription = currentOutputTranscriptionRef.current.trim();
                if (fullOutputTranscription) {
                  setChatHistories(prev => {
                      let historyForPersona = prev.get(activePersona) || [];
                      const lastMessage = historyForPersona[historyForPersona.length - 1];

                      // If the last message is the initial greeting, replace it.
                      // This ensures the first actual AI response overwrites the placeholder greeting.
                      if (lastMessage && lastMessage.sender === 'ai' && lastMessage.text === currentPersonaConfig.initialGreeting) {
                          const updatedHistory = [...historyForPersona.slice(0, -1), { sender: 'ai', text: fullOutputTranscription }];
                          return new Map(prev).set(activePersona, updatedHistory);
                      } else {
                          // Standard case: append new AI message
                          return new Map(prev).set(activePersona, [...historyForPersona, { sender: 'ai', text: fullOutputTranscription }]);
                      }
                  });
                }
                currentOutputTranscriptionRef.current = ''; // Clear for next turn

                setIsSpeaking(false);
                nextAudioStartTimeRef.current = 0; // Reset for next turn
              }
            },
            onerror: (e: ErrorEvent) => {
              console.error('Live session error:', e);
              handleToggleRecording(); // Attempt to stop recording on error
              alert(`Live AI session error: ${e.message || 'Unknown error'}. Please try again.`);
            },
            onclose: (e: CloseEvent) => {
              console.debug('Live session closed:', e);
              // Only react to unexpected closure, otherwise `handleToggleRecording` manages state
              if (isRecording && e.code !== 1000) { // 1000 is normal closure
                handleToggleRecording();
                alert(`Live AI session unexpectedly closed: ${e.reason || 'Unknown reason'}. Please try again.`);
              }
            },
          },
          config: {
            responseModalities: [Modality.AUDIO], // Must be an array with a single `Modality.AUDIO` element.
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
            },
            inputAudioTranscription: {}, // Enable transcription for user input
            outputAudioTranscription: {}, // Enable transcription for model output
            systemInstruction: currentPersonaConfig.systemInstruction,
          },
        });

        // Setup audio processing for sending microphone data
        scriptProcessorNodeRef.current.onaudioprocess = (audioProcessingEvent) => {
          const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
          const pcmBlob = createPcmBlob(inputData);
          liveSessionPromiseRef.current?.then((session) => {
            session.sendRealtimeInput({ media: pcmBlob });
          });
        };

      } catch (error) {
        console.error('Error starting live session:', error);
        setIsLoading(false);
        setIsRecording(false);
        alert(`Could not start voice chat: ${error instanceof Error ? error.message : 'Unknown error'}. Please ensure microphone access and a valid API key.`);
      }
    }
  }, [isRecording, isLoading, isSpeaking, chatHistories, getPersonaConfig, createPcmBlob, playAudio, activePersona]);


  const handlePersonaSelect = useCallback(async (personaId: Persona) => {
    if (isLoading || isSpeaking || isRecording) return; // Prevent switching if busy

    setActivePersona(personaId);
    if (!chatHistories.has(personaId)) {
      const personaConfig = getPersonaConfig(personaId);
      setChatHistories((prev) =>
        new Map(prev).set(personaId, [{ sender: 'ai', text: personaConfig.initialGreeting }])
      );
    }

    // Always check for API key when switching persona, as different models might require it.
    // For `gemini-2.5-flash-native-audio-preview-09-2025` used in live mode, a paid key is required.
    // For `gemini-2.5-flash-preview-tts` (MODEL_ID) used in text mode, it's also good practice.
    try {
      if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (!hasKey) {
          await window.aistudio.openSelectKey();
          // Assume success after opening dialog, re-check on next API call if fails
        }
      }
    } catch (error) {
      console.error("Error during API key selection check:", error);
    }
  }, [chatHistories, getPersonaConfig, isLoading, isSpeaking, isRecording]);


  const handleSendMessage = useCallback(async (message: string) => {
    if (!message.trim() || isLoading || isSpeaking || isRecording) return;

    setIsLoading(true);
    const personaConfig = getPersonaConfig(activePersona);
    const newChatHistory = [...(chatHistories.get(activePersona) || []), { sender: 'user', text: message }];

    setChatHistories((prev) => new Map(prev).set(activePersona, newChatHistory));

    try {
      const { text: aiText, audioBase64 } = await sendMessageAndGetAudio(
        activePersona,
        message,
        personaConfig.systemInstruction
      );

      setChatHistories((prev) =>
        new Map(prev).set(activePersona, [...(prev.get(activePersona) || []), { sender: 'ai', text: aiText }])
      );

      if (audioBase64 && outputAudioContextRef.current) {
        await playAudio(audioBase64, outputAudioContextRef.current, OUTPUT_SAMPLE_RATE);
      }
    } catch (error) {
      console.error('Failed to get AI response:', error);
      setChatHistories((prev) =>
        new Map(prev).set(activePersona, [
          ...(prev.get(activePersona) || []),
          { sender: 'ai', text: `Error: ${error instanceof Error ? error.message : 'Something went wrong.'}` },
        ])
      );
      // If API key issue, reset state for re-selection
      if (error instanceof Error && error.message.includes("API Key issue")) {
        // The service already triggered `openSelectKey`, here we just ensure state is correct
      }
    } finally {
      setIsLoading(false);
    }
  }, [activePersona, chatHistories, getPersonaConfig, playAudio, isLoading, isSpeaking, isRecording]);

  const currentChatMessages = chatHistories.get(activePersona) || [];

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-slate-900 via-zinc-900 to-neutral-900
                    dark:from-gray-950 dark:via-gray-900 dark:to-purple-950
                    text-gray-900 dark:text-gray-50 font-inter">
      <header className="flex flex-col md:flex-row items-center justify-between
                         p-2 md:p-4 bg-gradient-to-r from-blue-700 to-purple-600 shadow-xl z-20">
        <h1 className="text-white text-xl md:text-2xl font-bold font-poppins mb-2 md:mb-0">
          Multi-Persona AI Chat
        </h1>
        <PersonaSelector
          personas={PERSONAS}
          activePersona={activePersona}
          onSelectPersona={handlePersonaSelect}
          isLoading={isLoading}
          isRecording={isRecording}
        />
      </header>

      {/* Chat Area Container - made more colorful and futuristic */}
      <div className="flex-1 overflow-hidden flex flex-col pt-4 pb-2 md:pb-4 px-2 md:px-4
                      bg-gray-800/30 backdrop-blur-sm border border-gray-700 rounded-lg mx-auto my-4 w-[calc(100%-2rem)] max-w-3xl">
        <ChatWindow messages={currentChatMessages} aiSpeaking={isSpeaking} />
      </div>

      <div className="sticky bottom-0 z-10">
        <MessageInput
          onSendMessage={handleSendMessage}
          onToggleRecording={handleToggleRecording}
          isLoading={isLoading}
          isSpeaking={isSpeaking}
          isRecording={isRecording}
        />
      </div>
    </div>
  );
};

export default App;