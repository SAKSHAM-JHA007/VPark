'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  LANGUAGE_CHANGE_EVENT,
  createTranslator,
  languageCookieString,
  normalizeLanguage,
  translate,
  type Language,
  type Translator,
} from '@/lib/i18n';

const META_TITLE_KEYS = ['meta.siteTitle', 'meta.contactTitle', 'meta.privacyTitle', 'meta.notFoundTitle'] as const;

interface LanguageContextValue extends Translator {
  setLang: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

/**
 * Single source of truth for the interface language.
 *
 * The server reads the `vpark_lang` cookie in the root layout and passes it here as
 * `initialLang`, so server HTML and the first client render use the same language
 * (no hydration mismatch and no English flash). Changing the language rewrites the
 * cookie, updates <html lang> and re-renders every consumer from context.
 */
export function LanguageProvider({ initialLang, children }: { initialLang: Language; children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>(initialLang);

  const setLang = useCallback((next: Language) => {
    const safe = normalizeLanguage(next);
    // Keep the tab title in step with the page (server metadata is per request).
    const prev = normalizeLanguage(document.documentElement.lang);
    const titleKey = META_TITLE_KEYS.find((key) => translate(prev, key) === document.title);
    if (titleKey) document.title = translate(safe, titleKey);
    setLangState(safe);
    try {
      document.cookie = languageCookieString(safe);
    } catch {
      // Cookies blocked: the choice still applies until the page is reloaded.
    }
    document.documentElement.lang = safe;
    window.dispatchEvent(new CustomEvent(LANGUAGE_CHANGE_EVENT, { detail: safe }));
  }, []);

  // Keep several open tabs in sync with the cookie-backed choice.
  useEffect(() => {
    const onFocus = () => {
      const match = document.cookie.match(/(?:^|;\s*)vpark_lang=([^;]+)/);
      const fromCookie = normalizeLanguage(match?.[1]);
      if (match && fromCookie !== lang) {
        setLangState(fromCookie);
        document.documentElement.lang = fromCookie;
      }
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [lang]);

  const value = useMemo<LanguageContextValue>(() => ({ ...createTranslator(lang), setLang }), [lang, setLang]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

/** Translator + formatters for the current language. */
export function useI18n(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (ctx) return ctx;
  // Outside the provider (isolated tests/storybook): English, no persistence.
  return { ...createTranslator('en'), setLang: () => {} };
}
