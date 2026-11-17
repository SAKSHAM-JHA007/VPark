import React from 'react';

interface VParkLogoProps {
  className?: string;
  size?: number;
  variant?: 'horizontal' | 'mark';
  alt?: string;
}

/**
 * VPark Official Brand Logo
 * Aerodynamic sports car with electric blue 'V' apex and integrated VPARK typography.
 * Completely transparent background that blends seamlessly into light and dark surfaces.
 */
export function VParkLogo({
  className = 'h-8 w-auto',
  variant = 'horizontal',
  size,
  alt = 'VPark Smart Parking Platform',
}: VParkLogoProps) {
  const heightStyle = size ? { height: size } : undefined;

  return (
    <div
      style={heightStyle}
      className={`relative inline-flex items-center justify-start flex-shrink-0 select-none bg-transparent ${className}`}
    >
      {/* Dark mode: luminous electric blue & white typography on transparent background */}
      <img
        src="/logo-horizontal-dark.png"
        alt={alt}
        width={140}
        height={32}
        className="h-full w-auto max-h-full object-contain dark:block hidden select-none"
        loading="eager"
        decoding="async"
        fetchPriority="high"
      />
      {/* Light mode: electric blue & dark ink typography on transparent background */}
      <img
        src="/logo-horizontal-light.png"
        alt={alt}
        width={140}
        height={32}
        className="h-full w-auto max-h-full object-contain dark:hidden block select-none"
        loading="eager"
        decoding="async"
        fetchPriority="high"
      />
    </div>
  );
}
