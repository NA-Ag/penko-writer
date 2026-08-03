import React from 'react';

export const Ruler: React.FC<{ darkMode: boolean }> = ({ darkMode }) => {
  const bgColor = darkMode ? 'bg-[#252525]' : 'bg-gray-100';
  const borderColor = darkMode ? 'border-gray-700' : 'border-gray-300';
  const tickColor = darkMode ? 'bg-gray-500' : 'bg-gray-400';
  const subTickColor = darkMode ? 'bg-gray-600' : 'bg-gray-300';
  const textColor = darkMode ? 'text-gray-400' : 'text-gray-500';

  const marks = [];
  for (let i = 0; i < 40; i++) {
    marks.push(
      <div key={i} className="flex flex-col items-start h-full" style={{ width: '1cm' }}>
        <div className={`w-px h-1.5 ${tickColor} self-start`}></div>
        {/* Sub marks */}
        <div className="flex w-full justify-between mt-[1px]">
           <div className={`w-px h-1 ${subTickColor}`}></div>
           <div className={`w-px h-1 ${subTickColor}`}></div>
           <div className={`w-px h-1.5 ${tickColor}`}></div> 
           <div className={`w-px h-1 ${subTickColor}`}></div>
           <div className={`w-px h-1 ${subTickColor}`}></div>
        </div>
        <span className={`text-[8px] ${textColor} mt-0.5 -ml-1 select-none`}>{i + 1}</span>
      </div>
    );
  }

  return (
    <div className={`h-6 border-b flex items-end pl-[25mm] pr-[25mm] overflow-hidden w-full max-w-[210mm] mx-auto select-none cursor-default relative transition-colors ${bgColor} ${borderColor}`}>
       {/* Indent Markers */}
       <div className="absolute left-[25mm] top-0 h-full w-4 z-10 group cursor-col-resize">
         <div className={`w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] absolute top-0 ${darkMode ? 'border-t-gray-400' : 'border-t-gray-600'}`}></div>
         <div className={`w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[6px] absolute bottom-0 ${darkMode ? 'border-b-gray-400' : 'border-b-gray-600'}`}></div>
       </div>
       
       <div className="absolute right-[25mm] top-0 h-full w-4 z-10 cursor-col-resize">
          <div className={`w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[6px] absolute bottom-0 ${darkMode ? 'border-b-gray-400' : 'border-b-gray-600'}`}></div>
       </div>

      <div className="flex w-full h-full pt-1">
        {marks}
      </div>
    </div>
  );
};