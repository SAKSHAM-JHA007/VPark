'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldCheck, ChevronRight, AlertTriangle, Languages } from 'lucide-react';
import { PublicHeader } from '@/components/nav/PublicHeader';
import { SiteFooter } from '@/components/nav/SiteFooter';
import { useI18n } from '@/components/i18n/LanguageProvider';
import type { TranslationKey } from '@/lib/i18n';
import { APP_CONFIG } from '@/lib/constants';

type Item = { title?: TranslationKey; body: TranslationKey };

function Section({ n, title, intro, items, children }: { n: number; title: TranslationKey; intro: TranslationKey; items?: Item[]; children?: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <section className="space-y-3" aria-labelledby={`privacy-s${n}`}>
      <h2 id={`privacy-s${n}`} className="flex items-center gap-2.5 text-xl font-bold text-ink">
        <span className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-sm font-bold text-[var(--accent-soft-ink)]" aria-hidden="true">
          {n}
        </span>
        {t(title)}
      </h2>
      <p>{t(intro)}</p>
      {items && (
        <ul className="list-disc space-y-2 pl-5 marker:text-ink-3">
          {items.map((item) => (
            <li key={item.body}>
              {item.title && <strong className="font-semibold text-ink">{t(item.title)}</strong>} {t(item.body)}
            </li>
          ))}
        </ul>
      )}
      {children}
    </section>
  );
}

export function PrivacyContent() {
  const { t, lang, date } = useI18n();
  const lastUpdated = date('2026-11-17T00:00:00+05:30', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink">
      <PublicHeader />

      <main id="main-content" className="mx-auto w-full max-w-4xl flex-1 space-y-10 px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <nav aria-label={t('privacy.breadcrumb')} className="text-sm text-ink-3">
          <ol className="flex items-center gap-1.5">
            <li>
              <Link href="/" className="rounded-sm transition-colors hover:text-ink">
                {t('common.home')}
              </Link>
            </li>
            <li aria-hidden="true">
              <ChevronRight className="h-3.5 w-3.5" />
            </li>
            <li className="font-semibold text-ink" aria-current="page">
              {t('privacy.title')}
            </li>
          </ol>
        </nav>

        <header className="space-y-3 border-b border-hairline pb-6 animate-fade-up">
          <span className="vp-badge vp-badge-info">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            {t('privacy.badge')}
          </span>
          <h1 className="vp-h1">{t('privacy.title')}</h1>
          <p className="text-sm text-ink-3">
            {t('privacy.updated', { date: lastUpdated, version: APP_CONFIG.legalDocVersions.privacy })}
          </p>
          {lang !== 'en' && (
            <p className="flex items-start gap-2 text-sm text-ink-2">
              <Languages className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--transit-accent)]" aria-hidden="true" />
              {t('privacy.translationNote')}
            </p>
          )}
        </header>

        <div role="note" className="vp-alert vp-alert-warning animate-fade-up [animation-delay:90ms]">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" aria-hidden="true" />
          <p>
            <strong className="font-semibold">{t('privacy.noticeTitle')}</strong> {t('privacy.noticeBody')}
          </p>
        </div>

        <article className="space-y-10 text-[15px] leading-relaxed text-ink-2">
          <Section
            n={1}
            title="privacy.s1Title"
            intro="privacy.s1Intro"
            items={[
              { title: 'privacy.s1DriverTitle', body: 'privacy.s1DriverBody' },
              { title: 'privacy.s1ProviderTitle', body: 'privacy.s1ProviderBody' },
              { title: 'privacy.s1TxTitle', body: 'privacy.s1TxBody' },
              { title: 'privacy.s1TechTitle', body: 'privacy.s1TechBody' },
            ]}
          />
          <Section
            n={2}
            title="privacy.s2Title"
            intro="privacy.s2Intro"
            items={[
              { body: 'privacy.s2Item1' },
              { body: 'privacy.s2Item2' },
              { body: 'privacy.s2Item3' },
              { body: 'privacy.s2Item4' },
              { body: 'privacy.s2Item5' },
            ]}
          />
          <Section
            n={3}
            title="privacy.s3Title"
            intro="privacy.s3Intro"
            items={[
              { title: 'privacy.s3OtpTitle', body: 'privacy.s3OtpBody' },
              { title: 'privacy.s3DocsTitle', body: 'privacy.s3DocsBody' },
              { title: 'privacy.s3CookiesTitle', body: 'privacy.s3CookiesBody' },
              { title: 'privacy.s3MaskTitle', body: 'privacy.s3MaskBody' },
            ]}
          />
          <Section n={4} title="privacy.s4Title" intro="privacy.s4Intro">
            <ul className="list-disc space-y-2 pl-5 marker:text-ink-3">
              <li>
                <strong className="font-semibold text-ink">{t('privacy.s4InfoTitle')}</strong> {t('privacy.s4InfoBody')}{' '}
                <a href="/api/user/export" download className="vp-link font-mono font-medium">
                  /api/user/export
                </a>
                .
              </li>
              <li>
                <strong className="font-semibold text-ink">{t('privacy.s4CorrectionTitle')}</strong> {t('privacy.s4CorrectionBody')}
              </li>
              <li>
                <strong className="font-semibold text-ink">{t('privacy.s4GrievanceTitle')}</strong> {t('privacy.s4GrievanceBody')}
              </li>
            </ul>
          </Section>
          <Section
            n={5}
            title="privacy.s5Title"
            intro="privacy.s5Intro"
            items={[
              { title: 'privacy.s5PaymentTitle', body: 'privacy.s5PaymentBody' },
              { title: 'privacy.s5MapsTitle', body: 'privacy.s5MapsBody' },
              { title: 'privacy.s5AnalyticsTitle', body: 'privacy.s5AnalyticsBody' },
            ]}
          />
          <Section n={6} title="privacy.s6Title" intro="privacy.s6Intro">
            <div className="vp-panel space-y-1.5 p-4 text-sm">
              <p className="font-semibold text-ink">{t('privacy.s6Desk')}</p>
              <p>
                {t('privacy.s6Email')}:{' '}
                <a href={`mailto:${APP_CONFIG.contactEmail}`} className="vp-link font-mono font-medium">
                  {APP_CONFIG.contactEmail}
                </a>
              </p>
              <p>
                {t('privacy.s6Helpline')}: <span className="font-mono">{APP_CONFIG.contactPhone}</span> ({t('privacy.s6HelplineHours')})
              </p>
              <p>{t('privacy.s6Location')}: Yelahanka New Town, Bengaluru, Karnataka 560064, India</p>
            </div>
          </Section>
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}
