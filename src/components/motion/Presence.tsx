'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

/**
 * Minimal exit-animation helper (replaces Motion's AnimatePresence).
 *
 * Wrap a conditionally rendered element:
 *   <Presence>{open && <SomeModal />}</Presence>
 *
 * When the child disappears, the last rendered element stays mounted for
 * `exitMs` with `isPresent = false`, so surfaces below can play a CSS exit
 * animation and become inert. Removal is driven by a timer rather than
 * `animationend`, so it always completes even if the animation never runs
 * (reduced motion, background tab, CSS failure).
 */
const PresenceContext = createContext<boolean>(true);

/** `false` while the surrounding <Presence> is playing its exit. */
export function useIsPresent(): boolean {
  return useContext(PresenceContext);
}

interface PresenceProps {
  children?: React.ReactNode;
  /** Must cover the longest exit animation inside (CSS exits are 150 ms). */
  exitMs?: number;
}

export function Presence({ children, exitMs = 170 }: PresenceProps) {
  const isOpen = children !== null && children !== undefined && children !== false;
  const [last, setLast] = useState<React.ReactNode>(isOpen ? children : null);
  const [exiting, setExiting] = useState(false);

  // Derived state updated during render (React-endorsed pattern for tracking previous props).
  if (isOpen && last !== children) setLast(children);
  if (isOpen && exiting) setExiting(false);
  if (!isOpen && last !== null && !exiting) setExiting(true);

  useEffect(() => {
    if (!exiting) return;
    const reduce =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(() => {
      setExiting(false);
      setLast(null);
    }, reduce ? 0 : exitMs);
    return () => window.clearTimeout(timer);
  }, [exiting, exitMs]);

  const content = isOpen ? children : exiting ? last : null;
  return <PresenceContext.Provider value={isOpen}>{content}</PresenceContext.Provider>;
}
