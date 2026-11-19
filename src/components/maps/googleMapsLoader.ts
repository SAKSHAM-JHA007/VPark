'use client';

/**
 * Single, shared loader for the Google Maps JavaScript API.
 *
 * - The <script> is injected at most once per page, even when several maps mount,
 *   when a modal is reopened, or when React Strict Mode runs effects twice in dev.
 * - Uses the recommended `loading=async` bootstrap and `importLibrary`, and loads
 *   only the libraries the app uses (`core`, `maps` and `marker`).
 * - If Google rejects the key (unrestricted referrer, API not enabled, billing off)
 *   it calls `window.gm_authFailure`; subscribers are told so they can fall back to
 *   the iframe instead of showing Google's error tile.
 *
 * KEY REQUIREMENT: genuine light/dark map styling needs a Maps JavaScript API key in
 * `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`. The key is visible in the browser by design, so it
 * must be restricted in Google Cloud by HTTP referrer (the production domain and
 * localhost) and by API (Maps JavaScript API only). Without a key, the app uses the
 * keyless Google Maps iframe, which cannot be styled or put into dark mode.
 *
 * JSON `styles` are ignored by Google when a Map ID is set, so no Map ID is used.
 */

export interface GoogleMapsApi {
  Map: any;
  Marker: any;
  Point: any;
}

const SCRIPT_ID = 'vpark-google-maps-js';
const READY_CALLBACK = '__vparkGoogleMapsReady';

let loadPromise: Promise<GoogleMapsApi> | null = null;
let authFailed = false;
const authFailureListeners = new Set<() => void>();

export function getGoogleMapsApiKey(): string {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
}

export function hasGoogleMapsAuthFailed(): boolean {
  return authFailed;
}

/** Subscribe to Google's key-rejection signal. Returns an unsubscribe function. */
export function onGoogleMapsAuthFailure(listener: () => void): () => void {
  authFailureListeners.add(listener);
  return () => {
    authFailureListeners.delete(listener);
  };
}

async function resolveLibraries(): Promise<GoogleMapsApi> {
  const g = (window as any).google;
  if (g?.maps?.importLibrary) {
    const [{ Map }, { Marker }, { Point }] = await Promise.all([
      g.maps.importLibrary('maps'),
      g.maps.importLibrary('marker'),
      g.maps.importLibrary('core'),
    ]);
    return { Map, Marker, Point };
  }
  return { Map: g.maps.Map, Marker: g.maps.Marker, Point: g.maps.Point };
}

export function loadGoogleMaps(apiKey: string): Promise<GoogleMapsApi> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Maps can only load in the browser.'));
  }
  if (!apiKey) {
    return Promise.reject(new Error('No Google Maps API key configured.'));
  }
  if (loadPromise) return loadPromise;

  const w = window as any;

  // Google calls this global when the key is rejected for this page.
  if (!w.gm_authFailure) {
    w.gm_authFailure = () => {
      authFailed = true;
      authFailureListeners.forEach((listener) => listener());
    };
  }

  if (w.google?.maps?.Map || w.google?.maps?.importLibrary) {
    loadPromise = resolveLibraries();
    return loadPromise;
  }

  loadPromise = new Promise<GoogleMapsApi>((resolve, reject) => {
    w[READY_CALLBACK] = () => {
      delete w[READY_CALLBACK];
      resolveLibraries().then(resolve, reject);
    };

    if (document.getElementById(SCRIPT_ID)) return; // already requested; wait for the callback

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.async = true;
    script.src =
      'https://maps.googleapis.com/maps/api/js' +
      `?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async&callback=${READY_CALLBACK}`;
    script.onerror = () => {
      script.remove();
      loadPromise = null; // allow a later retry (e.g. after a network blip)
      reject(new Error('Google Maps JavaScript API failed to load.'));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}
