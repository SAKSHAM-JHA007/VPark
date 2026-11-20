'use client';

import React, { useId } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronDown, Crosshair, Loader2, MapPin } from 'lucide-react';
import { YELAHANKA_ANCHORS } from '@/lib/constants';
import { searchLocationStore } from '@/lib/location/searchLocationStore';
import { useI18n } from '@/components/i18n/LanguageProvider';
import {
  geolocationErrorKey,
  shortLocationLabel,
  useDeviceLocation,
  useSearchLocation,
} from '@/components/location/useSearchLocation';
import { MenuLabel, NavMenu } from './NavMenu';

export const FIND_PARKING_PATH = '/driver/home';

interface LocationMenuProps {
  /**
   * `navigate`: choosing a location opens Find Parking (homepage and static pages).
   * `inline`: the current screen already shows results; `onSelected` is called.
   */
  mode: 'navigate' | 'inline';
  onSelected?: () => void;
  /** Tailwind breakpoint class that reveals the text label (icon-only below it). */
  labelClassName?: string;
}

/**
 * Navbar location control: "Use my current location" (browser geolocation, only on
 * click) plus the Yelahanka pilot landmarks. It sets the shared in-memory search
 * location; nothing is written to storage or the URL except a landmark id.
 */
export function LocationMenu({ mode, onSelected, labelClassName = 'hidden sm:inline' }: LocationMenuProps) {
  const { t } = useI18n();
  const router = useRouter();
  const location = useSearchLocation();
  const { status, error, locate, clearError } = useDeviceLocation();
  const hintId = useId();
  const landmarksId = useId();
  const titleId = useId();
  const label = shortLocationLabel(location, t);
  const locating = status === 'locating';

  const finish = (close: (returnFocus?: boolean) => void, query: string) => {
    close(false);
    if (mode === 'navigate') router.push(`${FIND_PARKING_PATH}?${query}`);
    else onSelected?.();
  };

  return (
    <>
      <NavMenu
        panelClassName="w-[19.5rem]"
        trigger={(props) => (
          <button
            {...props}
            aria-label={t('location.triggerLabel', { place: label })}
            className="vp-nav-control max-w-[13rem] px-2.5 sm:px-3"
          >
            {locating ? (
              <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-[var(--transit-accent)]" aria-hidden="true" />
            ) : (
              <MapPin className="h-4 w-4 flex-shrink-0 text-[var(--transit-accent)]" aria-hidden="true" />
            )}
            <span className={`${labelClassName} truncate text-[var(--nav-ink)]`}>{label}</span>
            <ChevronDown className={`${labelClassName} h-3.5 w-3.5 flex-shrink-0 opacity-70`} aria-hidden="true" />
          </button>
        )}
      >
        {({ close }) => (
          <>
            <p id={titleId} className="px-3 pb-1.5 pt-2 text-sm font-semibold text-ink">
              {t('location.menuTitle')}
            </p>
            <div role="menu" aria-labelledby={titleId}>
              <button
                type="button"
                role="menuitem"
                aria-describedby={hintId}
                aria-disabled={locating || undefined}
                onClick={async () => {
                  if (locating) return;
                  const ok = await locate();
                  if (ok) finish(close, 'near=me');
                }}
                className="vp-menu-item items-start"
              >
                <span className="vp-icon-tile h-8 w-8 rounded-[10px]" aria-hidden="true">
                  {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-ink">
                    {locating ? t('location.locating') : t('location.useCurrent')}
                  </span>
                  <span id={hintId} className="block text-xs text-ink-3">
                    {t('location.useCurrentHint')}
                  </span>
                </span>
              </button>

              <div role="separator" className="mx-2 my-1.5 h-px bg-[var(--hairline)]" />

              <div role="group" aria-labelledby={landmarksId}>
                <MenuLabel id={landmarksId}>{t('location.landmarks')}</MenuLabel>
                {YELAHANKA_ANCHORS.map((anchor) => {
                  const checked = location.kind === 'anchor' && location.anchorId === anchor.id;
                  return (
                    <button
                      key={anchor.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={checked}
                      onClick={() => {
                        clearError();
                        searchLocationStore.setAnchor(anchor.id);
                        finish(close, `anchor=${encodeURIComponent(anchor.id)}`);
                      }}
                      className="vp-menu-item items-start"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block leading-snug">{anchor.name}</span>
                        <span className="block text-xs text-ink-3">{anchor.locality}</span>
                      </span>
                      {checked && <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--transit-accent)]" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {error && (
              <div role="alert" className="vp-alert vp-alert-warning mx-1.5 mb-1.5 mt-2 text-xs">
                {t(geolocationErrorKey(error))}
              </div>
            )}
            <p className="px-3 pb-2 pt-1.5 text-xs leading-relaxed text-ink-3">{t('location.pilotNote')}</p>
          </>
        )}
      </NavMenu>
      {/* Progress for screen readers even when the menu is closed. */}
      <span className="sr-only" role="status" aria-live="polite">
        {locating ? t('location.locating') : ''}
      </span>
    </>
  );
}
