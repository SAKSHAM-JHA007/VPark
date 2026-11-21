import { en, type Dictionary } from './en';
import { kn } from './kn';
import { hi } from './hi';

export type { Dictionary };

export const LANGUAGES = ['en', 'kn', 'hi'] as const;
export type Language = (typeof LANGUAGES)[number];

/** Cookie that carries the language to the server so the first render is already localised. */
export const LANGUAGE_COOKIE = 'vpark_lang';
export const LANGUAGE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
export const LANGUAGE_CHANGE_EVENT = 'vpark-language-change';

export interface LanguageOption {
  code: Language;
  /** Endonym shown in the selector, in its own script. */
  label: string;
  /** Short form for compact controls. */
  short: string;
  /** BCP 47 tag used for Intl formatting and <html lang>. */
  locale: string;
}

export const LANGUAGE_OPTIONS: readonly LanguageOption[] = [
  { code: 'en', label: 'English', short: 'EN', locale: 'en-IN' },
  { code: 'kn', label: 'ಕನ್ನಡ', short: 'ಕನ್ನಡ', locale: 'kn-IN' },
  { code: 'hi', label: 'हिन्दी', short: 'हिन्दी', locale: 'hi-IN' },
];

export const DICTIONARIES: Record<Language, Dictionary> = { en, kn, hi };

export function isLanguage(value: unknown): value is Language {
  return value === 'en' || value === 'kn' || value === 'hi';
}

export function normalizeLanguage(value: unknown): Language {
  return isLanguage(value) ? value : 'en';
}

export function localeFor(lang: Language): string {
  return LANGUAGE_OPTIONS.find((o) => o.code === lang)?.locale ?? 'en-IN';
}

/** Value for `document.cookie` that persists the language choice for a year. */
export function languageCookieString(lang: Language): string {
  return `${LANGUAGE_COOKIE}=${lang}; Path=/; Max-Age=${LANGUAGE_COOKIE_MAX_AGE}; SameSite=Lax`;
}

/** Reads the language from a raw Cookie header / `document.cookie` string. */
export function languageFromCookieString(cookie: string | null | undefined): Language {
  if (!cookie) return 'en';
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${LANGUAGE_COOKIE}=([^;]+)`));
  return normalizeLanguage(match ? decodeURIComponent(match[1]) : undefined);
}

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

export type TranslationKey = Leaves<Dictionary>;
/** Base keys of plural pairs (`foo` for `foo.one` / `foo.other`). */
export type PluralKey = TranslationKey extends infer K
  ? K extends `${infer B}.one`
    ? B
    : never
  : never;

export type TranslationVars = Record<string, string | number>;

function lookup(dict: unknown, key: string): string | undefined {
  let node: unknown = dict;
  for (const part of key.split('.')) {
    if (node === null || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

export function interpolate(template: string, vars?: TranslationVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match
  );
}

/** Translate a key, falling back to English (and then to the key) if a value is missing. */
export function translate(lang: Language, key: TranslationKey | string, vars?: TranslationVars): string {
  const value = lookup(DICTIONARIES[lang], key) ?? lookup(en, key) ?? key;
  return interpolate(value, vars);
}

// ---------------------------------------------------------------------------
// Formatting: Indian grouping (1,23,456) and INR in every language. Digits stay
// Latin, which is how prices and times are written on Kannada and Hindi signage.
// ---------------------------------------------------------------------------

export interface Formatters {
  locale: string;
  number(value: number, options?: Intl.NumberFormatOptions): string;
  /** ₹ amount; whole rupees by default, two decimals for receipts and totals. */
  inr(value: number, options?: { decimals?: boolean }): string;
  date(value: string | number | Date, options?: Intl.DateTimeFormatOptions): string;
  time(value: string | number | Date): string;
}

/** Lakh/crore grouping (1,23,456) with Latin digits for every language. ICU's Kannada
 * data groups in thousands, so numbers and money always use the en-IN pattern. */
const NUMBER_LOCALE = 'en-IN';

export function createFormatters(lang: Language): Formatters {
  const locale = localeFor(lang);
  const safeDate = (value: string | number | Date) => {
    const d = value instanceof Date ? value : new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  return {
    locale,
    number: (value, options) => new Intl.NumberFormat(NUMBER_LOCALE, options).format(value),
    inr: (value, options) =>
      new Intl.NumberFormat(NUMBER_LOCALE, {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: options?.decimals ? 2 : 0,
        maximumFractionDigits: options?.decimals ? 2 : 0,
      }).format(value),
    date: (value, options) => {
      const d = safeDate(value);
      return d ? new Intl.DateTimeFormat(locale, options ?? { day: 'numeric', month: 'short', year: 'numeric' }).format(d) : '';
    },
    time: (value) => {
      const d = safeDate(value);
      return d ? new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(d) : '';
    },
  };
}

export interface Translator extends Formatters {
  lang: Language;
  t(key: TranslationKey, vars?: TranslationVars): string;
  /** Plural-aware translation: picks `${key}.one` or `${key}.other` and passes `count`. */
  tn(key: PluralKey, count: number, vars?: TranslationVars): string;
}

export function createTranslator(lang: Language): Translator {
  const formatters = createFormatters(lang);
  const rules = new Intl.PluralRules(formatters.locale);
  return {
    ...formatters,
    lang,
    t: (key, vars) => translate(lang, key, vars),
    tn: (key, count, vars) => {
      // Kannada and Hindi treat 0 like 1 in CLDR; VPark copy uses "one" only for exactly 1.
      const form = count === 1 && rules.select(count) === 'one' ? 'one' : 'other';
      return translate(lang, `${key}.${form}`, { count: formatters.number(count), ...vars });
    },
  };
}
