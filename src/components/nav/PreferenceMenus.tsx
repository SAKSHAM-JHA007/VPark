'use client';

import React from 'react';
import { Check, ChevronDown, Globe } from 'lucide-react';
import { LANGUAGE_OPTIONS, type Language } from '@/lib/i18n';
import { useI18n } from '@/components/i18n/LanguageProvider';
import { NavMenu } from './NavMenu';

/** Navbar language selector: English, ಕನ್ನಡ, हिन्दी. */
export function LanguageMenu({ labelClassName = 'hidden sm:inline' }: { labelClassName?: string }) {
  const { t, lang, setLang } = useI18n();
  const current = LANGUAGE_OPTIONS.find((o) => o.code === lang) ?? LANGUAGE_OPTIONS[0];

  return (
    <NavMenu
      panelClassName="w-48"
      trigger={(props) => (
        <button
          {...props}
          aria-label={t('language.current', { language: current.label })}
          title={t('language.label')}
          className="vp-nav-control px-2.5"
        >
          <Globe className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <span className={labelClassName} lang={current.code}>
            {current.short}
          </span>
          <ChevronDown className={`${labelClassName} h-3.5 w-3.5 opacity-70`} aria-hidden="true" />
        </button>
      )}
    >
      {({ close }) => (
        <div role="menu" aria-label={t('language.menuLabel')}>
          {LANGUAGE_OPTIONS.map((option) => {
            const checked = option.code === lang;
            return (
              <button
                key={option.code}
                type="button"
                role="menuitemradio"
                aria-checked={checked}
                lang={option.code}
                onClick={() => {
                  setLang(option.code);
                  close();
                }}
                className="vp-menu-item justify-between"
              >
                <span>{option.label}</span>
                {checked && <Check className="h-4 w-4 text-[var(--transit-accent)]" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </NavMenu>
  );
}

/** Full-width language buttons for the compact navigation panel. */
export function MobilePreferences() {
  const { t, lang, setLang } = useI18n();

  return (
    <div>
      <p className="mb-1.5 px-1 text-xs font-semibold text-ink-3">{t('language.label')}</p>
      <div role="group" aria-label={t('language.menuLabel')} className="flex gap-1 rounded-control bg-surface-alt p-1">
        {LANGUAGE_OPTIONS.map((option) => {
          const active = option.code === lang;
          return (
            <button
              key={option.code}
              type="button"
              lang={option.code}
              aria-pressed={active}
              onClick={() => setLang(option.code as Language)}
              className={`flex min-h-[2.75rem] flex-1 items-center justify-center rounded-[10px] px-2 text-sm font-semibold transition-colors ${
                active ? 'bg-[var(--surface-bg)] text-ink shadow-card ring-1 ring-[var(--hairline-strong)]' : 'text-ink-2 hover:text-ink'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
