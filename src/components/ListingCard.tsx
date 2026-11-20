'use client';

import React from 'react';
import { SearchResultItem } from '@/types';
import { useI18n } from '@/components/i18n/LanguageProvider';
import { MapPin, Star, ShieldCheck, AlertTriangle, Lock, Zap, Umbrella, Sun, ImageOff, ArrowRight } from 'lucide-react';

interface ListingCardProps {
  item: SearchResultItem;
  isSelected?: boolean;
  onSelect: () => void;
  onBook: () => void;
}

const CATEGORY_BADGE: Record<string, string> = {
  COMMERCIAL: 'vp-badge vp-badge-info',
  PRIVATE: 'vp-badge vp-badge-host',
  OTHER: 'vp-badge vp-badge-warning',
  PUBLIC: 'vp-badge',
};

/**
 * One search result. Shows only the public discovery projection: for non-public
 * spaces the location is the approximate area and the distance is measured to the
 * approximate point (see listing-privacy.mjs).
 */
export function ListingCard({ item, isSelected, onSelect, onBook }: ListingCardProps) {
  const { t, tn, inr, date } = useI18n();
  const { listing, distanceKm, availableCapacity } = item;

  const isFree = listing.pricing.hourlyRate === 0;
  const photo = listing.photos[0];
  const isPublic = listing.category === 'PUBLIC';

  return (
    <article
      onClick={onSelect}
      aria-labelledby={`listing-${listing.id}-title`}
      className={`vp-card group overflow-hidden transition-[border-color,box-shadow,transform] duration-200 ease-out-quart hover:shadow-raised motion-safe:hover:-translate-y-0.5 ${
        isSelected ? 'border-[var(--transit-accent)] ring-1 ring-[var(--transit-accent)]' : 'hover:border-hairline-strong focus-within:border-hairline-strong'
      }`}
    >
      <div className="flex flex-col sm:flex-row">
        {/* Photo (or an honest placeholder; never a stock image) */}
        <div className="relative h-40 w-full flex-shrink-0 overflow-hidden bg-surface-alt sm:h-auto sm:min-h-[11rem] sm:w-44">
          {photo ? (
            <img
              src={photo}
              alt={t('listing.photoAlt', { title: listing.title })}
              className="h-full w-full object-cover transition-transform duration-500 ease-out-quart motion-safe:group-hover:scale-[1.03]"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-ink-3">
              <ImageOff className="h-6 w-6" aria-hidden="true" />
              <span className="text-xs">{t('listing.noPhoto')}</span>
            </div>
          )}
          <span className={`absolute left-2.5 top-2.5 ${CATEGORY_BADGE[listing.category] ?? 'vp-badge'} shadow-card`}>
            {t(`categories.${listing.category}`)}
          </span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <h3 id={`listing-${listing.id}-title`} className="min-w-0 text-[15px] font-semibold leading-snug text-ink">
              {listing.title}
            </h3>
            <p className="flex-shrink-0 text-right tabular-nums">
              {isFree ? (
                <span className="text-base font-bold text-ink">{t('common.free')}</span>
              ) : (
                <>
                  <span className="text-base font-bold text-ink">{inr(listing.pricing.hourlyRate)}</span>
                  <span className="text-xs text-ink-3">{t('common.perHour')}</span>
                </>
              )}
            </p>
          </div>

          {/* Area and distance (exact location only after booking) */}
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-2">
            <span className="inline-flex min-w-0 items-center gap-1">
              <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-ink-3" aria-hidden="true" />
              <span className="truncate">
                {listing.locality || 'Yelahanka'}
                {listing.landmark ? ` · ${t('listing.near', { landmark: listing.landmark })}` : ''}
              </span>
            </span>
            <span className="font-medium tabular-nums text-ink">{t('listing.distance', { km: distanceKm })}</span>
          </p>
          {!isPublic && (
            <p className="mt-1 inline-flex items-center gap-1 text-xs text-ink-3">
              <Lock className="h-3 w-3 text-[var(--transit-accent)]" aria-hidden="true" />
              {t('listing.exactAfterBooking')}
            </p>
          )}

          {/* Attributes */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {listing.reviewCount > 0 ? (
              <span className="vp-badge">
                <Star className="h-3 w-3 fill-amber-500 text-amber-500" aria-hidden="true" />
                <span className="text-ink">{listing.rating}</span>
                <span>({tn('listing.reviews', listing.reviewCount)})</span>
              </span>
            ) : (
              listing.status === 'VERIFIED' && (
                <span className="vp-badge vp-badge-success">
                  <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                  {t('listing.verified')}
                </span>
              )
            )}
            <span className="vp-badge">
              {listing.isCovered ? <Umbrella className="h-3 w-3" aria-hidden="true" /> : <Sun className="h-3 w-3" aria-hidden="true" />}
              {listing.isCovered ? t('listing.covered') : t('listing.open')}
            </span>
            {listing.hasEvCharging && (
              <span className="vp-badge vp-badge-info">
                <Zap className="h-3 w-3" aria-hidden="true" />
                {t('listing.evReady')}
              </span>
            )}
          </div>

          <p className="mt-2 text-xs">
            {listing.isStale ? (
              <span className="inline-flex items-center gap-1 font-medium text-[var(--warning-ink)]">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                {t('listing.stale')}
              </span>
            ) : (
              listing.lastConfirmedAt && (
                <span className="text-ink-3">{t('listing.confirmed', { date: date(listing.lastConfirmedAt, { day: 'numeric', month: 'short' }) })}</span>
              )
            )}
          </p>

          {/* Availability and action */}
          <div className="mt-auto flex items-center justify-between gap-3 border-t border-hairline pt-3 sm:mt-4">
            {isPublic ? (
              <span className="vp-badge">{t('listing.publicNotBookable')}</span>
            ) : availableCapacity > 0 ? (
              <span className="vp-badge vp-badge-success">{tn('listing.bays', availableCapacity)}</span>
            ) : (
              <span className="vp-badge vp-badge-warning">{t('listing.full')}</span>
            )}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelect();
                onBook();
              }}
              aria-describedby={`listing-${listing.id}-title`}
              className={`group/cta vp-btn vp-btn-sm ${listing.isBookable ? 'vp-btn-primary' : 'vp-btn-secondary'}`}
            >
              {listing.isBookable ? t('listing.reserve') : t('listing.viewDetails')}
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 ease-out-quart group-hover/cta:translate-x-0.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
