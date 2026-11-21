'use client';

import React from 'react';
import { User, UserRole } from '@/types';
import { useI18n } from '@/components/i18n/LanguageProvider';
import { SiteHeader, type SiteNavItem } from '@/components/nav/SiteHeader';
import { MenuLabel, NavMenu } from '@/components/nav/NavMenu';
import { Bell, ChevronDown, FileText, Car, Calendar, LogOut, PlusCircle, ShieldCheck, Building2 } from 'lucide-react';

type Tab = 'search' | 'bookings' | 'monthly' | 'provider' | 'admin';

interface HeaderProps {
  currentUser: User | null;
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  onAddCapability: (role: 'DRIVER' | 'PROVIDER') => void;
  onOpenLogin: (intent?: 'driver' | 'provider') => void;
  onLogout: () => void;
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  onOpenDpdp: () => void;
  onScrollHowItWorks: () => void;
  /** Called after a new search location is chosen in the navbar. */
  onLocationSelected: () => void;
  bookingsCount?: number;
}

export function Header({
  currentUser,
  currentRole,
  onRoleChange,
  onAddCapability,
  onOpenLogin,
  onLogout,
  activeTab,
  onTabChange,
  onOpenDpdp,
  onScrollHowItWorks,
  onLocationSelected,
  bookingsCount = 0,
}: HeaderProps) {
  const { t } = useI18n();

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

  const navItems: SiteNavItem[] = [
    { key: 'search', label: t('nav.findParking'), active: activeTab === 'search', onClick: () => onTabChange('search') },
    { key: 'provider', label: t('nav.listSpace'), active: activeTab === 'provider', onClick: handleListSpaceClick },
    { key: 'monthly', label: t('nav.forBusinesses'), active: activeTab === 'monthly', onClick: () => onTabChange('monthly') },
    {
      key: 'how',
      label: t('nav.howItWorks'),
      onClick: () => {
        onTabChange('search');
        setTimeout(onScrollHowItWorks, 50);
      },
    },
    ...(hasAdmin
      ? [
          {
            key: 'admin',
            label: t('nav.admin'),
            active: activeTab === 'admin',
            icon: <ShieldCheck className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />,
            onClick: () => onTabChange('admin'),
          },
        ]
      : []),
  ];

  const menuRow = (active: boolean) => `vp-menu-item ${active ? 'bg-surface-alt text-ink font-semibold' : ''}`;

  return (
    <SiteHeader
      navItems={navItems}
      onLogoClick={() => onTabChange('search')}
      locationMode="inline"
      onLocationSelected={onLocationSelected}
      actions={() =>
        !currentUser ? (
          <div className="hidden items-center gap-1 sm:flex">
            <button
              type="button"
              onClick={() => onOpenLogin('driver')}
              className="vp-nav-cta inline-flex min-h-[2.25rem] items-center whitespace-nowrap rounded-full px-4 text-sm font-semibold"
            >
              {t('nav.logIn')}
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onTabChange('bookings')}
              aria-label={t('nav.bookingsBadge', { count: bookingsCount })}
              title={t('account.myBookings')}
              className="vp-nav-control relative hidden sm:inline-flex"
            >
              <Bell className="h-4 w-4" aria-hidden="true" />
              {bookingsCount > 0 && (
                <span
                  key={bookingsCount}
                  aria-hidden="true"
                  className="absolute -right-1 -top-1 min-w-[1.125rem] rounded-full bg-brand px-1 text-center text-[10px] font-bold leading-[1.125rem] text-white animate-pop"
                >
                  {bookingsCount}
                </span>
              )}
            </button>

            <NavMenu
              panelClassName="w-72"
              trigger={(props) => (
                <button {...props} aria-label={t('account.openMenu')} className="vp-nav-control gap-2 pl-1 pr-2 sm:pr-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-xs font-bold text-white" aria-hidden="true">
                    {(currentUser.name || 'V')[0].toUpperCase()}
                  </span>
                  <span className="hidden max-w-[8rem] truncate text-sm font-medium text-[var(--nav-ink)] md:inline">
                    {currentUser.name || currentUser.phone}
                  </span>
                  <ChevronDown className="hidden h-3.5 w-3.5 sm:block" aria-hidden="true" />
                </button>
              )}
            >
              {({ close }) => (
                <div role="menu" aria-label={t('account.openMenu')}>
                  <div className="border-b border-hairline px-3 pb-2.5 pt-2">
                    <span className="block truncate text-sm font-semibold text-ink">{currentUser.name || t('account.member')}</span>
                    {currentUser.email && <span className="block truncate text-xs text-ink-3">{currentUser.email}</span>}
                  </div>

                  <div role="group" aria-label={t('account.modes')} className="py-1.5">
                    <MenuLabel>{t('account.modes')}</MenuLabel>
                    {hasDriver ? (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          onRoleChange('DRIVER');
                          onTabChange('search');
                          close();
                        }}
                        className={menuRow(currentRole === 'DRIVER' && activeTab !== 'provider')}
                      >
                        <Car className="h-4 w-4 text-[var(--transit-accent)]" aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className="block">{t('account.driverMode')}</span>
                          <span className="block text-xs font-normal text-ink-3">{t('account.driverModeHint')}</span>
                        </span>
                        {currentRole === 'DRIVER' && <span className="vp-badge vp-badge-info">{t('common.active')}</span>}
                      </button>
                    ) : (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          onAddCapability('DRIVER');
                          onTabChange('search');
                          close();
                        }}
                        className="vp-menu-item text-[var(--transit-accent)]"
                      >
                        <PlusCircle className="h-4 w-4" aria-hidden="true" />
                        {t('account.enableDriver')}
                      </button>
                    )}

                    {hasProvider ? (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          onRoleChange('PROVIDER');
                          onTabChange('provider');
                          close();
                        }}
                        className={menuRow(currentRole === 'PROVIDER' || activeTab === 'provider')}
                      >
                        <Building2 className="h-4 w-4 text-[var(--host-ink)]" aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className="block">{t('account.hostDashboard')}</span>
                          <span className="block text-xs font-normal text-ink-3">{t('account.hostHint')}</span>
                        </span>
                        {currentRole === 'PROVIDER' && <span className="vp-badge vp-badge-host">{t('common.active')}</span>}
                      </button>
                    ) : (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          onAddCapability('PROVIDER');
                          onTabChange('provider');
                          close();
                        }}
                        className="vp-menu-item text-[var(--host-ink)]"
                      >
                        <PlusCircle className="h-4 w-4" aria-hidden="true" />
                        {t('account.enableHost')}
                      </button>
                    )}

                    {hasAdmin && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          onRoleChange('ADMIN');
                          onTabChange('admin');
                          close();
                        }}
                        className={menuRow(activeTab === 'admin')}
                      >
                        <ShieldCheck className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                        <span className="flex-1">{t('account.adminQueue')}</span>
                        {activeTab === 'admin' && <span className="vp-badge vp-badge-warning">{t('common.active')}</span>}
                      </button>
                    )}
                  </div>

                  <div className="border-t border-hairline py-1.5">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        onTabChange('bookings');
                        close();
                      }}
                      className="vp-menu-item"
                    >
                      <Car className="h-4 w-4 text-ink-3" aria-hidden="true" />
                      <span className="flex-1">{t('account.myBookings')}</span>
                      {bookingsCount > 0 && <span className="vp-badge">{bookingsCount}</span>}
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        onTabChange('monthly');
                        close();
                      }}
                      className="vp-menu-item"
                    >
                      <Calendar className="h-4 w-4 text-ink-3" aria-hidden="true" />
                      {t('account.monthlyPasses')}
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        onOpenDpdp();
                        close(false);
                      }}
                      className="vp-menu-item"
                    >
                      <FileText className="h-4 w-4 text-ink-3" aria-hidden="true" />
                      {t('account.privacy')}
                    </button>
                  </div>

                  <div className="border-t border-hairline pt-1.5">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        close(false);
                        onLogout();
                      }}
                      className="vp-menu-item text-[var(--danger-ink)] hover:text-[var(--danger-ink)]"
                    >
                      <LogOut className="h-4 w-4" aria-hidden="true" />
                      {t('account.signOut')}
                    </button>
                  </div>
                </div>
              )}
            </NavMenu>
          </>
        )
      }
      mobileFooter={
        !currentUser ? (
          <button type="button" onClick={() => onOpenLogin('driver')} className="vp-btn vp-btn-inverse w-full">
            {t('nav.logIn')}
          </button>
        ) : (
          <button type="button" onClick={() => onTabChange('bookings')} className="vp-btn vp-btn-secondary w-full">
            <Bell className="h-4 w-4" aria-hidden="true" />
            {t('account.myBookings')}
            {bookingsCount > 0 && <span className="vp-badge">{bookingsCount}</span>}
          </button>
        )
      }
    />
  );
}
