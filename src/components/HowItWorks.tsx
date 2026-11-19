'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Car, Home, ShieldCheck, Info } from 'lucide-react';

/**
 * Listing submission depends on the photo/document upload route (`/api/uploads`),
 * which does not exist yet, so providers cannot submit listings. Flip this to `true`
 * once uploads work again; every notice below disappears with it.
 */
export const LISTING_SUBMISSION_AVAILABLE = false;

export function ListingSubmissionNotice({ className = '' }: { className?: string }) {
  if (LISTING_SUBMISSION_AVAILABLE) return null;
  return (
    <div
      role="note"
      className={`flex items-start gap-2.5 rounded-control border border-amber-300/70 bg-amber-50 px-3.5 py-3 text-xs leading-relaxed text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200 ${className}`}
    >
      <Info className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
      <p>
        <strong className="font-semibold">Listing submission is temporarily unavailable.</strong> Photo and
        document uploads aren&apos;t working yet, so new listings can&apos;t be sent for review. If you&apos;d
        like to list a space, please{' '}
        <Link href="/contact" className="font-semibold underline underline-offset-2 hover:no-underline">
          contact us
        </Link>
        .
      </p>
    </div>
  );
}

interface Step {
  title: string;
  body: string;
}

const DRIVER_STEPS: Step[] = [
  {
    title: 'Choose your destination',
    body: 'Pick a landmark in the Yelahanka pilot area, then filter by vehicle size, price and covered or open parking.',
  },
  {
    title: 'Compare listings',
    body: 'Each listing shows its hourly rate, distance, space type and when the owner last confirmed it. The exact address is shared only once a booking is confirmed.',
  },
  {
    title: 'Know what “verified” means',
    body: 'A listing only appears after our team has reviewed the owner’s proof that they’re allowed to rent the space.',
  },
];

const PROVIDER_STEPS: Step[] = [
  {
    title: 'Describe your space',
    body: 'A driveway, apartment slot or commercial lot: its map pin, how many vehicles fit, vehicle types, covered or open, and your hourly or monthly rate.',
  },
  {
    title: 'Add photos and proof',
    body: 'At least three photos of the actual space, plus a document showing you can rent it, such as a property tax receipt, landlord consent, society NOC or trade licence. Documents are visible only to the review team.',
  },
  {
    title: 'We review it before it goes live',
    body: 'Your listing stays hidden from drivers until it’s approved. You’ll see its status: Submitted, Needs info, Approved or Rejected.',
  },
];

function StepList({ steps }: { steps: Step[] }) {
  return (
    <ol className="space-y-4">
      {steps.map((step, index) => (
        <li key={step.title} className="flex gap-3">
          <span
            aria-hidden="true"
            className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[var(--nav-active-bg)] text-[11px] font-bold text-[var(--transit-accent)]"
          >
            {index + 1}
          </span>
          <div className="space-y-0.5">
            <h4 className="text-sm font-semibold text-ink">{step.title}</h4>
            <p className="text-xs leading-relaxed text-ink-2 sm:text-[13px]">{step.body}</p>
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
 * "How VPark works": customer-facing driver and space-owner journeys.
 * Copy reflects what the product does today (pilot area, test-mode bookings,
 * no payouts yet, listing submission blocked while uploads are broken).
 */
export function HowItWorks({
  onBrowse,
  browseHref,
  onSetUpHost,
  id = 'how-it-works',
  sectionRef,
  className = '',
}: HowItWorksProps) {
  const primaryBtn =
    'group/cta inline-flex items-center justify-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-brand-hover active:scale-[0.97]';
  const secondaryBtn =
    'group/cta inline-flex items-center justify-center gap-2 rounded-full border border-hairline-strong bg-surface px-5 py-2.5 text-sm font-semibold text-ink transition-[background-color,transform] duration-150 hover:bg-surface-alt active:scale-[0.97]';
  const arrow = (
    <ArrowRight className="h-4 w-4 transition-transform duration-200 ease-out-quart group-hover/cta:translate-x-0.5" />
  );

  return (
    <section id={id} ref={sectionRef} className={`scroll-mt-20 ${className}`} aria-labelledby={`${id}-title`}>
      <div className="space-y-2">
        <h2 id={`${id}-title`} className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
          How VPark works
        </h2>
        <p className="max-w-2xl text-sm text-ink-2 sm:text-base">
          VPark is piloting around Yelahanka, Bengaluru. Here&apos;s what drivers and space owners can do today.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 vp-reveal">
        {/* Driver journey */}
        <article className="flex flex-col justify-between gap-6 rounded-card border border-hairline bg-surface p-6 shadow-card sm:p-7">
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-control bg-[var(--nav-active-bg)] text-[var(--transit-accent)]">
                <Car className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-semibold text-ink-3">For drivers</p>
                <h3 className="text-lg font-bold tracking-tight text-ink">Find a spot near where you&apos;re going</h3>
              </div>
            </div>
            <StepList steps={DRIVER_STEPS} />
            <p className="rounded-control bg-surface-alt px-3.5 py-2.5 text-xs leading-relaxed text-ink-2">
              Bookings and payments run in test mode during the pilot. No real money is charged.
            </p>
          </div>
          <div>
            {browseHref ? (
              <Link href={browseHref} className={primaryBtn}>
                Browse parking near Yelahanka {arrow}
              </Link>
            ) : (
              <button type="button" onClick={onBrowse} className={primaryBtn}>
                Browse parking near Yelahanka {arrow}
              </button>
            )}
          </div>
        </article>

        {/* Space-owner journey */}
        <article className="flex flex-col justify-between gap-6 rounded-card border border-hairline bg-surface p-6 shadow-card sm:p-7">
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-control bg-[var(--nav-active-bg)] text-[var(--transit-accent)]">
                <Home className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-semibold text-ink-3">For space owners</p>
                <h3 className="text-lg font-bold tracking-tight text-ink">Earn from a space you don&apos;t use</h3>
              </div>
            </div>
            <StepList steps={PROVIDER_STEPS} />
            <p className="rounded-control bg-surface-alt px-3.5 py-2.5 text-xs leading-relaxed text-ink-2">
              Payouts to space owners aren&apos;t live yet. We&apos;ll ask you to verify your email before they open.
            </p>
            <ListingSubmissionNotice />
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onSetUpHost} className={secondaryBtn}>
              Set up a host account {arrow}
            </button>
          </div>
        </article>
      </div>

      {/* Trust line */}
      <div className="mt-4 flex flex-col gap-2 rounded-card border border-hairline bg-surface-alt px-4 py-3.5 text-xs text-ink-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2">
          <ShieldCheck className="mt-px h-4 w-4 flex-shrink-0 text-[var(--transit-accent)]" aria-hidden="true" />
          <span>Every listing is reviewed by the VPark team before drivers can see it.</span>
        </p>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-6 sm:pl-0">
          <Link href="/privacy" className="font-semibold text-ink underline-offset-2 hover:underline">
            Privacy policy
          </Link>
          <span>You can export or delete your data from your account.</span>
        </p>
      </div>
    </section>
  );
}
