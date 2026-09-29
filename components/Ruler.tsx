import React from 'react';
import { useApp } from '../AppContext';
import { rulerGeometry } from '../utils/ribbonHelpers';

export const Ruler: React.FC<{ darkMode: boolean }> = ({ darkMode }) => {
  const { currentDoc, zoom } = useApp();
  const scale = (zoom || 100) / 100;
  const { widthMm, marginMm, ticks } = rulerGeometry(currentDoc?.pageConfig);
  const mm = (v: number) => `${v * scale}mm`;

  const bgColor = darkMode ? 'bg-[#252525]' : 'bg-gray-100';
  const borderColor = darkMode ? 'border-gray-700' : 'border-gray-300';
  const tickColor = darkMode ? 'bg-gray-500' : 'bg-gray-400';
  const subTickColor = darkMode ? 'bg-gray-600' : 'bg-gray-300';
  const textColor = darkMode ? 'text-gray-400' : 'text-gray-500';

  const marks = [];
  for (let i = 0; i < ticks; i++) {
    marks.push(
      <div key={i} className="flex flex-col items-start h-full shrink-0" style={{ width: mm(10) }}>
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
    <div
      className={`h-6 border-b flex items-end overflow-hidden mx-auto select-none cursor-default relative transition-colors ${bgColor} ${borderColor}`}
      style={{ width: mm(widthMm), paddingLeft: mm(marginMm), paddingRight: mm(marginMm) }}
      role="presentation"
      aria-hidden="true"
      data-testid="ruler"
    >
       {/* Indent Markers (at the page margins) */}
       <div className="absolute top-0 h-full w-4 z-10 group" data-marker="left" style={{ left: `calc(${mm(marginMm)} - 6px)` }}>
         <div className={`w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] absolute top-0 ${darkMode ? 'border-t-gray-400' : 'border-t-gray-600'}`}></div>
         <div className={`w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[6px] absolute bottom-0 ${darkMode ? 'border-b-gray-400' : 'border-b-gray-600'}`}></div>
       </div>

       <div className="absolute top-0 h-full w-4 z-10" data-marker="right" style={{ right: `calc(${mm(marginMm)} - 10px)` }}>
          <div className={`w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[6px] absolute bottom-0 ${darkMode ? 'border-b-gray-400' : 'border-b-gray-600'}`}></div>
      </div>

      <div className="flex w-full h-full pt-1 overflow-hidden">
        {marks}
      </div>
    </div>
  );
};
