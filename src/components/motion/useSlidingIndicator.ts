'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

interface IndicatorRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Measures the active item inside a `position: relative` container so a single
 * absolutely-positioned "pill" can glide between items with a CSS transform.
 *
 * Progressive enhancement: until measurement succeeds (server render, no JS,
 * hidden container), `ready` is false and callers keep their original active
 * styles, so the active state is always visible.
 *
 * This replaces Motion's `layoutId`, which would require the larger `domMax`
 * feature bundle.
 */
export function useSlidingIndicator(activeKey: string | null) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const items = useRef(new Map<string, HTMLElement>());
  const refCallbacks = useRef(new Map<string, (el: HTMLElement | null) => void>());
  const [rect, setRect] = useState<IndicatorRect | null>(null);
  const [animate, setAnimate] = useState(false);

  const measure = useCallback(() => {
    const el = activeKey ? items.current.get(activeKey) : undefined;
    // offsetParent is null when the element (or an ancestor) is display:none.
    if (!el || !el.offsetParent) {
      setRect(null);
      return;
    }
    const next = { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight };
    setRect((prev) =>
      prev && prev.x === next.x && prev.y === next.y && prev.w === next.w && prev.h === next.h ? prev : next
    );
  }, [activeKey]);

  useIsoLayoutEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(container);
    items.current.forEach((el) => ro.observe(el));
    return () => ro.disconnect();
  }, [measure]);

  // Enable the transition only after the first placement, so the pill doesn't
  // slide in from the container's corner on load.
  const ready = rect !== null;
  useEffect(() => {
    if (!ready || animate) return;
    const id = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(id);
  }, [ready, animate]);

  const register = useCallback((key: string) => {
    let cb = refCallbacks.current.get(key);
    if (!cb) {
      cb = (el: HTMLElement | null) => {
        if (el) items.current.set(key, el);
        else items.current.delete(key);
      };
      refCallbacks.current.set(key, cb);
    }
    return cb;
  }, []);

  const indicatorStyle: CSSProperties | undefined = rect
    ? { transform: `translate(${rect.x}px, ${rect.y}px)`, width: rect.w, height: rect.h }
    : undefined;

  const indicatorClassName = `pointer-events-none absolute left-0 top-0 ${
    animate ? 'transition-[transform,width,height] duration-300 ease-out-quart' : ''
  }`;

  return { containerRef, register, ready, indicatorStyle, indicatorClassName };
}
