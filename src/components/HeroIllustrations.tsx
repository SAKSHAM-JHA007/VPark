import React from 'react';

/**
 * Find Parking Card Illustration
 * White car parked inside an electric-blue parking stall outline with a [P] parking sign.
 *
 * Theme behaviour (pure CSS via Tailwind `dark:` classes, no JS theme state):
 * - Light: daylight look, lamps off (clear lenses, no glow).
 * - Dark: warm amber headlights with a restrained glow and floor wash, red tail lamp.
 *
 * The outer `.vp-hero-car` group carries the CSS settle animation; the inner group keeps
 * its SVG transform attribute (a CSS transform would override it).
 */
export function FindParkingIllustration({ className = 'w-full h-full' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 380 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        {/* Floor ambient radial glow */}
        <radialGradient id="vpFloorGlow" cx="45%" cy="65%" r="55%">
          <stop offset="0%" stopColor="#0A5CFF" stopOpacity="0.4" />
          <stop offset="60%" stopColor="#061A40" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#040914" stopOpacity="0" />
        </radialGradient>

        {/* Stall neon line glow filter */}
        <filter id="vpNeonGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Small, soft lamp glow (used only by the dark-theme lamps) */}
        <filter id="vpLampGlow" x="-150%" y="-150%" width="400%" height="400%">
          <feGaussianBlur stdDeviation="2.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Car body: daylight and night variants */}
        <linearGradient id="vpCarBody" x1="0%" y1="0%" x2="100%" y2="80%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="55%" stopColor="#E2E8F0" />
          <stop offset="100%" stopColor="#94A3B8" />
        </linearGradient>
        <linearGradient id="vpCarBodyNight" x1="0%" y1="0%" x2="100%" y2="80%">
          <stop offset="0%" stopColor="#F1F5F9" />
          <stop offset="55%" stopColor="#CBD5E1" />
          <stop offset="100%" stopColor="#64748B" />
        </linearGradient>

        {/* Car windshield gradient */}
        <linearGradient id="vpCarGlass" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#1E293B" />
          <stop offset="100%" stopColor="#0F172A" />
        </linearGradient>

        {/* Warm headlight wash on the floor ahead of the car */}
        <linearGradient id="vpBeam" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFC85C" stopOpacity="0.26" />
          <stop offset="100%" stopColor="#FFC85C" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Atmospheric Floor Glow */}
      <ellipse cx="170" cy="155" rx="150" ry="70" fill="url(#vpFloorGlow)" />

      {/* Blue Illuminated Parking Stall Perimeter (Perspective) */}
      <polygon
        points="45,175 145,115 305,125 210,195"
        stroke="#0A5CFF"
        strokeWidth="3.5"
        strokeLinejoin="round"
        fill="none"
        filter="url(#vpNeonGlow)"
        opacity="0.9"
        className="vp-hero-glow"
      />
      <polygon
        points="45,175 145,115 305,125 210,195"
        stroke="#60A5FA"
        strokeWidth="1.2"
        strokeLinejoin="round"
        fill="none"
        opacity="0.95"
      />

      {/* Parking Sign [P] */}
      <g transform="translate(290, 48)">
        <line x1="18" y1="36" x2="18" y2="105" stroke="#94A3B8" strokeWidth="3" strokeLinecap="round" />
        <rect x="0" y="0" width="36" height="36" rx="8" fill="#0A5CFF" stroke="#3B82F6" strokeWidth="1.5" />
        <path
          d="M13 26V10H19.5C22 10 24 11.8 24 14.2C24 16.6 22 18.5 19.5 18.5H16.5V26H13ZM16.5 15.5H19.2C20.3 15.5 21 15 21 14.2C21 13.5 20.3 13 19.2 13H16.5V15.5Z"
          fill="white"
        />
      </g>

      <g className="vp-hero-car">
        {/* Night only: restrained warm wash from the headlights onto the bay floor */}
        <polygon points="114,137 123,142 66,186 36,168" fill="url(#vpBeam)" className="hidden dark:inline" />

        <g transform="translate(95, 90)">
          {/* Tyre contact shadows (small and soft, replacing the old dark oval) */}
          <ellipse cx="120" cy="73.5" rx="11" ry="2.4" fill="#020617" opacity="0.35" />
          <ellipse cx="48" cy="76.5" rx="11" ry="2.4" fill="#020617" opacity="0.35" />

          {/* Rear Wheel */}
          <ellipse cx="120" cy="62" rx="10" ry="12" fill="#0F172A" stroke="#334155" strokeWidth="2.5" />
          <ellipse cx="120" cy="62" rx="4.5" ry="5.5" fill="#64748B" />

          {/* Front Wheel */}
          <ellipse cx="48" cy="65" rx="10" ry="12" fill="#0F172A" stroke="#334155" strokeWidth="2.5" />
          <ellipse cx="48" cy="65" rx="4.5" ry="5.5" fill="#64748B" />

          {/* Main Chassis / Car Body */}
          <path
            d="M18 52
               C20 48, 28 42, 38 41
               L75 22
               C85 17, 105 16, 125 18
               L142 28
               C152 34, 156 42, 154 48
               L151 55
               C148 59, 138 60, 130 60
               C128 53, 115 52, 110 59
               L60 62
               C56 55, 42 55, 38 63
               L25 61
               C18 59, 16 55, 18 52 Z"
            className="[fill:url(#vpCarBody)] dark:[fill:url(#vpCarBodyNight)]"
            stroke="#CBD5E1"
            strokeWidth="0.8"
          />

          {/* Greenhouse / Cabin Windows */}
          <path
            d="M48 40
               L78 24
               C84 21, 102 21, 118 23
               L133 30
               C136 33, 137 38, 134 40
               L85 41
               Z"
            fill="url(#vpCarGlass)"
            stroke="#475569"
            strokeWidth="0.8"
          />

          {/* Window B-pillar divider */}
          <line x1="94" y1="23" x2="92" y2="41" stroke="#334155" strokeWidth="2" />

          {/* Headlight: clear lens by day, warm amber lamp at night */}
          <polygon points="20,49 32,45 28,52" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="0.6" className="dark:hidden" />
          <g className="hidden dark:inline">
            <polygon points="20,49 32,45 28,52" fill="#FFB938" opacity="0.9" filter="url(#vpLampGlow)" />
            <polygon points="20,49 32,45 28,52" fill="#FFE3A3" />
          </g>

          {/* Tail lamp: dark red lens by day, lit red with a subtle glow at night */}
          <polygon points="146,37 152.5,40.5 153.5,46 147.5,43" fill="#6E1B25" stroke="#4C0F17" strokeWidth="0.5" className="dark:hidden" />
          <g className="hidden dark:inline">
            <polygon points="146,37 152.5,40.5 153.5,46 147.5,43" fill="#EF4444" opacity="0.75" filter="url(#vpLampGlow)" />
            <polygon points="146,37 152.5,40.5 153.5,46 147.5,43" fill="#F87171" />
          </g>

          {/* Side Mirror */}
          <ellipse cx="73" cy="38" rx="4.5" ry="3" fill="#FFFFFF" stroke="#94A3B8" strokeWidth="0.6" />
        </g>
      </g>
    </svg>
  );
}

/**
 * Rent Your Space Card Illustration
 * Supplied roller-shutter garage artwork (transparent background), one file per theme.
 * Served as static <img> files: cached, no inline SVG id collisions, and the explicit
 * width/height reserve space so the card doesn't shift while it loads.
 */
export function RentSpaceIllustration({ className = 'w-full h-auto' }: { className?: string }) {
  return (
    <span className={`block ${className}`} aria-hidden="true">
      <img
        src="/illustrations/vpark-garage-light.svg"
        alt=""
        width={520}
        height={340}
        className="block h-auto w-full dark:hidden"
        decoding="async"
      />
      <img
        src="/illustrations/vpark-garage-dark.svg"
        alt=""
        width={520}
        height={340}
        className="hidden h-auto w-full dark:block"
        decoding="async"
      />
    </span>
  );
}
