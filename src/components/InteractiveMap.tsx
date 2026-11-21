'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SearchResultItem } from '@/types';
import { DemandAnchor } from '@/lib/constants';
import {
  Plus,
  Minus,
  Navigation,
  ExternalLink,
  Layers,
  Compass,
} from 'lucide-react';

interface InteractiveMapProps {
  results: SearchResultItem[];
  selectedItem?: SearchResultItem;
  onSelectItem: (item: SearchResultItem) => void;
  selectedAnchor?: DemandAnchor;
  onLocateMe?: () => void;
}

declare global {
  interface Window {
    google?: any;
    initGoogleMapCallback?: () => void;
  }
}

// Google Maps Custom Styling for Light and Dark Modes
const DARK_MAP_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#1a1d24' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1d24' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#9ca3af' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#16231c' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#6b7280' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2b303c' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212a37' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9ca3af' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3b4252' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#1f2835' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#f3d19c' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2f3948' }] },
  { featureType: 'transit.station', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0d131f' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#515c6d' }] },
  { featureType: 'water', elementType: 'labels.text.stroke', stylers: [{ color: '#17263c' }] },
];

const LIGHT_MAP_STYLES = [
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9e8fd' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f5f7fa' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#fed7aa' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#dcfce7' }] },
];

export function InteractiveMap({
  results,
  selectedItem,
  onSelectItem,
  selectedAnchor,
  onLocateMe,
}: InteractiveMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapInstance = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const anchorMarkerRef = useRef<any>(null);

  // Read API Key strictly from environment variable (never exposed on client UI)
  const apiKey =
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
    '';
  const [isJsApiLoaded, setIsJsApiLoaded] = useState<boolean>(false);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [mapType, setMapType] = useState<'roadmap' | 'satellite' | 'hybrid'>('roadmap');

  // Center coordinates: from selectedAnchor or default to Yelahanka (13.1007, 77.5963)
  const centerLat = selectedAnchor ? selectedAnchor.latitude : 13.1007;
  const centerLng = selectedAnchor ? selectedAnchor.longitude : 77.5963;

  // Detect dark mode from document class
  useEffect(() => {
    const checkDark = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };
    checkDark();
    const observer = new MutationObserver(checkDark);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Dynamically load Google Maps JavaScript API script when apiKey is configured in environment
  useEffect(() => {
    if (!apiKey) {
      setIsJsApiLoaded(false);
      return;
    }

    if (window.google && window.google.maps) {
      setIsJsApiLoaded(true);
      return;
    }

    const scriptId = 'google-maps-api-script';
    const existingScript = document.getElementById(scriptId);
    if (existingScript) {
      existingScript.remove();
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places,geometry`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      setIsJsApiLoaded(true);
    };

    script.onerror = () => {
      setIsJsApiLoaded(false);
    };

    document.head.appendChild(script);
  }, [apiKey]);

  // Initialize or reconfigure Google Map instance
  useEffect(() => {
    if (!isJsApiLoaded || !window.google || !window.google.maps || !mapRef.current) return;

    try {
      if (!googleMapInstance.current) {
        googleMapInstance.current = new window.google.maps.Map(mapRef.current, {
          center: { lat: centerLat, lng: centerLng },
          zoom: 14,
          mapTypeId: mapType,
          styles: isDarkMode ? DARK_MAP_STYLES : LIGHT_MAP_STYLES,
          disableDefaultUI: false,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: true,
          fullscreenControl: false,
        });
      } else {
        googleMapInstance.current.setCenter({ lat: centerLat, lng: centerLng });
        googleMapInstance.current.setMapTypeId(mapType);
        googleMapInstance.current.setOptions({
          styles: isDarkMode ? DARK_MAP_STYLES : LIGHT_MAP_STYLES,
        });
      }
    } catch (err) {
      console.error('Error initializing Google Map:', err);
    }
  }, [isJsApiLoaded, centerLat, centerLng, isDarkMode, mapType]);

  // Update Markers when results or selectedItem changes in Google Maps SDK
  useEffect(() => {
    if (!isJsApiLoaded || !googleMapInstance.current || !window.google || !window.google.maps) return;

    // Clear previous markers
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    if (anchorMarkerRef.current) {
      anchorMarkerRef.current.setMap(null);
      anchorMarkerRef.current = null;
    }

    // Add Anchor Marker (Search Radar Center)
    if (selectedAnchor) {
      const anchorMarker = new window.google.maps.Marker({
        position: { lat: selectedAnchor.latitude, lng: selectedAnchor.longitude },
        map: googleMapInstance.current,
        title: selectedAnchor.name,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: '#0A5CFF',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 2,
        },
        zIndex: 5,
      });
      anchorMarkerRef.current = anchorMarker;
    }

    // Add Parking Space Markers
    results.forEach((item) => {
      const { listing } = item;
      const isSelected = selectedItem?.listing.id === listing.id;
      const isFree = listing.pricing.hourlyRate === 0;
      const priceText = isFree ? 'Free' : `₹${listing.pricing.hourlyRate}`;

      const color =
        listing.category === 'COMMERCIAL'
          ? '#0A5CFF'
          : listing.category === 'PRIVATE'
          ? '#9333EA'
          : '#059669';

      const marker = new window.google.maps.Marker({
        position: { lat: listing.latitude, lng: listing.longitude },
        map: googleMapInstance.current,
        title: `${listing.title} (${priceText}/hr)`,
        label: {
          text: priceText,
          color: '#FFFFFF',
          fontSize: isSelected ? '11px' : '10px',
          fontWeight: 'bold',
        },
        icon: {
          path: 'M -24,-14 L 24,-14 A 4,4 0 0,1 28,-10 L 28,10 A 4,4 0 0,1 24,14 L 4,14 L 0,22 L -4,14 L -24,14 A 4,4 0 0,1 -28,10 L -28,-10 A 4,4 0 0,1 -24,-14 Z',
          fillColor: color,
          fillOpacity: 1,
          strokeColor: isSelected ? '#FFFFFF' : '#1E293B',
          strokeWeight: isSelected ? 2.5 : 1,
          scale: isSelected ? 1.15 : 1,
          labelOrigin: new window.google.maps.Point(0, 0),
        },
        zIndex: isSelected ? 999 : 10,
      });

      marker.addListener('click', () => {
        onSelectItem(item);
      });

      markersRef.current.push(marker);
    });
  }, [isJsApiLoaded, results, selectedItem, selectedAnchor, onSelectItem]);

  // Center on current search zone or user
  const handleCenterLocation = useCallback(() => {
    if (googleMapInstance.current) {
      googleMapInstance.current.panTo({ lat: centerLat, lng: centerLng });
      googleMapInstance.current.setZoom(15);
    }
    if (onLocateMe) {
      onLocateMe();
    }
  }, [centerLat, centerLng, onLocateMe]);

  // Google Maps Deep Link for navigation
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${centerLat},${centerLng}`;
  const embedMapUrl = `https://maps.google.com/maps?q=${centerLat},${centerLng}&z=14&output=embed`;

  return (
    <div className="relative w-full h-[580px] bg-slate-100 dark:bg-slate-900 rounded-3xl overflow-hidden border border-slate-200 dark:border-neutral-800 shadow-md select-none">
      {/* 1. Google Maps Display: SDK Canvas or Live Embed Layer */}
      {isJsApiLoaded ? (
        <div ref={mapRef} className="w-full h-full" />
      ) : (
        <div className="relative w-full h-full">
          {/* Real Google Maps Embed Iframe */}
          <iframe
            title="Google Maps Location View"
            src={embedMapUrl}
            width="100%"
            height="100%"
            style={{ border: 0 }}
            loading="lazy"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
            className="w-full h-full grayscale-[15%] contrast-[105%]"
          />

          {/* Semi-transparent dark overlay in dark mode */}
          <div className="absolute inset-0 pointer-events-none bg-black/10 dark:bg-slate-950/30" />
        </div>
      )}

      {/* 2. Top Right Actions: Map Type Switcher & Open in Google Maps */}
      <div className="absolute top-4 right-4 flex items-center gap-2 pointer-events-none z-30">
        <div className="pointer-events-auto flex items-center gap-1.5">
          {isJsApiLoaded && (
            <button
              type="button"
              onClick={() => setMapType((t) => (t === 'roadmap' ? 'satellite' : 'roadmap'))}
              className="p-2 rounded-full bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md border border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-slate-200 hover:text-[#0A5CFF] shadow-sm transition-colors text-xs font-semibold flex items-center gap-1 px-3"
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="capitalize">{mapType}</span>
            </button>
          )}

          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md border border-slate-200 dark:border-neutral-700 shadow-sm text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-[#0A5CFF] hover:border-blue-400 transition-colors"
          >
            <span>Open in Google Maps</span>
            <ExternalLink className="w-3 h-3 text-[#0A5CFF]" />
          </a>
        </div>
      </div>

      {/* 3. Floating Bottom Summary Card: Active Spot or Zone Summary */}
      <div className="absolute bottom-4 left-4 max-w-sm bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md rounded-2xl p-3.5 border border-slate-200 dark:border-neutral-700 shadow-lg z-30 flex items-center justify-between gap-3 animate-fade-up [animation-delay:150ms]">
        {/* Overlay content re-keys on selection so the summary slides in; map/marker logic is untouched. */}
        {selectedItem ? (
          <div key={selectedItem.listing.id} className="flex items-center gap-3 animate-slide-in">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-xs ${
                selectedItem.listing.category === 'COMMERCIAL'
                  ? 'bg-[#0A5CFF]'
                  : selectedItem.listing.category === 'PRIVATE'
                  ? 'bg-purple-600'
                  : 'bg-emerald-600'
              }`}
            >
              P
            </div>
            <div className="min-w-0">
              <h4 className="font-bold text-slate-900 dark:text-white text-xs truncate max-w-[200px]">
                {selectedItem.listing.title}
              </h4>
              <p className="text-slate-500 dark:text-slate-400 text-[11px] truncate">
                {selectedItem.listing.locality} · ₹{selectedItem.listing.pricing.hourlyRate}/hr
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 animate-fade-in">
            <div className="w-9 h-9 rounded-xl bg-[#0A5CFF] text-white flex items-center justify-center font-bold text-xs">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 dark:text-white text-xs">
                {selectedAnchor ? selectedAnchor.locality : 'Yelahanka Pilot Micro-Market'}
              </h4>
              <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                {results.length} verified parking bays indexed in zone
              </p>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={handleCenterLocation}
          className="p-2 rounded-xl bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-slate-300 hover:text-[#0A5CFF] transition-[color,transform] duration-150 active:scale-90"
          title="Center on search location"
        >
          <Navigation className="w-4 h-4" />
        </button>
      </div>

      {/* 4. Zoom & Center Navigation Controls (right side) */}
      <div className="absolute bottom-4 right-4 flex flex-col items-center gap-2 z-30">
        <div className="bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-neutral-700 shadow-md flex flex-col divide-y divide-slate-200 dark:divide-neutral-800 overflow-hidden">
          <button
            type="button"
            onClick={() => {
              if (googleMapInstance.current) {
                googleMapInstance.current.setZoom(googleMapInstance.current.getZoom() + 1);
              }
            }}
            title="Zoom In"
            aria-label="Zoom In"
            className="w-9 h-9 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              if (googleMapInstance.current) {
                googleMapInstance.current.setZoom(googleMapInstance.current.getZoom() - 1);
              }
            }}
            title="Zoom Out"
            aria-label="Zoom Out"
            className="w-9 h-9 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <Minus className="w-4 h-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={handleCenterLocation}
          title="Center Map"
          className="w-9 h-9 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-neutral-700 shadow-md flex items-center justify-center text-slate-700 dark:text-slate-200 hover:text-[#0A5CFF] transition-colors"
        >
          <Navigation className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
