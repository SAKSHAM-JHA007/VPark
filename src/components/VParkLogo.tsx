import React from 'react';

type LogoVariant = 'lockup' | 'stacked' | 'mark' | 'horizontal';

interface VParkLogoProps {
  className?: string;
  /** Rendered height in px (overrides the height set via className). */
  size?: number;
  /**
   * - `lockup` (default): emblem + PARK wordmark side by side, for headers and footers.
   * - `stacked`: the full supplied logo (emblem above PARK), for larger spaces.
   * - `mark`: emblem only.
   * `horizontal` is kept as an alias of `lockup` for existing call sites.
   */
  variant?: LogoVariant;
  alt?: string;
}

/**
 * VPark brand logo, built only from the supplied brand artwork in /public/brand.
 * The emblem is theme-neutral; the wordmark switches between a dark ink variant
 * (light theme) and a white variant (dark theme) with CSS, so there is no
 * hydration flash and no JavaScript theme state.
 */
export function VParkLogo({
  className = 'h-8 w-auto',
  variant = 'lockup',
  size,
  alt = 'VPark',
}: VParkLogoProps) {
  const heightStyle = size ? { height: size } : undefined;
  const base = `relative inline-flex items-center flex-shrink-0 select-none ${className}`;

  if (variant === 'stacked') {
    return (
      <span style={heightStyle} className={base} role="img" aria-label={alt}>
        <img
          src="/brand/vpark-logo-light.png"
          alt=""
          width={322}
          height={256}
          className="h-full w-auto object-contain dark:hidden"
          decoding="async"
        />
        <img
          src="/brand/vpark-logo-dark.png"
          alt=""
          width={322}
          height={256}
          className="hidden h-full w-auto object-contain dark:block"
          decoding="async"
        />
      </span>
    );
  }

  if (variant === 'mark') {
    return (
      <span style={heightStyle} className={base} role="img" aria-label={alt}>
        <img
          src="/brand/vpark-mark.png"
          alt=""
          width={188}
          height={128}
          className="h-full w-auto object-contain"
          decoding="async"
        />
      </span>
    );
  }

  // Lockup: the emblem acts as the "V", followed by the PARK wordmark.
  return (
    <span style={heightStyle} className={`${base} gap-[0.3em]`} role="img" aria-label={alt}>
      <img
        src="/brand/vpark-mark.png"
        alt=""
        width={188}
        height={128}
        className="h-full w-auto object-contain"
        loading="eager"
        decoding="async"
      />
      <span className="flex h-full items-center pt-[4%]">
        <img
          src="/brand/vpark-wordmark-light.png"
          alt=""
          width={367}
          height={40}
          className="h-[34%] w-auto object-contain dark:hidden"
          loading="eager"
          decoding="async"
        />
        <img
          src="/brand/vpark-wordmark-dark.png"
          alt=""
          width={367}
          height={40}
          className="hidden h-[34%] w-auto object-contain dark:block"
          loading="eager"
          decoding="async"
        />
      </span>
    </span>
  );
}
