'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Header } from '@/components/Header';
import { InteractiveMap } from '@/components/InteractiveMap';
import { ListingCard } from '@/components/ListingCard';
import { ListingDetailModal } from '@/components/ListingDetailModal';
import { DigitalPassModal } from '@/components/DigitalPassModal';
import { DisputeModal } from '@/components/DisputeModal';
import { ProviderHub } from '@/components/ProviderHub';
import { AdminConsole } from '@/components/AdminConsole';
import { MonthlyPassesView } from '@/components/MonthlyPassesView';
import { DpdpExportModal } from '@/components/DpdpExportModal';
import { AuthModal } from '@/components/AuthModal';
import { Language, getT } from '@/lib/i18n';
import {
  UserRole,
  SearchResultItem,
  Booking,
  User,
} from '@/types';
import { APP_CONFIG, YELAHANKA_ANCHORS, DemandAnchor } from '@/lib/constants';
import {
  Search,
  SlidersHorizontal,
  MapPin,
  Calendar,
  Clock,
  ChevronDown,
  Map as MapIcon,
  List,
  ShieldCheck,
  Building2,
  Car,
  Mail,
  Phone,
  ArrowRight,
  LocateFixed,
} from 'lucide-react';

export type VParkTab = 'search' | 'bookings' | 'monthly' | 'provider' | 'admin';

interface VParkAppProps {
  initialTab?: VParkTab;
  initialIntent?: 'driver' | 'provider';
}

export function VParkApp({
  initialTab = 'search',
  initialIntent = 'driver',
}: VParkAppProps) {
  const [currentRole, setCurrentRole] = useState<UserRole>(
    initialIntent === 'provider' ? 'PROVIDER' : 'DRIVER'
  );
  const [activeTab, setActiveTab] = useState<VParkTab>(initialTab);
  const [currentLang, setCurrentLang] = useState<Language>('en');
  const [showDpdpModal, setShowDpdpModal] = useState<boolean>(false);
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [authIntent, setAuthIntent] = useState<'driver' | 'provider'>(initialIntent);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');

  // Search & Filters
  const [selectedAnchor, setSelectedAnchor] = useState<DemandAnchor>(YELAHANKA_ANCHORS[0]);
  const [selectedDate, setSelectedDate] = useState<string>('Today');
  const [selectedTimeRange, setSelectedTimeRange] = useState<string>('2:00 PM – 6:00 PM');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('All');
  const [selectedPriceFilter, setSelectedPriceFilter] = useState<string>('All');
  const [selectedVehicleFilter, setSelectedVehicleFilter] = useState<string>('All');
  const [selectedCoveredFilter, setSelectedCoveredFilter] = useState<string>('All');
  const [selectedAvailabilityFilter, setSelectedAvailabilityFilter] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'Nearest' | 'Lowest Price' | 'Highest Rated'>('Nearest');

  // Data state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedResult, setSelectedResult] = useState<SearchResultItem | undefined>(undefined);
  const [bookingModalItem, setBookingModalItem] = useState<SearchResultItem | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [activePassBooking, setActivePassBooking] = useState<Booking | null>(null);
  const [disputeBooking, setDisputeBooking] = useState<Booking | null>(null);

  // Optional post-signup Email verification banner
  const [emailInput, setEmailInput] = useState<string>('');
  const [emailStatus, setEmailStatus] = useState<string | null>(null);

  const searchSectionRef = useRef<HTMLDivElement>(null);
  const howItWorksRef = useRef<HTMLElement>(null);

  const t = getT(currentLang);

  // Sync optional query string params client-side without requiring Suspense boundaries
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    const tabParam = sp.get('tab') as VParkTab | null;
    if (tabParam && ['search', 'bookings', 'monthly', 'provider', 'admin'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
    const intentParam = sp.get('intent');
    if (intentParam === 'provider' || intentParam === 'driver') {
      setAuthIntent(intentParam);
      if (intentParam === 'provider' && !tabParam) setActiveTab('provider');
    }
  }, []);

  const fetchInitialData = async () => {
    try {
      const [userRes, bookingsRes] = await Promise.all([
        fetch('/api/auth/me'),
        fetch('/api/bookings'),
      ]);
      const userData = await userRes.json();
      const bookingsData = await bookingsRes.json();

      if (userData.success) {
        setCurrentUser(userData.user);
        if (userData.user?.activeRole) {
          setCurrentRole(userData.user.activeRole);
        }
      }
      if (bookingsData.success) {
        setBookings(bookingsData.data || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchListings = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('lat', selectedAnchor.latitude.toString());
      params.set('lng', selectedAnchor.longitude.toString());
      params.set('radius', '5');

      if (selectedCategoryFilter === 'Private') params.set('category', 'PRIVATE');
      else if (selectedCategoryFilter === 'Commercial') params.set('category', 'COMMERCIAL');
      else if (selectedCategoryFilter === 'Public') params.set('category', 'PUBLIC');

      if (selectedPriceFilter === 'Under ₹40') params.set('maxPrice', '40');
      else if (selectedPriceFilter === 'Under ₹60') params.set('maxPrice', '60');

      if (selectedVehicleFilter !== 'All') {
        const vtMap: Record<string, string> = {
          Sedan: 'SEDAN',
          SUV: 'SUV',
          EV: 'EV',
          '2-Wheeler': 'TWO_WHEELER',
        };
        if (vtMap[selectedVehicleFilter]) params.set('vehicleType', vtMap[selectedVehicleFilter]);
      }

      if (selectedCoveredFilter === 'Covered') params.set('isCovered', 'true');
      else if (selectedCoveredFilter === 'Open') params.set('isCovered', 'false');

      if (selectedAvailabilityFilter === 'Instant') params.set('bookableNow', 'true');

      if (sortBy === 'Lowest Price') params.set('sortBy', 'PRICE_LOW');
      else if (sortBy === 'Nearest') params.set('sortBy', 'DISTANCE_NEAR');
      else if (sortBy === 'Highest Rated') params.set('sortBy', 'RATING_HIGH');

      const res = await fetch(`/api/search?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setResults(data.data);
        if (data.data.length > 0) {
          setSelectedResult((prev) =>
            prev && data.data.some((d: SearchResultItem) => d.listing.id === prev.listing.id)
              ? prev
              : data.data[0]
          );
        } else {
          setSelectedResult(undefined);
        }
      }
    } catch (err) {
      console.error('Failed to load listings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (activeTab === 'search') {
      fetchListings();
    }
  }, [
    activeTab,
    selectedAnchor,
    selectedCategoryFilter,
    selectedPriceFilter,
    selectedVehicleFilter,
    selectedCoveredFilter,
    selectedAvailabilityFilter,
    sortBy,
  ]);

  const openLoginModal = (intent: 'driver' | 'provider' = 'driver') => {
    setAuthIntent(intent);
    setAuthModalOpen(true);
  };

  const handleAuthenticated = (user: User) => {
    setAuthModalOpen(false);
    setCurrentUser(user);
    setCurrentRole(user.activeRole);
    fetchInitialData();
    if (authIntent === 'provider' && user.roles.includes('PROVIDER')) {
      setActiveTab('provider');
    } else if (user.activeRole === 'ADMIN') {
      setActiveTab('admin');
    } else if (user.activeRole === 'PROVIDER' && initialTab === 'provider') {
      setActiveTab('provider');
    }
  };

  const handleRoleChange = async (role: UserRole) => {
    const res = await fetch('/api/auth/role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'SWITCH_MODE', role }),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      setCurrentRole(role);
      setCurrentUser(data.user);
      fetchInitialData();
    }
  };

  const handleAddCapability = async (role: 'DRIVER' | 'PROVIDER') => {
    if (!currentUser) {
      openLoginModal(role === 'PROVIDER' ? 'provider' : 'driver');
      return;
    }
    const res = await fetch('/api/auth/role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ADD_CAPABILITY', role }),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      setCurrentUser(data.user);
      setCurrentRole(role);
      fetchInitialData();
    }
  };

  const handleSwitchDemoPersona = async (role: UserRole) => {
    const res = await fetch('/api/auth/role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'SWITCH_DEMO_PERSONA', role, switchDemoUser: true }),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      setCurrentUser(data.user);
      setCurrentRole(role);
      fetchInitialData();
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setCurrentUser(null);
    setCurrentRole('DRIVER');
    setBookings([]);
    setActiveTab('search');
  };

  const handleSaveOptionalEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailStatus(null);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCurrentUser(data.user);
        setEmailInput('');
        setEmailStatus('Email verified and saved.');
      } else {
        setEmailStatus(data.error || 'Enter a valid email address.');
      }
    } catch {
      setEmailStatus('Could not save email.');
    }
  };

  const resetFilters = () => {
    setSelectedCategoryFilter('All');
    setSelectedPriceFilter('All');
    setSelectedVehicleFilter('All');
    setSelectedCoveredFilter('All');
    setSelectedAvailabilityFilter('All');
    setSortBy('Nearest');
  };

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-colors">
      <Header
        currentUser={currentUser}
        currentRole={currentRole}
        onRoleChange={handleRoleChange}
        onAddCapability={handleAddCapability}
        onSwitchDemoPersona={handleSwitchDemoPersona}
        onOpenLogin={openLoginModal}
        onLogout={handleLogout}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenDpdp={() => setShowDpdpModal(true)}
        onScrollHowItWorks={() =>
          howItWorksRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
        currentLang={currentLang}
        onLangChange={setCurrentLang}
        bookingsCount={bookings.length}
      />

      <main className="flex-1">
        {activeTab === 'search' && (
          <div>
            {/* Signed-in Driver Welcome & Optional Email Banner (PRD 6.2 & 8.1) */}
            {currentUser && (
              <div className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-700/80 px-4 sm:px-6 lg:px-8 py-2.5 text-xs">
                <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="text-slate-700 dark:text-slate-300">
                    <span className="font-bold text-slate-900 dark:text-white">
                      Welcome, {currentUser.name || currentUser.phone}
                    </span>
                    <span className="text-slate-500 dark:text-slate-400 ml-2">Where would you like to park today?</span>
                  </div>

                  {!currentUser.email && (
                    <form onSubmit={handleSaveOptionalEmail} className="flex items-center gap-2">
                      <input
                        type="email"
                        aria-label="Add email for receipts and payouts"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        placeholder="Add email for receipts & payouts"
                        className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-xs w-56"
                      />
                      <button
                        type="submit"
                        className="px-3 py-1.5 rounded-lg bg-[#0A5CFF] text-white font-bold text-xs"
                      >
                        Verify Email
                      </button>
                    </form>
                  )}
                  {emailStatus && <span className="text-emerald-700 dark:text-emerald-400 font-semibold">{emailStatus}</span>}
                </div>
              </div>
            )}

            {/* SWISS TRANSIT SEARCH TERMINAL */}
            <div
              id="vpark-search"
              ref={searchSectionRef}
              className="w-full bg-[var(--surface-bg)] border-b border-[var(--hairline)] py-8 sm:py-10 px-4 sm:px-6 lg:px-8"
            >
              <div className="max-w-7xl mx-auto space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                  <div>
                    <div className="font-mono text-[10px] tracking-widest uppercase text-[var(--transit-accent)] flex items-center gap-1.5 mb-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--transit-accent)]" />
                      Municipal Pilot Dispatch · Sector 01 (Yelahanka)
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight uppercase text-[var(--ink)] leading-none">
                      Find Verified Parking Bays
                    </h1>
                  </div>
                  <div className="font-mono text-[11px] text-[var(--ink-tertiary)] flex items-center gap-2">
                    <span>SECTOR 01</span>
                    <span>·</span>
                    <span>13.1007°N, 77.5963°E</span>
                  </div>
                </div>

                {/* High-Density Unified Search Terminal */}
                <div className="border border-[var(--hairline-strong)] bg-[var(--surface-bg)] grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-[var(--hairline-strong)]">
                  <div className="md:col-span-4 p-3 flex flex-col justify-center">
                    <label className="font-mono text-[9px] uppercase tracking-wider text-[var(--ink-tertiary)] block mb-1">
                      01 / Destination Anchor
                    </label>
                    <select
                      aria-label="Destination location in Yelahanka"
                      value={selectedAnchor.id}
                      onChange={(e) => {
                        const a = YELAHANKA_ANCHORS.find((item) => item.id === e.target.value);
                        if (a) setSelectedAnchor(a);
                      }}
                      className="w-full bg-transparent font-bold text-xs uppercase text-[var(--ink)] focus:outline-none cursor-pointer truncate"
                    >
                      {YELAHANKA_ANCHORS.map((anchor) => (
                        <option key={anchor.id} value={anchor.id} className="dark:bg-slate-900">
                          {anchor.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-3 p-3 flex flex-col justify-center">
                    <label className="font-mono text-[9px] uppercase tracking-wider text-[var(--ink-tertiary)] block mb-1">
                      02 / Reservation Date
                    </label>
                    <select
                      aria-label="Select parking date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="w-full bg-transparent font-bold text-xs uppercase text-[var(--ink)] focus:outline-none cursor-pointer"
                    >
                      <option value="Today" className="dark:bg-slate-900">Today</option>
                      <option value="Tomorrow" className="dark:bg-slate-900">Tomorrow</option>
                      <option value="This Weekend" className="dark:bg-slate-900">This Weekend</option>
                    </select>
                  </div>

                  <div className="md:col-span-3 p-3 flex flex-col justify-center">
                    <label className="font-mono text-[9px] uppercase tracking-wider text-[var(--ink-tertiary)] block mb-1">
                      03 / Time Window
                    </label>
                    <select
                      aria-label="Select parking time range"
                      value={selectedTimeRange}
                      onChange={(e) => setSelectedTimeRange(e.target.value)}
                      className="w-full bg-transparent font-bold text-xs uppercase text-[var(--ink)] focus:outline-none cursor-pointer"
                    >
                      <option value="2:00 PM – 6:00 PM" className="dark:bg-slate-900">14:00 – 18:00 (Standard)</option>
                      <option value="9:00 AM – 1:00 PM" className="dark:bg-slate-900">09:00 – 13:00 (Morning)</option>
                      <option value="6:00 PM – 10:00 PM" className="dark:bg-slate-900">18:00 – 22:00 (Evening)</option>
                      <option value="All Day (24 hrs)" className="dark:bg-slate-900">24-Hour Pass</option>
                    </select>
                  </div>

                  <div className="md:col-span-2 p-2 flex items-center justify-stretch">
                    <button
                      type="button"
                      onClick={fetchListings}
                      className="w-full h-full py-2.5 px-4 bg-[var(--transit-accent)] hover:bg-[var(--transit-accent-hover)] text-white font-mono text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors rounded-none"
                    >
                      <span>Search</span>
                      <span>→</span>
                    </button>
                  </div>
                </div>

                {/* Secondary Telemetry Strip */}
                <div className="flex flex-wrap items-center justify-between gap-3 font-mono text-[11px] text-[var(--ink-secondary)] pt-1">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedAnchor(YELAHANKA_ANCHORS[0])}
                      className="hover:text-[var(--transit-accent)] flex items-center gap-1 uppercase underline underline-offset-4"
                    >
                      <LocateFixed className="w-3 h-3 text-[var(--transit-accent)]" />
                      Current Location ({selectedAnchor.locality})
                    </button>
                    <span>·</span>
                    <span>15-MIN ARRIVAL BUFFER INCLUDED</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (!currentUser) openLoginModal('provider');
                      else if (!currentUser.roles.includes('PROVIDER')) handleAddCapability('PROVIDER').then(() => setActiveTab('provider'));
                      else setActiveTab('provider');
                    }}
                    className="hover:text-[var(--transit-accent)] uppercase underline underline-offset-4"
                  >
                    Host unused driveway or space →
                  </button>
                </div>
              </div>
            </div>

            {/* FILTER STRIP & VIEW SWITCHER */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 border-b border-[var(--hairline)] flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={resetFilters}
                  className="px-2.5 py-1 border border-[var(--hairline-strong)] hover:bg-[var(--surface-alt)] uppercase text-[11px] text-[var(--ink-secondary)] flex items-center gap-1 transition-colors"
                >
                  <SlidersHorizontal className="w-3 h-3" />
                  Reset
                </button>

                <select
                  aria-label="Filter by space type"
                  value={selectedCategoryFilter}
                  onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                  className="bg-[var(--surface-bg)] border border-[var(--hairline)] hover:border-[var(--hairline-strong)] px-2.5 py-1 text-[11px] uppercase text-[var(--ink)] focus:outline-none cursor-pointer"
                >
                  <option value="All" className="dark:bg-slate-900">Type: All</option>
                  <option value="Commercial" className="dark:bg-slate-900">Type: Commercial</option>
                  <option value="Private" className="dark:bg-slate-900">Type: Residential</option>
                  <option value="Public" className="dark:bg-slate-900">Type: Public</option>
                </select>

                <select
                  aria-label="Filter by hourly price"
                  value={selectedPriceFilter}
                  onChange={(e) => setSelectedPriceFilter(e.target.value)}
                  className="bg-[var(--surface-bg)] border border-[var(--hairline)] hover:border-[var(--hairline-strong)] px-2.5 py-1 text-[11px] uppercase text-[var(--ink)] focus:outline-none cursor-pointer"
                >
                  <option value="All" className="dark:bg-slate-900">Rate: All</option>
                  <option value="Under ₹40" className="dark:bg-slate-900">Rate: &lt;₹40/hr</option>
                  <option value="Under ₹60" className="dark:bg-slate-900">Rate: &lt;₹60/hr</option>
                </select>

                <select
                  aria-label="Filter by vehicle size"
                  value={selectedVehicleFilter}
                  onChange={(e) => setSelectedVehicleFilter(e.target.value)}
                  className="bg-[var(--surface-bg)] border border-[var(--hairline)] hover:border-[var(--hairline-strong)] px-2.5 py-1 text-[11px] uppercase text-[var(--ink)] focus:outline-none cursor-pointer"
                >
                  <option value="All" className="dark:bg-slate-900">Vehicle: Any</option>
                  <option value="Sedan" className="dark:bg-slate-900">Vehicle: Sedan</option>
                  <option value="SUV" className="dark:bg-slate-900">Vehicle: SUV</option>
                  <option value="EV" className="dark:bg-slate-900">Vehicle: EV Ready</option>
                  <option value="2-Wheeler" className="dark:bg-slate-900">Vehicle: 2-Wheeler</option>
                </select>

                <select
                  aria-label="Filter by covered or open"
                  value={selectedCoveredFilter}
                  onChange={(e) => setSelectedCoveredFilter(e.target.value)}
                  className="bg-[var(--surface-bg)] border border-[var(--hairline)] hover:border-[var(--hairline-strong)] px-2.5 py-1 text-[11px] uppercase text-[var(--ink)] focus:outline-none cursor-pointer"
                >
                  <option value="All" className="dark:bg-slate-900">Cover: Any</option>
                  <option value="Covered" className="dark:bg-slate-900">Cover: Basement/Covered</option>
                  <option value="Open" className="dark:bg-slate-900">Cover: Open Surface</option>
                </select>
              </div>

              <div className="flex items-center border border-[var(--hairline-strong)]">
                <button
                  type="button"
                  onClick={() => setViewMode('map')}
                  className={`px-3 py-1 text-[11px] uppercase tracking-wider font-mono transition-colors ${
                    viewMode === 'map' ? 'bg-[var(--ink)] text-[var(--surface-bg)] font-bold' : 'text-[var(--ink-secondary)] hover:bg-[var(--surface-alt)]'
                  }`}
                >
                  Map View
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-1 text-[11px] uppercase tracking-wider font-mono transition-colors border-l border-[var(--hairline-strong)] ${
                    viewMode === 'list' ? 'bg-[var(--ink)] text-[var(--surface-bg)] font-bold' : 'text-[var(--ink-secondary)] hover:bg-[var(--surface-alt)]'
                  }`}
                >
                  List View
                </button>
              </div>
            </div>

            {/* MAIN CONTENT SPLIT: Cards + Interactive Map */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
              <div className="flex items-baseline justify-between pb-3 border-b border-[var(--hairline)] mb-4">
                <h2 className="text-xs font-mono font-bold text-[var(--ink)] tracking-wider uppercase">
                  Index // {results.length} {results.length === 1 ? 'Bay' : 'Bays'} Available Near{' '}
                  <span className="text-[var(--transit-accent)]">{selectedAnchor.locality}</span>
                </h2>

                <div className="flex items-center gap-1.5 font-mono text-[11px] text-[var(--ink-secondary)]">
                  <label htmlFor="sort-by-select" className="uppercase">Sort:</label>
                  <select
                    id="sort-by-select"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'Nearest' | 'Lowest Price' | 'Highest Rated')}
                    className="font-bold text-[var(--ink)] uppercase bg-transparent focus:outline-none cursor-pointer"
                  >
                    <option value="Nearest" className="dark:bg-slate-900">Nearest Distance</option>
                    <option value="Lowest Price" className="dark:bg-slate-900">Lowest Hourly Rate</option>
                    <option value="Highest Rated" className="dark:bg-slate-900">Highest Host Rating</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                <div className={`${viewMode === 'list' ? 'lg:col-span-12' : 'lg:col-span-6'} space-y-2.5`}>
                  {loading ? (
                    <div className="p-12 text-center font-mono text-xs text-[var(--ink-secondary)] uppercase tracking-wider">
                      Querying Yelahanka Sector 01 Registry...
                    </div>
                  ) : results.length === 0 ? (
                    <div className="p-8 text-center bg-[var(--surface-bg)] border border-[var(--hairline-strong)] text-[var(--ink-secondary)] font-mono text-xs space-y-2">
                      <p className="font-bold uppercase text-[var(--ink)]">No verified bays match filter parameters.</p>
                      <button
                        type="button"
                        onClick={resetFilters}
                        className="px-3.5 py-1.5 bg-[var(--surface-alt)] border border-[var(--hairline-strong)] text-[var(--ink)] uppercase font-semibold text-[11px]"
                      >
                        Reset All Filters
                      </button>
                    </div>
                  ) : (
                    results.slice(0, viewMode === 'list' ? 24 : 6).map((item) => (
                      <ListingCard
                        key={item.listing.id}
                        item={item}
                        isSelected={selectedResult?.listing.id === item.listing.id}
                        onSelect={() => setSelectedResult(item)}
                        onBook={() => setBookingModalItem(item)}
                      />
                    ))
                  )}
                </div>

                {viewMode === 'map' && (
                  <div className="lg:col-span-6 sticky top-20">
                    <InteractiveMap
                      results={results}
                      selectedItem={selectedResult}
                      onSelectItem={(item) => setSelectedResult(item)}
                      selectedAnchor={selectedAnchor}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* BELOW THE FOLD: Municipal Operating Protocols */}
            <section ref={howItWorksRef} id="how-it-works" className="bg-[var(--surface-bg)] border-t border-[var(--hairline)] py-12 px-4 sm:px-6 lg:px-8">
              <div className="max-w-7xl mx-auto space-y-8">
                <div className="border-b border-[var(--hairline)] pb-3">
                  <span className="font-mono text-[10px] tracking-widest uppercase text-[var(--ink-tertiary)] block">
                    Operating Manual · PRD Foundation Release
                  </span>
                  <h2 className="text-xl font-bold tracking-tight uppercase text-[var(--ink)] mt-0.5">
                    Municipal Network Protocols
                  </h2>
                </div>

                {/* Two-Column Asymmetric Protocol Matrix */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-[var(--hairline)] border border-[var(--hairline)]">
                  {/* Protocol A: Driver */}
                  <div className="bg-[var(--surface-bg)] p-6 space-y-5 flex flex-col justify-between">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between font-mono text-[11px] text-[var(--ink-tertiary)] uppercase">
                        <span>Protocol 01 // Driver</span>
                        <span>Direct Bay Access</span>
                      </div>
                      <h3 className="text-base font-bold uppercase tracking-tight text-[var(--ink)]">
                        Locate, Hold &amp; Park With Digital Pass
                      </h3>
                      <ol className="space-y-3 font-mono text-xs text-[var(--ink-secondary)]">
                        <li className="flex items-start gap-2.5">
                          <span className="font-bold text-[var(--ink)]">01/</span>
                          <span><strong>Filter by vehicle &amp; coverage:</strong> Select destination landmark, vehicle dimensions, and basement/open preference.</span>
                        </li>
                        <li className="flex items-start gap-2.5">
                          <span className="font-bold text-[var(--ink)]">02/</span>
                          <span><strong>10-minute slot lock:</strong> Authenticate with +91 OTP. The bay locks exclusively to prevent concurrent double-booking.</span>
                        </li>
                        <li className="flex items-start gap-2.5">
                          <span className="font-bold text-[var(--ink)]">03/</span>
                          <span><strong>Digital pass check-in:</strong> Gate codes and host relay number unlock on confirmation, with 15-min arrival grace.</span>
                        </li>
                      </ol>
                    </div>

                    <button
                      type="button"
                      onClick={() => searchSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}
                      className="w-full py-2.5 bg-[var(--surface-alt)] hover:bg-[var(--surface-bg)] border border-[var(--hairline-strong)] text-[var(--ink)] font-mono text-xs uppercase tracking-wider transition-colors"
                    >
                      Browse Available Bays →
                    </button>
                  </div>

                  {/* Protocol B: Host */}
                  <div className="bg-[var(--surface-bg)] p-6 space-y-5 flex flex-col justify-between">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between font-mono text-[11px] text-[var(--ink-tertiary)] uppercase">
                        <span>Protocol 02 // Space Owner</span>
                        <span>Driveway Dispatch</span>
                      </div>
                      <h3 className="text-base font-bold uppercase tracking-tight text-[var(--ink)]">
                        List Unused Bay With Proof of Right-to-Rent
                      </h3>
                      <ol className="space-y-3 font-mono text-xs text-[var(--ink-secondary)]">
                        <li className="flex items-start gap-2.5">
                          <span className="font-bold text-[var(--ink)]">01/</span>
                          <span><strong>GPS Pin &amp; Rate Setting:</strong> Mark physical bay location, assign hourly or monthly rates, and specify vehicle clearance.</span>
                        </li>
                        <li className="flex items-start gap-2.5">
                          <span className="font-bold text-[var(--ink)]">02/</span>
                          <span><strong>Deed Verification:</strong> Upload municipal tax receipt, landlord consent, or society NOC to our encrypted DPDP vault.</span>
                        </li>
                        <li className="flex items-start gap-2.5">
                          <span className="font-bold text-[var(--ink)]">03/</span>
                          <span><strong>Go live after audit:</strong> Start accepting reservations with monthly automated payouts in exact paise.</span>
                        </li>
                      </ol>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (!currentUser) openLoginModal('provider');
                        else if (!currentUser.roles.includes('PROVIDER')) handleAddCapability('PROVIDER').then(() => setActiveTab('provider'));
                        else setActiveTab('provider');
                      }}
                      className="w-full py-2.5 bg-[var(--transit-accent)] hover:bg-[var(--transit-accent-hover)] text-white font-mono text-xs uppercase tracking-wider transition-colors"
                    >
                      Register Driveway / Commercial Space →
                    </button>
                  </div>
                </div>

                {/* Audit & Trust Verification Footer Line */}
                <div className="p-3.5 bg-[var(--surface-alt)] border border-[var(--hairline)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono text-[11px] text-[var(--ink-secondary)]">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[var(--transit-accent)] flex-shrink-0" />
                    <span className="font-bold text-[var(--ink)] uppercase">Trust &amp; Safety Gate:</span>
                    <span>All listings inspected before inclusion in public dispatch registry.</span>
                  </div>
                  <span className="text-[var(--ink-tertiary)]">DPDP ACT 2023 COMPLIANT</span>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* TAB 2: Driver Bookings */}
        {activeTab === 'bookings' && (
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-5 font-mono">
            <div className="border-b border-[var(--hairline)] pb-2 flex items-baseline justify-between">
              <h1 className="text-base font-bold uppercase tracking-tight text-[var(--ink)]">
                Active Parking Sessions &amp; Digital Passes
              </h1>
              <span className="text-xs text-[var(--ink-tertiary)]">{bookings.length} TOTAL SESSIONS</span>
            </div>

            {!currentUser ? (
              <div className="p-8 text-center bg-[var(--surface-bg)] border border-[var(--hairline-strong)] space-y-3 text-xs">
                <p className="font-bold uppercase text-[var(--ink)]">Authentication Required</p>
                <p className="text-[var(--ink-secondary)]">Sign in with primary mobile OTP to retrieve passes and billing ledger.</p>
                <button
                  type="button"
                  onClick={() => openLoginModal('driver')}
                  className="px-4 py-2 bg-[var(--transit-accent)] hover:bg-[var(--transit-accent-hover)] text-white font-mono uppercase tracking-wider transition-colors"
                >
                  Authenticate via OTP
                </button>
              </div>
            ) : bookings.length === 0 ? (
              <div className="p-8 text-center bg-[var(--surface-bg)] border border-[var(--hairline-strong)] text-[var(--ink-secondary)] text-xs space-y-1">
                <p className="font-bold uppercase text-[var(--ink)]">No Active Reservations</p>
                <p className="text-[var(--ink-tertiary)]">Search verified bays in Yelahanka to hold a slot and receive your digital pass.</p>
              </div>
            ) : (
              bookings.map((booking) => (
                <div
                  key={booking.id}
                  onClick={() => setActivePassBooking(booking)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setActivePassBooking(booking);
                    }
                  }}
                  className="p-4 bg-[var(--surface-bg)] border border-[var(--hairline)] hover:border-[var(--hairline-strong)] cursor-pointer flex justify-between items-center text-xs transition-colors"
                >
                  <div className="space-y-0.5">
                    <span className="font-mono font-bold text-[var(--transit-accent)] text-[11px] uppercase tracking-wider">
                      PASS // {booking.referenceNumber}
                    </span>
                    <h3 className="font-bold text-sm text-[var(--ink)] uppercase">{booking.listingTitle}</h3>
                    <p className="text-[var(--ink-secondary)] text-xs">{booking.listingAddress}</p>
                  </div>
                  <div className="text-right font-mono">
                    <span className="text-sm font-bold text-[var(--ink)]">₹{booking.pricingSnapshot.totalAmount}</span>
                    <span className="block text-[var(--transit-accent)] font-semibold text-[11px] uppercase tracking-wider mt-0.5">
                      Open Pass →
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'monthly' && (
          <MonthlyPassesView onRequireAuth={() => openLoginModal('driver')} />
        )}

        {activeTab === 'provider' && (
          <ProviderHub
            currentUser={currentUser}
            onRequireAuth={() => openLoginModal('provider')}
            onEnableProvider={() => handleAddCapability('PROVIDER')}
          />
        )}

        {activeTab === 'admin' && <AdminConsole />}
      </main>

      {/* Clean Footer */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-5 px-4 sm:px-6 lg:px-8 text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <span>
            © {new Date().getFullYear()} {APP_CONFIG.appName} Technologies · Yelahanka Pilot, Bengaluru
          </span>

          <div className="flex flex-wrap items-center gap-4 font-medium text-xs">
            <a href="/login" className="text-slate-600 dark:text-slate-400 hover:text-[#0A5CFF] dark:hover:text-blue-400 transition-colors">Sign in</a>
            <a href="/driver/home" className="text-slate-600 dark:text-slate-400 hover:text-[#0A5CFF] dark:hover:text-blue-400 transition-colors">Driver Home</a>
            <a href="/owner/dashboard" className="text-slate-600 dark:text-slate-400 hover:text-[#0A5CFF] dark:hover:text-blue-400 transition-colors">Host Dashboard</a>
            <button
              type="button"
              onClick={() => setShowDpdpModal(true)}
              className="text-slate-600 dark:text-slate-400 hover:text-[#0A5CFF] dark:hover:text-blue-400 transition-colors"
            >
              DPDP Privacy &amp; Rights
            </button>
          </div>
        </div>
      </footer>

      {/* Modals */}
      {authModalOpen && (
        <AuthModal
          initialIntent={authIntent}
          onAuthenticated={handleAuthenticated}
          onClose={() => setAuthModalOpen(false)}
        />
      )}

      {bookingModalItem && (
        <ListingDetailModal
          item={bookingModalItem}
          userVehicles={currentUser?.vehicles || []}
          isAuthenticated={Boolean(currentUser)}
          onRequireAuth={() => {
            setBookingModalItem(null);
            openLoginModal('driver');
          }}
          onClose={() => setBookingModalItem(null)}
          onBookingSuccess={() => {
            setBookingModalItem(null);
            fetchInitialData();
            setActiveTab('bookings');
          }}
        />
      )}

      {activePassBooking && (
        <DigitalPassModal
          booking={activePassBooking}
          onClose={() => setActivePassBooking(null)}
          onRefresh={() => {
            fetchInitialData();
            fetch(`/api/bookings/${activePassBooking.id}`)
              .then((r) => r.json())
              .then((d) => {
                if (d.success) setActivePassBooking(d.booking);
              });
          }}
          onOpenDispute={(b) => setDisputeBooking(b)}
        />
      )}

      {disputeBooking && (
        <DisputeModal
          booking={disputeBooking}
          onClose={() => setDisputeBooking(null)}
          onDisputeCreated={() => {
            setDisputeBooking(null);
            fetchInitialData();
          }}
        />
      )}

      {showDpdpModal && (
        <DpdpExportModal
          onClose={() => setShowDpdpModal(false)}
          onDeleted={() => {
            setShowDpdpModal(false);
            handleLogout();
          }}
        />
      )}
    </div>
  );
}

