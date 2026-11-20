'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { MoonStar, Sun } from 'lucide-react';
import { useI18n } from '@/components/i18n/LanguageProvider';
import { useTheme } from '@/components/theme/useTheme';
import { chooseTransitionMode, nextTheme, revealGeometry } from '@/lib/theme';

const REVEAL_CLASS = 'vp-theme-revealing';
const FADE_CLASS = 'vp-theme-fading';
const FADE_MS = 260;

type ViewTransitionLike = { ready: Promise<void>; finished: Promise<void> };
type DocumentWithVT = Document & { startViewTransition?: (update: () => void) => ViewTransitionLike };

/**
 * One-click Light ↔ OLED switch.
 *
 * With the View Transition API the new theme spreads from the press point as a soft-edged
 * circle (CSS in globals.css: `.vp-theme-revealing::view-transition-new(root)`). The theme
 * itself is applied synchronously inside the transition callback, so state, DOM classes and
 * contrast change together, never after the animation. Without the API the colours
 * cross-fade briefly; with `prefers-reduced-motion` the switch is instant. Clicks during a
 * running reveal are ignored, so rapid toggles cannot desynchronise state.
 */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const { t } = useI18n();
  const { theme, setTheme, mounted } = useTheme();
  const busyRef = useRef(false);
  const fadeTimer = useRef<number | undefined>(undefined);
  const [swapCount, setSwapCount] = useState(0);

  const cleanup = useCallback(() => {
    const root = document.documentElement;
    root.classList.remove(REVEAL_CLASS);
    root.style.removeProperty('--vp-reveal-x');
    root.style.removeProperty('--vp-reveal-y');
    root.style.removeProperty('--vp-reveal-max');
    busyRef.current = false;
  }, []);

  useEffect(
    () => () => {
      window.clearTimeout(fadeTimer.current);
      document.documentElement.classList.remove(FADE_CLASS);
      cleanup();
    },
    [cleanup]
  );

  const onClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (busyRef.current) return;
    const target = nextTheme(theme);
    const root = document.documentElement;
    const doc = document as DocumentWithVT;
    const apply = () =>
      flushSync(() => {
        setTheme(target);
        setSwapCount((n) => n + 1);
      });

    const mode = chooseTransitionMode({
      hasViewTransitions: typeof doc.startViewTransition === 'function',
      reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
    });

    if (mode === 'instant') {
      apply();
      return;
    }

    if (mode === 'fade') {
      window.clearTimeout(fadeTimer.current);
      root.classList.add(FADE_CLASS);
      apply();
      fadeTimer.current = window.setTimeout(() => root.classList.remove(FADE_CLASS), FADE_MS + 40);
      return;
    }

    // Keyboard activation reports detail 0 and no pointer position: use the button centre.
    const geometry = revealGeometry(
      event.currentTarget.getBoundingClientRect(),
      { width: window.innerWidth, height: window.innerHeight },
      event.detail > 0 ? { x: event.clientX, y: event.clientY } : null
    );
    busyRef.current = true;
    root.style.setProperty('--vp-reveal-x', `${geometry.x}px`);
    root.style.setProperty('--vp-reveal-y', `${geometry.y}px`);
    root.style.setProperty('--vp-reveal-max', `${geometry.radius}px`);
    root.classList.add(REVEAL_CLASS);

    try {
      const transition = doc.startViewTransition!(apply);
      transition.ready.catch(() => {});
      transition.finished.then(cleanup, cleanup);
    } catch {
      // The transition could not start (e.g. another one is running): still switch.
      if (root.getAttribute('data-theme') !== target) apply();
      cleanup();
    }
  };

  const toOled = theme !== 'oled';
  const label = toOled ? t('theme.switchToOled') : t('theme.switchToLight');
  const Icon = theme === 'oled' ? MoonStar : Sun;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={mounted ? label : t('theme.label')}
      title={mounted ? label : undefined}
      className={`vp-nav-control overflow-hidden ${className}`}
    >
      {mounted ? (
        <Icon
          key={`${theme}-${swapCount}`}
          className={`h-4 w-4 ${theme === 'light' ? 'text-amber-500' : 'text-[var(--accent-soft-ink)]'} ${swapCount > 0 ? 'animate-spin-in' : ''}`}
          aria-hidden="true"
        />
      ) : (
        <Sun className="h-4 w-4 opacity-0" aria-hidden="true" />
      )}
    </button>
  );
}
