/**
 * The active search location, shared by the navbar location menu, the homepage
 * search card and the Find Parking screen.
 *
 * Deliberately in memory only: a module-level value that survives client-side
 * navigation (homepage → /driver/home) but not a reload, and is never written to
 * localStorage, sessionStorage, cookies or the URL. That is how the device's precise
 * coordinates are handed from the homepage to the results page without leaving them
 * in browser history or storage.
 */

import { YELAHANKA_ANCHORS, type DemandAnchor } from '@/lib/constants';
import type { LatLng } from './geo';

export type SearchLocation =
  | { kind: 'anchor'; anchorId: string }
  | {
      kind: 'device';
      lat: number;
      lng: number;
      accuracyM: number | null;
      /** Locality from reverse geocoding, or null when unavailable. */
      label: string | null;
      /** Pilot landmark the fix is close to, used as a fallback label. */
      nearAnchorId: string | null;
    };

const DEFAULT_LOCATION: SearchLocation = { kind: 'anchor', anchorId: YELAHANKA_ANCHORS[0].id };

let current: SearchLocation = DEFAULT_LOCATION;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export const searchLocationStore = {
  get(): SearchLocation {
    return current;
  },
  getServerSnapshot(): SearchLocation {
    return DEFAULT_LOCATION;
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  setAnchor(anchorId: string): void {
    const exists = YELAHANKA_ANCHORS.some((a) => a.id === anchorId);
    current = { kind: 'anchor', anchorId: exists ? anchorId : DEFAULT_LOCATION.anchorId };
    emit();
  },
  setDevice(location: Omit<Extract<SearchLocation, { kind: 'device' }>, 'kind'>): void {
    current = { kind: 'device', ...location };
    emit();
  },
  /** Update the label of the current device location once reverse geocoding resolves. */
  setDeviceLabel(label: string | null): void {
    if (current.kind !== 'device') return;
    current = { ...current, label };
    emit();
  },
  reset(): void {
    current = DEFAULT_LOCATION;
    emit();
  },
};

export function anchorById(id: string): DemandAnchor {
  return YELAHANKA_ANCHORS.find((a) => a.id === id) ?? YELAHANKA_ANCHORS[0];
}

export function centerOf(location: SearchLocation): LatLng {
  if (location.kind === 'device') return { lat: location.lat, lng: location.lng };
  const anchor = anchorById(location.anchorId);
  return { lat: anchor.latitude, lng: anchor.longitude };
}
