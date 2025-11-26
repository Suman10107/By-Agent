// components/ChatWindow.tsx
import React, { useEffect, useRef } from 'react';
import { ChatMessage, Sender } from '../types';

interface ChatWindowProps {
  messages: ChatMessage[];
  aiSpeaking: boolean;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ messages, aiSpeaking }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const getMessageBubbleClasses = (sender: Sender) => {
    // Futuristic and colorful gradients
    return sender === 'user'
      ? 'bg-gradient-to-br from-sky-500 to-indigo-600 text-white self-end rounded-br-lg shadow-xl shadow-sky-500/30'
      : 'bg-gradient-to-br from-fuchsia-500 to-purple-600 text-white self-start rounded-bl-lg shadow-xl shadow-fuchsia-500/30';
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-3xl mx-auto w-full">
      {messages.map((message, index) => (
        <div
          key={index}
          className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`
              max-w-[80%] p-3 rounded-xl transition-all duration-300
              ${getMessageBubbleClasses(message.sender)}
            `}
            style={{ borderRadius: message.sender === 'user' ? '1.5rem 0.5rem 1.5rem 1.5rem' : '0.5rem 1.5rem 1.5rem 1.5rem' }}
          >
            <p className="text-sm md:text-base whitespace-pre-wrap">{message.text}</p>
          </div>
        </div>
      ))}
      {aiSpeaking && (
        <div className="flex justify-start">
          <div className="bg-gradient-to-br from-fuchsia-500 to-purple-600 text-white p-3 rounded-xl shadow-xl shadow-fuchsia-500/30"
               style={{ borderRadius: '0.5rem 1.5rem 1.5rem 1.5rem' }}>
            <div className="flex space-x-1 text-fuchsia-400"> {/* Matched dot color to AI bubble */}
              <span className="animate-pulse duration-700 delay-0">.</span>
              <span className="animate-pulse duration-700 delay-100">.</span>
              <span className="animate-pulse duration-700 delay-200">.</span>
            </div>
          </div>
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default ChatWindow;