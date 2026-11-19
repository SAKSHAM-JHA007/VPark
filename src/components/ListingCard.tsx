'use client';

import React from 'react';
import { SearchResultItem } from '@/types';
import { MapPin, Star, ShieldCheck, AlertTriangle, Lock } from 'lucide-react';

interface ListingCardProps {
  item: SearchResultItem;
  isSelected?: boolean;
  onSelect: () => void;
  onBook: () => void;
}

export function ListingCard({ item, isSelected, onSelect, onBook }: ListingCardProps) {
  const { listing, distanceKm, availableCapacity } = item;

  const categoryBadgeClass =
    listing.category === 'COMMERCIAL'
      ? 'border-[#0b45b8] text-[#0b45b8] dark:border-blue-400 dark:text-blue-400 bg-[var(--surface-alt)]'
      : listing.category === 'PRIVATE'
      ? 'border-purple-600 text-purple-700 dark:border-purple-400 dark:text-purple-400 bg-[var(--surface-alt)]'
      : listing.category === 'OTHER'
      ? 'border-amber-600 text-amber-700 dark:border-amber-400 dark:text-amber-400 bg-[var(--surface-alt)]'
      : 'border-[var(--hairline-strong)] text-[var(--ink-secondary)] bg-[var(--surface-alt)]';

  const categoryLabel =
    listing.category === 'COMMERCIAL'
      ? 'COMMERCIAL'
      : listing.category === 'PRIVATE'
      ? 'RESIDENTIAL'
      : listing.category === 'OTHER'
      ? 'OTHER'
      : 'PUBLIC';

  const isFree = listing.pricing.hourlyRate === 0;
  const confirmedLabel = listing.lastConfirmedAt
    ? new Date(listing.lastConfirmedAt).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
      })
    : 'Recently';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`group bg-[var(--surface-bg)] rounded-card p-4 border cursor-pointer transition-[border-color,box-shadow,transform] duration-200 ease-out-quart hover:shadow-md motion-safe:hover:-translate-y-0.5 ${
        isSelected
          ? 'border-[var(--transit-accent)] ring-1 ring-[var(--transit-accent)]'
          : 'border-[var(--hairline)] hover:border-[var(--hairline-strong)]'
      }`}
    >
      <div className="flex flex-col sm:flex-row gap-4 items-stretch">
        {/* Photo with category badge */}
        <div className="relative w-full sm:w-44 h-32 sm:h-36 rounded-control overflow-hidden bg-[var(--surface-alt)] border border-[var(--hairline)] flex-shrink-0">
          <img
            src={listing.photos[0] || 'https://images.unsplash.com/photo-1590674899484-d5640e854abe?w=800'}
            alt={listing.title ? `Verified parking bay: ${listing.title}` : 'Verified parking space bay in Bengaluru'}
            className="w-full h-full object-cover filter contrast-[1.02] transition-transform duration-500 ease-out-quart motion-safe:group-hover:scale-[1.04]"
            loading="lazy"
            decoding="async"
          />

          <span
            className={`absolute top-2 left-2 px-2 py-0.5 rounded-full font-mono text-[10px] tracking-wider uppercase border ${categoryBadgeClass}`}
          >
            {categoryLabel}
          </span>
        </div>

        {/* Content details */}
        <div className="flex-1 flex flex-col justify-between min-w-0">
          <div className="space-y-1.5">
            {/* Row 1: Title & Price */}
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-bold text-sm text-[var(--ink)] tracking-tight hover:text-[var(--transit-accent)] transition-colors uppercase leading-snug">
                {listing.title}
              </h3>

              <div className="text-right flex-shrink-0 font-mono">
                {isFree ? (
                  <span className="text-sm font-bold text-[var(--ink)]">FREE</span>
                ) : (
                  <span className="text-sm font-bold text-[var(--ink)]">
                    ₹{listing.pricing.hourlyRate}
                    <span className="text-[11px] font-normal text-[var(--ink-secondary)]">/HR</span>
                  </span>
                )}
              </div>
            </div>

            {/* Row 2: Location & Distance (Precise location unlocked after payment) */}
            <div className="flex items-center gap-1.5 text-xs text-[var(--ink-secondary)]">
              <span className="truncate font-medium text-[var(--ink)]">
                {listing.locality || 'Yelahanka'}{listing.landmark ? ` (Near ${listing.landmark})` : ''}
              </span>
              <span className="text-[var(--hairline-strong)]">·</span>
              <span className="font-mono text-[11px] text-[var(--ink)] flex-shrink-0">{distanceKm} KM</span>
              <span className="text-[var(--hairline-strong)]">·</span>
              <span className="inline-flex items-center gap-0.5 text-[10px] text-[var(--ink-tertiary)] font-mono flex-shrink-0">
                <Lock className="w-2.5 h-2.5 text-[var(--transit-accent)]" />
                Exact location after booking
              </span>
            </div>

            {/* Row 3: Verification, Rating & Attributes */}
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-[var(--ink-secondary)] pt-1">
              {listing.reviewCount > 0 ? (
                <div className="flex items-center gap-1 font-semibold text-[var(--ink)]">
                  <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                  <span>{listing.rating}</span>
                  <span className="text-[var(--ink-tertiary)] font-normal">({listing.reviewCount})</span>
                </div>
              ) : (
                <span className="border border-emerald-600/40 text-emerald-700 dark:text-emerald-400 px-2 py-0.2 rounded-full text-[10px] uppercase">
                  VERIFIED
                </span>
              )}

              <span className="text-[var(--hairline-strong)]">·</span>
              <span>{listing.isCovered ? 'COVERED' : 'OPEN'}</span>
              <span className="text-[var(--hairline-strong)]">·</span>
              <span>{listing.hasEvCharging ? 'EV READY' : 'STANDARD'}</span>

              {listing.isStale ? (
                <>
                  <span className="text-[var(--hairline-strong)]">·</span>
                  <span className="text-amber-700 dark:text-amber-400 uppercase">
                    &gt;30D UNCONFIRMED
                  </span>
                </>
              ) : (
                <>
                  <span className="text-[var(--hairline-strong)]">·</span>
                  <span className="text-[var(--ink-tertiary)]">CONFIRMED {confirmedLabel.toUpperCase()}</span>
                </>
              )}
            </div>
          </div>

          {/* Row 4: Availability & Action Button */}
          <div className="flex items-center justify-between gap-3 pt-2.5 mt-2.5 border-t border-[var(--hairline)]">
            {listing.category === 'PUBLIC' ? (
              <span className="px-2 py-0.5 rounded-full font-mono text-[10px] tracking-wider uppercase border border-[var(--hairline-strong)] text-[var(--ink-secondary)]">
                PUBLIC · NOT BOOKABLE
              </span>
            ) : availableCapacity > 0 ? (
              <span className="px-2 py-0.5 rounded-full font-mono text-[10px] tracking-wider uppercase border border-emerald-600/30 text-emerald-700 dark:text-emerald-400">
                {availableCapacity} {availableCapacity === 1 ? 'BAY' : 'BAYS'} AVAILABLE
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full font-mono text-[10px] tracking-wider uppercase border border-amber-600/30 text-amber-700 dark:text-amber-400">
                FULL FOR THIS TIME
              </span>
            )}

            {listing.isBookable ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onBook();
                }}
                className="px-3.5 py-1.5 rounded-full bg-brand hover:bg-brand-hover text-white font-mono text-xs uppercase tracking-wider transition-[background-color,transform] duration-150 active:scale-[0.96]"
              >
                RESERVE BAY
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onBook();
                }}
                className="px-3 py-1.5 rounded-full bg-[var(--surface-alt)] hover:bg-[var(--surface-bg)] text-[var(--ink)] font-mono text-xs uppercase tracking-wider border border-[var(--hairline-strong)] transition-[background-color,transform] duration-150 active:scale-[0.96]"
              >
                VIEW DETAILS
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
