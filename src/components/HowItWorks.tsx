'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Car, Home, Info, Lock, ShieldCheck, Wallet, FlaskConical, FileDown } from 'lucide-react';
import { useI18n } from '@/components/i18n/LanguageProvider';
import type { TranslationKey } from '@/lib/i18n';

/**
 * Listing submission depends on the photo/document upload route (`/api/uploads`),
 * which does not exist yet, so providers cannot submit listings. Flip this to `true`
 * once uploads work again; every notice below disappears with it.
 */
export const LISTING_SUBMISSION_AVAILABLE = false;

export function ListingSubmissionNotice({ className = '' }: { className?: string }) {
  const { t } = useI18n();
  if (LISTING_SUBMISSION_AVAILABLE) return null;
  return (
    <div role="note" className={`vp-alert vp-alert-warning ${className}`}>
      <Info className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
      <p>
        <strong className="font-semibold">{t('how.submissionTitle')}</strong> {t('how.submissionBody')}{' '}
        <Link href="/contact" className="font-semibold underline underline-offset-2 hover:no-underline">
          {t('how.submissionContact')}
        </Link>
      </p>
    </div>
  );
}

type StepKeys = { title: TranslationKey; body: TranslationKey };

const DRIVER_STEPS: StepKeys[] = [
  { title: 'how.driverSteps.s1Title', body: 'how.driverSteps.s1Body' },
  { title: 'how.driverSteps.s2Title', body: 'how.driverSteps.s2Body' },
  { title: 'how.driverSteps.s3Title', body: 'how.driverSteps.s3Body' },
];

const OWNER_STEPS: StepKeys[] = [
  { title: 'how.ownerSteps.s1Title', body: 'how.ownerSteps.s1Body' },
  { title: 'how.ownerSteps.s2Title', body: 'how.ownerSteps.s2Body' },
  { title: 'how.ownerSteps.s3Title', body: 'how.ownerSteps.s3Body' },
];

/**
 * "pending" until the element first scrolls into view, then "done". Stays undefined when
 * the user prefers reduced motion, IntersectionObserver is missing, or the element is
 * already visible on mount, so content is never held back.
 */
function useRevealOnce<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [state, setState] = useState<'pending' | 'done' | undefined>(undefined);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.85 && rect.bottom > 0) return;
    setState('pending');
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setState('done');
          observer.disconnect();
        }
      },
      { threshold: 0.35 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, state };
}

/** Numbered steps joined by a vertical rule that draws in, step by step, on first view. */
function StepTimeline({ steps, tone }: { steps: StepKeys[]; tone: 'driver' | 'owner' }) {
  const { t } = useI18n();
  const { ref, state } = useRevealOnce<HTMLOListElement>();
  const dot =
    tone === 'driver'
      ? 'bg-[var(--accent-soft)] text-[var(--accent-soft-ink)] ring-[var(--info-border)]'
      : 'bg-[var(--host-bg)] text-[var(--host-ink)] ring-[var(--host-border)]';
  return (
    <ol ref={ref} data-reveal={state} className="relative space-y-6">
      {steps.map((step, index) => (
        <li key={step.title} className="relative flex gap-4">
          {index < steps.length - 1 && (
            <span
              aria-hidden="true"
              style={{ transitionDelay: `${120 + index * 260}ms` }}
              className="vp-step-line absolute bottom-[-20px] left-[15px] top-9 w-px bg-[var(--hairline-strong)]"
            />
          )}
          <span
            aria-hidden="true"
            style={{ transitionDelay: `${index * 260}ms` }}
            className={`vp-step-dot relative z-[1] flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold ring-1 ${dot}`}
          >
            {index + 1}
          </span>
          <div className="min-w-0 pt-1">
            <h4 className="text-[15px] font-semibold leading-snug text-ink">{t(step.title)}</h4>
            <p className="mt-1 max-w-[46ch] text-sm leading-relaxed text-ink-2">{t(step.body)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

interface HowItWorksProps {
  /** Driver call to action (e.g. scroll to search, or navigate to the search page). */
  onBrowse?: () => void;
  browseHref?: string;
  /** Provider call to action (sign in / open the host dashboard). */
  onSetUpHost: () => void;
  id?: string;
  sectionRef?: React.Ref<HTMLElement>;
  className?: string;
}

/**
 * "How VPark works": customer-facing driver and space-owner journeys, followed by the
 * pilot's current limits (test-mode payments, no payouts, paused listing submission)
 * and the trust/privacy commitments. Copy reflects what the product does today.
 */
export function HowItWorks({
  onBrowse,
  browseHref,
  onSetUpHost,
  id = 'how-it-works',
  sectionRef,
  className = '',
}: HowItWorksProps) {
  const { t } = useI18n();
  const arrow = (
    <ArrowRight className="h-4 w-4 transition-transform duration-200 ease-out-quart group-hover/cta:translate-x-0.5" aria-hidden="true" />
  );

  return (
    <section id={id} ref={sectionRef} className={`scroll-mt-24 ${className}`} aria-labelledby={`${id}-title`}>
      <div className="max-w-2xl space-y-2">
        <p className="vp-eyebrow">{t('how.eyebrow')}</p>
        <h2 id={`${id}-title`} className="vp-h2">
          {t('how.title')}
        </h2>
        <p className="vp-lead">{t('how.intro')}</p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Driver journey */}
        <article className="vp-card flex flex-col overflow-hidden">
          <div className="h-1 bg-[var(--transit-accent)]" aria-hidden="true" />
          <div className="flex flex-1 flex-col p-6 sm:p-8">
            <header className="flex items-start gap-4">
              <span className="vp-icon-tile h-12 w-12" aria-hidden="true">
                <Car className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--transit-accent)]">{t('how.driverLabel')}</p>
                <h3 className="mt-0.5 text-xl font-bold leading-snug tracking-tight text-ink">{t('how.driverTitle')}</h3>
              </div>
            </header>
            <div className="mt-7 flex-1">
              <StepTimeline steps={DRIVER_STEPS} tone="driver" />
            </div>
            <div className="mt-8 border-t border-hairline pt-6">
              {browseHref ? (
                <Link href={browseHref} className="group/cta vp-btn vp-btn-primary w-full sm:w-auto">
                  {t('how.driverCta')} {arrow}
                </Link>
              ) : (
                <button type="button" onClick={onBrowse} className="group/cta vp-btn vp-btn-primary w-full sm:w-auto">
                  {t('how.driverCta')} {arrow}
                </button>
              )}
            </div>
          </div>
        </article>

        {/* Space-owner journey */}
        <article className="vp-card flex flex-col overflow-hidden">
          <div className="h-1 bg-[var(--host-ink)] opacity-80" aria-hidden="true" />
          <div className="flex flex-1 flex-col p-6 sm:p-8">
            <header className="flex items-start gap-4">
              <span
                className="inline-flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-control bg-[var(--host-bg)] text-[var(--host-ink)] ring-1 ring-[var(--host-border)]"
                aria-hidden="true"
              >
                <Home className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--host-ink)]">{t('how.ownerLabel')}</p>
                <h3 className="mt-0.5 text-xl font-bold leading-snug tracking-tight text-ink">{t('how.ownerTitle')}</h3>
              </div>
            </header>
            <div className="mt-7 flex-1">
              <StepTimeline steps={OWNER_STEPS} tone="owner" />
            </div>
            <div className="mt-8 border-t border-hairline pt-6">
              <button type="button" onClick={onSetUpHost} className="group/cta vp-btn vp-btn-secondary w-full sm:w-auto">
                {t('how.ownerCta')} {arrow}
              </button>
            </div>
          </div>
        </article>
      </div>

      {/* Pilot status: every current limitation in one place */}
      <div className="mt-5 vp-card p-5 sm:p-6" role="note" aria-labelledby={`${id}-pilot`}>
        <h3 id={`${id}-pilot`} className="flex items-center gap-2 text-sm font-semibold text-ink">
          <span className="vp-badge vp-badge-warning">{t('common.testMode')}</span>
          {t('how.pilotTitle')}
        </h3>
        <ul className="mt-4 grid gap-4 text-sm leading-relaxed text-ink-2 md:grid-cols-3">
          <li className="flex gap-3">
            <FlaskConical className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--info-ink)]" aria-hidden="true" />
            <span>{t('how.pilotTestMode')}</span>
          </li>
          <li className="flex gap-3">
            <Wallet className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--info-ink)]" aria-hidden="true" />
            <span>{t('how.pilotPayouts')}</span>
          </li>
          {!LISTING_SUBMISSION_AVAILABLE && (
            <li className="flex gap-3">
              <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--warning-ink)]" aria-hidden="true" />
              <span>
                {t('how.pilotListings')}{' '}
                <Link href="/contact" className="vp-link whitespace-nowrap">
                  {t('how.pilotContact')}
                </Link>
              </span>
            </li>
          )}
        </ul>
      </div>

      {/* Trust and privacy */}
      <ul className="mt-5 grid gap-3 text-sm text-ink-2 sm:grid-cols-3">
        <li className="flex items-start gap-2.5 rounded-control px-1 py-1">
          <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--transit-accent)]" aria-hidden="true" />
          <span>{t('how.trustReviewed')}</span>
        </li>
        <li className="flex items-start gap-2.5 rounded-control px-1 py-1">
          <Lock className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--transit-accent)]" aria-hidden="true" />
          <span>{t('how.trustExact')}</span>
        </li>
        <li className="flex items-start gap-2.5 rounded-control px-1 py-1">
          <FileDown className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--transit-accent)]" aria-hidden="true" />
          <span>
            {t('how.trustData')}{' '}
            <Link href="/privacy" className="vp-link">
              {t('how.privacyLink')}
            </Link>
          </span>
        </li>
      </ul>
    </section>
  );
}
