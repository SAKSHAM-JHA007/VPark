'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AuthPanel } from '@/components/AuthModal';
import { VParkLogo } from '@/components/VParkLogo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { MobileNav } from '@/components/MobileNav';
import { HowItWorks } from '@/components/HowItWorks';
import { FindParkingIllustration, RentSpaceIllustration } from '@/components/HeroIllustrations';
import { User } from '@/types';
import { Presence } from '@/components/motion/Presence';
import { ModalBackdrop, ModalPanel } from '@/components/motion/AnimatedModal';
import { useSlidingIndicator } from '@/components/motion/useSlidingIndicator';
import { APP_CONFIG, YELAHANKA_ANCHORS } from '@/lib/constants';
import {
  MapPin,
  Calendar,
  Clock,
  ArrowRight,
  Zap,
  ShieldCheck,
  Building2,
  ChevronDown,
  HelpCircle,
  Car,
  Store,
  X,
} from 'lucide-react';

export default function RootHomePage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authIntent, setAuthIntent] = useState<'driver' | 'provider'>('driver');

  // Search Dispatch State
  const [selectedAnchorId, setSelectedAnchorId] = useState(YELAHANKA_ANCHORS[0].id);
  const [selectedDate, setSelectedDate] = useState('Today');
  const [selectedTimeRange, setSelectedTimeRange] = useState('14:00 - 18:00 (4 hrs)');
  const [searchMode, setSearchMode] = useState<'find' | 'rent'>('find');
  const modePill = useSlidingIndicator(searchMode);

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
      } finally {
        if (mounted) {
          setCheckingAuth(false);
        }
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
  };

  const handleAuthenticated = (user: User) => {
    setCurrentUser(user);
    setAuthModalOpen(false);
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
      router.push('/owner/dashboard');
      return;
    }
    router.push(`/driver/home?anchor=${encodeURIComponent(selectedAnchorId)}`);
  };

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col justify-between font-sans transition-colors duration-200">
      {/* 1. Header / Navbar: theme-aware ribbon shared with the app header (.vp-nav) */}
      <header className="vp-nav sticky top-0 z-40 select-none">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-5 lg:gap-8 min-w-0">
            <Link href="/" aria-label="VPark home" className="flex items-center flex-shrink-0 rounded-sm">
              <VParkLogo className="h-7 sm:h-8 w-auto" />
            </Link>

            <nav aria-label="Main navigation" className="hidden md:flex items-center gap-1">
              <Link href="/driver/home" className="vp-nav-link">
                Find Parking
              </Link>
              <button type="button" onClick={() => handleOpenAuth('provider')} className="vp-nav-link">
                Rent Your Space
              </button>
              <Link href="/driver/home?tab=monthly" className="vp-nav-link">
                For Businesses
              </Link>
              <a href="#how-it-works" className="vp-nav-link">
                How it works
              </a>
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {/* Pilot city (informational only) */}
            <div className="vp-nav-control hidden xl:flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-medium whitespace-nowrap">
              <MapPin className="w-3.5 h-3.5 text-[var(--transit-accent)]" aria-hidden="true" />
              <span>Bengaluru</span>
            </div>

            <ThemeToggle />

            <Link href="/contact" className="vp-nav-ghost hidden lg:inline-flex px-2 py-1 text-xs font-semibold">
              Help
            </Link>

            {!currentUser ? (
              <div className="flex items-center gap-1 sm:gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenAuth('driver')}
                  className="vp-nav-ghost px-2 sm:px-3 py-1.5 text-xs font-semibold whitespace-nowrap"
                >
                  Log in
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenAuth('driver')}
                  className="vp-nav-cta hidden sm:inline-flex px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap active:scale-[0.96]"
                >
                  Sign up
                </button>
              </div>
            ) : (
              <Link
                href="/driver/home"
                className="px-4 py-1.5 rounded-full bg-brand hover:bg-brand-hover text-white text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap"
              >
                <span>Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}

            <MobileNav
              items={[
                { key: 'find', label: 'Find Parking', href: '/driver/home' },
                { key: 'rent', label: 'Rent Your Space', onClick: () => handleOpenAuth('provider') },
                { key: 'business', label: 'For Businesses', href: '/driver/home?tab=monthly' },
                {
                  key: 'how',
                  label: 'How it works',
                  onClick: () =>
                    document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
                },
                { key: 'help', label: 'Help & contact', href: '/contact' },
              ]}
              footer={
                !currentUser ? (
                  <button
                    type="button"
                    onClick={() => handleOpenAuth('driver')}
                    className="vp-nav-cta w-full rounded-control px-3 py-2.5 text-sm font-bold sm:hidden"
                  >
                    Sign up
                  </button>
                ) : undefined
              }
            />
          </div>
        </div>
      </header>

      {/* 2. Main Content Container */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-12">
        {/* Section: Explore what you can do with VPark */}
        <section className="space-y-6">
          <div className="space-y-1.5">
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-ink animate-fade-up">
              Explore what you can do with VPark
            </h1>
            <p className="text-sm sm:text-base text-ink-2 animate-fade-up [animation-delay:70ms]">
              Find parking near your destination, or list a space you don’t use. Now piloting in Yelahanka, Bengaluru.
            </p>
          </div>

          {/* Two Hero Action Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            {/* Card 1: Find Parking */}
            <div className="group relative overflow-hidden rounded-card bg-gradient-to-br from-[#060D1E] via-[#09152F] to-[#0A1A3A] border border-blue-900/40 p-6 sm:p-9 text-white flex flex-col justify-between shadow-card min-h-[260px] sm:min-h-[290px] animate-fade-up [animation-delay:130ms] transition-[transform,box-shadow,border-color] duration-300 ease-out-quart hover:border-blue-700/60 hover:shadow-raised motion-safe:hover:-translate-y-1">
              <div className="z-10 max-w-[240px] sm:max-w-[270px] space-y-2.5">
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                  Find Parking
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  Compare reviewed parking spaces near landmarks in Yelahanka.
                </p>
                <div className="pt-3">
                  <Link
                    href="/driver/home"
                    className="group/cta inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-slate-950 font-bold text-xs sm:text-sm hover:bg-slate-100 transition-[background-color,transform] duration-150 active:scale-[0.97] shadow-md"
                  >
                    <span>Find Parking</span>
                    <ArrowRight className="w-4 h-4 text-slate-900 transition-transform duration-200 ease-out-quart group-hover/cta:translate-x-0.5" />
                  </Link>
                </div>
              </div>

              {/* Right Illustration: White Car in Blue Stall with [P] */}
              <div className="relative -mb-4 -mr-2 mt-4 self-end w-[230px] sm:absolute sm:right-2 sm:bottom-0 sm:m-0 sm:w-[320px] pointer-events-none select-none transition-transform duration-500 ease-out-quart motion-safe:group-hover:-translate-y-1 motion-safe:group-hover:translate-x-1">
                <FindParkingIllustration />
              </div>
            </div>

            {/* Card 2: Rent Your Space */}
            <div className="group relative overflow-hidden rounded-card bg-surface border border-hairline p-6 sm:p-9 text-ink flex flex-col justify-between shadow-card min-h-[260px] sm:min-h-[290px] animate-fade-up [animation-delay:190ms] transition-[transform,box-shadow,border-color] duration-300 ease-out-quart hover:border-hairline-strong hover:shadow-raised motion-safe:hover:-translate-y-1">
              <div className="z-10 max-w-[240px] sm:max-w-[270px] space-y-2.5">
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
                  Rent Your Space
                </h2>
                <p className="text-xs sm:text-sm text-ink-2 leading-relaxed">
                  Turn an unused driveway or parking slot into income. Every space is reviewed before drivers see it.
                </p>
                <div className="pt-3">
                  <button
                    type="button"
                    onClick={() => handleOpenAuth('provider')}
                    className="group/cta inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-950 dark:bg-white text-white dark:text-slate-950 font-bold text-xs sm:text-sm hover:bg-slate-800 dark:hover:bg-slate-100 transition-[background-color,transform] duration-150 active:scale-[0.97] shadow-sm"
                  >
                    <span>Get started</span>
                    <ArrowRight className="w-4 h-4 transition-transform duration-200 ease-out-quart group-hover/cta:translate-x-0.5" />
                  </button>
                </div>
              </div>

              {/* Right Illustration: 3D Garage Bay with Hazard Stripes & [P] */}
              <div className="relative -mb-3 mt-4 self-end w-[220px] sm:absolute sm:right-4 sm:bottom-1 sm:m-0 sm:w-[300px] pointer-events-none select-none transition-transform duration-500 ease-out-quart motion-safe:group-hover:-translate-y-1 motion-safe:group-hover:-translate-x-1">
                <RentSpaceIllustration />
              </div>
            </div>
          </div>

          {/* Three Feature Badges */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            {/* Feature 1: EV Parking */}
            <div className="bg-surface rounded-card border border-hairline p-4 sm:p-5 flex items-start gap-3.5 shadow-card animate-fade-up [animation-delay:260ms]">
              <div className="w-10 h-10 rounded-control bg-[var(--nav-active-bg)] text-[var(--transit-accent)] flex items-center justify-center flex-shrink-0">
                <Zap className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <h3 className="font-bold text-sm text-ink">EV-ready spaces</h3>
                <p className="text-xs text-ink-2 leading-relaxed">
                  Filter for spaces their owners have marked as EV-ready.
                </p>
              </div>
            </div>

            {/* Feature 2: Verified & Secure */}
            <div className="bg-surface rounded-card border border-hairline p-4 sm:p-5 flex items-start gap-3.5 shadow-card animate-fade-up [animation-delay:310ms]">
              <div className="w-10 h-10 rounded-control bg-[var(--nav-active-bg)] text-[var(--transit-accent)] flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <h3 className="font-bold text-sm text-ink">Reviewed listings</h3>
                <p className="text-xs text-ink-2 leading-relaxed">
                  Every listing is checked by our team, including proof the owner can rent it, before it appears.
                </p>
              </div>
            </div>

            {/* Feature 3: For Businesses */}
            <Link
              href="/driver/home?tab=monthly"
              className="bg-surface hover:bg-surface-alt transition-[background-color,transform,box-shadow] duration-200 ease-out-quart hover:shadow-raised motion-safe:hover:-translate-y-0.5 rounded-card border border-hairline p-4 sm:p-5 flex items-start justify-between gap-3.5 shadow-xs group animate-fade-up [animation-delay:360ms]"
            >
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-control bg-[var(--nav-active-bg)] text-[var(--transit-accent)] flex items-center justify-center flex-shrink-0 transition-transform duration-200 ease-out-quart motion-safe:group-hover:scale-110">
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="space-y-0.5">
                  <h3 className="font-bold text-sm text-ink">Monthly passes</h3>
                  <p className="text-xs text-ink-2 leading-relaxed">
                    Reserve a regular spot near offices and stations in the pilot area.
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-ink-3 group-hover:text-[var(--transit-accent)] group-hover:translate-x-0.5 transition-[color,transform] duration-200 ease-out-quart mt-1" />
            </Link>
          </div>
        </section>

        {/* Section: Plan your parking (Unified Dispatch Card) */}
        <section className="space-y-4 pt-4 vp-reveal">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
            Plan your parking
          </h2>

          <div className="bg-surface rounded-card border border-hairline p-4 sm:p-6 shadow-card space-y-4">
            {/* Mode selection pill tabs */}
            <div ref={modePill.containerRef} className="relative flex items-center gap-2">
              {modePill.ready && (
                <span
                  aria-hidden="true"
                  style={modePill.indicatorStyle}
                  className={`${modePill.indicatorClassName} rounded-full bg-[var(--nav-active-bg)]`}
                />
              )}
              <button
                ref={modePill.register('find')}
                type="button"
                onClick={() => setSearchMode('find')}
                className={`relative px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 transition-colors ${
                  searchMode === 'find'
                    ? `${modePill.ready ? '' : 'bg-[var(--nav-active-bg)]'} text-[var(--transit-accent)]`
                    : 'text-ink-2 hover:text-ink'
                }`}
              >
                <Car className="w-3.5 h-3.5" />
                <span>Find Parking</span>
              </button>

              <button
                ref={modePill.register('rent')}
                type="button"
                onClick={() => setSearchMode('rent')}
                className={`relative px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 transition-colors ${
                  searchMode === 'rent'
                    ? `${modePill.ready ? '' : 'bg-[var(--nav-active-bg)]'} text-[var(--transit-accent)]`
                    : 'text-ink-2 hover:text-ink'
                }`}
              >
                <Store className="w-3.5 h-3.5" />
                <span>Rent Your Space</span>
              </button>
            </div>

            {/* Horizontal Input Search Grid */}
            <form onSubmit={handleExecuteSearch} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
              {/* Field 1: Location Anchor */}
              <div className="md:col-span-4 p-3 rounded-control bg-surface-alt border border-hairline flex items-center gap-3 transition-[border-color,box-shadow] duration-200 hover:border-hairline-strong focus-within:border-[var(--transit-accent)] focus-within:shadow-[0_0_0_3px_rgba(10,92,255,0.12)]">
                <MapPin className="w-4 h-4 text-ink-3 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-ink-3">
                    Location
                  </span>
                  <select
                    value={selectedAnchorId}
                    onChange={(e) => setSelectedAnchorId(e.target.value)}
                    className="w-full appearance-none bg-transparent font-bold text-xs text-ink focus:outline-none cursor-pointer truncate"
                  >
                    {YELAHANKA_ANCHORS.map((anchor) => (
                      <option key={anchor.id} value={anchor.id} className="dark:bg-slate-900">
                        {anchor.name}
                      </option>
                    ))}
                  </select>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-ink-3" />
              </div>

              {/* Field 2: Date */}
              <div className="md:col-span-3 p-3 rounded-control bg-surface-alt border border-hairline flex items-center gap-3 transition-[border-color,box-shadow] duration-200 hover:border-hairline-strong focus-within:border-[var(--transit-accent)] focus-within:shadow-[0_0_0_3px_rgba(10,92,255,0.12)]">
                <Calendar className="w-4 h-4 text-ink-3 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-ink-3">
                    Date
                  </span>
                  <select
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full appearance-none bg-transparent font-bold text-xs text-ink focus:outline-none cursor-pointer truncate"
                  >
                    <option value="Today" className="dark:bg-slate-900">Today</option>
                    <option value="Tomorrow" className="dark:bg-slate-900">Tomorrow</option>
                    <option value="Weekend Pass" className="dark:bg-slate-900">This Weekend</option>
                  </select>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-ink-3" />
              </div>

              {/* Field 3: Time Range */}
              <div className="md:col-span-3 p-3 rounded-control bg-surface-alt border border-hairline flex items-center gap-3 transition-[border-color,box-shadow] duration-200 hover:border-hairline-strong focus-within:border-[var(--transit-accent)] focus-within:shadow-[0_0_0_3px_rgba(10,92,255,0.12)]">
                <Clock className="w-4 h-4 text-ink-3 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-ink-3">
                    Time
                  </span>
                  <select
                    value={selectedTimeRange}
                    onChange={(e) => setSelectedTimeRange(e.target.value)}
                    className="w-full appearance-none bg-transparent font-bold text-xs text-ink focus:outline-none cursor-pointer truncate"
                  >
                    <option value="14:00 - 18:00 (4 hrs)" className="dark:bg-slate-900">14:00 – 18:00 (4 hrs)</option>
                    <option value="09:00 - 13:00 (4 hrs)" className="dark:bg-slate-900">09:00 – 13:00 (Morning)</option>
                    <option value="18:00 - 22:00 (4 hrs)" className="dark:bg-slate-900">18:00 – 22:00 (Evening)</option>
                    <option value="Full Day (08:00 - 20:00)" className="dark:bg-slate-900">Full Day (12 hrs)</option>
                  </select>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-ink-3" />
              </div>

              {/* Field 4: Action Button */}
              <div className="md:col-span-2">
                <button
                  type="submit"
                  className="group/cta w-full h-full py-3.5 px-4 rounded-control bg-brand hover:bg-brand-hover text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-[background-color,transform] duration-150 active:scale-[0.97]"
                >
                  <span key={searchMode} className="animate-fade-in">{searchMode === 'rent' ? 'List Space' : 'Search Parking'}</span>
                  <ArrowRight className="w-4 h-4 transition-transform duration-200 ease-out-quart group-hover/cta:translate-x-0.5" />
                </button>
              </div>
            </form>
          </div>
        </section>

        {/* Section: How VPark works (PRD 5: short explanation for each side) */}
        <HowItWorks browseHref="/driver/home" onSetUpHost={() => handleOpenAuth('provider')} className="pt-4" />
      </main>

      {/* 3. Footer */}
      <footer className="border-t border-hairline bg-surface py-8 px-4 sm:px-6 lg:px-8 mt-12 transition-colors">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-5 text-xs text-ink-2">
          <div className="flex items-center gap-4">
            <VParkLogo variant="stacked" className="h-12 w-auto" />
            <div className="space-y-0.5">
              <p className="font-semibold text-ink">{APP_CONFIG.brandTagline}</p>
              <p>Pilot area: Yelahanka, Bengaluru</p>
            </div>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <a href="#how-it-works" className="hover:text-ink transition-colors">How it works</a>
            <Link href="/privacy" className="hover:text-ink transition-colors">Privacy</Link>
            <Link href="/contact" className="hover:text-ink transition-colors">Contact</Link>
            <span className="text-ink-3">© {new Date().getFullYear()} VPark</span>
          </nav>
        </div>
      </footer>

      {/* 4. Auth Modal Overlay when user clicks Log In or Sign Up */}
      <Presence>
      {authModalOpen && (
        <ModalBackdrop key="auth-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <ModalPanel className="relative w-full max-w-md bg-surface rounded-card border border-hairline p-6 shadow-raised">
            <button
              type="button"
              onClick={() => setAuthModalOpen(false)}
              aria-label="Close" className="absolute top-4 right-4 p-2 rounded-full text-ink-3 hover:text-ink hover:bg-surface-alt transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="mb-4">
              <VParkLogo variant="stacked" className="h-14 w-auto mb-3" />
              <h3 className="font-extrabold text-lg text-ink">
                {authIntent === 'provider' ? 'List & Earn with VPark' : 'Access Your Parking Account'}
              </h3>
              <p className="text-xs text-ink-2">
                Sign in with your email. One account works for parking and for listing a space.
              </p>
            </div>
            <AuthPanel
              embedded
              initialIntent={authIntent}
              onAuthenticated={handleAuthenticated}
              onClose={() => setAuthModalOpen(false)}
            />
          </ModalPanel>
        </ModalBackdrop>
      )}
      </Presence>
    </div>
  );
}
