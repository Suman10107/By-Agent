// components/MessageInput.tsx
import React, { useState, useRef, useEffect } from 'react';
import { MicrophoneIcon, PaperAirplaneIcon, StopIcon } from '@heroicons/react/24/solid'; // Using Heroicons for a modern look

interface MessageInputProps {
  onSendMessage: (message: string) => void;
  onToggleRecording: () => void; // New prop for mic button
  isLoading: boolean;
  isSpeaking: boolean;
  isRecording: boolean; // New prop for mic state
}

const MessageInput: React.FC<MessageInputProps> = ({ onSendMessage, onToggleRecording, isLoading, isSpeaking, isRecording }) => {
  const [inputMessage, setInputMessage] = useState<string>('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputMessage(event.target.value);
  };

  const handleSendClick = () => {
    if (inputMessage.trim() && !isLoading && !isSpeaking && !isRecording) {
      onSendMessage(inputMessage.trim());
      setInputMessage('');
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault(); // Prevent new line on Enter
      handleSendClick();
    }
  };

  useEffect(() => {
    // Adjust textarea height dynamically
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [inputMessage]);

  const isDisabled = isLoading || isSpeaking || isRecording;
  const isSendDisabled = isDisabled || !inputMessage.trim();

  return (
    <div className="p-4 bg-gradient-to-t from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-900
                    shadow-2xl border-t border-gray-200 dark:border-gray-700
                    w-full max-w-3xl mx-auto flex items-end rounded-t-lg">
      <textarea
        ref={textareaRef}
        className={`
          flex-1 p-3 border rounded-xl resize-none overflow-hidden
          bg-white dark:bg-gray-900 border-gray-300 dark:border-700
          text-gray-900 dark:text-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500
          transition-all duration-200 max-h-32 min-h-[44px]
          ${isDisabled ? 'opacity-60 cursor-not-allowed' : ''}
        `}
        placeholder={isRecording ? 'Listening...' : (isSpeaking ? 'AI is speaking...' : (isLoading ? 'Loading...' : 'Type your message...'))}
        value={inputMessage}
        onChange={handleInputChange}
        onKeyPress={handleKeyPress}
        rows={1}
        disabled={isDisabled}
      />
      <button
        onClick={handleSendClick}
        disabled={isSendDisabled}
        className={`
          ml-2 md:ml-3 p-3 rounded-xl font-semibold flex items-center justify-center
          transition-all duration-200 w-12 h-12
          ${isSendDisabled
            ? 'bg-blue-300 dark:bg-blue-700 text-white cursor-not-allowed'
            : 'bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 dark:from-blue-600 dark:to-blue-700 text-white shadow-lg'
          }
        `}
        title="Send Message"
      >
        <PaperAirplaneIcon className="h-5 w-5 -rotate-45" />
      </button>

      <button
        onClick={onToggleRecording}
        disabled={isLoading || isSpeaking} // Disable mic if loading or AI is speaking
        className={`
          ml-2 md:ml-3 p-3 rounded-xl font-semibold flex items-center justify-center
          transition-all duration-200 w-12 h-12
          ${isRecording
            ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse shadow-lg' // Red pulsating when recording
            : 'bg-purple-500 hover:bg-purple-600 dark:bg-purple-600 dark:hover:bg-purple-700 text-white shadow-lg' // Purple when idle
          }
          ${(isLoading || isSpeaking) ? 'opacity-60 cursor-not-allowed' : ''}
        `}
        title={isRecording ? "Stop Recording" : "Start Recording"}
      >
        {isRecording ? <StopIcon className="h-5 w-5" /> : <MicrophoneIcon className="h-5 w-5" />}
      </button>
    </div>
  );
};

export default MessageInput;