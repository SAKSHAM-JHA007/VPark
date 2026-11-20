'use client';

import React, { useEffect, useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AuthPanel } from '@/components/AuthModal';
import { HowItWorks } from '@/components/HowItWorks';
import { FindParkingIllustration, RentSpaceIllustration } from '@/components/HeroIllustrations';
import { PublicHeader } from '@/components/nav/PublicHeader';
import { SiteFooter } from '@/components/nav/SiteFooter';
import { FIND_PARKING_PATH } from '@/components/nav/LocationMenu';
import { User } from '@/types';
import { Presence } from '@/components/motion/Presence';
import { ModalBackdrop, ModalPanel } from '@/components/motion/AnimatedModal';
import { useDialog } from '@/components/motion/useDialog';
import { useI18n } from '@/components/i18n/LanguageProvider';
import {
  geolocationErrorKey,
  shortLocationLabel,
  useDeviceLocation,
  useSearchLocation,
} from '@/components/location/useSearchLocation';
import { searchLocationStore } from '@/lib/location/searchLocationStore';
import { YELAHANKA_ANCHORS } from '@/lib/constants';
import {
  MapPin,
  Calendar,
  Clock,
  ArrowRight,
  Zap,
  ShieldCheck,
  Building2,
  Car,
  Store,
  X,
  Crosshair,
  Loader2,
} from 'lucide-react';

const DEVICE_OPTION = '__device__';

export default function RootHomePage() {
  const router = useRouter();
  const { t } = useI18n();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authIntent, setAuthIntent] = useState<'driver' | 'provider'>('driver');

  const searchLocation = useSearchLocation();
  const { status: locateStatus, error: locateError, locate } = useDeviceLocation();
  const [selectedDate, setSelectedDate] = useState('today');
  const [selectedTime, setSelectedTime] = useState('afternoon');
  const [searchMode, setSearchMode] = useState<'find' | 'rent'>('find');
  const ids = { location: useId(), date: useId(), time: useId(), error: useId() };

  useEffect(() => {
    let mounted = true;
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (mounted && data.success && data.user) setCurrentUser(data.user);
      })
      .catch(() => {
        // Continue as guest
      });
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

  const goToResults = () => {
    if (searchLocation.kind === 'device') router.push(`${FIND_PARKING_PATH}?near=me`);
    else router.push(`${FIND_PARKING_PATH}?anchor=${encodeURIComponent(searchLocation.anchorId)}`);
  };

  const handleExecuteSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (searchMode === 'rent') {
      if (currentUser) router.push('/owner/dashboard');
      else handleOpenAuth('provider');
      return;
    }
    goToResults();
  };

  const handleUseLocation = async () => {
    if (locateStatus === 'locating') return;
    const ok = await locate();
    if (ok) router.push(`${FIND_PARKING_PATH}?near=me`);
  };

  const scrollToHow = () =>
    document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const fieldClass =
    'relative flex min-h-[3.5rem] items-center gap-3 rounded-control border border-hairline bg-surface-alt px-3.5 py-2 transition-[border-color,box-shadow] duration-200 hover:border-hairline-strong focus-within:border-[var(--transit-accent)] focus-within:shadow-[var(--focus-ring)]';
  const fieldLabel = 'block text-[11px] font-semibold uppercase tracking-wider text-ink-3';
  const fieldSelect = 'w-full cursor-pointer appearance-none truncate bg-transparent pr-1 text-sm font-semibold text-ink focus:outline-none';

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink">
      <PublicHeader onAuth={handleOpenAuth} signedIn={Boolean(currentUser)} onHowItWorks={scrollToHow} />

      <main id="main-content" className="mx-auto w-full max-w-7xl flex-1 space-y-14 px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        {/* Hero + search */}
        <section aria-labelledby="home-title" className="space-y-6">
          <div className="max-w-3xl space-y-3">
            <p className="vp-eyebrow animate-fade-up">{t('home.eyebrow')}</p>
            <h1 id="home-title" className="vp-h1 animate-fade-up [animation-delay:60ms]">
              {t('home.title')}
            </h1>
            <p className="vp-lead max-w-2xl animate-fade-up [animation-delay:110ms]">{t('home.subtitle')}</p>
          </div>

          <div className="vp-card p-4 sm:p-5 animate-fade-up [animation-delay:150ms]">
            <div role="group" aria-label={t('planner.modeLabel')} className="mb-4 inline-flex gap-1 rounded-full bg-surface-alt p-1">
              {(['find', 'rent'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={searchMode === mode}
                  onClick={() => setSearchMode(mode)}
                  className={`inline-flex min-h-[2.25rem] items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors ${
                    searchMode === mode
                      ? 'bg-surface text-[var(--transit-accent)] shadow-card ring-1 ring-[var(--hairline)]'
                      : 'text-ink-2 hover:text-ink'
                  }`}
                >
                  {mode === 'find' ? <Car className="h-4 w-4" aria-hidden="true" /> : <Store className="h-4 w-4" aria-hidden="true" />}
                  {mode === 'find' ? t('planner.modeFind') : t('planner.modeRent')}
                </button>
              ))}
            </div>

            <form onSubmit={handleExecuteSearch} className="grid grid-cols-1 gap-3 md:grid-cols-12" aria-describedby={locateError ? ids.error : undefined}>
              <div className={`md:col-span-5 ${fieldClass}`}>
                <MapPin className="h-4 w-4 flex-shrink-0 text-[var(--transit-accent)]" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <label htmlFor={ids.location} className={fieldLabel}>
                    {t('planner.location')}
                  </label>
                  <select
                    id={ids.location}
                    value={searchLocation.kind === 'device' ? DEVICE_OPTION : searchLocation.anchorId}
                    onChange={(e) => {
                      if (e.target.value !== DEVICE_OPTION) searchLocationStore.setAnchor(e.target.value);
                    }}
                    className={fieldSelect}
                  >
                    {searchLocation.kind === 'device' && (
                      <option value={DEVICE_OPTION}>{shortLocationLabel(searchLocation, t)}</option>
                    )}
                    {YELAHANKA_ANCHORS.map((anchor) => (
                      <option key={anchor.id} value={anchor.id}>
                        {anchor.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={handleUseLocation}
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
                  <span key={searchMode} className="animate-fade-in">
                    {searchMode === 'rent' ? t('planner.listSpace') : t('planner.search')}
                  </span>
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 ease-out-quart group-hover/cta:translate-x-0.5" aria-hidden="true" />
                </button>
              </div>
            </form>

            <div aria-live="polite" className="sr-only">
              {locateStatus === 'locating' ? t('location.locating') : ''}
            </div>
            {locateError && (
              <p id={ids.error} role="alert" className="vp-alert vp-alert-warning mt-3">
                {t(geolocationErrorKey(locateError))}
              </p>
            )}
          </div>
        </section>

        {/* Two entry points */}
        <section aria-label={t('planner.modeLabel')} className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-2">
          <div className="group relative flex min-h-[260px] flex-col justify-between overflow-hidden rounded-card border border-blue-900/40 bg-gradient-to-br from-[#060D1E] via-[#09152F] to-[#0A1A3A] p-6 text-white shadow-card transition-[transform,box-shadow,border-color] duration-300 ease-out-quart hover:border-blue-700/60 hover:shadow-raised motion-safe:hover:-translate-y-0.5 sm:min-h-[290px] sm:p-9 oled:border-[var(--hairline-strong)] oled:bg-none oled:bg-black">
            <div className="z-10 max-w-[270px] space-y-2.5">
              <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{t('home.findTitle')}</h2>
              <p className="text-sm leading-relaxed text-slate-300">{t('home.findBody')}</p>
              <div className="pt-3">
                <Link href="/driver/home" className="group/cta vp-btn bg-white text-slate-950 hover:bg-slate-100">
                  {t('home.findCta')}
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 ease-out-quart group-hover/cta:translate-x-0.5" aria-hidden="true" />
                </Link>
              </div>
            </div>
            <div className="pointer-events-none relative -mb-4 -mr-2 mt-4 w-[230px] select-none self-end transition-transform duration-500 ease-out-quart motion-safe:group-hover:-translate-y-1 sm:absolute sm:bottom-0 sm:right-2 sm:m-0 sm:w-[320px]">
              <FindParkingIllustration />
            </div>
          </div>

          <div className="group relative flex min-h-[260px] flex-col justify-between overflow-hidden rounded-card border border-hairline bg-surface p-6 text-ink shadow-card transition-[transform,box-shadow,border-color] duration-300 ease-out-quart hover:border-hairline-strong hover:shadow-raised motion-safe:hover:-translate-y-0.5 sm:min-h-[290px] sm:p-9">
            <div className="z-10 max-w-[270px] space-y-2.5">
              <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{t('home.rentTitle')}</h2>
              <p className="text-sm leading-relaxed text-ink-2">{t('home.rentBody')}</p>
              <div className="pt-3">
                {currentUser ? (
                  <Link href="/owner/dashboard" className="group/cta vp-btn vp-btn-inverse">
                    {t('home.rentCta')}
                    <ArrowRight className="h-4 w-4 transition-transform duration-200 ease-out-quart group-hover/cta:translate-x-0.5" aria-hidden="true" />
                  </Link>
                ) : (
                  <button type="button" onClick={() => handleOpenAuth('provider')} className="group/cta vp-btn vp-btn-inverse">
                    {t('home.rentCta')}
                    <ArrowRight className="h-4 w-4 transition-transform duration-200 ease-out-quart group-hover/cta:translate-x-0.5" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
            <div className="pointer-events-none relative -mb-3 mt-4 w-[220px] select-none self-end transition-transform duration-500 ease-out-quart motion-safe:group-hover:-translate-y-1 sm:absolute sm:bottom-1 sm:right-4 sm:m-0 sm:w-[300px]">
              <RentSpaceIllustration />
            </div>
          </div>
        </section>

        {/* Feature highlights */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-3" aria-label={t('how.title')}>
          <div className="vp-card flex items-start gap-3.5 p-5">
            <span className="vp-icon-tile" aria-hidden="true">
              <Zap className="h-5 w-5" />
            </span>
            <div className="space-y-1">
              <h3 className="text-[15px] font-semibold text-ink">{t('home.features.evTitle')}</h3>
              <p className="text-sm leading-relaxed text-ink-2">{t('home.features.evBody')}</p>
            </div>
          </div>
          <div className="vp-card flex items-start gap-3.5 p-5">
            <span className="vp-icon-tile" aria-hidden="true">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div className="space-y-1">
              <h3 className="text-[15px] font-semibold text-ink">{t('home.features.reviewedTitle')}</h3>
              <p className="text-sm leading-relaxed text-ink-2">{t('home.features.reviewedBody')}</p>
            </div>
          </div>
          <Link
            href="/driver/home?tab=monthly"
            className="vp-card group flex items-start justify-between gap-3.5 p-5 transition-[background-color,box-shadow,transform] duration-200 ease-out-quart hover:bg-surface-alt hover:shadow-raised motion-safe:hover:-translate-y-0.5"
          >
            <span className="flex items-start gap-3.5">
              <span className="vp-icon-tile" aria-hidden="true">
                <Building2 className="h-5 w-5" />
              </span>
              <span className="space-y-1">
                <span className="block text-[15px] font-semibold text-ink">{t('home.features.monthlyTitle')}</span>
                <span className="block text-sm leading-relaxed text-ink-2">{t('home.features.monthlyBody')}</span>
              </span>
            </span>
            <ArrowRight className="mt-1 h-4 w-4 flex-shrink-0 text-ink-3 transition-[color,transform] duration-200 ease-out-quart group-hover:translate-x-0.5 group-hover:text-[var(--transit-accent)]" aria-hidden="true" />
          </Link>
        </section>

        <HowItWorks browseHref="/driver/home" onSetUpHost={() => (currentUser ? router.push('/owner/dashboard') : handleOpenAuth('provider'))} />
      </main>

      <SiteFooter />

      <Presence>
        {authModalOpen && (
          <HomeAuthDialog
            key="auth-modal"
            intent={authIntent}
            onClose={() => setAuthModalOpen(false)}
            onAuthenticated={handleAuthenticated}
          />
        )}
      </Presence>
    </div>
  );
}

function HomeAuthDialog({
  intent,
  onClose,
  onAuthenticated,
}: {
  intent: 'driver' | 'provider';
  onClose: () => void;
  onAuthenticated: (user: User) => void;
}) {
  const { t } = useI18n();
  const ref = useDialog<HTMLDivElement>(onClose);
  const titleId = useId();
  return (
    <ModalBackdrop
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <ModalPanel className="relative my-auto w-full max-w-md">
        <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} className="vp-card p-5 shadow-raised sm:p-6">
          <button
            type="button"
            onClick={onClose}
            aria-label={t('auth.close')}
            className="absolute right-3 top-3 rounded-full p-2 text-ink-3 transition-colors hover:bg-surface-alt hover:text-ink"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
          <div className="mb-5 pr-8">
            <h2 id={titleId} className="text-lg font-bold text-ink">
              {intent === 'provider' ? t('home.authProviderTitle') : t('home.authDriverTitle')}
            </h2>
            <p className="mt-1 text-sm text-ink-2">{t('home.authBody')}</p>
          </div>
          <AuthPanel embedded initialIntent={intent} onAuthenticated={onAuthenticated} />
        </div>
      </ModalPanel>
    </ModalBackdrop>
  );
}
