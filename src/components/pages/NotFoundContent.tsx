'use client';

import React from 'react';
import Link from 'next/link';
import { Compass, Home, Search, HelpCircle } from 'lucide-react';
import { PublicHeader } from '@/components/nav/PublicHeader';
import { SiteFooter } from '@/components/nav/SiteFooter';
import { useI18n } from '@/components/i18n/LanguageProvider';

export function NotFoundContent() {
  const { t } = useI18n();
  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink">
      <PublicHeader />
      <main id="main-content" className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center space-y-8 px-4 py-16 text-center sm:py-24">
        <div className="relative">
          <span className="vp-icon-tile h-24 w-24 rounded-3xl animate-scale-in" aria-hidden="true">
            <Compass className="h-12 w-12 animate-spin-slow" />
          </span>
          <span className="absolute -right-2 -top-2 rounded-full bg-rose-600 px-2.5 py-0.5 font-mono text-[11px] font-bold text-white shadow-card animate-pop [animation-delay:350ms]">
            404
          </span>
        </div>

        <div className="max-w-md space-y-3 animate-fade-up [animation-delay:120ms]">
          <h1 className="vp-h1">{t('notFound.title')}</h1>
          <p className="vp-lead">{t('notFound.body')}</p>
        </div>

        <div className="grid w-full max-w-md grid-cols-1 gap-3 sm:grid-cols-2">
          <Link href="/" className="vp-btn vp-btn-primary">
            <Home className="h-4 w-4" aria-hidden="true" />
            {t('notFound.home')}
          </Link>
          <Link href="/driver/home" className="vp-btn vp-btn-secondary">
            <Search className="h-4 w-4 text-[var(--transit-accent)]" aria-hidden="true" />
            {t('notFound.find')}
          </Link>
        </div>

        <nav className="flex w-full max-w-md flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-hairline pt-6 text-sm text-ink-2" aria-label={t('footer.explore')}>
          <Link href="/owner/dashboard" className="transition-colors hover:text-ink">
            {t('notFound.rent')}
          </Link>
          <Link href="/contact" className="inline-flex items-center gap-1 transition-colors hover:text-ink">
            <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
            {t('notFound.contact')}
          </Link>
          <Link href="/privacy" className="transition-colors hover:text-ink">
            {t('notFound.privacy')}
          </Link>
        </nav>
      </main>
      <SiteFooter />
    </div>
  );
}
