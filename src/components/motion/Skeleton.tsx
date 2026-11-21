import React from 'react';

/**
 * Placeholder shaped like a ListingCard. Only rendered while a real search
 * request is in flight; it is decorative (aria-hidden) — the caller keeps a
 * visible text status for screen readers.
 */
export function ListingCardSkeleton({ style }: { style?: React.CSSProperties }) {
  return (
    <div
      aria-hidden="true"
      style={style}
      className="bg-[var(--surface-bg)] rounded-sm p-4 border border-[var(--hairline)] animate-fade-in"
    >
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="vp-skeleton w-full sm:w-44 h-32 sm:h-36 rounded-xs flex-shrink-0" />
        <div className="flex-1 space-y-2.5 py-1">
          <div className="flex justify-between gap-3">
            <div className="vp-skeleton h-3.5 w-2/3 rounded-xs" />
            <div className="vp-skeleton h-3.5 w-12 rounded-xs" />
          </div>
          <div className="vp-skeleton h-3 w-1/2 rounded-xs" />
          <div className="vp-skeleton h-3 w-3/4 rounded-xs" />
          <div className="flex justify-between items-center pt-4">
            <div className="vp-skeleton h-4 w-24 rounded-xs" />
            <div className="vp-skeleton h-7 w-24 rounded-xs" />
          </div>
        </div>
      </div>
    </div>
  );
}
