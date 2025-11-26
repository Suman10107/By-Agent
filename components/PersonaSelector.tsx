// components/PersonaSelector.tsx
import React from 'react';
import { Persona, PersonaConfig } from '../types';

interface PersonaSelectorProps {
  personas: PersonaConfig[];
  activePersona: Persona;
  onSelectPersona: (persona: Persona) => void;
  isLoading: boolean;
  isRecording: boolean; // New prop for recording state
}

const PersonaSelector: React.FC<PersonaSelectorProps> = ({ personas, activePersona, onSelectPersona, isLoading, isRecording }) => {
  const isDisabled = isLoading || isRecording; // Disable selection during loading or recording

  return (
    <div className="flex justify-center md:justify-start items-center p-2 md:p-4
                    bg-gradient-to-r from-blue-700 to-purple-600 shadow-xl rounded-b-lg w-full">
      <h2 className="text-white text-lg md:text-xl font-bold mr-4 hidden md:block">Select Persona:</h2>
      <div className="flex gap-3 overflow-x-auto pb-1"> {/* Added overflow for small screens */}
        {personas.map((persona) => (
          <button
            key={persona.id}
            onClick={() => onSelectPersona(persona.id)}
            disabled={isDisabled}
            className={`
              flex flex-col items-center justify-center w-16 h-16 md:w-20 md:h-20
              rounded-full transition-all duration-300 transform
              hover:scale-105 active:scale-95 text-white
              ${activePersona === persona.id
                ? 'bg-purple-400 border-4 border-white shadow-2xl' // Active state
                : 'bg-blue-500 bg-opacity-70 border-2 border-transparent' // Inactive state
              }
              ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
            `}
            title={persona.name}
          >
            <span className="text-2xl md:text-3xl">{persona.icon}</span>
            <span className="text-xs font-medium mt-1 sr-only md:not-sr-only">{persona.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default PersonaSelector;