'use client';

import React, { useState } from 'react';
import { User, UserRole } from '@/types';
import { Language, getT, translations } from '@/lib/i18n';
import { VParkLogo } from '@/components/VParkLogo';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
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
  onSwitchDemoPersona: (role: UserRole) => void;
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
    <header className="sticky top-0 z-40 bg-[var(--surface-bg)] border-b border-[var(--hairline)] select-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-15 flex items-center justify-between gap-4">
        {/* Brand Logo + Primary Navigation */}
        <div className="flex items-center gap-6 lg:gap-10">
          <button
            type="button"
            onClick={() => onTabChange('search')}
            className="flex items-center gap-2.5 text-left rounded-sm focus-visible:outline-2 py-0.5"
          >
            <VParkLogo className="h-7 sm:h-8 w-auto" />
            <span className="hidden sm:inline-block text-[9px] font-mono tracking-widest text-[var(--ink-tertiary)] uppercase border-l border-[var(--hairline)] pl-2.5 py-0.5">
              Pilot · BLR/YEL
            </span>
          </button>

          <nav aria-label="Main navigation" className="hidden md:flex items-center gap-1 text-xs">
            <button
              type="button"
              onClick={() => onTabChange('search')}
              className={`px-3 py-1.5 rounded-sm font-mono text-xs uppercase tracking-wider transition-colors ${
                activeTab === 'search'
                  ? 'bg-[var(--surface-alt)] text-[var(--transit-accent)] font-semibold border-b-2 border-[var(--transit-accent)]'
                  : 'text-[var(--ink-secondary)] hover:text-[var(--ink)] hover:bg-[var(--surface-alt)]'
              }`}
            >
              <span className="opacity-40 mr-1.5">01</span>{t.findParking}
            </button>

            <button
              type="button"
              onClick={handleListSpaceClick}
              className={`px-3 py-1.5 rounded-sm font-mono text-xs uppercase tracking-wider transition-colors ${
                activeTab === 'provider'
                  ? 'bg-[var(--surface-alt)] text-[var(--transit-accent)] font-semibold border-b-2 border-[var(--transit-accent)]'
                  : 'text-[var(--ink-secondary)] hover:text-[var(--ink)] hover:bg-[var(--surface-alt)]'
              }`}
            >
              <span className="opacity-40 mr-1.5">02</span>{t.listSpace}
            </button>

            <button
              type="button"
              onClick={() => {
                onTabChange('search');
                setTimeout(onScrollHowItWorks, 50);
              }}
              className="px-3 py-1.5 rounded-sm font-mono text-xs uppercase tracking-wider text-[var(--ink-secondary)] hover:text-[var(--ink)] hover:bg-[var(--surface-alt)] transition-colors"
            >
              <span className="opacity-40 mr-1.5">03</span>{t.howItWorks}
            </button>

            <button
              type="button"
              onClick={() => onTabChange('monthly')}
              className={`px-3 py-1.5 rounded-sm font-mono text-xs uppercase tracking-wider transition-colors ${
                activeTab === 'monthly'
                  ? 'bg-[var(--surface-alt)] text-[var(--transit-accent)] font-semibold border-b-2 border-[var(--transit-accent)]'
                  : 'text-[var(--ink-secondary)] hover:text-[var(--ink)] hover:bg-[var(--surface-alt)]'
              }`}
            >
              <span className="opacity-40 mr-1.5">04</span>{t.monthlyPasses}
            </button>

            {hasAdmin && (
              <button
                type="button"
                onClick={() => onTabChange('admin')}
                className={`px-3 py-1.5 rounded-sm font-mono text-xs uppercase tracking-wider transition-colors flex items-center gap-1.5 ${
                  activeTab === 'admin'
                    ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 font-semibold border-b-2 border-amber-600'
                    : 'text-[var(--ink-secondary)] hover:text-[var(--ink)] hover:bg-[var(--surface-alt)]'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                {t.adminConsole}
              </button>
            )}
          </nav>
        </div>

        {/* Right Side: Theme Toggle + Log in / Profile */}
        <div className="flex items-center gap-2">
          <ThemeToggle />

          {currentUser && (
            <button
              type="button"
              onClick={() => onTabChange('bookings')}
              aria-label="My Bookings & Notifications"
              title="My Bookings & Notifications"
              className="relative p-2 rounded-sm border border-[var(--hairline)] text-[var(--ink-secondary)] hover:text-[var(--ink)] hover:bg-[var(--surface-alt)] transition-colors"
            >
              <Bell className="w-3.5 h-3.5" />
              {bookingsCount > 0 && (
                <span className="absolute -top-1 -right-1 px-1 rounded-sm bg-[var(--transit-accent)] text-white text-[9px] font-mono leading-tight">
                  {bookingsCount}
                </span>
              )}
            </button>
          )}

          {!currentUser ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenLogin('driver')}
                className="px-3.5 py-1.5 rounded-sm bg-[var(--transit-accent)] hover:bg-[var(--transit-accent-hover)] text-white font-mono text-xs uppercase tracking-wider transition-colors"
              >
                {t.logIn}
              </button>
            </div>
          ) : (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                aria-expanded={showProfileMenu}
                aria-label="Open account menu"
                className="flex items-center gap-2 p-1.5 pl-2 pr-2 rounded-sm border border-[var(--hairline)] hover:bg-[var(--surface-alt)] transition-colors"
              >
                <div className="w-5 h-5 rounded-xs bg-[var(--surface-alt)] border border-[var(--hairline-strong)] text-[var(--ink)] flex items-center justify-center font-mono font-bold text-[10px]">
                  {(currentUser.name || 'V')[0].toUpperCase()}
                </div>
                <span className="hidden sm:inline text-xs font-mono text-[var(--ink)] max-w-[120px] truncate">
                  {currentUser.name || currentUser.phone}
                </span>
                <ChevronDown className="w-3 h-3 text-[var(--ink-tertiary)]" />
              </button>

              {showProfileMenu && (
                <div className="absolute right-0 mt-1 w-72 bg-[var(--surface-bg)] rounded-sm border border-[var(--hairline-strong)] shadow-sm p-2 z-50 text-xs text-[var(--ink)]">
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
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750'
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
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
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
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
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
                  <div className="py-1.5 border-t border-slate-100 dark:border-slate-700 space-y-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        onTabChange('bookings');
                        setShowProfileMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
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
                      className="w-full text-left px-3 py-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
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
                      className="w-full text-left px-3 py-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
                    >
                      <FileText className="w-4 h-4 text-slate-400" />
                      DPDP 2023 Data Privacy
                    </button>
                  </div>

                  {/* Language Selector (PRD Section 10) */}
                  {onLangChange && (
                    <div className="py-1.5 px-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
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
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                            }`}
                          >
                            {langCode}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Demo Persona Switcher + Logout */}
                  <div className="pt-1.5 border-t border-slate-100 dark:border-slate-700 space-y-1">
                    <div className="px-3 py-0.5 text-xs text-slate-400 font-medium flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      Demo Personas
                    </div>
                    <div className="grid grid-cols-3 gap-1 px-2">
                      <button
                        type="button"
                        onClick={() => {
                          onSwitchDemoPersona('DRIVER');
                          onTabChange('search');
                          setShowProfileMenu(false);
                        }}
                        className="py-1 rounded-md bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-medium text-xs"
                      >
                        Driver
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onSwitchDemoPersona('PROVIDER');
                          onTabChange('provider');
                          setShowProfileMenu(false);
                        }}
                        className="py-1 rounded-md bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-medium text-xs"
                      >
                        Provider
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onSwitchDemoPersona('ADMIN');
                          onTabChange('admin');
                          setShowProfileMenu(false);
                        }}
                        className="py-1 rounded-md bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-medium text-xs"
                      >
                        Admin
                      </button>
                    </div>

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
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
