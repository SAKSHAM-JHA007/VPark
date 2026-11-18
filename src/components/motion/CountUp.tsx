'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

interface CountUpProps {
  /** The genuine value to display. The animation always ends exactly on it. */
  value: number;
  /** Formats both intermediate and final values (must match the original display). */
  format?: (n: number) => string;
  durationMs?: number;
}

/**
 * Counts from the previously shown number to `value`.
 * - Server render and no-JS render show the final value.
 * - Screen readers only ever get the final value (intermediate frames are aria-hidden).
 * - Reduced-motion users see the final value immediately.
 */
export function CountUp({ value, format = (n) => String(Math.round(n)), durationMs = 900 }: CountUpProps) {
  const [display, setDisplay] = useState<number>(value);
  const shownRef = useRef<number>(0);
  const formatRef = useRef(format);
  formatRef.current = format;

  useIsoLayoutEffect(() => {
    const from = shownRef.current;
    const reduce =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduce || from === value || !Number.isFinite(value)) {
      shownRef.current = value;
      setDisplay(value);
      return;
    }

    setDisplay(from);
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = t >= 1 ? value : from + (value - from) * eased;
      shownRef.current = next;
      setDisplay(next);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs]);

  return (
    <>
      <span aria-hidden="true">{formatRef.current(display)}</span>
      <span className="sr-only">{formatRef.current(value)}</span>
    </>
  );
}
