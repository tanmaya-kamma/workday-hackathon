import React from 'react';

export function LoadingState({ message = 'Loading records...' }) {
  return (
    <div className="w-full py-16 flex flex-col items-center justify-center gap-3 text-center">
      <div className="w-10 h-10 border-3 border-[#ebf5ff] border-t-[#00646f] rounded-full animate-spin"></div>
      <p className="text-sm text-[#687781] font-medium">{message}</p>
    </div>
  );
}
