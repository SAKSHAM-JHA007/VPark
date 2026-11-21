'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { VParkLogo } from '@/components/VParkLogo';
import { Presence } from '@/components/motion/Presence';
import { DropdownSurface } from '@/components/motion/AnimatedModal';
import { useI18n } from '@/components/i18n/LanguageProvider';
import { LocationMenu } from './LocationMenu';
import { LanguageMenu, MobilePreferences } from './PreferenceMenus';
import { ThemeToggle } from './ThemeToggle';

export interface SiteNavItem {
  key: string;
  label: string;
  href?: string;
  onClick?: () => void;
  active?: boolean;
  icon?: React.ReactNode;
}

export interface NavBreakpoints {
  /** Visible only where the full desktop navigation is shown. */
  desktopOnly: string;
  /** Visible only where the compact (menu button) navigation is shown. */
  compactOnly: string;
  /** Wide screens with room for every label. */
  wideOnly: string;
}

interface SiteHeaderProps {
  navItems: SiteNavItem[];
  /** Logo action; defaults to a link to the homepage. */
  onLogoClick?: () => void;
  locationMode: 'navigate' | 'inline';
  onLocationSelected?: () => void;
  /** Right-hand account area (log in / sign up, or the account menu). */
  actions?: (bp: NavBreakpoints) => React.ReactNode;
  /** Extra content at the bottom of the compact menu (auth buttons). */
  mobileFooter?: React.ReactNode;
}

/**
 * Shared navigation bar for every page. The full desktop navigation appears from `xl`
 * (1280px); below that the links move into the menu panel. Location, language and
 * the one-click theme switch stay in the bar at every width.
 */
export function SiteHeader({ navItems, onLogoClick, locationMode, onLocationSelected, actions, mobileFooter }: SiteHeaderProps) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const isEnglish = lang === 'en';
  // Six nav items plus location, language, theme and account controls need ~1250px in
  // English and more in Kannada/Hindi, so the full bar starts at `xl` (1280px).
  const bp: NavBreakpoints = {
    desktopOnly: 'hidden xl:flex',
    compactOnly: 'xl:hidden',
    wideOnly: isEnglish ? 'hidden xl:inline' : 'hidden 2xl:inline',
  };

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
    panelRef.current?.querySelector<HTMLElement>('a,button')?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  // Close the compact menu if the window grows into the desktop layout.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1280px)');
    const onChange = () => mq.matches && setOpen(false);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  const logo = <VParkLogo className="h-7 w-auto sm:h-8" />;

  const renderItem = (item: SiteNavItem, compact: boolean) => {
    const className = compact
      ? `flex w-full min-h-[2.75rem] items-center gap-2 rounded-control px-3 text-left text-[15px] font-semibold transition-colors ${
          item.active
            ? 'bg-[var(--nav-active-bg)] text-[var(--nav-active-ink)]'
            : 'text-[var(--nav-ink-muted)] hover:bg-[var(--nav-hover-bg)] hover:text-[var(--nav-ink)]'
        }`
      : 'vp-nav-link';
    const content = (
      <>
        {item.icon}
        {item.label}
      </>
    );
    const onClick = () => {
      if (compact) setOpen(false);
      item.onClick?.();
    };
    return item.href ? (
      <Link key={item.key} href={item.href} onClick={onClick} aria-current={item.active ? 'page' : undefined} className={className}>
        {content}
      </Link>
    ) : (
      <button key={item.key} type="button" onClick={onClick} aria-current={item.active ? 'page' : undefined} className={className}>
        {content}
      </button>
    );
  };

  return (
    <header className="vp-nav sticky top-0 z-40">
      <div className="relative mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:gap-3 sm:px-6 lg:px-8">
        {onLogoClick ? (
          <button type="button" onClick={onLogoClick} aria-label={t('nav.homeLabel')} className="flex flex-shrink-0 items-center rounded-md">
            {logo}
          </button>
        ) : (
          <Link href="/" aria-label={t('nav.homeLabel')} className="flex flex-shrink-0 items-center rounded-md">
            {logo}
          </Link>
        )}

        <nav aria-label={t('nav.mainLabel')} className={`${bp.desktopOnly} ml-4 items-center gap-0.5 xl:ml-6`}>
          {navItems.map((item) => renderItem(item, false))}
        </nav>

        <div className="ml-auto flex min-w-0 items-center gap-1.5 sm:gap-2">
          <LocationMenu
            mode={locationMode}
            onSelected={onLocationSelected}
            labelClassName={isEnglish ? 'hidden sm:inline' : 'hidden md:inline'}
          />
          <LanguageMenu labelClassName="hidden sm:inline" />
          <ThemeToggle />
          {actions?.(bp)}
          <button
            ref={buttonRef}
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="vp-compact-nav"
            aria-label={open ? t('nav.closeMenu') : t('nav.openMenu')}
            className={`vp-nav-control ${bp.compactOnly}`}
          >
            {open ? <X className="h-4 w-4" aria-hidden="true" /> : <Menu className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>

        <Presence>
          {open && (
            <DropdownSurface className="absolute left-3 right-3 top-[calc(100%+6px)] z-50 sm:left-auto sm:w-[22rem]">
              <div ref={panelRef} id="vp-compact-nav" className="vp-popover max-h-[calc(100dvh-5rem)] overflow-y-auto p-2">
                <nav aria-label={t('nav.mobileLabel')} className="flex flex-col gap-0.5">
                  {navItems.map((item) => renderItem(item, true))}
                </nav>
                <div className="mt-2 border-t border-[var(--nav-border)] px-1 pb-1 pt-3">
                  <MobilePreferences />
                </div>
                {mobileFooter && <div className="mt-2 border-t border-[var(--nav-border)] px-1 pt-3">{mobileFooter}</div>}
              </div>
            </DropdownSurface>
          )}
        </Presence>
      </div>
    </header>
  );
}
