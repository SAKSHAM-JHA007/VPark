import React from 'react';

interface VParkLogoProps {
  className?: string;
  size?: number;
  alt?: string;
}

/**
 * VPark Brand Logo Mark
 * Official brand identity: Aerodynamic vehicle silhouette with electric blue 'V' apex.
 * Non-reactive, pixel-crisp across light and dark modes.
 */
export function VParkLogo({
  className = 'w-8 h-8',
  size,
  alt = 'VPark Logo',
}: VParkLogoProps) {
  const dimensionStyle = size ? { width: size, height: size } : undefined;

  return (
    <div
      style={dimensionStyle}
      className={`relative inline-flex items-center justify-center flex-shrink-0 select-none overflow-hidden rounded-md bg-black border border-[var(--hairline)] ${className}`}
      aria-hidden="true"
    >
      <img
        src="/logo.jpg"
        alt={alt}
        width={size || 36}
        height={size || 36}
        className="w-full h-full object-cover block"
        loading="eager"
        decoding="async"
      />
    </div>
  );
}
