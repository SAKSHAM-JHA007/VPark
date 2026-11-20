'use client';

import React, { useState, useEffect, useRef, useId, useCallback } from 'react';
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
import { SiteFooter } from '@/components/nav/SiteFooter';
import { Presence } from '@/components/motion/Presence';
import { ListingCardSkeleton } from '@/components/motion/Skeleton';
import { staggerStyle } from '@/components/motion/tokens';
import { useI18n } from '@/components/i18n/LanguageProvider';
import {
  fullLocationLabel,
  geolocationErrorKey,
  shortLocationLabel,
  useDeviceLocation,
  useSearchLocation,
} from '@/components/location/useSearchLocation';
import { searchLocationStore, centerOf } from '@/lib/location/searchLocationStore';
import {
  DEFAULT_FILTERS,
  DEFAULT_SEARCH_RADIUS_KM,
  MAX_SEARCH_RADIUS_KM,
  SEARCH_RADIUS_OPTIONS_KM,
  buildSearchQuery,
  classifyEmptyResults,
  hasActiveFilters,
  type SearchFiltersState,
} from '@/lib/location/geo';
import { bookingStatusInfo, badgeClass } from '@/components/ui/status';
import { UserRole, SearchResultItem, Booking, User } from '@/types';
import { YELAHANKA_ANCHORS } from '@/lib/constants';
import { signOutFirebase } from '@/lib/firebase';
import {
  MapPin,
  Calendar,
  Clock,
  Car,
  Store,
  ArrowRight,
  Lock,
  Crosshair,
  Loader2,
  RotateCcw,
  SearchX,
  WifiOff,
  Ticket,
  Navigation,
  Info,
} from 'lucide-react';

export type VParkTab = 'search' | 'bookings' | 'monthly' | 'provider' | 'admin';

interface VParkAppProps {
  initialTab?: VParkTab;
  initialIntent?: 'driver' | 'provider';
}

const DEVICE_OPTION = '__device__';

export function VParkApp({ initialTab = 'search', initialIntent = 'driver' }: VParkAppProps) {
  const i18n = useI18n();
  const { t, tn, inr } = i18n;
  const [currentRole, setCurrentRole] = useState<UserRole>(initialIntent === 'provider' ? 'PROVIDER' : 'DRIVER');
  const [activeTab, setActiveTab] = useState<VParkTab>(initialTab);
  const [showDpdpModal, setShowDpdpModal] = useState<boolean>(false);
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [authIntent, setAuthIntent] = useState<'driver' | 'provider'>(initialIntent);

  // Search location (shared, in-memory) and filters
  const searchLocation = useSearchLocation();
  const { status: locateStatus, error: locateError, locate } = useDeviceLocation();
  const [reloadNotice, setReloadNotice] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('today');
  const [selectedTime, setSelectedTime] = useState<string>('afternoon');
  const [filters, setFilters] = useState<SearchFiltersState>(DEFAULT_FILTERS);
  const [radiusKm, setRadiusKm] = useState<number>(DEFAULT_SEARCH_RADIUS_KM);

  // Data state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<boolean>(false);
  const [selectedResult, setSelectedResult] = useState<SearchResultItem | undefined>(undefined);
  const [bookingModalItem, setBookingModalItem] = useState<SearchResultItem | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [activePassBooking, setActivePassBooking] = useState<Booking | null>(null);
  const [disputeBooking, setDisputeBooking] = useState<Booking | null>(null);

  // Optional post-signup email banner
  const [emailInput, setEmailInput] = useState<string>('');
  const [emailStatus, setEmailStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const resultsRef = useRef<HTMLDivElement>(null);
  const searchSectionRef = useRef<HTMLDivElement>(null);
  const howItWorksRef = useRef<HTMLElement>(null);
  const requestIdRef = useRef(0);
  const ids = { location: useId(), date: useId(), time: useId(), email: useId(), sort: useId() };

  const center = centerOf(searchLocation);
  const isDevice = searchLocation.kind === 'device';
  const placeLabel = fullLocationLabel(searchLocation, t);
  const locationKey = isDevice ? `device:${center.lat}:${center.lng}` : `anchor:${searchLocation.anchorId}`;

  // Tab content fades in only after the user (or a URL param) switches tabs.
  const initialTabRef = useRef<VParkTab>(activeTab);
  const tabSwitchedRef = useRef(false);
  if (activeTab !== initialTabRef.current) tabSwitchedRef.current = true;
  const tabEnterClass = tabSwitchedRef.current ? 'animate-fade-in' : '';

  // Query string hand-off from other pages: ?tab=, ?intent=, ?anchor=<landmark id>,
  // ?near=me (device location kept in memory by the page that requested it).
  useEffect(() => {
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
    const anchorParam = sp.get('anchor');
    if (anchorParam && YELAHANKA_ANCHORS.some((a) => a.id === anchorParam)) {
      searchLocationStore.setAnchor(anchorParam);
    }
    if (sp.get('near') === 'me') {
      // The fix never travels in the URL. After a reload it is gone, so say so
      // rather than silently searching somewhere else or re-prompting on load.
      if (searchLocationStore.get().kind !== 'device') setReloadNotice(true);
      sp.delete('near');
      const qs = sp.toString();
      window.history.replaceState(window.history.state, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
    }
  }, []);

  const fetchInitialData = async () => {
    try {
      const [userRes, bookingsRes] = await Promise.all([fetch('/api/auth/me'), fetch('/api/bookings')]);
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

  const fetchListings = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setSearchError(false);
    try {
      const res = await fetch(`/api/search?${buildSearchQuery(center, radiusKm, filters)}`);
      const data = await res.json();
      if (requestId !== requestIdRef.current) return; // a newer search superseded this one
      if (!res.ok || !data.success) {
        setSearchError(true);
        setResults([]);
        setSelectedResult(undefined);
        return;
      }
      setResults(data.data);
      setSelectedResult((prev) =>
        data.data.length === 0
          ? undefined
          : prev && data.data.some((d: SearchResultItem) => d.listing.id === prev.listing.id)
          ? prev
          : data.data[0]
      );
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      console.error('Failed to load listings:', err);
      setSearchError(true);
      setResults([]);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
    // center is derived from searchLocation; depend on its coordinates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center.lat, center.lng, radiusKm, filters]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (activeTab === 'search') fetchListings();
  }, [activeTab, fetchListings]);

  // A new location clears the "location lost after reload" notice.
  useEffect(() => {
    if (searchLocation.kind === 'device') setReloadNotice(false);
  }, [searchLocation]);

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
        setEmailStatus({ ok: true, text: t('search.emailSaved') });
      } else {
        setEmailStatus({ ok: false, text: data.error || t('search.emailInvalid') });
      }
    } catch {
      setEmailStatus({ ok: false, text: t('search.emailFailed') });
    }
  };

  const resetFilters = () => setFilters(DEFAULT_FILTERS);
  const setFilter = <K extends keyof SearchFiltersState>(key: K, value: SearchFiltersState[K]) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const goToProvider = () => {
    if (!currentUser) openLoginModal('provider');
    else if (!currentUser.roles.includes('PROVIDER')) handleAddCapability('PROVIDER').then(() => setActiveTab('provider'));
    else setActiveTab('provider');
  };

  const chooseAnchor = (anchorId: string) => {
    searchLocationStore.setAnchor(anchorId);
    setReloadNotice(false);
  };

  const handleLocationSelected = () => {
    setActiveTab('search');
    requestAnimationFrame(() => {
      const top = resultsRef.current?.getBoundingClientRect().top ?? 0;
      if (top > window.innerHeight * 0.75) resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const fieldClass =
    'relative flex min-h-[3.5rem] items-center gap-3 rounded-control border border-hairline bg-surface-alt px-3.5 py-2 transition-[border-color,box-shadow] duration-200 hover:border-hairline-strong focus-within:border-[var(--transit-accent)] focus-within:shadow-[var(--focus-ring)]';
  const fieldLabel = 'block text-[11px] font-semibold uppercase tracking-wider text-ink-3';
  const fieldSelect = 'w-full cursor-pointer appearance-none truncate bg-transparent pr-1 text-sm font-semibold text-ink focus:outline-none';
  const filterSelect =
    'min-h-[2.25rem] cursor-pointer rounded-full border border-hairline-strong bg-surface px-3 text-[13px] font-medium text-ink transition-colors hover:border-ink-3 focus:border-[var(--transit-accent)] focus:outline-none focus:shadow-[var(--focus-ring)]';

  const emptyKind = classifyEmptyResults({ center, filters, isDeviceLocation: isDevice });

  const anchorChips = (
    <div className="flex flex-wrap justify-center gap-2">
      {YELAHANKA_ANCHORS.map((anchor) => (
        <button key={anchor.id} type="button" onClick={() => chooseAnchor(anchor.id)} className="vp-btn vp-btn-secondary vp-btn-sm">
          <MapPin className="h-3.5 w-3.5 text-[var(--transit-accent)]" aria-hidden="true" />
          {anchor.locality}
        </button>
      ))}
    </div>
  );

  const renderEmptyState = () => {
    if (searchError) {
      return (
        <EmptyState icon={<WifiOff className="h-6 w-6" />} title={t('search.empty.errorTitle')} body={t('search.empty.errorBody')}>
          <button type="button" onClick={fetchListings} className="vp-btn vp-btn-primary">
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            {t('common.retry')}
          </button>
        </EmptyState>
      );
    }
    if (emptyKind === 'outsideCoverage') {
      return (
        <EmptyState
          icon={<EmptyBayIllustration />}
          bare
          title={t('search.empty.outsideTitle')}
          body={t('search.empty.outsideBody', { km: radiusKm })}
        >
          {radiusKm < MAX_SEARCH_RADIUS_KM && (
            <button type="button" onClick={() => setRadiusKm(MAX_SEARCH_RADIUS_KM)} className="vp-btn vp-btn-secondary">
              {t('search.empty.widen')}
            </button>
          )}
          <p className="pt-2 text-sm font-semibold text-ink">{t('search.empty.tryLandmark')}</p>
          {anchorChips}
        </EmptyState>
      );
    }
    if (emptyKind === 'filters') {
      return (
        <EmptyState icon={<SearchX className="h-6 w-6" />} title={t('search.empty.filtersTitle')} body={t('search.empty.filtersBody')}>
          <button type="button" onClick={resetFilters} className="vp-btn vp-btn-primary">
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            {t('search.filters.reset')}
          </button>
          {radiusKm < MAX_SEARCH_RADIUS_KM && (
            <button type="button" onClick={() => setRadiusKm(MAX_SEARCH_RADIUS_KM)} className="vp-btn vp-btn-secondary">
              {t('search.empty.widen')}
            </button>
          )}
        </EmptyState>
      );
    }
    return (
      <EmptyState
        icon={<EmptyBayIllustration />}
        bare
        title={t('search.empty.nearbyTitle', { km: radiusKm })}
        body={t('search.empty.nearbyBody')}
      >
        {radiusKm < MAX_SEARCH_RADIUS_KM && (
          <button type="button" onClick={() => setRadiusKm(MAX_SEARCH_RADIUS_KM)} className="vp-btn vp-btn-secondary">
            {t('search.empty.widen')}
          </button>
        )}
        <p className="pt-2 text-sm font-semibold text-ink">{t('search.empty.tryLandmark')}</p>
        {anchorChips}
      </EmptyState>
    );
  };

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink">
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
        onScrollHowItWorks={() => howItWorksRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        onLocationSelected={handleLocationSelected}
        bookingsCount={bookings.length}
      />

      <main id="main-content" className="flex-1">
        {activeTab === 'search' && (
          <div className={tabEnterClass}>
            {/* Signed-in welcome and optional email */}
            {currentUser && (
              <div className="border-b border-hairline bg-surface px-4 py-3 sm:px-6 lg:px-8 animate-fade-in">
                <div className="mx-auto flex max-w-7xl flex-col justify-between gap-3 text-sm sm:flex-row sm:items-center">
                  <p className="text-ink-2">
                    <span className="font-semibold text-ink">{t('search.welcome', { name: currentUser.name || currentUser.phone })}</span>
                    <span className="ml-2">{t('search.welcomeHint')}</span>
                  </p>
                  {!currentUser.email && (
                    <form onSubmit={handleSaveOptionalEmail} className="flex items-center gap-2">
                      <label htmlFor={ids.email} className="sr-only">
                        {t('search.emailLabel')}
                      </label>
                      <input
                        id={ids.email}
                        type="email"
                        autoComplete="email"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        placeholder={t('search.emailLabel')}
                        aria-invalid={emailStatus && !emailStatus.ok ? true : undefined}
                        aria-describedby={emailStatus ? `${ids.email}-status` : undefined}
                        className="vp-input min-h-[2.25rem] w-full py-1.5 sm:w-64"
                      />
                      <button type="submit" className="vp-btn vp-btn-primary vp-btn-sm whitespace-nowrap">
                        {t('search.emailSave')}
                      </button>
                    </form>
                  )}
                  {emailStatus && (
                    <span
                      id={`${ids.email}-status`}
                      key={emailStatus.text}
                      role={emailStatus.ok ? 'status' : 'alert'}
                      className={`text-sm font-semibold animate-fade-in ${emailStatus.ok ? 'text-[var(--success-ink)]' : 'text-[var(--danger-ink)]'}`}
                    >
                      {emailStatus.text}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Search console */}
            <div id="vpark-search" ref={searchSectionRef} className="border-b border-hairline px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
              <div className="mx-auto max-w-7xl space-y-5">
                <div className="max-w-3xl">
                  <h1 className="vp-h1 animate-fade-up">{t('planner.title')}</h1>
                  <p className="vp-lead mt-2">{t('search.subtitle')}</p>
                </div>

                <div className="vp-card space-y-4 p-4 sm:p-5 animate-fade-up [animation-delay:80ms]">
                  <div role="group" aria-label={t('planner.modeLabel')} className="inline-flex gap-1 rounded-full bg-surface-alt p-1">
                    <button
                      type="button"
                      aria-pressed="true"
                      className="inline-flex min-h-[2.25rem] items-center gap-2 rounded-full bg-surface px-4 text-sm font-semibold text-[var(--transit-accent)] shadow-card ring-1 ring-[var(--hairline)]"
                    >
                      <Car className="h-4 w-4" aria-hidden="true" />
                      {t('planner.modeFind')}
                    </button>
                    <button
                      type="button"
                      aria-pressed="false"
                      onClick={goToProvider}
                      className="inline-flex min-h-[2.25rem] items-center gap-2 rounded-full px-4 text-sm font-semibold text-ink-2 transition-colors hover:text-ink"
                    >
                      <Store className="h-4 w-4" aria-hidden="true" />
                      {t('planner.modeRent')}
                    </button>
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      fetchListings();
                      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    className="grid grid-cols-1 gap-3 md:grid-cols-12"
                  >
                    <div className={`md:col-span-5 ${fieldClass}`}>
                      <MapPin className="h-4 w-4 flex-shrink-0 text-[var(--transit-accent)]" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <label htmlFor={ids.location} className={fieldLabel}>
                          {t('planner.location')}
                        </label>
                        <select
                          id={ids.location}
                          value={isDevice ? DEVICE_OPTION : searchLocation.anchorId}
                          onChange={(e) => {
                            if (e.target.value !== DEVICE_OPTION) chooseAnchor(e.target.value);
                          }}
                          className={fieldSelect}
                        >
                          {isDevice && <option value={DEVICE_OPTION}>{shortLocationLabel(searchLocation, t)}</option>}
                          {YELAHANKA_ANCHORS.map((anchor) => (
                            <option key={anchor.id} value={anchor.id}>
                              {anchor.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (locateStatus !== 'locating') locate();
                        }}
                        aria-label={t('location.useCurrent')}
                        title={t('location.useCurrent')}
                        className="vp-btn vp-btn-ghost vp-btn-sm -mr-1.5 flex-shrink-0 px-2.5 text-[var(--transit-accent)]"
                      >
                        {locateStatus === 'locating' ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <Crosshair className="h-4 w-4" aria-hidden="true" />
                        )}
                        <span className="hidden lg:inline">{t('planner.useLocation')}</span>
                      </button>
                    </div>

                    <div className={`md:col-span-2 ${fieldClass}`}>
                      <Calendar className="h-4 w-4 flex-shrink-0 text-ink-3" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <label htmlFor={ids.date} className={fieldLabel}>
                          {t('planner.date')}
                        </label>
                        <select id={ids.date} value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className={fieldSelect}>
                          <option value="today">{t('planner.dates.today')}</option>
                          <option value="tomorrow">{t('planner.dates.tomorrow')}</option>
                          <option value="weekend">{t('planner.dates.weekend')}</option>
                        </select>
                      </div>
                    </div>

                    <div className={`md:col-span-3 ${fieldClass}`}>
                      <Clock className="h-4 w-4 flex-shrink-0 text-ink-3" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <label htmlFor={ids.time} className={fieldLabel}>
                          {t('planner.time')}
                        </label>
                        <select id={ids.time} value={selectedTime} onChange={(e) => setSelectedTime(e.target.value)} className={fieldSelect}>
                          <option value="afternoon">{t('planner.times.afternoon')}</option>
                          <option value="morning">{t('planner.times.morning')}</option>
                          <option value="evening">{t('planner.times.evening')}</option>
                          <option value="fullDay">{t('planner.times.fullDay')}</option>
                        </select>
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      <button type="submit" className="group/cta vp-btn vp-btn-primary vp-btn-lg h-full min-h-[3.5rem] w-full rounded-control">
                        {t('planner.search')}
                        <ArrowRight className="h-4 w-4 transition-transform duration-200 ease-out-quart group-hover/cta:translate-x-0.5" aria-hidden="true" />
                      </button>
                    </div>
                  </form>

                  {locateError && (
                    <p role="alert" className="vp-alert vp-alert-warning">
                      <Info className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
                      <span>{t(geolocationErrorKey(locateError))}</span>
                    </p>
                  )}
                  {reloadNotice && (
                    <p role="status" className="vp-alert vp-alert-info">
                      <Info className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
                      <span>{t('location.reloadNotice')}</span>
                    </p>
                  )}
                </div>

                {/* Active search centre */}
                <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                  <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-ink-2">
                    {/* Re-keyed on every new centre: the pin drops and one locator ripple spreads. */}
                    <span key={locationKey} className="vp-pin-drop relative inline-flex flex-shrink-0" aria-hidden="true">
                      <span className="vp-locator-ripple" />
                      {isDevice ? (
                        <Navigation className="h-4 w-4 text-[var(--transit-accent)]" />
                      ) : (
                        <MapPin className="h-4 w-4 text-[var(--transit-accent)]" />
                      )}
                    </span>
                    <span className="whitespace-nowrap">{t('search.searchingFrom')}</span>
                    <span className="min-w-0 max-w-full truncate font-semibold text-ink">{placeLabel}</span>
                    {isDevice && searchLocation.accuracyM !== null && searchLocation.accuracyM > 0 && (
                      <span className="hidden text-xs text-ink-3 sm:inline">
                        · {t('location.accuracy', { meters: i18n.number(searchLocation.accuracyM) })}
                      </span>
                    )}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    {isDevice && (
                      <button type="button" onClick={() => chooseAnchor(YELAHANKA_ANCHORS[0].id)} className="vp-link text-sm">
                        {t('search.resetLocation')}
                      </button>
                    )}
                    <button type="button" onClick={goToProvider} className="vp-link text-sm">
                      {t('search.haveSpace')} →
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Filter strip (the scanning sweep along its lower edge runs only while a search is in flight) */}
            <div className="relative border-b border-hairline bg-surface">
              {loading && <div className="vp-scan-bar" aria-hidden="true" />}
              <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
                <div role="group" aria-label={t('search.filters.label')} className="flex flex-wrap items-center gap-2">
                  <label className="sr-only" htmlFor="flt-type">
                    {t('search.filters.type')}
                  </label>
                  <select id="flt-type" value={filters.category} onChange={(e) => setFilter('category', e.target.value as SearchFiltersState['category'])} className={filterSelect}>
                    <option value="All">{t('search.filters.typeAll')}</option>
                    <option value="Commercial">{t('search.filters.typeCommercial')}</option>
                    <option value="Private">{t('search.filters.typePrivate')}</option>
                    <option value="Public">{t('search.filters.typePublic')}</option>
                  </select>

                  <label className="sr-only" htmlFor="flt-price">
                    {t('search.filters.price')}
                  </label>
                  <select id="flt-price" value={filters.price} onChange={(e) => setFilter('price', e.target.value as SearchFiltersState['price'])} className={filterSelect}>
                    <option value="All">{t('search.filters.priceAll')}</option>
                    <option value="Under40">{t('search.filters.price40')}</option>
                    <option value="Under60">{t('search.filters.price60')}</option>
                  </select>

                  <label className="sr-only" htmlFor="flt-vehicle">
                    {t('search.filters.vehicle')}
                  </label>
                  <select id="flt-vehicle" value={filters.vehicle} onChange={(e) => setFilter('vehicle', e.target.value as SearchFiltersState['vehicle'])} className={filterSelect}>
                    <option value="All">{t('search.filters.vehicleAny')}</option>
                    <option value="SEDAN">{t('vehicles.SEDAN')}</option>
                    <option value="SUV">{t('vehicles.SUV')}</option>
                    <option value="EV">{t('listing.evReady')}</option>
                    <option value="TWO_WHEELER">{t('vehicles.TWO_WHEELER')}</option>
                  </select>

                  <label className="sr-only" htmlFor="flt-cover">
                    {t('search.filters.cover')}
                  </label>
                  <select id="flt-cover" value={filters.cover} onChange={(e) => setFilter('cover', e.target.value as SearchFiltersState['cover'])} className={filterSelect}>
                    <option value="All">{t('search.filters.coverAny')}</option>
                    <option value="Covered">{t('search.filters.covered')}</option>
                    <option value="Open">{t('search.filters.open')}</option>
                  </select>

                  <label className="sr-only" htmlFor="flt-radius">
                    {t('search.filters.radius')}
                  </label>
                  <select id="flt-radius" value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value))} className={filterSelect}>
                    {SEARCH_RADIUS_OPTIONS_KM.map((km) => (
                      <option key={km} value={km}>
                        {t('search.filters.radiusOption', { km })}
                      </option>
                    ))}
                  </select>

                  {(hasActiveFilters(filters) || radiusKm !== DEFAULT_SEARCH_RADIUS_KM) && (
                    <button
                      type="button"
                      onClick={() => {
                        resetFilters();
                        setRadiusKm(DEFAULT_SEARCH_RADIUS_KM);
                      }}
                      className="vp-btn vp-btn-ghost vp-btn-sm"
                    >
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                      {t('search.filters.reset')}
                    </button>
                  )}
                </div>

                <p className="flex items-center gap-1.5 text-xs text-ink-2">
                  <Lock className="h-3.5 w-3.5 text-[var(--transit-accent)]" aria-hidden="true" />
                  {t('search.filters.privacyNote')}
                </p>
              </div>
            </div>

            {/* Results: real VPark listings from /api/search */}
            <div ref={resultsRef} className="mx-auto max-w-7xl scroll-mt-20 px-4 py-6 sm:px-6 lg:px-8">
              <div className="mb-4 flex flex-col gap-2 border-b border-hairline pb-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-base font-semibold text-ink" role="status" aria-live="polite">
                  {loading
                    ? t('search.loading', { place: placeLabel })
                    : searchError
                    ? t('search.empty.errorTitle')
                    : tn('search.results', results.length, { km: radiusKm, place: placeLabel })}
                </h2>
                <div className="flex items-center gap-2 text-sm">
                  <label htmlFor={ids.sort} className="text-ink-2">
                    {t('search.sort.label')}
                  </label>
                  <select
                    id={ids.sort}
                    value={filters.sort}
                    onChange={(e) => setFilter('sort', e.target.value as SearchFiltersState['sort'])}
                    className={filterSelect}
                  >
                    <option value="Nearest">{t('search.sort.nearest')}</option>
                    <option value="LowestPrice">{t('search.sort.lowestPrice')}</option>
                    <option value="HighestRated">{t('search.sort.highestRated')}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2" aria-busy={loading}>
                {loading ? (
                  [0, 1, 2, 3].map((i) => <ListingCardSkeleton key={i} style={staggerStyle(i, 70)} />)
                ) : results.length === 0 ? (
                  <div className="lg:col-span-2">{renderEmptyState()}</div>
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

            {/* How VPark works */}
            <div className="border-t border-hairline bg-surface px-4 py-14 sm:px-6 lg:px-8 oled:bg-black">
              <HowItWorks
                className="mx-auto max-w-7xl"
                sectionRef={howItWorksRef}
                onBrowse={() => searchSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}
                onSetUpHost={goToProvider}
              />
            </div>
          </div>
        )}

        {/* Driver bookings */}
        {activeTab === 'bookings' && (
          <div className={`mx-auto max-w-4xl space-y-5 px-4 py-8 sm:px-6 lg:px-8 ${tabEnterClass}`}>
            <div className="flex flex-wrap items-end justify-between gap-2 border-b border-hairline pb-4">
              <div>
                <h1 className="vp-h2">{t('bookings.title')}</h1>
                <p className="mt-1 text-sm text-ink-2">{t('bookings.subtitle')}</p>
              </div>
              {currentUser && <span className="vp-badge">{tn('bookings.count', bookings.length)}</span>}
            </div>

            {!currentUser ? (
              <EmptyState icon={<Lock className="h-6 w-6" />} title={t('bookings.signInTitle')} body={t('bookings.signInBody')}>
                <button type="button" onClick={() => openLoginModal('driver')} className="vp-btn vp-btn-primary">
                  {t('bookings.signIn')}
                </button>
              </EmptyState>
            ) : bookings.length === 0 ? (
              <EmptyState icon={<Ticket className="h-6 w-6" />} title={t('bookings.emptyTitle')} body={t('bookings.emptyBody')}>
                <button type="button" onClick={() => setActiveTab('search')} className="vp-btn vp-btn-primary">
                  {t('bookings.emptyCta')}
                </button>
              </EmptyState>
            ) : (
              <ul className="space-y-3">
                {bookings.map((booking, index) => {
                  const status = bookingStatusInfo(booking.status);
                  return (
                    <li key={booking.id} style={staggerStyle(index)} className="animate-fade-up">
                      <button
                        type="button"
                        onClick={() => setActivePassBooking(booking)}
                        aria-label={t('bookings.passFor', { ref: booking.referenceNumber })}
                        className="vp-card group flex w-full flex-col gap-3 p-4 text-left transition-[border-color,box-shadow,transform] duration-200 ease-out-quart hover:border-hairline-strong hover:shadow-raised motion-safe:hover:-translate-y-0.5 sm:flex-row sm:items-center sm:justify-between sm:p-5"
                      >
                        <span className="min-w-0 space-y-1.5">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-semibold text-[var(--transit-accent)]">{booking.referenceNumber}</span>
                            <span className={badgeClass(status.tone)}>{t(status.key)}</span>
                            {booking.locationRevealed !== false && (
                              <span className="vp-badge vp-badge-success">{t('bookings.unlocked')}</span>
                            )}
                          </span>
                          <span className="block text-[15px] font-semibold text-ink">{booking.listingTitle}</span>
                          <span className="block text-sm text-ink-2">{booking.listingAddress}</span>
                          <span className="block text-xs text-ink-3">
                            {i18n.date(booking.startTime, { day: 'numeric', month: 'short', year: 'numeric' })} · {i18n.time(booking.startTime)} → {i18n.time(booking.endTime)}
                          </span>
                        </span>
                        <span className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
                          <span className="text-base font-bold tabular-nums text-ink">{inr(booking.pricingSnapshot.totalAmount, { decimals: true })}</span>
                          <span className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--transit-accent)]">
                            {t('bookings.openPass')}
                            <ArrowRight className="h-4 w-4 transition-transform duration-200 ease-out-quart group-hover:translate-x-0.5" aria-hidden="true" />
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
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

      <SiteFooter onOpenDataRights={currentUser ? () => setShowDpdpModal(true) : undefined} />

      {/* Modals */}
      <Presence>
        {authModalOpen && (
          <AuthModal key="auth-modal" initialIntent={authIntent} onAuthenticated={handleAuthenticated} onClose={() => setAuthModalOpen(false)} />
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

/** An empty parking bay with a locator: drawn in once, the locator pulses twice. */
function EmptyBayIllustration() {
  return (
    <svg viewBox="0 0 120 72" className="h-16 w-28" fill="none">
      <path
        d="M14 60 L36 14 M106 60 L84 14 M30 44 L90 44"
        pathLength={1}
        stroke="var(--hairline-strong)"
        strokeWidth="2.5"
        strokeLinecap="round"
        className="vp-empty-bay"
      />
      <circle cx="60" cy="30" r="13" stroke="var(--transit-accent)" strokeWidth="1.5" className="vp-empty-pulse" />
      <path
        d="M60 16c-5 0-9 3.9-9 8.8 0 6.4 9 15.2 9 15.2s9-8.8 9-15.2C69 19.9 65 16 60 16Z"
        fill="var(--accent-soft)"
        stroke="var(--transit-accent)"
        strokeWidth="1.8"
      />
      <circle cx="60" cy="25" r="3" fill="var(--transit-accent)" />
    </svg>
  );
}

function EmptyState({
  icon,
  bare = false,
  title,
  body,
  children,
}: {
  icon: React.ReactNode;
  /** Render the icon without the round tile (for illustrations). */
  bare?: boolean;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="vp-card flex flex-col items-center gap-3 px-6 py-10 text-center animate-fade-in">
      <span className={bare ? 'inline-flex' : 'vp-icon-tile h-12 w-12 rounded-full'} aria-hidden="true">
        {icon}
      </span>
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      <p className="max-w-md text-sm leading-relaxed text-ink-2">{body}</p>
      {children && <div className="flex flex-col items-center gap-3 pt-2">{children}</div>}
    </div>
  );
}
