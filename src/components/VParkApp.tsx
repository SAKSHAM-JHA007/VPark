'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Header } from '@/components/Header';
import { HowItWorks } from '@/components/HowItWorks';
import { ListingCard } from '@/components/ListingCard';
import { ListingDetailModal } from '@/components/ListingDetailModal';
import { DigitalPassModal } from '@/components/DigitalPassModal';
import { DisputeModal } from '@/components/DisputeModal';
import { ProviderHub } from '@/components/ProviderHub';
import { AdminConsole } from '@/components/AdminConsole';
import { MonthlyPassesView } from '@/components/MonthlyPassesView';
import { DpdpExportModal } from '@/components/DpdpExportModal';
import { AuthModal } from '@/components/AuthModal';
import { Presence } from '@/components/motion/Presence';
import { ListingCardSkeleton } from '@/components/motion/Skeleton';
import { staggerStyle } from '@/components/motion/tokens';
import { Language, getT } from '@/lib/i18n';
import {
  UserRole,
  SearchResultItem,
  Booking,
  User,
} from '@/types';
import { APP_CONFIG, YELAHANKA_ANCHORS, DemandAnchor } from '@/lib/constants';
import { signOutFirebase } from '@/lib/firebase';
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
  Store,
  Mail,
  Phone,
  ArrowRight,
  LocateFixed,
  Lock,
  Navigation,
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

  // Tab content fades in only after the user (or a URL param) switches tabs,
  // never on the initial page render.
  const initialTabRef = useRef<VParkTab>(activeTab);
  const tabSwitchedRef = useRef(false);
  if (activeTab !== initialTabRef.current) tabSwitchedRef.current = true;
  const tabEnterClass = tabSwitchedRef.current ? 'animate-fade-in' : '';

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

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    await signOutFirebase();
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
        setEmailStatus('Email saved.');
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
    <div className="min-h-screen flex flex-col bg-canvas text-ink transition-colors">
      <Header
        currentUser={currentUser}
        currentRole={currentRole}
        onRoleChange={handleRoleChange}
        onAddCapability={handleAddCapability}
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
          <div className={tabEnterClass}>
            {/* Signed-in Driver Welcome & Optional Email Banner (PRD 6.2 & 8.1) */}
            {currentUser && (
              <div className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-700/80 px-4 sm:px-6 lg:px-8 py-2.5 text-xs animate-fade-in">
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
                        className="px-3 py-1.5 rounded-lg bg-[#0A5CFF] hover:bg-[#0047d4] text-white font-bold text-xs transition-[background-color,transform] duration-150 active:scale-[0.96]"
                      >
                        Verify Email
                      </button>
                    </form>
                  )}
                  {emailStatus && (
                    <span key={emailStatus} role="status" className="text-emerald-700 dark:text-emerald-400 font-semibold animate-fade-in">
                      {emailStatus}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* PLAN YOUR PARKING SEARCH CONSOLE */}
            <div
              id="vpark-search"
              ref={searchSectionRef}
              className="w-full bg-[var(--canvas-bg)] border-b border-[var(--hairline)] py-6 sm:py-8 px-4 sm:px-6 lg:px-8"
            >
              <div className="max-w-7xl mx-auto space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ink)] leading-none animate-fade-up">
                      Plan your parking
                    </h1>
                    <p className="text-xs sm:text-sm text-[var(--ink-secondary)] mt-1.5">
                      Find reviewed parking spaces near landmarks in the Yelahanka pilot area.
                    </p>
                  </div>
                </div>

                {/* Unified Rounded Search Card */}
                <div className="bg-[var(--surface-bg)] rounded-card border border-[var(--hairline)] p-4 sm:p-5 shadow-card space-y-4 animate-fade-up [animation-delay:80ms]">
                  {/* Mode Tabs */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('search')}
                      className="px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 bg-blue-50 text-[#0A5CFF] dark:bg-blue-950/60 dark:text-blue-400"
                    >
                      <Car className="w-3.5 h-3.5" />
                      <span>Find Parking</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!currentUser) openLoginModal('provider');
                        else setActiveTab('provider');
                      }}
                      className="px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 text-[var(--ink-secondary)] hover:text-[var(--ink)] transition-colors"
                    >
                      <Store className="w-3.5 h-3.5" />
                      <span>Rent Your Space</span>
                    </button>
                  </div>

                  {/* Horizontal Inputs Bar */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                    {/* Location */}
                    <div className="md:col-span-4 p-3 rounded-control bg-[var(--surface-alt)] border border-[var(--hairline)] flex items-center gap-3 transition-[border-color,box-shadow] duration-200 hover:border-[var(--hairline-strong)] focus-within:border-[var(--transit-accent)] focus-within:shadow-[0_0_0_3px_rgba(10,92,255,0.12)]">
                      <MapPin className="w-4 h-4 text-[#0A5CFF] flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="block text-[9px] font-bold uppercase tracking-wider text-[var(--ink-tertiary)]">
                          Location
                        </span>
                        <select
                          aria-label="Destination location in Yelahanka"
                          value={selectedAnchor.id}
                          onChange={(e) => {
                            const a = YELAHANKA_ANCHORS.find((item) => item.id === e.target.value);
                            if (a) setSelectedAnchor(a);
                          }}
                          className="w-full appearance-none bg-transparent font-bold text-xs text-[var(--ink)] focus:outline-none cursor-pointer truncate"
                        >
                          {YELAHANKA_ANCHORS.map((anchor) => (
                            <option key={anchor.id} value={anchor.id} className="dark:bg-slate-900">
                              {anchor.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <ChevronDown className="w-3.5 h-3.5 text-[var(--ink-tertiary)]" />
                    </div>

                    {/* Date */}
                    <div className="md:col-span-3 p-3 rounded-control bg-[var(--surface-alt)] border border-[var(--hairline)] flex items-center gap-3 transition-[border-color,box-shadow] duration-200 hover:border-[var(--hairline-strong)] focus-within:border-[var(--transit-accent)] focus-within:shadow-[0_0_0_3px_rgba(10,92,255,0.12)]">
                      <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="block text-[9px] font-bold uppercase tracking-wider text-[var(--ink-tertiary)]">
                          Date
                        </span>
                        <select
                          aria-label="Select parking date"
                          value={selectedDate}
                          onChange={(e) => setSelectedDate(e.target.value)}
                          className="w-full appearance-none bg-transparent font-bold text-xs text-[var(--ink)] focus:outline-none cursor-pointer truncate"
                        >
                          <option value="Today" className="dark:bg-slate-900">Today</option>
                          <option value="Tomorrow" className="dark:bg-slate-900">Tomorrow</option>
                          <option value="This Weekend" className="dark:bg-slate-900">This Weekend</option>
                        </select>
                      </div>
                      <ChevronDown className="w-3.5 h-3.5 text-[var(--ink-tertiary)]" />
                    </div>

                    {/* Time */}
                    <div className="md:col-span-3 p-3 rounded-control bg-[var(--surface-alt)] border border-[var(--hairline)] flex items-center gap-3 transition-[border-color,box-shadow] duration-200 hover:border-[var(--hairline-strong)] focus-within:border-[var(--transit-accent)] focus-within:shadow-[0_0_0_3px_rgba(10,92,255,0.12)]">
                      <Clock className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="block text-[9px] font-bold uppercase tracking-wider text-[var(--ink-tertiary)]">
                          Time
                        </span>
                        <select
                          aria-label="Select parking time range"
                          value={selectedTimeRange}
                          onChange={(e) => setSelectedTimeRange(e.target.value)}
                          className="w-full appearance-none bg-transparent font-bold text-xs text-[var(--ink)] focus:outline-none cursor-pointer truncate"
                        >
                          <option value="2:00 PM – 6:00 PM" className="dark:bg-slate-900">14:00 – 18:00 (Standard)</option>
                          <option value="9:00 AM – 1:00 PM" className="dark:bg-slate-900">09:00 – 13:00 (Morning)</option>
                          <option value="6:00 PM – 10:00 PM" className="dark:bg-slate-900">18:00 – 22:00 (Evening)</option>
                          <option value="All Day (24 hrs)" className="dark:bg-slate-900">24-Hour Pass</option>
                        </select>
                      </div>
                      <ChevronDown className="w-3.5 h-3.5 text-[var(--ink-tertiary)]" />
                    </div>

                    {/* Action Button */}
                    <div className="md:col-span-2">
                      <button
                        type="button"
                        onClick={fetchListings}
                        className="group/cta w-full py-3.5 px-4 rounded-control bg-brand hover:bg-brand-hover text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-[background-color,transform] duration-150 active:scale-[0.97]"
                      >
                        <span>Search Parking</span>
                        <ArrowRight className="w-4 h-4 transition-transform duration-200 ease-out-quart group-hover/cta:translate-x-0.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Secondary Telemetry Strip */}
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--ink-secondary)] pt-1">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedAnchor(YELAHANKA_ANCHORS[0])}
                      className="hover:text-[var(--transit-accent)] flex items-center gap-1 underline underline-offset-4"
                    >
                      <LocateFixed className="w-3 h-3 text-[var(--transit-accent)]" />
                      Reset location
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (!currentUser) openLoginModal('provider');
                      else if (!currentUser.roles.includes('PROVIDER')) handleAddCapability('PROVIDER').then(() => setActiveTab('provider'));
                      else setActiveTab('provider');
                    }}
                    className="hover:text-[var(--transit-accent)] underline underline-offset-4"
                  >
                    Have a space to rent out? →
                  </button>
                </div>
              </div>
            </div>

            {/* FILTER STRIP & VIEW SWITCHER */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 border-b border-[var(--hairline)] flex flex-wrap items-center justify-between gap-3 text-xs font-sans">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={resetFilters}
                  className="px-3 py-1 rounded-full border border-[var(--hairline-strong)] hover:bg-[var(--surface-alt)] uppercase text-[11px] text-[var(--ink-secondary)] flex items-center gap-1 transition-colors"
                >
                  <SlidersHorizontal className="w-3 h-3" />
                  Reset
                </button>

                <select
                  aria-label="Filter by space type"
                  value={selectedCategoryFilter}
                  onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                  className="bg-[var(--surface-bg)] rounded-full border border-[var(--hairline)] hover:border-[var(--hairline-strong)] px-3 py-1 text-[11px] uppercase text-[var(--ink)] focus:outline-none cursor-pointer"
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
                  className="bg-[var(--surface-bg)] rounded-full border border-[var(--hairline)] hover:border-[var(--hairline-strong)] px-3 py-1 text-[11px] uppercase text-[var(--ink)] focus:outline-none cursor-pointer"
                >
                  <option value="All" className="dark:bg-slate-900">Rate: All</option>
                  <option value="Under ₹40" className="dark:bg-slate-900">Rate: &lt;₹40/hr</option>
                  <option value="Under ₹60" className="dark:bg-slate-900">Rate: &lt;₹60/hr</option>
                </select>

                <select
                  aria-label="Filter by vehicle size"
                  value={selectedVehicleFilter}
                  onChange={(e) => setSelectedVehicleFilter(e.target.value)}
                  className="bg-[var(--surface-bg)] rounded-full border border-[var(--hairline)] hover:border-[var(--hairline-strong)] px-3 py-1 text-[11px] uppercase text-[var(--ink)] focus:outline-none cursor-pointer"
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
                  className="bg-[var(--surface-bg)] rounded-full border border-[var(--hairline)] hover:border-[var(--hairline-strong)] px-3 py-1 text-[11px] uppercase text-[var(--ink)] focus:outline-none cursor-pointer"
                >
                  <option value="All" className="dark:bg-slate-900">Cover: Any</option>
                  <option value="Covered" className="dark:bg-slate-900">Cover: Basement/Covered</option>
                  <option value="Open" className="dark:bg-slate-900">Cover: Open Surface</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--surface-alt)] border border-[var(--hairline)] text-[11px] text-[var(--ink-secondary)]">
                <Lock className="w-3 h-3 text-[var(--transit-accent)]" />
                <span>Exact location and directions are shared after booking</span>
              </div>
            </div>

            {/* MAIN CONTENT: Verified Listings Grid (Map preview removed prior to payment) */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
              <div className="flex items-baseline justify-between pb-3 border-b border-[var(--hairline)] mb-4">
                <h2 className="text-sm font-bold text-[var(--ink)] tracking-tight">
                  {results.length} {results.length === 1 ? 'parking space' : 'parking spaces'} near{' '}
                  <span className="text-[var(--transit-accent)]">{selectedAnchor.name}</span>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                {loading ? (
                  <>
                    <div role="status" className="md:col-span-2 py-2 text-xs text-[var(--ink-secondary)] animate-fade-in">
                      Finding parking near {selectedAnchor.name}…
                    </div>
                    {[0, 1, 2, 3].map((i) => (
                      <ListingCardSkeleton key={i} style={staggerStyle(i, 70)} />
                    ))}
                  </>
                ) : results.length === 0 ? (
                  <div className="md:col-span-2 p-8 text-center bg-[var(--surface-bg)] rounded-card border border-[var(--hairline)] text-[var(--ink-secondary)] text-xs space-y-3 animate-fade-in">
                    <p className="text-sm font-bold text-[var(--ink)]">No parking spaces match these filters</p>
                    <p>Try removing a filter or choosing a different landmark.</p>
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="px-4 py-2 rounded-full bg-[var(--surface-alt)] border border-[var(--hairline-strong)] text-[var(--ink)] font-semibold text-xs hover:bg-[var(--surface-bg)] transition-colors"
                    >
                      Reset filters
                    </button>
                  </div>
                ) : (
                  results.map((item, index) => (
                    <div key={item.listing.id} className="animate-fade-up" style={staggerStyle(index)}>
                      <ListingCard
                        item={item}
                        isSelected={selectedResult?.listing.id === item.listing.id}
                        onSelect={() => setSelectedResult(item)}
                        onBook={() => setBookingModalItem(item)}
                      />
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* BELOW THE FOLD: How VPark works (driver and space-owner journeys) */}
            <div className="bg-[var(--surface-bg)] border-t border-[var(--hairline)] py-12 px-4 sm:px-6 lg:px-8">
              <HowItWorks
                className="max-w-7xl mx-auto"
                sectionRef={howItWorksRef}
                onBrowse={() => searchSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}
                onSetUpHost={() => {
                  if (!currentUser) openLoginModal('provider');
                  else if (!currentUser.roles.includes('PROVIDER')) handleAddCapability('PROVIDER').then(() => setActiveTab('provider'));
                  else setActiveTab('provider');
                }}
              />
            </div>
          </div>
        )}

        {/* TAB 2: Driver Bookings */}
        {activeTab === 'bookings' && (
          <div className={`max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-5 font-sans ${tabEnterClass}`}>
            <div className="border-b border-[var(--hairline)] pb-2 flex items-baseline justify-between">
              <h1 className="text-base font-bold uppercase tracking-tight text-[var(--ink)]">
                Active Parking Sessions &amp; Digital Passes
              </h1>
              <span className="text-xs text-[var(--ink-tertiary)]">{bookings.length} TOTAL SESSIONS</span>
            </div>

            {!currentUser ? (
              <div className="p-8 text-center bg-[var(--surface-bg)] border border-[var(--hairline-strong)] space-y-3 text-xs">
                <p className="font-bold uppercase text-[var(--ink)]">Authentication Required</p>
                <p className="text-[var(--ink-secondary)]">Sign in with your email to see your bookings and passes.</p>
                <button
                  type="button"
                  onClick={() => openLoginModal('driver')}
                  className="px-4 py-2 bg-brand hover:bg-brand-hover text-white font-sans uppercase tracking-wider transition-colors"
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
              bookings.map((booking, index) => (
                <div
                  key={booking.id}
                  style={staggerStyle(index)}
                  onClick={() => setActivePassBooking(booking)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setActivePassBooking(booking);
                    }
                  }}
                  className="group p-4 bg-[var(--surface-bg)] border border-[var(--hairline)] hover:border-[var(--hairline-strong)] hover:shadow-md cursor-pointer flex justify-between items-center text-xs transition-[border-color,box-shadow,transform] duration-200 ease-out-quart motion-safe:hover:-translate-y-0.5 animate-fade-up"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-[var(--transit-accent)] text-[11px] uppercase tracking-wider">
                        PASS // {booking.referenceNumber}
                      </span>
                      <span className="px-2 py-0.2 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 font-mono text-[10px] font-bold border border-emerald-500/30">
                        📍 Exact Map &amp; Navigation Unlocked
                      </span>
                    </div>
                    <h3 className="font-bold text-sm text-[var(--ink)] uppercase">{booking.listingTitle}</h3>
                    <p className="text-[var(--ink-secondary)] text-xs">{booking.listingAddress}</p>
                  </div>
                  <div className="text-right tabular-nums">
                    <span className="text-sm font-bold text-[var(--ink)]">₹{booking.pricingSnapshot.totalAmount}</span>
                    <span className="block text-[var(--transit-accent)] font-semibold text-[11px] uppercase tracking-wider mt-0.5 transition-transform duration-200 ease-out-quart group-hover:translate-x-0.5">
                      Open Exact Map &amp; Pass →
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'monthly' && (
          <div className={tabEnterClass}>
            <MonthlyPassesView onRequireAuth={() => openLoginModal('driver')} />
          </div>
        )}

        {activeTab === 'provider' && (
          <div className={tabEnterClass}>
            <ProviderHub
              currentUser={currentUser}
              onRequireAuth={() => openLoginModal('provider')}
              onEnableProvider={() => handleAddCapability('PROVIDER')}
            />
          </div>
        )}

        {activeTab === 'admin' && (
          <div className={tabEnterClass}>
            <AdminConsole />
          </div>
        )}
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
      <Presence>
      {authModalOpen && (
        <AuthModal
          key="auth-modal"
          initialIntent={authIntent}
          onAuthenticated={handleAuthenticated}
          onClose={() => setAuthModalOpen(false)}
        />
      )}
      </Presence>

      <Presence>
      {bookingModalItem && (
        <ListingDetailModal
          key={`listing-${bookingModalItem.listing.id}`}
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
      </Presence>

      <Presence>
      {activePassBooking && (
        <DigitalPassModal
          key={`pass-${activePassBooking.id}`}
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
      </Presence>

      <Presence>
      {disputeBooking && (
        <DisputeModal
          key={`dispute-${disputeBooking.id}`}
          booking={disputeBooking}
          onClose={() => setDisputeBooking(null)}
          onDisputeCreated={() => {
            setDisputeBooking(null);
            fetchInitialData();
          }}
        />
      )}
      </Presence>

      <Presence>
      {showDpdpModal && (
        <DpdpExportModal
          key="dpdp-modal"
          onClose={() => setShowDpdpModal(false)}
          onDeleted={() => {
            setShowDpdpModal(false);
            handleLogout();
          }}
        />
      )}
      </Presence>
    </div>
  );
}

