'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AuthPanel } from '@/components/AuthModal';
import { VParkLogo } from '@/components/VParkLogo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { FindParkingIllustration, RentSpaceIllustration } from '@/components/HeroIllustrations';
import { User } from '@/types';
import { YELAHANKA_ANCHORS } from '@/lib/constants';
import { trackEvent } from '@/lib/analytics';
import {
  MapPin,
  Calendar,
  Clock,
  ArrowRight,
  Zap,
  ShieldCheck,
  Building2,
  ChevronDown,
  Globe,
  Car,
  Store,
  X,
} from 'lucide-react';

export function HomePageClient() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authIntent, setAuthIntent] = useState<'driver' | 'provider'>('driver');

  // Search Dispatch State
  const [selectedAnchorId, setSelectedAnchorId] = useState(YELAHANKA_ANCHORS[0].id);
  const [selectedDate, setSelectedDate] = useState('Today');
  const [selectedTimeRange, setSelectedTimeRange] = useState('14:00 - 18:00 (4 hrs)');
  const [searchMode, setSearchMode] = useState<'find' | 'rent'>('find');

  // Check if session exists
  useEffect(() => {
    let mounted = true;
    async function checkSession() {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (mounted && data.success && data.user) {
          setCurrentUser(data.user);
        }
      } catch {
        // Continue as guest
      }
    }

    checkSession();
    return () => {
      mounted = false;
    };
  }, []);

  const handleOpenAuth = (intent: 'driver' | 'provider') => {
    setAuthIntent(intent);
    setAuthModalOpen(true);
    if (intent === 'provider') {
      trackEvent({ name: 'rent_space_select' });
    }
  };

  const handleAuthenticated = (user: User) => {
    setCurrentUser(user);
    setAuthModalOpen(false);
    trackEvent({ name: 'login_complete', params: { role: user.activeRole } });
    if (user.activeRole === 'ADMIN') {
      router.push('/driver/home?tab=admin');
    } else if (user.activeRole === 'PROVIDER') {
      router.push('/owner/dashboard');
    } else {
      router.push('/driver/home');
    }
  };

  const handleExecuteSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (searchMode === 'rent') {
      trackEvent({ name: 'rent_space_select' });
      router.push('/owner/dashboard');
      return;
    }
    trackEvent({
      name: 'get_parking_select',
      params: { anchor: selectedAnchorId, date: selectedDate },
    });
    router.push(`/driver/home?anchor=${encodeURIComponent(selectedAnchorId)}`);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#07090E] text-slate-900 dark:text-slate-100 flex flex-col justify-between font-sans transition-colors duration-200">
      {/* 1. Header / Navbar - Sleek Dark Palette matching reference UI */}
      <header className="sticky top-0 z-40 bg-[#0B0C10] border-b border-neutral-800 text-white select-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Left: Brand Logo */}
          <div className="flex items-center gap-6 lg:gap-8">
            <Link href="/" className="flex items-center gap-2.5 focus-visible:outline-none" aria-label="VPark Home">
              <VParkLogo className="h-8 w-auto" />
            </Link>

            {/* Navigation Pills */}
            <nav aria-label="Main Navigation" className="hidden md:flex items-center gap-1.5 text-xs">
              <Link
                href="/driver/home"
                onClick={() => trackEvent({ name: 'get_parking_select' })}
                className="px-3.5 py-1.5 rounded-full bg-neutral-800 text-white font-medium hover:bg-neutral-700 transition-colors"
              >
                Find Parking
              </Link>
              <button
                type="button"
                onClick={() => handleOpenAuth('provider')}
                className="px-3.5 py-1.5 rounded-full text-neutral-300 hover:text-white hover:bg-neutral-800/60 font-medium transition-colors cursor-pointer"
              >
                Rent Your Space
              </button>
              <Link
                href="/driver/home?tab=monthly"
                className="px-3.5 py-1.5 rounded-full text-neutral-300 hover:text-white hover:bg-neutral-800/60 font-medium transition-colors"
              >
                For Businesses
              </Link>
              <Link
                href="/contact"
                className="px-3.5 py-1.5 rounded-full text-neutral-300 hover:text-white hover:bg-neutral-800/60 font-medium transition-colors"
              >
                Contact
              </Link>
            </nav>
          </div>

          {/* Right Controls: Location, Language, Theme, and Auth */}
          <div className="flex items-center gap-2 sm:gap-4 text-xs">
            {/* Location Selector */}
            <div className="hidden lg:flex items-center gap-1 px-2.5 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-200">
              <MapPin className="w-3.5 h-3.5 text-[#0A5CFF]" aria-hidden="true" />
              <span className="font-medium text-[11px]">Bengaluru</span>
              <ChevronDown className="w-3 h-3 text-neutral-400" aria-hidden="true" />
            </div>

            {/* Language Selector */}
            <div className="hidden sm:flex items-center gap-1 px-2 py-1 text-neutral-300 hover:text-white transition-colors cursor-pointer">
              <Globe className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="font-medium text-[11px]">EN</span>
            </div>

            <ThemeToggle />

            {/* Help Link */}
            <Link
              href="/contact"
              className="hidden sm:inline-flex items-center gap-1 text-neutral-300 hover:text-white px-2 py-1 transition-colors"
            >
              <span>Help</span>
            </Link>

            {/* Auth Buttons */}
            {!currentUser ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenAuth('driver')}
                  className="px-3 py-1.5 text-neutral-200 hover:text-white font-medium transition-colors cursor-pointer"
                >
                  Log in
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenAuth('driver')}
                  className="px-4 py-1.5 rounded-full bg-white hover:bg-neutral-100 text-neutral-950 font-semibold transition-all shadow-sm cursor-pointer"
                >
                  Sign up
                </button>
              </div>
            ) : (
              <Link
                href={currentUser.activeRole === 'PROVIDER' ? '/owner/dashboard' : '/driver/home'}
                className="px-4 py-1.5 rounded-full bg-[#0A5CFF] hover:bg-[#0047d4] text-white font-semibold transition-colors flex items-center gap-1.5"
              >
                <span>Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* 2. Main Content Container */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-12">
        {/* Section: Explore what you can do with VPark */}
        <section className="space-y-6">
          <div className="space-y-1.5">
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Explore what you can do with VPark
            </h1>
            <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400">
              A unified platform to find parking or list your space and earn, for individuals and businesses in Bengaluru.
            </p>
          </div>

          {/* Two Hero Action Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            {/* Card 1: Find Parking */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#060D1E] via-[#09152F] to-[#0A1A3A] border border-blue-900/40 p-7 sm:p-9 text-white flex flex-col justify-between shadow-lg min-h-[260px] sm:min-h-[290px]">
              <div className="z-10 max-w-[240px] sm:max-w-[270px] space-y-2.5">
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                  Find Parking
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  Discover and book verified parking bays near you with real-time slot availability.
                </p>
                <div className="pt-3">
                  <Link
                    href="/driver/home"
                    onClick={() => trackEvent({ name: 'get_parking_select' })}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-slate-950 font-bold text-xs sm:text-sm hover:bg-slate-100 transition-colors shadow-md"
                  >
                    <span>Find Parking</span>
                    <ArrowRight className="w-4 h-4 text-slate-900" aria-hidden="true" />
                  </Link>
                </div>
              </div>

              {/* Right Illustration: White Car in Blue Stall with [P] */}
              <div className="absolute right-[-10px] bottom-[-15px] sm:right-2 sm:bottom-0 w-[240px] sm:w-[320px] pointer-events-none select-none opacity-95">
                <FindParkingIllustration />
              </div>
            </div>

            {/* Card 2: Rent Your Space */}
            <div className="relative overflow-hidden rounded-3xl bg-white dark:bg-neutral-900/90 border border-slate-200 dark:border-neutral-800 p-7 sm:p-9 text-slate-900 dark:text-white flex flex-col justify-between shadow-sm min-h-[260px] sm:min-h-[290px]">
              <div className="z-10 max-w-[240px] sm:max-w-[270px] space-y-2.5">
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  Rent Your Space
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  List your unused parking space, driveway, or commercial bay and earn passive monthly income.
                </p>
                <div className="pt-3">
                  <button
                    type="button"
                    onClick={() => handleOpenAuth('provider')}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-950 dark:bg-white text-white dark:text-slate-950 font-bold text-xs sm:text-sm hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors shadow-sm cursor-pointer"
                  >
                    <span>List Your Space</span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              {/* Right Illustration: 3D Garage Bay with Hazard Stripes & [P] */}
              <div className="absolute right-[-10px] bottom-[-10px] sm:right-2 sm:bottom-0 w-[240px] sm:w-[320px] pointer-events-none select-none opacity-95">
                <RentSpaceIllustration />
              </div>
            </div>
          </div>

          {/* Three Feature Badges */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            {/* Feature 1: EV Parking */}
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-slate-200/80 dark:border-neutral-800 p-4 sm:p-5 flex items-start gap-3.5 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200/60 dark:border-blue-900/60 text-[#0A5CFF] flex items-center justify-center flex-shrink-0">
                <Zap className="w-5 h-5" aria-hidden="true" />
              </div>
              <div className="space-y-0.5">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">EV Parking</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Find EV-friendly parking bays with fast-charging plug points.
                </p>
              </div>
            </div>

            {/* Feature 2: Verified & Secure */}
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-slate-200/80 dark:border-neutral-800 p-4 sm:p-5 flex items-start gap-3.5 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200/60 dark:border-blue-900/60 text-[#0A5CFF] flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="w-5 h-5" aria-hidden="true" />
              </div>
              <div className="space-y-0.5">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Verified &amp; Secure</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Park at physically inspected, CCTV-monitored, gated bays.
                </p>
              </div>
            </div>

            {/* Feature 3: For Businesses */}
            <Link
              href="/driver/home?tab=monthly"
              className="bg-white dark:bg-neutral-900 hover:bg-slate-50 dark:hover:bg-neutral-800/70 transition-colors rounded-2xl border border-slate-200/80 dark:border-neutral-800 p-4 sm:p-5 flex items-start justify-between gap-3.5 shadow-xs group"
            >
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200/60 dark:border-blue-900/60 text-[#0A5CFF] flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-5 h-5" aria-hidden="true" />
                </div>
                <div className="space-y-0.5">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">For Businesses</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Manage and digitize monthly staff and visitor parking.
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#0A5CFF] group-hover:translate-x-0.5 transition-all mt-1" aria-hidden="true" />
            </Link>
          </div>
        </section>

        {/* Section: Plan your parking (Unified Dispatch Card) */}
        <section className="space-y-4 pt-4">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Plan your parking
          </h2>

          <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-slate-200 dark:border-neutral-800 p-4 sm:p-6 shadow-sm space-y-4">
            {/* Mode selection pill tabs */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSearchMode('find')}
                className={`px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${
                  searchMode === 'find'
                    ? 'bg-blue-50 text-[#0A5CFF] dark:bg-blue-950/60 dark:text-blue-400'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Car className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Find Parking</span>
              </button>

              <button
                type="button"
                onClick={() => setSearchMode('rent')}
                className={`px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${
                  searchMode === 'rent'
                    ? 'bg-blue-50 text-[#0A5CFF] dark:bg-blue-950/60 dark:text-blue-400'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Store className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Rent Your Space</span>
              </button>
            </div>

            {/* Horizontal Input Search Grid */}
            <form onSubmit={handleExecuteSearch} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
              {/* Field 1: Location Anchor */}
              <div className="md:col-span-4 p-3 rounded-2xl bg-slate-50 dark:bg-neutral-800/60 border border-slate-200/80 dark:border-neutral-700/80 flex items-center gap-3">
                <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <label htmlFor="search_anchor_select" className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Location
                  </label>
                  <select
                    id="search_anchor_select"
                    value={selectedAnchorId}
                    onChange={(e) => setSelectedAnchorId(e.target.value)}
                    className="w-full bg-transparent font-bold text-xs text-slate-900 dark:text-white focus:outline-none cursor-pointer truncate"
                  >
                    {YELAHANKA_ANCHORS.map((anchor) => (
                      <option key={anchor.id} value={anchor.id} className="dark:bg-slate-900">
                        {anchor.name}
                      </option>
                    ))}
                  </select>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
              </div>

              {/* Field 2: Date */}
              <div className="md:col-span-3 p-3 rounded-2xl bg-slate-50 dark:bg-neutral-800/60 border border-slate-200/80 dark:border-neutral-700/80 flex items-center gap-3">
                <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <label htmlFor="search_date_select" className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Date
                  </label>
                  <select
                    id="search_date_select"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full bg-transparent font-bold text-xs text-slate-900 dark:text-white focus:outline-none cursor-pointer truncate"
                  >
                    <option value="Today" className="dark:bg-slate-900">Today</option>
                    <option value="Tomorrow" className="dark:bg-slate-900">Tomorrow</option>
                    <option value="Weekend Pass" className="dark:bg-slate-900">This Weekend</option>
                  </select>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
              </div>

              {/* Field 3: Time Range */}
              <div className="md:col-span-3 p-3 rounded-2xl bg-slate-50 dark:bg-neutral-800/60 border border-slate-200/80 dark:border-neutral-700/80 flex items-center gap-3">
                <Clock className="w-4 h-4 text-slate-400 flex-shrink-0" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <label htmlFor="search_time_select" className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Time
                  </label>
                  <select
                    id="search_time_select"
                    value={selectedTimeRange}
                    onChange={(e) => setSelectedTimeRange(e.target.value)}
                    className="w-full bg-transparent font-bold text-xs text-slate-900 dark:text-white focus:outline-none cursor-pointer truncate"
                  >
                    <option value="14:00 - 18:00 (4 hrs)" className="dark:bg-slate-900">14:00 – 18:00 (4 hrs)</option>
                    <option value="09:00 - 13:00 (4 hrs)" className="dark:bg-slate-900">09:00 – 13:00 (Morning)</option>
                    <option value="18:00 - 22:00 (4 hrs)" className="dark:bg-slate-900">18:00 – 22:00 (Evening)</option>
                    <option value="Full Day (08:00 - 20:00)" className="dark:bg-slate-900">Full Day (12 hrs)</option>
                  </select>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
              </div>

              {/* Field 4: Action Button */}
              <div className="md:col-span-2">
                <button
                  type="submit"
                  className="w-full h-full py-3.5 px-4 rounded-2xl bg-[#0A5CFF] hover:bg-[#0047d4] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all shadow-md shadow-blue-500/20 active:scale-[0.99] cursor-pointer"
                >
                  <span>{searchMode === 'rent' ? 'List Space' : 'Search Parking'}</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </form>
          </div>
        </section>
      </main>

      {/* 3. Footer with full internal links */}
      <footer className="border-t border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#0B0C10] py-6 px-4 sm:px-6 lg:px-8 mt-12 transition-colors">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-3">
            <VParkLogo className="h-6 w-auto" />
            <span>·</span>
            <span>Bengaluru Smart Parking &amp; Verified Bays</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] flex-wrap justify-center">
            <Link href="/" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Home
            </Link>
            <span>·</span>
            <Link href="/driver/home" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Find Parking
            </Link>
            <span>·</span>
            <button
              type="button"
              onClick={() => handleOpenAuth('provider')}
              className="hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              Rent Your Space
            </button>
            <span>·</span>
            <Link href="/privacy" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <span>·</span>
            <Link href="/contact" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Contact Us
            </Link>
            <span>·</span>
            <Link href="/login" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Login
            </Link>
            <span>·</span>
            <span>© {new Date().getFullYear()} VPark</span>
          </div>
        </div>
      </footer>

      {/* 4. Auth Modal Overlay */}
      {authModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-md bg-white dark:bg-neutral-900 rounded-3xl border border-slate-200 dark:border-neutral-800 p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setAuthModalOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="mb-4">
              <VParkLogo className="h-7 w-auto mb-2" />
              <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
                {authIntent === 'provider' ? 'List & Earn with VPark' : 'Access Your Parking Account'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Fast OTP verification for drivers and verified hosts in Bengaluru.
              </p>
            </div>
            <AuthPanel
              embedded
              initialIntent={authIntent}
              onAuthenticated={handleAuthenticated}
              onClose={() => setAuthModalOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
