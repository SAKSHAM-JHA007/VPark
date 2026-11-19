'use client';

import React, { useState } from 'react';
import { User, UserRole } from '@/types';
import { Language, getT, translations } from '@/lib/i18n';
import { VParkLogo } from '@/components/VParkLogo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Presence } from '@/components/motion/Presence';
import { DropdownSurface } from '@/components/motion/AnimatedModal';
import { useSlidingIndicator } from '@/components/motion/useSlidingIndicator';
import { MobileNav } from '@/components/MobileNav';
import {
  MapPin,
  Bell,
  User as UserIcon,
  ChevronDown,
  FileText,
  Car,
  Calendar,
  LogOut,
  PlusCircle,
  ShieldCheck,
  Globe,
  Users,
} from 'lucide-react';

interface HeaderProps {
  currentUser: User | null;
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  onAddCapability: (role: 'DRIVER' | 'PROVIDER') => void;
  onSwitchDemoPersona?: (role: UserRole) => void;
  onOpenLogin: (intent?: 'driver' | 'provider') => void;
  onLogout: () => void;
  activeTab: 'search' | 'bookings' | 'monthly' | 'provider' | 'admin';
  onTabChange: (tab: 'search' | 'bookings' | 'monthly' | 'provider' | 'admin') => void;
  onOpenDpdp: () => void;
  onScrollHowItWorks: () => void;
  currentLang?: Language;
  onLangChange?: (lang: Language) => void;
  bookingsCount?: number;
}

export function Header({
  currentUser,
  currentRole,
  onRoleChange,
  onAddCapability,
  onSwitchDemoPersona,
  onOpenLogin,
  onLogout,
  activeTab,
  onTabChange,
  onOpenDpdp,
  onScrollHowItWorks,
  currentLang = 'en',
  onLangChange,
  bookingsCount = 0,
}: HeaderProps) {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const navPill = useSlidingIndicator(
    activeTab === 'search' || activeTab === 'provider' || activeTab === 'monthly' ? activeTab : null
  );
  const t = getT(currentLang) || translations?.en || ({} as any);

  const hasDriver = currentUser?.roles?.includes('DRIVER') ?? false;
  const hasProvider = currentUser?.roles?.includes('PROVIDER') ?? false;
  const hasAdmin = currentUser?.roles?.includes('ADMIN') ?? false;

  const handleListSpaceClick = () => {
    if (!currentUser) {
      onOpenLogin('provider');
      return;
    }
    if (!hasProvider) {
      onAddCapability('PROVIDER');
    } else {
      onRoleChange('PROVIDER');
    }
    onTabChange('provider');
  };

  return (
    <header className="vp-nav sticky top-0 z-40 select-none">
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand Logo + Primary Navigation */}
        <div className="flex items-center gap-5 lg:gap-8 min-w-0">
          <button
            type="button"
            onClick={() => onTabChange('search')}
            aria-label="VPark home: find parking"
            className="flex items-center text-left rounded-sm flex-shrink-0"
          >
            <VParkLogo className="h-7 sm:h-8 w-auto" />
          </button>

          <nav
            ref={navPill.containerRef}
            aria-label="Main navigation"
            className="relative hidden md:flex items-center gap-1"
          >
            {navPill.ready && (
              <span
                aria-hidden="true"
                style={navPill.indicatorStyle}
                className={`${navPill.indicatorClassName} vp-nav-pill rounded-full`}
              />
            )}
            <button
              type="button"
              ref={navPill.register('search')}
              onClick={() => onTabChange('search')}
              aria-current={activeTab === 'search' ? 'page' : undefined}
              className={`vp-nav-link ${
                activeTab === 'search' ? `vp-nav-link-active ${navPill.ready ? '' : 'vp-nav-pill'}` : ''
              }`}
            >
              {t.findParking}
            </button>

            <button
              type="button"
              ref={navPill.register('provider')}
              onClick={handleListSpaceClick}
              aria-current={activeTab === 'provider' ? 'page' : undefined}
              className={`vp-nav-link ${
                activeTab === 'provider' ? `vp-nav-link-active ${navPill.ready ? '' : 'vp-nav-pill'}` : ''
              }`}
            >
              {t.listSpace}
            </button>

            <button
              type="button"
              ref={navPill.register('monthly')}
              onClick={() => onTabChange('monthly')}
              aria-current={activeTab === 'monthly' ? 'page' : undefined}
              className={`vp-nav-link ${
                activeTab === 'monthly' ? `vp-nav-link-active ${navPill.ready ? '' : 'vp-nav-pill'}` : ''
              }`}
            >
              For Businesses
            </button>

            <button
              type="button"
              onClick={() => {
                onTabChange('search');
                setTimeout(onScrollHowItWorks, 50);
              }}
              className="vp-nav-link"
            >
              {t.howItWorks}
            </button>

            {hasAdmin && (
              <button
                type="button"
                onClick={() => onTabChange('admin')}
                aria-current={activeTab === 'admin' ? 'page' : undefined}
                className={`vp-nav-link gap-1.5 ${
                  activeTab === 'admin'
                    ? 'bg-amber-500/15 !text-amber-700 dark:!text-amber-300 ring-1 ring-inset ring-amber-500/40'
                    : ''
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                {t.adminConsole}
              </button>
            )}
          </nav>
        </div>

        {/* Right Side: Location, Language, Theme Toggle, Log in / Profile */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          {/* Pilot city (informational only) */}
          <div className="vp-nav-control hidden xl:flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-medium whitespace-nowrap">
            <MapPin className="w-3.5 h-3.5 text-[var(--transit-accent)]" aria-hidden="true" />
            <span>Bengaluru</span>
          </div>

          {/* Current language (changed from the account menu) */}
          {onLangChange && (
            <span
              className="vp-nav-ghost hidden lg:flex items-center gap-1 px-1.5 py-1 text-[11px] font-semibold uppercase"
              title="Language can be changed from the account menu"
            >
              <Globe className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="sr-only">Language: </span>
              {currentLang}
            </span>
          )}

          <ThemeToggle />

          {currentUser && (
            <button
              type="button"
              onClick={() => onTabChange('bookings')}
              aria-label="My Bookings & Notifications"
              title="My Bookings & Notifications"
              className="vp-nav-control relative h-8 w-8 flex items-center justify-center rounded-full"
            >
              <Bell className="w-3.5 h-3.5" />
              {bookingsCount > 0 && (
                <span
                  key={bookingsCount}
                  className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full bg-brand text-white text-[9px] font-bold leading-tight animate-pop"
                >
                  {bookingsCount}
                </span>
              )}
            </button>
          )}

          {!currentUser ? (
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                type="button"
                onClick={() => onOpenLogin('driver')}
                className="vp-nav-ghost px-2 sm:px-3 py-1.5 text-xs font-semibold whitespace-nowrap"
              >
                {t.logIn}
              </button>
              <button
                type="button"
                onClick={() => onOpenLogin('driver')}
                className="vp-nav-cta hidden sm:inline-flex px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap active:scale-[0.96]"
              >
                Sign up
              </button>
            </div>
          ) : (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                aria-expanded={showProfileMenu}
                aria-label="Open account menu"
                className="vp-nav-control flex items-center gap-2 p-1.5 pl-2 sm:pl-2.5 pr-2 rounded-full"
              >
                <div className="w-5 h-5 rounded-full bg-brand text-white flex items-center justify-center font-bold text-[10px]">
                  {(currentUser.name || 'V')[0].toUpperCase()}
                </div>
                <span className="hidden sm:inline text-xs font-medium text-[var(--nav-ink)] max-w-[120px] truncate">
                  {currentUser.name || currentUser.phone}
                </span>
                <ChevronDown
                  className={`w-3 h-3 transition-transform duration-200 ease-out-quart ${
                    showProfileMenu ? 'rotate-180' : ''
                  }`}
                />
              </button>

              <Presence>
              {showProfileMenu && (
                <DropdownSurface
                  className="absolute right-0 mt-2 w-72 max-w-[calc(100vw-2rem)] bg-surface rounded-card border border-hairline-strong shadow-raised p-2 z-50 text-xs text-ink"
                >
                  <div className="px-3 py-2 border-b border-[var(--hairline)]">
                    <span className="font-semibold text-[var(--ink)] block text-xs">
                      {currentUser.name || 'VPark Member'}
                    </span>
                    <span className="text-[var(--ink-tertiary)] text-[11px] font-mono">
                      {currentUser.phone} · BLR
                    </span>
                  </div>

                  {/* Account Capability Mode Switcher (PRD Section 4) */}
                  <div className="py-1.5 space-y-0.5">
                    <div className="px-3 py-1 font-mono text-[10px] text-[var(--ink-tertiary)] uppercase tracking-wider">
                      Account Modes
                    </div>

                    {hasDriver ? (
                      <button
                        type="button"
                        onClick={() => {
                          onRoleChange('DRIVER');
                          onTabChange('search');
                          setShowProfileMenu(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between ${
                          currentRole === 'DRIVER' && activeTab !== 'provider'
                            ? 'bg-blue-50 dark:bg-blue-950/60 text-[#0A5CFF] dark:text-blue-400 font-semibold'
                            : 'text-ink-2 hover:bg-surface-alt hover:text-ink'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <Car className="w-4 h-4 text-[#0A5CFF]" />
                          Driver Mode (Get parking)
                        </span>
                        {currentRole === 'DRIVER' && (
                          <span className="text-[10px] bg-blue-100 dark:bg-blue-900/60 text-[#0A5CFF] dark:text-blue-300 px-1.5 py-0.5 rounded font-bold">Active</span>
                        )}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          onAddCapability('DRIVER');
                          onTabChange('search');
                          setShowProfileMenu(false);
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg text-[#0A5CFF] dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 font-medium flex items-center gap-2"
                      >
                        <PlusCircle className="w-4 h-4" />
                        Enable Driver Mode (1-click)
                      </button>
                    )}

                    {hasProvider ? (
                      <button
                        type="button"
                        onClick={() => {
                          onRoleChange('PROVIDER');
                          onTabChange('provider');
                          setShowProfileMenu(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between ${
                          currentRole === 'PROVIDER' || activeTab === 'provider'
                            ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 font-semibold'
                            : 'text-ink-2 hover:bg-surface-alt hover:text-ink'
                        }`}
                      >
                        <span>Host Dashboard (Rent your space)</span>
                        {currentRole === 'PROVIDER' && (
                          <span className="text-[10px] bg-purple-200 dark:bg-purple-900/60 text-purple-800 dark:text-purple-200 px-1.5 py-0.5 rounded font-bold">Active</span>
                        )}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          onAddCapability('PROVIDER');
                          onTabChange('provider');
                          setShowProfileMenu(false);
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/50 font-medium flex items-center gap-2"
                      >
                        <PlusCircle className="w-4 h-4" />
                        Add Host Capability (Rent space)
                      </button>
                    )}

                    {hasAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          onRoleChange('ADMIN');
                          onTabChange('admin');
                          setShowProfileMenu(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between ${
                          activeTab === 'admin'
                            ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-semibold'
                            : 'text-ink-2 hover:bg-surface-alt hover:text-ink'
                        }`}
                      >
                        <span>Admin Verification Queue</span>
                        {activeTab === 'admin' && (
                          <span className="text-[10px] bg-amber-200 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 px-1.5 py-0.5 rounded font-bold">Active</span>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Navigation Shortcuts & DPDP */}
                  <div className="py-1.5 border-t border-hairline space-y-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        onTabChange('bookings');
                        setShowProfileMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg text-ink-2 hover:bg-surface-alt hover:text-ink flex items-center gap-2"
                    >
                      <Car className="w-4 h-4 text-[#0A5CFF]" />
                      {t.myBookings}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onTabChange('monthly');
                        setShowProfileMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg text-ink-2 hover:bg-surface-alt hover:text-ink flex items-center gap-2"
                    >
                      <Calendar className="w-4 h-4 text-indigo-500" />
                      {t.monthlyPasses}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onOpenDpdp();
                        setShowProfileMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg text-ink-2 hover:bg-surface-alt hover:text-ink flex items-center gap-2"
                    >
                      <FileText className="w-4 h-4 text-ink-3" />
                      DPDP 2023 Data Privacy
                    </button>
                  </div>

                  {/* Language Selector (PRD Section 10) */}
                  {onLangChange && (
                    <div className="py-1.5 px-3 border-t border-hairline flex items-center justify-between">
                      <span className="text-ink-3 flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5" />
                        Language
                      </span>
                      <div className="flex gap-1">
                        {(['en', 'kn', 'hi'] as Language[]).map((langCode) => (
                          <button
                            key={langCode}
                            type="button"
                            onClick={() => onLangChange(langCode)}
                            className={`px-2 py-0.5 rounded font-semibold uppercase text-xs ${
                              currentLang === langCode
                                ? 'bg-[#0A5CFF] text-white'
                                : 'bg-surface-alt text-ink-2 hover:bg-hairline'
                            }`}
                          >
                            {langCode}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Profile Actions: Logout */}
                  <div className="pt-1.5 border-t border-slate-100 dark:border-slate-700">

                    <button
                      type="button"
                      onClick={() => {
                        setShowProfileMenu(false);
                        onLogout();
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-medium flex items-center gap-2 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign out
                    </button>
                  </div>
                </DropdownSurface>
              )}
              </Presence>
            </div>
          )}

          <MobileNav
            items={[
              { key: 'search', label: t.findParking, active: activeTab === 'search', onClick: () => onTabChange('search') },
              { key: 'provider', label: t.listSpace, active: activeTab === 'provider', onClick: handleListSpaceClick },
              { key: 'monthly', label: 'For Businesses', active: activeTab === 'monthly', onClick: () => onTabChange('monthly') },
              {
                key: 'how',
                label: t.howItWorks,
                onClick: () => {
                  onTabChange('search');
                  setTimeout(onScrollHowItWorks, 50);
                },
              },
              ...(hasAdmin
                ? [{ key: 'admin', label: t.adminConsole, active: activeTab === 'admin', onClick: () => onTabChange('admin') }]
                : []),
            ]}
            footer={
              !currentUser ? (
                <button
                  type="button"
                  onClick={() => onOpenLogin('driver')}
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
  );
}
