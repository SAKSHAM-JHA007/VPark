import React from 'react';

interface VParkLogoProps {
  className?: string;
  size?: number;
}

/**
 * VPark Brand Logo Mark
 * Represents a vehicle parked in a verified parking stall [   ].
 * Intentionally non-reactive (no hover scaling, pulsing, or layout shifts).
 */
export function VParkLogo({ className = 'w-8 h-8', size }: VParkLogoProps) {
  const style = size ? { width: size, height: size } : undefined;

  return (
    <div
      style={style}
      className={`inline-flex items-center justify-center flex-shrink-0 select-none ${className}`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 32 32"
        width="100%"
        height="100%"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="block"
      >
        {/* Brand Background Badge */}
        <rect width="32" height="32" rx="8" fill="#0A5CFF" />

        {/* Parking Lot Stall Demarcation Lines [   ] */}
        <path
          d="M7.5 7.5H5V24.5H7.5"
          stroke="white"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeOpacity="0.85"
        />
        <path
          d="M24.5 7.5H27V24.5H24.5"
          stroke="white"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeOpacity="0.85"
        />

        {/* Parked Vehicle Silhouette in Stall */}
        <path
          d="M9.5 20.5V17C9.5 16.5 9.8 16.1 10.3 16.1L12.4 11.8C12.7 11.3 13.2 11 13.8 11H18.2C18.8 11 19.3 11.3 19.6 11.8L21.7 16.1C22.2 16.1 22.5 16.5 22.5 17V20.5C22.5 21 22.1 21.5 21.5 21.5H21V22.2C21 22.6 20.6 23 20.2 23H19.3C18.9 23 18.5 22.6 18.5 22.2V21.5H13.5V22.2C13.5 22.6 13.1 23 12.7 23H11.8C11.4 23 11 22.6 11 22.2V21.5H10.5C9.9 21.5 9.5 21 9.5 20.5Z"
          fill="white"
        />

        {/* Windshield */}
        <path
          d="M12.8 15.6H19.2L18.1 12.6H13.9L12.8 15.6Z"
          fill="#0A5CFF"
        />

        {/* Headlights */}
        <circle cx="11.5" cy="18.2" r="0.9" fill="#0A5CFF" />
        <circle cx="20.5" cy="18.2" r="0.9" fill="#0A5CFF" />

        {/* Center Grille / V emblem */}
        <path
          d="M15 18.2L16 19.4L17 18.2"
          stroke="#0A5CFF"
          strokeWidth="0.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

