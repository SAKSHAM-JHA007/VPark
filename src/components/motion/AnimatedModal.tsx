'use client';

import React, { useEffect, useRef } from 'react';
import { useIsPresent } from './Presence';

/**
 * Drop-in replacements for a modal's outer overlay <div> and inner panel <div>,
 * plus a dropdown surface. They pass every prop through (role, aria-*, onClick,
 * className, children…), so the existing open/close state, focus handling and
 * form handlers are untouched.
 *
 * Enter/exit animations are pure CSS (see `.vp-modal-*` / `.vp-dropdown` in
 * globals.css). Exit animations play when the call site is wrapped in
 * <Presence>; without it the surface animates in and unmounts instantly.
 */
type DivProps = React.HTMLAttributes<HTMLDivElement>;

/**
 * While exiting, the element is still in the DOM for its exit animation. Make it
 * inert so it can't receive clicks, focus or screen-reader navigation (e.g. a
 * second click on a submit button that has just re-enabled itself).
 */
function useExitInert() {
  const isPresent = useIsPresent();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (isPresent) el.removeAttribute('inert');
    else el.setAttribute('inert', '');
  }, [isPresent]);
  return { ref, state: isPresent ? 'open' : 'closed' } as const;
}

export function ModalBackdrop({ className = '', ...props }: DivProps) {
  const { ref, state } = useExitInert();
  return <div ref={ref} data-state={state} className={`vp-modal-backdrop ${className}`} {...props} />;
}

export function ModalPanel({ className = '', ...props }: DivProps) {
  return <div className={`vp-modal-panel ${className}`} {...props} />;
}

export function DropdownSurface({ className = '', ...props }: DivProps) {
  const { ref, state } = useExitInert();
  return <div ref={ref} data-state={state} className={`vp-dropdown ${className}`} {...props} />;
}
