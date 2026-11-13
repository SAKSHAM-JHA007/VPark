'use client';

import React, { useState } from 'react';
import { SearchResultItem } from '@/types';
import { DemandAnchor } from '@/lib/constants';
import { Plus, Minus, Navigation } from 'lucide-react';

interface InteractiveMapProps {
  results: SearchResultItem[];
  selectedItem?: SearchResultItem;
  onSelectItem: (item: SearchResultItem) => void;
  selectedAnchor?: DemandAnchor;
  onLocateMe?: () => void;
}

export function InteractiveMap({
  results,
  selectedItem,
  onSelectItem,
  selectedAnchor,
  onLocateMe,
}: InteractiveMapProps) {
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [locationHint, setLocationHint] = useState<string | null>(null);

  const minLat = 13.055;
  const maxLat = 13.125;
  const minLng = 77.575;
  const maxLng = 77.625;

  const toX = (lng: number) => {
    return Math.max(10, Math.min(90, ((lng - minLng) / (maxLng - minLng)) * 100));
  };

  const toY = (lat: number) => {
    return Math.max(10, Math.min(90, (1 - (lat - minLat) / (maxLat - minLat)) * 100));
  };

  const anchorX = selectedAnchor ? toX(selectedAnchor.longitude) : 50;
  const anchorY = selectedAnchor ? toY(selectedAnchor.latitude) : 48;

  const handleCurrentLocation = () => {
    if (onLocateMe) {
      onLocateMe();
      setLocationHint('Centered on your selected Yelahanka zone');
      setTimeout(() => setLocationHint(null), 2500);
      return;
    }
    setZoomLevel(1);
    setLocationHint('Map zoom reset to Yelahanka view');
    setTimeout(() => setLocationHint(null), 2500);
  };

  return (
    <div className="relative w-full h-[580px] bg-[#f8fafc] dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-xs select-none">
      {/* Zoomable Map Canvas */}
      <div
        className="w-full h-full transition-transform duration-200 origin-center"
        style={{ transform: `scale(${zoomLevel})` }}
      >
        {/* Light / Dark Vector Map Background */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <rect width="100%" height="100%" className="fill-[#f8fafc] dark:fill-slate-900" />

          <path d="M 20 40 Q 60 20 90 60 Q 70 120 30 100 Z" className="fill-[#eafaf1] dark:fill-emerald-950/30" opacity="0.6" />
          <path d="M 500 100 Q 560 60 620 120 Q 580 200 480 180 Z" className="fill-[#eafaf1] dark:fill-emerald-950/30" opacity="0.6" />
          <path d="M 50 350 Q 150 300 200 450 Q 100 520 40 480 Z" className="fill-[#eafaf1] dark:fill-emerald-950/30" opacity="0.6" />

          {/* Major NH44 corridor */}
          <path d="M 460 -20 L 440 620" className="stroke-[#fef08a] dark:stroke-amber-900/50" strokeWidth="8" />
          <path d="M 460 -20 L 440 620" className="stroke-[#eab308] dark:stroke-amber-600/40" strokeWidth="2" opacity="0.4" />

          {/* Secondary roads */}
          <path d="M -20 220 C 180 230, 360 210, 650 240" className="stroke-white dark:stroke-slate-800" strokeWidth="7" />
          <path d="M -20 220 C 180 230, 360 210, 650 240" className="stroke-[#cbd5e1] dark:stroke-slate-700" strokeWidth="1.2" />

          <path d="M 120 -20 L 140 620" className="stroke-white dark:stroke-slate-800" strokeWidth="6" />
          <path d="M 120 -20 L 140 620" className="stroke-[#cbd5e1] dark:stroke-slate-700" strokeWidth="1" />

          <path d="M -20 380 L 650 390" className="stroke-white dark:stroke-slate-800" strokeWidth="6" />
          <path d="M -20 380 L 650 390" className="stroke-[#cbd5e1] dark:stroke-slate-700" strokeWidth="1" />

          {/* Yelahanka Lake */}
          <path
            d="M 380 240 C 420 230, 480 250, 490 280 C 500 310, 470 340, 440 345 C 410 350, 370 330, 360 290 C 350 260, 370 245, 380 240 Z"
            className="fill-[#bae6fd] dark:fill-sky-950/50 stroke-[#7dd3fc] dark:stroke-sky-800/80"
            strokeWidth="1.5"
          />
          <text
            x="425"
            y="295"
            className="fill-[#0284c7] dark:fill-sky-400"
            fontSize="11"
            fontFamily="system-ui, -apple-system, sans-serif"
            fontWeight="bold"
            textAnchor="middle"
            opacity="0.85"
          >
            Yelahanka Lake
          </text>

          <text x="110" y="265" className="fill-[#64748b] dark:fill-slate-500" fontSize="10" fontFamily="system-ui, sans-serif" fontWeight="bold" letterSpacing="0.05em">
            YELAHANKA
          </text>
          <text x="110" y="280" className="fill-[#64748b] dark:fill-slate-500" fontSize="10" fontFamily="system-ui, sans-serif" fontWeight="bold" letterSpacing="0.05em">
            NEW TOWN
          </text>

          <text x="530" y="310" className="fill-[#64748b] dark:fill-slate-500" fontSize="10" fontFamily="system-ui, sans-serif" fontWeight="bold" letterSpacing="0.05em">
            JUDICIAL
          </text>
          <text x="530" y="325" className="fill-[#64748b] dark:fill-slate-500" fontSize="10" fontFamily="system-ui, sans-serif" fontWeight="bold" letterSpacing="0.05em">
            LAYOUT
          </text>

          <text x="350" y="410" className="fill-[#64748b] dark:fill-slate-500" fontSize="11" fontFamily="system-ui, sans-serif" fontWeight="bold" letterSpacing="0.08em">
            YELAHANKA
          </text>
        </svg>

        {/* Active Search Center Radar Marker */}
        <div
          style={{ left: `${anchorX}%`, top: `${anchorY}%` }}
          className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        >
          <div className="relative flex items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-blue-500/15 animate-ping" />
            <div className="absolute w-6 h-6 rounded-full bg-blue-500/25" />
            <div className="absolute w-3 h-3 rounded-full bg-[#0A5CFF] ring-3 ring-white dark:ring-slate-900 shadow-xs" />
          </div>
        </div>

        {/* Parking Price Pins */}
        {results.slice(0, 15).map((item) => {
          const { listing } = item;
          const x = toX(listing.longitude);
          const y = toY(listing.latitude);
          const isSelected = selectedItem?.listing.id === listing.id;

          const isFree = listing.pricing.hourlyRate === 0;
          const priceLabel = isFree ? 'Free' : `₹${listing.pricing.hourlyRate}/hr`;

          const badgeBg =
            listing.category === 'COMMERCIAL'
              ? 'bg-[#0A5CFF]'
              : listing.category === 'PRIVATE'
              ? 'bg-purple-600'
              : 'bg-slate-700';

          return (
            <button
              key={listing.id}
              type="button"
              style={{ left: `${x}%`, top: `${y}%` }}
              onClick={() => onSelectItem(item)}
              aria-label={`${listing.title}, ${priceLabel}`}
              className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer z-20 group focus:outline-none"
            >
              <div
                className={`flex items-center gap-1.5 bg-[var(--surface-bg)] px-2 py-1 rounded-xs border font-mono text-xs transition-colors ${
                  isSelected
                    ? 'border-[var(--transit-accent)] ring-1 ring-[var(--transit-accent)] bg-[var(--surface-alt)] font-bold'
                    : 'border-[var(--hairline-strong)] hover:border-[var(--ink)]'
                }`}
              >
                <div
                  className={`w-3 h-3 rounded-none ${badgeBg} text-white font-mono font-bold text-[8px] flex items-center justify-center flex-shrink-0`}
                >
                  P
                </div>
                <span className="font-mono text-[11px] text-[var(--ink)] whitespace-nowrap">{priceLabel}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Location toast */}
      {locationHint && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-[var(--surface-bg)] border border-[var(--hairline-strong)] text-[var(--ink)] font-mono text-xs px-3 py-1.5 rounded-xs shadow-sm z-30 uppercase tracking-wider">
          {locationHint}
        </div>
      )}

      {/* Floating Bottom Summary Card */}
      <div className="absolute bottom-4 left-4 bg-[var(--surface-bg)] rounded-xs p-3 border border-[var(--hairline-strong)] flex items-center gap-3 z-30">
        <div className="w-7 h-7 rounded-none bg-[var(--transit-accent)] text-white font-mono font-bold text-[11px] flex items-center justify-center">
          P
        </div>
        <div>
          <h4 className="font-mono font-bold text-[var(--ink)] text-xs uppercase leading-tight tracking-tight">
            {selectedAnchor ? selectedAnchor.locality : 'Yelahanka Micro-Market'}
          </h4>
          <p className="text-[var(--ink-secondary)] font-mono text-[10px] mt-0.5">
            {results.length} {results.length === 1 ? 'BAY' : 'BAYS'} INDEXED · &lt;5 KM RADIUS
          </p>
        </div>
      </div>

      {/* Zoom & Location Controls */}
      <div className="absolute bottom-4 right-4 flex flex-col items-center gap-1.5 z-30">
        <div className="bg-[var(--surface-bg)] rounded-xs border border-[var(--hairline-strong)] flex flex-col divide-y divide-[var(--hairline)] overflow-hidden">
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.min(Number((z + 0.15).toFixed(2)), 1.6))}
            title="Zoom In"
            aria-label="Zoom In"
            className="w-7 h-7 flex items-center justify-center text-[var(--ink)] hover:bg-[var(--surface-alt)] transition-colors font-mono"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.max(Number((z - 0.15).toFixed(2)), 0.85))}
            title="Zoom Out"
            aria-label="Zoom Out"
            className="w-7 h-7 flex items-center justify-center text-[var(--ink)] hover:bg-[var(--surface-alt)] transition-colors font-mono"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
        </div>

        <button
          type="button"
          onClick={handleCurrentLocation}
          title="Center on current search zone"
          aria-label="Center map on current location"
          className="w-7 h-7 bg-[var(--surface-bg)] rounded-xs border border-[var(--hairline-strong)] flex items-center justify-center text-[var(--ink)] hover:bg-[var(--surface-alt)] hover:text-[var(--transit-accent)] transition-colors"
        >
          <Navigation className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
