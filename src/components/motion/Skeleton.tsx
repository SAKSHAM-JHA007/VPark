import React from 'react';

/**
 * Placeholder shaped like a ListingCard. Only rendered while a real search
 * request is in flight; it is decorative (aria-hidden) — the caller keeps a
 * visible text status for screen readers.
 */
export function ListingCardSkeleton({ style }: { style?: React.CSSProperties }) {
  return (
    <div aria-hidden="true" style={style} className="vp-card overflow-hidden animate-fade-in">
      <div className="flex flex-col sm:flex-row">
        <div className="vp-skeleton h-40 w-full flex-shrink-0 sm:h-auto sm:min-h-[11rem] sm:w-44" />
        <div className="flex-1 space-y-3 p-4 sm:p-5">
          <div className="flex justify-between gap-3">
            <div className="vp-skeleton h-4 w-2/3 rounded-full" />
            <div className="vp-skeleton h-4 w-14 rounded-full" />
          </div>
          <div className="vp-skeleton h-3 w-1/2 rounded-full" />
          <div className="flex gap-1.5 pt-1">
            <div className="vp-skeleton h-5 w-16 rounded-full" />
            <div className="vp-skeleton h-5 w-16 rounded-full" />
          </div>
          <div className="flex items-center justify-between border-t border-hairline pt-3">
            <div className="vp-skeleton h-5 w-24 rounded-full" />
            <div className="vp-skeleton h-9 w-24 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
