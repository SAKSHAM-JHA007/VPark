'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Presence } from '@/components/motion/Presence';
import { DropdownSurface } from '@/components/motion/AnimatedModal';

const ITEM_SELECTOR = '[role="menuitem"]:not([disabled]),[role="menuitemradio"]:not([disabled])';

export interface NavMenuTriggerProps {
  ref: React.RefObject<HTMLButtonElement>;
  id: string;
  type: 'button';
  'aria-haspopup': 'menu';
  'aria-expanded': boolean;
  'aria-controls': string;
  onClick: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
}

interface NavMenuProps {
  /** Renders the trigger button; spread the props onto a <button>. */
  trigger: (props: NavMenuTriggerProps, open: boolean) => React.ReactNode;
  /** Panel content. Put menu items in an element with role="menu". */
  children: (api: { close: (returnFocus?: boolean) => void }) => React.ReactNode;
  align?: 'left' | 'right';
  panelClassName?: string;
  className?: string;
}

/**
 * Keyboard-operable popover menu for the navbar (WAI-ARIA menu button pattern):
 * Enter/Space/ArrowDown open it and focus the checked (or first) item, ArrowUp/Down,
 * Home and End move between items, Escape and Tab close it and Escape returns focus
 * to the trigger. Clicking outside closes it.
 */
export function NavMenu({ trigger, children, align = 'right', panelClassName = 'w-64', className = '' }: NavMenuProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const baseId = useId();
  const triggerId = `${baseId}-trigger`;
  const panelId = `${baseId}-panel`;

  const close = useCallback((returnFocus = true) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  const items = () => Array.from(panelRef.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? []);

  useEffect(() => {
    if (!open) return;
    // Focus the selected item (or the first) once the panel is in the DOM.
    const frame = requestAnimationFrame(() => {
      const list = items();
      const checked = list.find((el) => el.getAttribute('aria-checked') === 'true');
      (checked ?? list[0])?.focus();
    });
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  const onPanelKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const list = items();
    const index = list.indexOf(document.activeElement as HTMLElement);
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        close(true);
        break;
      case 'Tab':
        setOpen(false);
        break;
      case 'ArrowDown':
        e.preventDefault();
        list[(index + 1) % list.length]?.focus();
        break;
      case 'ArrowUp':
        e.preventDefault();
        list[(index - 1 + list.length) % list.length]?.focus();
        break;
      case 'Home':
        e.preventDefault();
        list[0]?.focus();
        break;
      case 'End':
        e.preventDefault();
        list[list.length - 1]?.focus();
        break;
      default:
        break;
    }
  };

  const triggerProps: NavMenuTriggerProps = {
    ref: triggerRef,
    id: triggerId,
    type: 'button',
    'aria-haspopup': 'menu',
    'aria-expanded': open,
    'aria-controls': panelId,
    onClick: () => setOpen((v) => !v),
    onKeyDown: (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setOpen(true);
      }
    },
  };

  return (
    <div className={`relative ${className}`}>
      {trigger(triggerProps, open)}
      <Presence>
        {open && (
          <DropdownSurface
            className={`absolute top-[calc(100%+8px)] z-50 ${align === 'right' ? 'right-0' : 'left-0'} max-w-[calc(100vw-1.5rem)]`}
          >
            <div
              ref={panelRef}
              id={panelId}
              onKeyDown={onPanelKeyDown}
              className={`vp-popover p-1.5 text-sm ${panelClassName}`}
            >
              {children({ close })}
            </div>
          </DropdownSurface>
        )}
      </Presence>
    </div>
  );
}

/** Small uppercase section label inside a menu panel. */
export function MenuLabel({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <div id={id} className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-ink-3">
      {children}
    </div>
  );
}
