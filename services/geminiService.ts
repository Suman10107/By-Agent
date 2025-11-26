// services/geminiService.ts
import { GoogleGenAI, Chat, Modality, GenerateContentResponse } from '@google/genai';
import { Persona } from '../types';
import { MODEL_ID } from '../constants';

/**
 * Singleton instance of GoogleGenAI.
 * It's important to create this instance right before making an API call to ensure
 * it always uses the most up-to-date API key from the aistudio dialog.
 * This instance utilizes a single API key from `process.env.API_KEY` for all Gemini text and audio generation.
 */
let aiInstance: GoogleGenAI | null = null;
let lastApiKey: string | null = null; // Track the last API key used for the instance

function getAiInstance(): GoogleGenAI {
  const currentApiKey = process.env.API_KEY || '';
  // Re-initialize if instance is null or API key has changed
  if (!aiInstance || currentApiKey !== lastApiKey) {
    aiInstance = new GoogleGenAI({ apiKey: currentApiKey });
    lastApiKey = currentApiKey;
  }
  return aiInstance;
}

// Map to store chat sessions for each persona to maintain context
const chatsMap = new Map<Persona, Chat>();

/**
 * Retrieves or creates a chat session for a given persona.
 * @param persona The persona for which to get the chat session.
 * @param systemInstruction The system instruction for the chat model.
 * @returns The Chat instance for the persona.
 */
export function getChatSession(persona: Persona, systemInstruction: string): Chat {
  if (!chatsMap.has(persona)) {
    const ai = getAiInstance();
    const chat = ai.chats.create({
      model: MODEL_ID,
      config: {
        systemInstruction: systemInstruction,
      },
    });
    chatsMap.set(persona, chat);
  }
  return chatsMap.get(persona)!;
}

/**
 * Sends a message to the Gemini model for a specific persona and retrieves both text and audio responses.
 * @param persona The persona to interact with.
 * @param message The user's message.
 * @param systemInstruction The system instruction for the chat model.
 * @returns A Promise resolving to an object containing the AI's text response and its base64 encoded audio.
 */
export async function sendMessageAndGetAudio(
  persona: Persona,
  message: string,
  systemInstruction: string,
): Promise<{ text: string; audioBase64: string }> {
  try {
    const chat = getChatSession(persona, systemInstruction);

    // Make the API call with responseModalities to get both text and audio
    const response: GenerateContentResponse = await chat.sendMessage({
      message: message,
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
           voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }, // Using Kore for better consistency
        },
      },
    });

    // Attempt to get text from the dedicated .text getter first
    let aiText = response.text;

    // If .text is empty, iterate through parts as a fallback, which can happen in multimodal contexts
    if (!aiText && response.candidates && response.candidates.length > 0) {
      aiText = response.candidates[0].content?.parts
        ?.map(part => {
          if ('text' in part && typeof part.text === 'string') {
            return part.text;
          }
          return '';
        })
        .filter(Boolean) // Remove any empty strings from parts that aren't text
        .join(' '); // Join multiple text parts if they exist
    }

    aiText = aiText || 'No response text.'; // Final fallback

    const audioBase64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || '';

    if (!audioBase64) {
      console.warn("No audio data received from Gemini API.");
    }

    // Add logging here to debug the full response when the issue occurs
    console.log("Full Gemini response (static TTS):", response);
    console.log("Extracted AI Text (static TTS):", aiText);
    console.log("Audio Base64 length (static TTS):", audioBase64.length > 0 ? audioBase64.length : 'none');


    return { text: aiText, audioBase64: audioBase64 };
  } catch (error) {
    console.error('Error sending message to Gemini API:', error);
    // If the error message indicates "Requested entity was not found.", prompt the user to re-select API key.
    if (error instanceof Error && error.message.includes("Requested entity was not found.")) {
      console.warn("API Key might be invalid or expired. Prompting user to select key.");
      // This pattern assumes window.aistudio is available and handles the key selection.
      if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
        await window.aistudio.openSelectKey();
        // Force re-initialization of AI instance by clearing lastApiKey
        lastApiKey = null;
      }
      throw new Error("API Key issue. Please try again after re-selecting your API key.");
    }
    throw new Error('Failed to get response from AI. Please try again.');
  }
}