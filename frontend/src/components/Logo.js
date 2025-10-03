import React from 'react';

const Logo = ({ width = 32, height = 32, className = "" }) => {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Background circle */}
      <circle cx="16" cy="16" r="16" fill="#05A0D1" />
      
      {/* Robot arm base */}
      <rect x="4" y="20" width="6" height="8" rx="1" fill="#0284c7" />
      
      {/* Robot arm segments */}
      <rect x="9" y="18" width="8" height="3" rx="1.5" fill="#0284c7" />
      <rect x="16" y="14" width="3" height="6" rx="1.5" fill="#0284c7" />
      
      {/* Robot gripper/claw */}
      <rect x="18" y="13" width="2" height="3" rx="1" fill="#0284c7" />
      <rect x="18" y="17" width="2" height="3" rx="1" fill="#0284c7" />
      
      {/* Package being held */}
      <rect x="20" y="14" width="6" height="6" rx="1" fill="#eab308" stroke="#ca8a04" strokeWidth="0.5" />
      
      {/* Package tape/lines */}
      <line x1="23" y1="14" x2="23" y2="20" stroke="#ca8a04" strokeWidth="0.5" />
      <line x1="20" y1="17" x2="26" y2="17" stroke="#ca8a04" strokeWidth="0.5" />
      
      {/* PMS text */}
      <text
        x="16"
        y="11"
        textAnchor="middle"
        fill="#eab308"
        fontSize="8"
        fontWeight="bold"
        fontFamily="system-ui, sans-serif"
      >
        PMS
      </text>
      
      {/* Robot arm joint indicators */}
      <circle cx="10" cy="19.5" r="1" fill="#0369a1" />
      <circle cx="17.5" cy="17" r="1" fill="#0369a1" />
    </svg>
  );
};

export default Logo;