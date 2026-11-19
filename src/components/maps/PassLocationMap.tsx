'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useIsDarkTheme } from '@/components/hooks/useIsDarkTheme';
import {
  getGoogleMapsApiKey,
  hasGoogleMapsAuthFailed,
  loadGoogleMaps,
  onGoogleMapsAuthFailure,
} from '@/components/maps/googleMapsLoader';
import { DARK_MAP_STYLES, LIGHT_MAP_STYLES } from '@/components/maps/mapStyles';

interface PassLocationMapProps {
  latitude: number;
  longitude: number;
  title: string;
  className?: string;
}

type MapStatus = 'loading' | 'ready' | 'fallback';

// Single-pin marker in VPark blue (an SVG path, so no extra marker library is needed).
const PIN_PATH =
  'M12 0C5.4 0 0 5.3 0 11.9 0 20.8 12 32 12 32s12-11.2 12-20.1C24 5.3 18.6 0 12 0zm0 16.5a4.6 4.6 0 1 1 0-9.2 4.6 4.6 0 0 1 0 9.2z';

/**
 * Exact-location map shown on the Digital Pass (after a booking is confirmed).
 *
 * - With a valid, restricted Maps JavaScript API key: a real Google map whose JSON
 *   style follows VPark's light/dark theme instantly via `setOptions`, without
 *   re-creating the map or resetting the view.
 * - Without a key (or if Google rejects it): the keyless Google Maps iframe in its
 *   standard style. That embed cannot be styled, so no CSS filters are applied to
 *   imitate a dark map.
 */
export function PassLocationMap({ latitude, longitude, title, className = 'h-48' }: PassLocationMapProps) {
  const apiKey = getGoogleMapsApiKey();
  const isDark = useIsDarkTheme();
  const isDarkRef = useRef(isDark);
  isDarkRef.current = isDark;

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [status, setStatus] = useState<MapStatus>(() =>
    apiKey && !hasGoogleMapsAuthFailed() ? 'loading' : 'fallback'
  );

  // Fall back to the iframe if Google rejects the key at any point.
  useEffect(() => onGoogleMapsAuthFailure(() => setStatus('fallback')), []);

  // Load the API once and create this map instance once.
  useEffect(() => {
    if (status === 'fallback' || mapRef.current) return;
    let cancelled = false;

    loadGoogleMaps(apiKey)
      .then(({ Map, Marker, Point }) => {
        if (cancelled || !containerRef.current || hasGoogleMapsAuthFailed()) return;
        const position = { lat: latitude, lng: longitude };
        mapRef.current = new Map(containerRef.current, {
          center: position,
          zoom: 17,
          styles: isDarkRef.current ? DARK_MAP_STYLES : LIGHT_MAP_STYLES,
          disableDefaultUI: true,
          zoomControl: true,
          fullscreenControl: true,
          clickableIcons: false,
          gestureHandling: 'cooperative',
        });
        markerRef.current = new Marker({
          position,
          map: mapRef.current,
          title,
          icon: {
            path: PIN_PATH,
            fillColor: '#0A5CFF',
            fillOpacity: 1,
            strokeColor: '#FFFFFF',
            strokeWeight: 1.5,
            scale: 1.1,
            anchor: new Point(12, 32),
          },
        });
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('fallback');
      });

    return () => {
      cancelled = true;
    };
    // Created once per mount; position/title/theme updates are applied by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, status]);

  // Theme sync: restyle the existing map in place.
  useEffect(() => {
    mapRef.current?.setOptions({ styles: isDark ? DARK_MAP_STYLES : LIGHT_MAP_STYLES });
  }, [isDark]);

  // Keep the pin in sync if the booking's coordinates change.
  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    const position = { lat: latitude, lng: longitude };
    markerRef.current.setPosition(position);
    markerRef.current.setTitle(title);
    mapRef.current.setCenter(position);
  }, [latitude, longitude, title]);

  // Detach the marker when the pass closes.
  useEffect(
    () => () => {
      markerRef.current?.setMap(null);
      markerRef.current = null;
      mapRef.current = null;
    },
    []
  );

  const frameClass = `relative w-full overflow-hidden rounded-control border border-hairline bg-surface-alt ${className}`;

  if (status === 'fallback') {
    const embedUrl = `https://maps.google.com/maps?q=${latitude},${longitude}&z=17&output=embed`;
    return (
      <div className="space-y-1.5">
        <div className={frameClass}>
          <iframe
            title={`Map of ${title}`}
            src={embedUrl}
            width="100%"
            height="100%"
            style={{ border: 0 }}
            loading="lazy"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
            className="h-full w-full"
          />
        </div>
        <p className="hidden text-[11px] text-ink-3 dark:block">Map shown in Google&apos;s standard light style.</p>
      </div>
    );
  }

  return (
    <div className={frameClass}>
      <div ref={containerRef} className="h-full w-full" role="region" aria-label={`Map of ${title}`} />
      {status === 'loading' && (
        <div className="vp-skeleton absolute inset-0" role="status" aria-label="Loading map" />
      )}
    </div>
  );
}
