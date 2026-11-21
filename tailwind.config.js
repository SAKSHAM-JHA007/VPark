/** @type {import('tailwindcss').Config} */

// Shared motion curve: fast start, long soft settle ("ease-out-quart").
const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';

module.exports = {
  darkMode: 'class',
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        transit: {
          blue: '#0B45B8',
          'blue-hover': '#083491',
        },
        // Semantic theme tokens (values live in globals.css and switch with `.dark`).
        canvas: 'var(--canvas-bg)',
        surface: {
          DEFAULT: 'var(--surface-bg)',
          alt: 'var(--surface-alt)',
        },
        hairline: {
          DEFAULT: 'var(--hairline)',
          strong: 'var(--hairline-strong)',
        },
        ink: {
          DEFAULT: 'var(--ink)',
          2: 'var(--ink-secondary)',
          3: 'var(--ink-tertiary)',
        },
        accent: {
          DEFAULT: 'var(--transit-accent)',
          hover: 'var(--transit-accent-hover)',
        },
        brand: {
          DEFAULT: '#0A5CFF',
          hover: '#0047D4',
        },
      },
      borderRadius: {
        card: 'var(--radius-card)',
        control: 'var(--radius-control)',
        none: '0px',
        xs: '2px',
        sm: '3px',
        DEFAULT: '4px',
        md: '4px',
        lg: '6px',
        xl: '8px',
        '2xl': '8px',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        xs: '0 1px 2px rgba(0, 0, 0, 0.04)',
        sm: '0 1px 3px rgba(0, 0, 0, 0.06)',
        md: '0 4px 6px -1px rgba(0, 0, 0, 0.08)',
        card: 'var(--shadow-card)',
        raised: 'var(--shadow-raised)',
      },
      // Previously referenced in markup but undefined in Tailwind 3 (no-op classes).
      backdropBlur: {
        xs: '2px',
      },
      zIndex: {
        60: '60',
      },
      transitionTimingFunction: {
        'out-quart': EASE_OUT,
      },
      // Entrance animations use `backwards` fill so the element returns to its
      // natural styles once finished (hover transforms keep working, and the
      // final state is always the fully visible, un-animated element).
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'none' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'none' },
        },
        'slide-in': {
          from: { opacity: '0', transform: 'translateX(14px)' },
          to: { opacity: '1', transform: 'none' },
        },
        pop: {
          '0%': { transform: 'scale(0.6)', opacity: '0' },
          '60%': { transform: 'scale(1.12)', opacity: '1' },
          '100%': { transform: 'none', opacity: '1' },
        },
        'spin-in': {
          from: { opacity: '0', transform: 'rotate(-90deg) scale(0.6)' },
          to: { opacity: '1', transform: 'none' },
        },
        'spin-slow': {
          to: { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'fade-in': `fade-in 240ms ${EASE_OUT} backwards`,
        'fade-up': `fade-up 520ms ${EASE_OUT} backwards`,
        'scale-in': `scale-in 280ms ${EASE_OUT} backwards`,
        'slide-in': `slide-in 300ms ${EASE_OUT} backwards`,
        pop: `pop 360ms ${EASE_OUT} backwards`,
        'spin-in': `spin-in 320ms ${EASE_OUT} backwards`,
        // One slow settle-turn (not an endless loop).
        'spin-slow': `spin-slow 2.4s ${EASE_OUT} 300ms 1 backwards`,
      },
    },
  },
  plugins: [],
};
