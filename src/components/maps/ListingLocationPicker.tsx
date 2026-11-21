'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useIsDarkTheme } from '@/components/hooks/useIsDarkTheme';
import {
  getGoogleMapsApiKey,
  hasGoogleMapsAuthFailed,
  loadGoogleMaps,
  onGoogleMapsAuthFailure,
} from '@/components/maps/googleMapsLoader';
import { DARK_MAP_STYLES, LIGHT_MAP_STYLES } from '@/components/maps/mapStyles';
import { Navigation, MapPin, Locate, ExternalLink } from 'lucide-react';

interface ListingLocationPickerProps {
  latitude: number;
  longitude: number;
  onChange: (lat: number, lng: number) => void;
  locality?: string;
  className?: string;
}

type MapStatus = 'loading' | 'ready' | 'fallback';

const TILE_TIMEOUT_MS = 4000;

// VPark branded pin SVG path
const PIN_PATH =
  'M12 0C5.4 0 0 5.3 0 11.9 0 20.8 12 32 12 32s12-11.2 12-20.1C24 5.3 18.6 0 12 0zm0 16.5a4.6 4.6 0 1 1 0-9.2 4.6 4.6 0 0 1 0 9.2z';

export function ListingLocationPicker({
  latitude,
  longitude,
  onChange,
  locality,
  className = 'h-64',
}: ListingLocationPickerProps) {
  const apiKey = getGoogleMapsApiKey();
  const isDark = useIsDarkTheme();
  const isDarkRef = useRef(isDark);
  isDarkRef.current = isDark;

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const watchdogRef = useRef<number | undefined>(undefined);
  const isDraggingRef = useRef<boolean>(false);

  const [status, setStatus] = useState<MapStatus>(() =>
    apiKey && !hasGoogleMapsAuthFailed() ? 'loading' : 'fallback'
  );
  const [locating, setLocating] = useState<boolean>(false);
  const [geoMessage, setGeoMessage] = useState<string | null>(null);

  // Fall back to iframe if Google rejects the key at any point
  useEffect(() => onGoogleMapsAuthFailure(() => setStatus('fallback')), []);

  // Initialize Google Maps instance
  useEffect(() => {
    if (status === 'fallback' || mapRef.current) return;
    let cancelled = false;

    loadGoogleMaps(apiKey)
      .then(({ Map, Marker, Point }) => {
        if (cancelled || !containerRef.current || hasGoogleMapsAuthFailed()) return;

        const position = { lat: latitude, lng: longitude };
        const map = new Map(containerRef.current, {
          center: position,
          zoom: 17,
          styles: isDarkRef.current ? DARK_MAP_STYLES : LIGHT_MAP_STYLES,
          disableDefaultUI: true,
          zoomControl: true,
          fullscreenControl: true,
          clickableIcons: false,
          gestureHandling: 'cooperative',
        });
        mapRef.current = map;

        const marker = new Marker({
          position,
          map,
          draggable: true,
          title: 'Drag to exact parking entrance',
          icon: {
            path: PIN_PATH,
            fillColor: '#0A5CFF',
            fillOpacity: 1,
            strokeColor: '#FFFFFF',
            strokeWeight: 2,
            scale: 1.25,
            anchor: new Point(12, 32),
          },
        });
        markerRef.current = marker;

        // Drag events
        marker.addListener('dragstart', () => {
          isDraggingRef.current = true;
        });

        marker.addListener('dragend', (e: any) => {
          isDraggingRef.current = false;
          if (e?.latLng) {
            const nextLat = Number(e.latLng.lat().toFixed(6));
            const nextLng = Number(e.latLng.lng().toFixed(6));
            onChange(nextLat, nextLng);
          }
        });

        // Click on map to place pin
        map.addListener('click', (e: any) => {
          if (e?.latLng) {
            const nextLat = Number(e.latLng.lat().toFixed(6));
            const nextLng = Number(e.latLng.lng().toFixed(6));
            marker.setPosition(e.latLng);
            onChange(nextLat, nextLng);
          }
        });

        // Wait for tiles to verify key validity
        const tilesListener = map.addListener('tilesloaded', () => {
          window.clearTimeout(watchdogRef.current);
          tilesListener.remove();
          setStatus('ready');
        });

        watchdogRef.current = window.setTimeout(() => {
          tilesListener.remove();
          markerRef.current?.setMap(null);
          markerRef.current = null;
          mapRef.current = null;
          setStatus('fallback');
        }, TILE_TIMEOUT_MS);
      })
      .catch(() => {
        if (!cancelled) setStatus('fallback');
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, status]);

  // Theme updates
  useEffect(() => {
    mapRef.current?.setOptions({
      styles: isDark ? DARK_MAP_STYLES : LIGHT_MAP_STYLES,
    });
  }, [isDark]);

  // Keep marker in sync with external coordinate changes (e.g. from locality dropdown)
  useEffect(() => {
    if (!mapRef.current || !markerRef.current || isDraggingRef.current) return;
    const curr = markerRef.current.getPosition();
    if (
      !curr ||
      Math.abs(curr.lat() - latitude) > 0.00005 ||
      Math.abs(curr.lng() - longitude) > 0.00005
    ) {
      const nextPos = { lat: latitude, lng: longitude };
      markerRef.current.setPosition(nextPos);
      mapRef.current.panTo(nextPos);
    }
  }, [latitude, longitude]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      window.clearTimeout(watchdogRef.current);
      markerRef.current?.setMap(null);
      markerRef.current = null;
      mapRef.current = null;
    };
  }, []);

  // GPS "Locate Me" handler
  const handleLocateMe = useCallback(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setGeoMessage('Geolocation is not supported by your browser.');
      return;
    }
    setLocating(true);
    setGeoMessage(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        onChange(lat, lng);

        if (mapRef.current && markerRef.current) {
          const nextPos = { lat, lng };
          markerRef.current.setPosition(nextPos);
          mapRef.current.panTo(nextPos);
          mapRef.current.setZoom(18);
        }
      },
      (err) => {
        setLocating(false);
        setGeoMessage('Unable to retrieve GPS location. Please pinpoint your space on the map.');
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  }, [onChange]);

  return (
    <div className="space-y-2">
      {/* Location Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-ink-2">
          <MapPin className="w-3.5 h-3.5 text-[#0A5CFF]" />
          <span>Pinpoint Space Entrance (Drag or Click)</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleLocateMe}
            disabled={locating}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-[#0A5CFF] dark:text-blue-400 font-bold hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors border border-blue-200 dark:border-blue-900/60 disabled:opacity-50"
            title="Use current GPS location"
          >
            <Locate className={`w-3 h-3 ${locating ? 'animate-spin' : ''}`} />
            <span>{locating ? 'Locating...' : 'Locate Me'}</span>
          </button>

          <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-100 dark:bg-surface-alt border border-slate-200 dark:border-hairline text-slate-700 dark:text-ink-2 font-bold">
            {latitude.toFixed(4)}, {longitude.toFixed(4)}
          </span>
        </div>
      </div>

      {geoMessage && (
        <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
          {geoMessage}
        </p>
      )}

      {/* Map View */}
      <div
        className={`relative w-full overflow-hidden rounded-xl border border-slate-300 dark:border-hairline-strong bg-surface-alt ${className}`}
      >
        {status === 'fallback' ? (
          <div className="relative h-full w-full">
            <iframe
              title={`Location map for ${locality || 'Parking Space'}`}
              src={`https://maps.google.com/maps?q=${latitude},${longitude}&z=17&output=embed`}
              width="100%"
              height="100%"
              style={{ border: 0 }}
              loading="lazy"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
              className="h-full w-full"
            />
            {/* Fallback Overlay for Coordinates & Open in Google Maps */}
            <div className="absolute bottom-2 right-2 flex items-center gap-1.5 bg-black/75 backdrop-blur-md px-2.5 py-1 rounded-lg text-white text-[11px] font-mono">
              <span>{latitude.toFixed(5)}, {longitude.toFixed(5)}</span>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-blue-300 flex items-center gap-0.5 ml-1"
                title="Open in Google Maps"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        ) : (
          <>
            <div
              ref={containerRef}
              className="h-full w-full cursor-crosshair"
              role="region"
              aria-label="Interactive map for selecting space location"
            />
            {status === 'loading' && (
              <div
                className="vp-skeleton absolute inset-0 flex items-center justify-center bg-slate-100 dark:bg-surface-alt/80 backdrop-blur-sm"
                role="status"
                aria-label="Loading map"
              >
                <span className="text-xs font-semibold text-slate-500">Loading Google Maps...</span>
              </div>
            )}
            {/* Floating Guide Badge */}
            <div className="absolute top-2 left-2 pointer-events-none px-2 py-1 rounded-md bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border border-slate-200 dark:border-hairline shadow-sm text-[10px] font-semibold text-slate-700 dark:text-ink-2 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#0A5CFF] animate-pulse" />
              Click map or drag pin to bay entrance
            </div>
          </>
        )}
      </div>

      {/* Manual Fine-Tuning Coordinates Accordion / Helper */}
      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-ink-3">
        <span>Drivers will be routed directly to this exact pin coordinate.</span>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1">
            <span>Lat:</span>
            <input
              type="number"
              step="0.0001"
              value={latitude}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val)) onChange(val, longitude);
              }}
              className="w-20 px-1 py-0.5 text-[11px] font-mono bg-slate-50 dark:bg-surface border border-slate-200 dark:border-hairline rounded text-slate-800 dark:text-ink"
            />
          </label>
          <label className="flex items-center gap-1">
            <span>Lng:</span>
            <input
              type="number"
              step="0.0001"
              value={longitude}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val)) onChange(latitude, val);
              }}
              className="w-20 px-1 py-0.5 text-[11px] font-mono bg-slate-50 dark:bg-surface border border-slate-200 dark:border-hairline rounded text-slate-800 dark:text-ink"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
