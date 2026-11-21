'use client';

import { getGoogleMapsApiKey, hasGoogleMapsAuthFailed, loadGoogleMaps } from '@/components/maps/googleMapsLoader';
import { roundCoordinate, type LatLng } from '@/lib/location/geo';
import { pickLocality, type GeocodeResultLike } from '@/lib/location/locality';

const GEOCODE_TIMEOUT_MS = 6000;

/**
 * Readable locality for a device location, via the Maps JavaScript API that VPark
 * already uses (same restricted browser key, same loader). Returns null when no key
 * is configured, Google rejects the key, the request fails or it takes too long; the
 * caller then shows a truthful fallback such as "Current location".
 *
 * Only a rounded point (~110 m) is sent, and nothing is cached or stored.
 */
export async function reverseGeocodeLocality(point: LatLng): Promise<string | null> {
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey || hasGoogleMapsAuthFailed()) return null;

  const work = (async () => {
    await loadGoogleMaps(apiKey);
    const maps = (window as any).google?.maps;
    if (!maps) return null;
    const lib = typeof maps.importLibrary === 'function' ? await maps.importLibrary('geocoding') : maps;
    if (!lib?.Geocoder) return null;
    const geocoder = new lib.Geocoder();
    const response = await geocoder.geocode({
      location: { lat: roundCoordinate(point.lat), lng: roundCoordinate(point.lng) },
    });
    return pickLocality((response?.results ?? []) as GeocodeResultLike[]);
  })();

  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), GEOCODE_TIMEOUT_MS));
  try {
    return await Promise.race([work, timeout]);
  } catch {
    return null;
  }
}
