'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useI18n } from '@/components/i18n/LanguageProvider';
import { SiteHeader, type SiteNavItem } from './SiteHeader';

interface PublicHeaderProps {
  /** Open the sign-in dialog in place; without it, links go to /login. */
  onAuth?: (intent: 'driver' | 'provider') => void;
  /** Signed-in visitors get a Dashboard link instead of log in / sign up. */
  signedIn?: boolean;
  active?: 'how' | 'contact';
  /** Same-page "How it works" anchor (homepage) instead of a link to it. */
  onHowItWorks?: () => void;
}

/** Navigation bar for the public pages (home, contact, privacy, sign-in, 404). */
export function PublicHeader({ onAuth, signedIn = false, active, onHowItWorks }: PublicHeaderProps) {
  const { t } = useI18n();

  const navItems: SiteNavItem[] = [
    { key: 'find', label: t('nav.findParking'), href: '/driver/home' },
    onAuth && !signedIn
      ? { key: 'list', label: t('nav.listSpace'), onClick: () => onAuth('provider') }
      : { key: 'list', label: t('nav.listSpace'), href: signedIn ? '/owner/dashboard' : '/login?intent=provider' },
    { key: 'business', label: t('nav.forBusinesses'), href: '/driver/home?tab=monthly' },
    onHowItWorks
      ? { key: 'how', label: t('nav.howItWorks'), onClick: onHowItWorks, active: active === 'how' }
      : { key: 'how', label: t('nav.howItWorks'), href: '/#how-it-works', active: active === 'how' },
    { key: 'help', label: t('nav.help'), href: '/contact', active: active === 'contact' },
  ];

  const authButton = (intent: 'driver', className: string, label: string) =>
    onAuth ? (
      <button type="button" onClick={() => onAuth(intent)} className={className}>
        {label}
      </button>
    ) : (
      <Link href="/login" className={className}>
        {label}
      </Link>
    );

  return (
    <SiteHeader
      navItems={navItems}
      locationMode="navigate"
      actions={(bp) =>
        signedIn ? (
          <Link href="/driver/home" className="vp-btn vp-btn-primary vp-btn-sm hidden whitespace-nowrap sm:inline-flex">
            {t('nav.dashboard')}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        ) : (
          <div className="hidden items-center gap-1 sm:flex">
            {authButton('driver', `vp-nav-ghost ${bp.wideOnly} rounded-full px-3 py-2 text-sm font-semibold whitespace-nowrap`, t('nav.logIn'))}
            {authButton('driver', 'vp-nav-cta inline-flex min-h-[2.25rem] items-center rounded-full px-4 text-sm font-semibold whitespace-nowrap', t('nav.signUp'))}
          </div>
        )
      }
      mobileFooter={
        signedIn ? (
          <Link href="/driver/home" className="vp-btn vp-btn-primary w-full">
            {t('nav.dashboard')}
          </Link>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {authButton('driver', 'vp-btn vp-btn-secondary w-full', t('nav.logIn'))}
            {authButton('driver', 'vp-btn vp-btn-inverse w-full', t('nav.signUp'))}
          </div>
        )
      }
    />
  );
}
