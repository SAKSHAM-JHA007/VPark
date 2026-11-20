'use client';

import React from 'react';
import Link from 'next/link';
import { VParkLogo } from '@/components/VParkLogo';
import { useI18n } from '@/components/i18n/LanguageProvider';

interface SiteFooterProps {
  /** Opens the in-app DPDP export/delete dialog (signed-in app only). */
  onOpenDataRights?: () => void;
}

const linkClass = 'rounded-sm text-ink-2 transition-colors hover:text-ink';

/** Shared footer for every page. */
export function SiteFooter({ onOpenDataRights }: SiteFooterProps) {
  const { t } = useI18n();
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-hairline bg-surface">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr] lg:px-8">
        <div className="space-y-3">
          <VParkLogo variant="stacked" className="h-12 w-auto" />
          <p className="text-sm font-semibold text-ink">{t('brand.tagline')}</p>
          <p className="max-w-xs text-sm text-ink-2">{t('brand.pilotArea')}</p>
        </div>

        <nav aria-label={t('footer.explore')} className="space-y-3 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">{t('footer.explore')}</p>
          <ul className="space-y-2.5">
            <li>
              <Link href="/driver/home" className={linkClass}>
                {t('nav.findParking')}
              </Link>
            </li>
            <li>
              <Link href="/owner/dashboard" className={linkClass}>
                {t('nav.listSpace')}
              </Link>
            </li>
            <li>
              <Link href="/driver/home?tab=monthly" className={linkClass}>
                {t('nav.forBusinesses')}
              </Link>
            </li>
            <li>
              <Link href="/#how-it-works" className={linkClass}>
                {t('nav.howItWorks')}
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-label={t('footer.support')} className="space-y-3 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">{t('footer.support')}</p>
          <ul className="space-y-2.5">
            <li>
              <Link href="/contact" className={linkClass}>
                {t('footer.contact')}
              </Link>
            </li>
            <li>
              <Link href="/privacy" className={linkClass}>
                {t('footer.privacy')}
              </Link>
            </li>
            {onOpenDataRights && (
              <li>
                <button type="button" onClick={onOpenDataRights} className={linkClass}>
                  {t('footer.dataRights')}
                </button>
              </li>
            )}
            <li>
              <Link href="/login" className={linkClass}>
                {t('footer.signIn')}
              </Link>
            </li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-hairline">
        <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4 text-xs text-ink-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <span>{t('footer.copyright', { year })}</span>
          <span>{t('footer.pilotNote')}</span>
        </div>
      </div>
    </footer>
  );
}
