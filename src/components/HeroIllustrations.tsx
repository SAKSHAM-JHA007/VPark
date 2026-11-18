import React from 'react';

/**
 * Find Parking Card Illustration
 * Sleek white car parked inside an illuminated electric-blue parking stall outline with a [P] parking sign.
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
        <radialGradient id="floorGlow" cx="45%" cy="65%" r="55%">
          <stop offset="0%" stopColor="#0A5CFF" stopOpacity="0.4" />
          <stop offset="60%" stopColor="#061A40" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#040914" stopOpacity="0" />
        </radialGradient>

        {/* Stall neon line glow filter */}
        <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Car body gradient */}
        <linearGradient id="carBody" x1="0%" y1="0%" x2="100%" y2="80%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="55%" stopColor="#E2E8F0" />
          <stop offset="100%" stopColor="#94A3B8" />
        </linearGradient>

        {/* Car windshield gradient */}
        <linearGradient id="carGlass" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#1E293B" />
          <stop offset="100%" stopColor="#0F172A" />
        </linearGradient>
      </defs>

      {/* Atmospheric Floor Glow */}
      <ellipse cx="170" cy="155" rx="150" ry="70" fill="url(#floorGlow)" />

      {/* Blue Illuminated Parking Stall Perimeter (Perspective) */}
      <polygon
        points="45,175 145,115 305,125 210,195"
        stroke="#0A5CFF"
        strokeWidth="3.5"
        strokeLinejoin="round"
        fill="none"
        filter="url(#neonGlow)"
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

      {/* Ground Shadow under the car */}
      <ellipse cx="178" cy="160" rx="72" ry="22" fill="#020617" opacity="0.85" />

      {/* Parking Sign [P] */}
      <g transform="translate(290, 48)">
        {/* Metal Pole */}
        <line x1="18" y1="36" x2="18" y2="105" stroke="#94A3B8" strokeWidth="3" strokeLinecap="round" />
        {/* Blue Sign Badge */}
        <rect x="0" y="0" width="36" height="36" rx="8" fill="#0A5CFF" stroke="#3B82F6" strokeWidth="1.5" />
        {/* White Letter P */}
        <path
          d="M13 26V10H19.5C22 10 24 11.8 24 14.2C24 16.6 22 18.5 19.5 18.5H16.5V26H13ZM16.5 15.5H19.2C20.3 15.5 21 15 21 14.2C21 13.5 20.3 13 19.2 13H16.5V15.5Z"
          fill="white"
        />
      </g>

      {/* Sleek Modern White Car (3/4 Perspective) — outer group carries the CSS settle animation,
          inner group keeps its SVG transform attribute (a CSS transform would override it). */}
      <g className="vp-hero-car">
      <g transform="translate(95, 90)">
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
          fill="url(#carBody)"
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
          fill="url(#carGlass)"
          stroke="#475569"
          strokeWidth="0.8"
        />

        {/* Window B-pillar divider */}
        <line x1="94" y1="23" x2="92" y2="41" stroke="#334155" strokeWidth="2" />

        {/* Headlight (Electric Glow) */}
        <polygon
          points="20,49 32,45 28,52"
          fill="#FFFFFF"
          filter="url(#neonGlow)"
        />
        <polygon points="20,49 32,45 28,52" fill="#BAE6FD" />

        {/* Side Mirror */}
        <ellipse cx="73" cy="38" rx="4.5" ry="3" fill="#FFFFFF" stroke="#94A3B8" strokeWidth="0.6" />
      </g>
      </g>
    </svg>
  );
}

/**
 * Rent Your Space Card Illustration
 * Modern 3D parking bay garage with bold blue [P] logo banner and hazard safety warning pillars.
 */
export function RentSpaceIllustration({ className = 'w-full h-full' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 380 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        {/* Garage Roof Gradient */}
        <linearGradient id="garageRoof" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#0A5CFF" />
          <stop offset="100%" stopColor="#0043C6" />
        </linearGradient>

        {/* Garage Interior Depth Gradient */}
        <linearGradient id="garageInterior" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#1E293B" />
          <stop offset="70%" stopColor="#334155" />
          <stop offset="100%" stopColor="#475569" />
        </linearGradient>

        {/* Hazard pattern yellow/black stripes */}
        <pattern id="hazardStripes" width="16" height="16" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
          <rect width="8" height="16" fill="#FBBF24" />
          <rect x="8" width="8" height="16" fill="#18181B" />
        </pattern>
      </defs>

      {/* Ground Floor Shadow */}
      <ellipse cx="190" cy="205" rx="140" ry="24" fill="#E2E8F0" opacity="0.8" />

      {/* Main Garage Structure */}
      <g transform="translate(85, 35)">
        {/* Concrete Outer Shell */}
        <rect x="15" y="30" width="180" height="140" rx="4" fill="#F1F5F9" stroke="#CBD5E1" strokeWidth="1.5" />

        {/* Dark Interior Bay with Depth */}
        <rect x="32" y="55" width="146" height="115" rx="2" fill="url(#garageInterior)" />

        {/* Interior Floor Perspective Lines */}
        <line x1="32" y1="170" x2="65" y2="135" stroke="#64748B" strokeWidth="1.2" strokeOpacity="0.5" />
        <line x1="178" y1="170" x2="145" y2="135" stroke="#64748B" strokeWidth="1.2" strokeOpacity="0.5" />

        {/* Garage Ceiling LED Light Bar */}
        <rect x="62" y="62" width="86" height="5" rx="2" fill="#FFFFFF" opacity="0.95" />
        <rect x="62" y="62" width="86" height="5" rx="2" fill="#93C5FD" opacity="0.6" className="vp-hero-glow" />

        {/* Left Safety Pillar with Hazard Warning Stripes */}
        <rect x="22" y="115" width="18" height="55" fill="url(#hazardStripes)" stroke="#0F172A" strokeWidth="0.8" />
        <rect x="22" y="55" width="18" height="60" fill="#E2E8F0" stroke="#CBD5E1" strokeWidth="0.8" />

        {/* Right Safety Pillar with Hazard Warning Stripes */}
        <rect x="170" y="115" width="18" height="55" fill="url(#hazardStripes)" stroke="#0F172A" strokeWidth="0.8" />
        <rect x="170" y="55" width="18" height="60" fill="#E2E8F0" stroke="#CBD5E1" strokeWidth="0.8" />

        {/* Modern Overhead Canopy / Roof Facade */}
        <rect x="10" y="20" width="190" height="36" rx="4" fill="url(#garageRoof)" stroke="#0037A8" strokeWidth="1" />
        {/* Top 3D Edge */}
        <rect x="10" y="20" width="190" height="5" fill="#3B82F6" />

        {/* White Parking Emblem [P] on Blue Canopy */}
        <g transform="translate(93, 25)">
          <path
            d="M5 24V4H13C16.5 4 19 6.2 19 9.5C19 12.8 16.5 15 13 15H9V24H5ZM9 11.5H12.5C14 11.5 15 10.7 15 9.5C15 8.3 14 7.5 12.5 7.5H9V11.5Z"
            fill="white"
          />
        </g>
      </g>
    </svg>
  );
}
