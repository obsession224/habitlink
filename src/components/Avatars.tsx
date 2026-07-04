import React from 'react';

export const PASTEL_COLORS = [
  'bg-blue-500 text-white',
  'bg-indigo-500 text-white',
  'bg-purple-500 text-white',
  'bg-pink-500 text-white',
  'bg-rose-500 text-white',
  'bg-emerald-500 text-white',
  'bg-teal-500 text-white',
  'bg-amber-500 text-white'
];

export function renderInitialsAvatar(nameString: string, sizeClass = 'w-10 h-10 text-sm') {
  const initials = nameString ? nameString.charAt(0).toUpperCase() : 'G';
  // Deterministic pastel color choice
  const charCodeSum = nameString ? nameString.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) : 0;
  const bgClass = PASTEL_COLORS[charCodeSum % PASTEL_COLORS.length];
  return (
    <div 
      className={`${sizeClass} rounded-full flex items-center justify-center font-bold tracking-wider border-2 border-white/40 dark:border-white/10 ${bgClass}`}
      role="img"
      aria-label={nameString}
    >
      {initials}
    </div>
  );
}
