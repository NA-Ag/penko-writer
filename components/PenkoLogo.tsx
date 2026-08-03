import React from 'react';

interface PenkoLogoProps {
  className?: string;
  size?: number;
}

export const PenkoLogo: React.FC<PenkoLogoProps> = ({ className = '', size = 24 }) => {
  // Royal blue color for Penko Writer theme: #2563eb
  const blueColor = '#2563eb';
  
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 32 32" 
      width={size} 
      height={size}
      className={className}
    >
      <style>
        {`.pixel { shape-rendering: crispEdges; }`}
      </style>

      {/* Transparent background */}
      <rect width="32" height="32" fill="none"/>

      {/* Blue outline pixels */}
      <rect className="pixel" x="10" y="4" width="2" height="2" fill={blueColor}/>
      <rect className="pixel" x="12" y="4" width="8" height="2" fill={blueColor}/>
      <rect className="pixel" x="20" y="4" width="2" height="2" fill={blueColor}/>

      {/* Head top row */}
      <rect className="pixel" x="8" y="6" width="2" height="2" fill={blueColor}/>
      <rect className="pixel" x="10" y="6" width="12" height="2" fill={blueColor}/>
      <rect className="pixel" x="22" y="6" width="2" height="2" fill={blueColor}/>

      {/* Head with white face */}
      <rect className="pixel" x="8" y="8" width="2" height="2" fill={blueColor}/>
      <rect className="pixel" x="10" y="8" width="2" height="2" fill="#ffffff"/>
      <rect className="pixel" x="12" y="8" width="8" height="2" fill={blueColor}/>
      <rect className="pixel" x="20" y="8" width="2" height="2" fill="#ffffff"/>
      <rect className="pixel" x="22" y="8" width="2" height="2" fill={blueColor}/>

      {/* Eyes row */}
      <rect className="pixel" x="6" y="10" width="2" height="2" fill={blueColor}/>
      <rect className="pixel" x="8" y="10" width="2" height="2" fill="#ffffff"/>
      <rect className="pixel" x="10" y="10" width="2" height="2" fill={blueColor}/>
      <rect className="pixel" x="12" y="10" width="2" height="2" fill="#ffffff"/>
      <rect className="pixel" x="14" y="10" width="4" height="2" fill={blueColor}/>
      <rect className="pixel" x="18" y="10" width="2" height="2" fill="#ffffff"/>
      <rect className="pixel" x="20" y="10" width="2" height="2" fill={blueColor}/>
      <rect className="pixel" x="22" y="10" width="2" height="2" fill="#ffffff"/>
      <rect className="pixel" x="24" y="10" width="2" height="2" fill={blueColor}/>

      {/* Beak row */}
      <rect className="pixel" x="6" y="12" width="2" height="2" fill={blueColor}/>
      <rect className="pixel" x="8" y="12" width="4" height="2" fill="#ffffff"/>
      <rect className="pixel" x="12" y="12" width="2" height="2" fill="#ffa500"/>
      <rect className="pixel" x="14" y="12" width="4" height="2" fill="#ffa500"/>
      <rect className="pixel" x="18" y="12" width="2" height="2" fill="#ffa500"/>
      <rect className="pixel" x="20" y="12" width="4" height="2" fill="#ffffff"/>
      <rect className="pixel" x="24" y="12" width="2" height="2" fill={blueColor}/>

      {/* Body start */}
      <rect className="pixel" x="6" y="14" width="2" height="2" fill={blueColor}/>
      <rect className="pixel" x="8" y="14" width="4" height="2" fill="#ffffff"/>
      <rect className="pixel" x="12" y="14" width="8" height="2" fill={blueColor}/>
      <rect className="pixel" x="20" y="14" width="4" height="2" fill="#ffffff"/>
      <rect className="pixel" x="24" y="14" width="2" height="2" fill={blueColor}/>

      {/* Wings row 1 */}
      <rect className="pixel" x="4" y="16" width="2" height="2" fill={blueColor}/>
      <rect className="pixel" x="6" y="16" width="2" height="2" fill="#ffffff"/>
      <rect className="pixel" x="8" y="16" width="4" height="2" fill={blueColor}/>
      <rect className="pixel" x="12" y="16" width="8" height="2" fill="#ffffff"/>
      <rect className="pixel" x="20" y="16" width="4" height="2" fill={blueColor}/>
      <rect className="pixel" x="24" y="16" width="2" height="2" fill="#ffffff"/>
      <rect className="pixel" x="26" y="16" width="2" height="2" fill={blueColor}/>

      {/* Wings row 2 */}
      <rect className="pixel" x="4" y="18" width="2" height="2" fill={blueColor}/>
      <rect className="pixel" x="6" y="18" width="2" height="2" fill="#ffffff"/>
      <rect className="pixel" x="8" y="18" width="4" height="2" fill={blueColor}/>
      <rect className="pixel" x="12" y="18" width="8" height="2" fill="#ffffff"/>
      <rect className="pixel" x="20" y="18" width="4" height="2" fill={blueColor}/>
      <rect className="pixel" x="24" y="18" width="2" height="2" fill="#ffffff"/>
      <rect className="pixel" x="26" y="18" width="2" height="2" fill={blueColor}/>

      {/* Body middle */}
      <rect className="pixel" x="6" y="20" width="2" height="2" fill={blueColor}/>
      <rect className="pixel" x="8" y="20" width="4" height="2" fill={blueColor}/>
      <rect className="pixel" x="12" y="20" width="8" height="2" fill="#ffffff"/>
      <rect className="pixel" x="20" y="20" width="4" height="2" fill={blueColor}/>
      <rect className="pixel" x="24" y="20" width="2" height="2" fill={blueColor}/>

      {/* Body lower */}
      <rect className="pixel" x="8" y="22" width="2" height="2" fill={blueColor}/>
      <rect className="pixel" x="10" y="22" width="12" height="2" fill="#ffffff"/>
      <rect className="pixel" x="22" y="22" width="2" height="2" fill={blueColor}/>

      {/* Feet row 1 */}
      <rect className="pixel" x="8" y="24" width="2" height="2" fill={blueColor}/>
      <rect className="pixel" x="10" y="24" width="4" height="2" fill="#ffffff"/>
      <rect className="pixel" x="14" y="24" width="4" height="2" fill={blueColor}/>
      <rect className="pixel" x="18" y="24" width="4" height="2" fill="#ffffff"/>
      <rect className="pixel" x="22" y="24" width="2" height="2" fill={blueColor}/>

      {/* Feet row 2 */}
      <rect className="pixel" x="8" y="26" width="2" height="2" fill="#ffa500"/>
      <rect className="pixel" x="10" y="26" width="2" height="2" fill="#ffa500"/>
      <rect className="pixel" x="12" y="26" width="2" height="2" fill={blueColor}/>
      <rect className="pixel" x="14" y="26" width="4" height="2" fill={blueColor}/>
      <rect className="pixel" x="18" y="26" width="2" height="2" fill={blueColor}/>
      <rect className="pixel" x="20" y="26" width="2" height="2" fill="#ffa500"/>
      <rect className="pixel" x="22" y="26" width="2" height="2" fill="#ffa500"/>

      {/* Bottom outline */}
      <rect className="pixel" x="10" y="28" width="4" height="2" fill={blueColor}/>
      <rect className="pixel" x="14" y="28" width="4" height="2" fill={blueColor}/>
      <rect className="pixel" x="18" y="28" width="4" height="2" fill={blueColor}/>
    </svg>
  );
};
