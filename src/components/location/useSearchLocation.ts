'use client';

import { useCallback, useState, useSyncExternalStore } from 'react';
import {
  NEAR_ANCHOR_KM,
  nearestAnchor,
  requestCurrentPosition,
  type GeolocationFailure,
} from '@/lib/location/geo';
import {
  anchorById,
  searchLocationStore,
  type SearchLocation,
} from '@/lib/location/searchLocationStore';
import { reverseGeocodeLocality } from '@/components/maps/reverseGeocode';
import type { Translator } from '@/lib/i18n';

/** The shared, in-memory search location. */
export function useSearchLocation(): SearchLocation {
  return useSyncExternalStore(
    searchLocationStore.subscribe,
    searchLocationStore.get,
    searchLocationStore.getServerSnapshot
  );
}

export type LocateStatus = 'idle' | 'locating' | 'error';

/**
 * Requests the device location (only when `locate()` is called from a user action),
 * sets it as the active search location and resolves a readable label in the
 * background. The precise fix lives only in memory.
 */
export function useDeviceLocation() {
  const [status, setStatus] = useState<LocateStatus>('idle');
  const [error, setError] = useState<GeolocationFailure | null>(null);

  const locate = useCallback(async (): Promise<boolean> => {
    setStatus('locating');
    setError(null);
    const result = await requestCurrentPosition({
      geolocation: typeof navigator !== 'undefined' ? navigator.geolocation ?? null : null,
      isSecureContext: typeof window !== 'undefined' ? window.isSecureContext : undefined,
    });
    if (!result.ok) {
      setError(result.reason);
      setStatus('error');
      return false;
    }
    const { lat, lng, accuracyM } = result.position;
    const near = nearestAnchor({ lat, lng });
    searchLocationStore.setDevice({
      lat,
      lng,
      accuracyM,
      label: null,
      nearAnchorId: near && near.km <= NEAR_ANCHOR_KM ? near.anchor.id : null,
    });
    setStatus('idle');
    // Non-blocking: results show immediately with the fallback label.
    reverseGeocodeLocality({ lat, lng }).then((label) => {
      if (label) searchLocationStore.setDeviceLabel(label);
    });
    return true;
  }, []);

  const clearError = useCallback(() => {
    setError(null);
    setStatus('idle');
  }, []);

  return { status, error, locate, clearError };
}

/** Short label for chips ("Yelahanka New Town", "Near Yelahanka West", "Current location"). */
export function shortLocationLabel(location: SearchLocation, t: Translator['t']): string {
  if (location.kind === 'anchor') return anchorById(location.anchorId).locality;
  if (location.label) return location.label;
  if (location.nearAnchorId) return t('location.nearPlace', { place: anchorById(location.nearAnchorId).locality });
  return t('location.currentLocation');
}

/** Longer label for headings ("Mother Dairy Circle & New Town 4th Phase"). */
export function fullLocationLabel(location: SearchLocation, t: Translator['t']): string {
  if (location.kind === 'anchor') return anchorById(location.anchorId).name;
  return shortLocationLabel(location, t);
}

export function geolocationErrorKey(reason: GeolocationFailure | null) {
  switch (reason) {
    case 'denied':
      return 'location.errors.denied' as const;
    case 'unavailable':
      return 'location.errors.unavailable' as const;
    case 'timeout':
      return 'location.errors.timeout' as const;
    case 'unsupported':
      return 'location.errors.unsupported' as const;
    case 'insecure':
      return 'location.errors.insecure' as const;
    default:
      return 'location.errors.generic' as const;
  }
}
