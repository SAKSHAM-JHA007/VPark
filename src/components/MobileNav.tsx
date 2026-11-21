'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { Presence } from '@/components/motion/Presence';
import { DropdownSurface } from '@/components/motion/AnimatedModal';

export interface MobileNavItem {
  key: string;
  label: React.ReactNode;
  href?: string;
  onClick?: () => void;
  active?: boolean;
}

interface MobileNavProps {
  items: MobileNavItem[];
  /** Optional extra content (e.g. auth actions) rendered under the links. */
  footer?: React.ReactNode;
}

/**
 * Small-screen navigation for the shared header ribbon (below the `md` breakpoint).
 * Re-uses the existing dropdown enter/exit animation. Closes on Escape, on outside
 * click and after any item is chosen; focus returns to the toggle button.
 */
export function MobileNav({ items, footer }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    // Move focus into the menu so keyboard users land on the first link.
    const first = panelRef.current?.querySelector<HTMLElement>('a,button');
    first?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  const close = () => setOpen(false);
  const itemClass = (active?: boolean) =>
    `flex w-full items-center rounded-control px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
      active
        ? 'bg-[var(--nav-active-bg)] text-[var(--nav-active-ink)]'
        : 'text-[var(--nav-ink-muted)] hover:bg-[var(--nav-hover-bg)] hover:text-[var(--nav-ink)]'
    }`;

  return (
    <div className="md:hidden">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="vp-mobile-nav"
        aria-label={open ? 'Close menu' : 'Open menu'}
        className="vp-nav-control flex h-8 w-8 items-center justify-center rounded-full"
      >
        {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </button>

      <Presence>
        {open && (
          <DropdownSurface
            id="vp-mobile-nav"
            className="absolute left-3 right-3 top-[calc(100%+6px)] z-50 rounded-card border border-[var(--nav-border)] bg-[var(--nav-bg)] shadow-raised"
          >
            <div ref={panelRef} className="p-2">
            <nav aria-label="Mobile navigation" className="flex flex-col gap-0.5">
              {items.map((item) =>
                item.href ? (
                  <Link
                    key={item.key}
                    href={item.href}
                    onClick={close}
                    aria-current={item.active ? 'page' : undefined}
                    className={itemClass(item.active)}
                  >
                    {item.label}
                  </Link>
                ) : (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      close();
                      item.onClick?.();
                    }}
                    aria-current={item.active ? 'page' : undefined}
                    className={itemClass(item.active)}
                  >
                    {item.label}
                  </button>
                )
              )}
            </nav>
            {footer && <div className="mt-2 border-t border-[var(--nav-border)] pt-2">{footer}</div>}
            </div>
          </DropdownSurface>
        )}
      </Presence>
    </div>
  );
}
