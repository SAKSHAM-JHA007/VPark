/** Minimal shape of a Google Geocoder result (only what we read). */
export interface GeocodeResultLike {
  address_components?: { long_name?: string; short_name?: string; types?: string[] }[];
}

/** Most useful neighbourhood-level name first, then the city. */
const LOCALITY_TYPES = ['sublocality_level_1', 'sublocality', 'neighborhood', 'locality'] as const;

/**
 * Picks a short, human-readable locality ("Yelahanka New Town") from reverse-geocoding
 * results. Never returns a street address or house number.
 */
export function pickLocality(results: readonly GeocodeResultLike[] | null | undefined): string | null {
  if (!results || results.length === 0) return null;
  for (const type of LOCALITY_TYPES) {
    for (const result of results) {
      const component = result.address_components?.find((c) => c.types?.includes(type));
      const name = component?.long_name?.trim();
      if (name) return name.length > 40 ? `${name.slice(0, 39)}…` : name;
    }
  }
  return null;
}
