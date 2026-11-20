// Language support: English, Kannada and Hindi dictionaries must stay in lock-step,
// and the language preference must round-trip through its cookie.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import './support/register-ts.mjs';

const { en } = await import('../src/lib/i18n/en.ts');
const { kn } = await import('../src/lib/i18n/kn.ts');
const { hi } = await import('../src/lib/i18n/hi.ts');
const i18n = await import('../src/lib/i18n/index.ts');

function flatten(obj, prefix = '', out = new Map()) {
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object') flatten(value, path, out);
    else out.set(path, value);
  }
  return out;
}

const placeholders = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const KANNADA = /[ಀ-೿]/;
const DEVANAGARI = /[ऀ-ॿ]/;

const flat = { en: flatten(en), kn: flatten(kn), hi: flatten(hi) };

describe('translation dictionaries', () => {
  it('have exactly the same keys in English, Kannada and Hindi', () => {
    const enKeys = [...flat.en.keys()].sort();
    for (const lang of ['kn', 'hi']) {
      const keys = [...flat[lang].keys()].sort();
      const missing = enKeys.filter((k) => !flat[lang].has(k));
      const extra = keys.filter((k) => !flat.en.has(k));
      assert.deepEqual(missing, [], `${lang} is missing keys`);
      assert.deepEqual(extra, [], `${lang} has keys that English does not`);
    }
    assert.ok(enKeys.length > 400, `expected a complete dictionary, got ${enKeys.length} keys`);
  });

  it('only contain non-empty strings', () => {
    for (const [lang, map] of Object.entries(flat)) {
      for (const [key, value] of map) {
        assert.equal(typeof value, 'string', `${lang}:${key} is not a string`);
        assert.ok(value.trim().length > 0, `${lang}:${key} is empty`);
      }
    }
  });

  it('keep the same {placeholders} as English for every key', () => {
    for (const lang of ['kn', 'hi']) {
      for (const [key, value] of flat.en) {
        assert.deepEqual(placeholders(flat[lang].get(key)), placeholders(value), `${lang}:${key} placeholders differ`);
      }
    }
  });

  it('never leave an English string untranslated, except reviewed technical values', () => {
    // Brand names, tax codes, an example address and an example email are the same in every language.
    const SAME_IN_ALL_LANGUAGES = new Set([
      'payment.UPI',
      'pass.gps',
      'pass.receiptCgst',
      'pass.receiptSgst',
      'wizard.addressPlaceholder',
      'contactForm.emailPlaceholder',
      'footer.copyright',
    ]);
    for (const lang of ['kn', 'hi']) {
      const copied = [...flat.en]
        .filter(([key, value]) => flat[lang].get(key) === value && !SAME_IN_ALL_LANGUAGES.has(key))
        .map(([key]) => key);
      assert.deepEqual(copied, [], `${lang} copies English for these keys`);
    }
  });

  it('define both plural forms wherever a plural is used', () => {
    for (const [key] of flat.en) {
      if (key.endsWith('.one')) assert.ok(flat.en.has(key.replace(/\.one$/, '.other')), `${key} has no .other`);
    }
  });

  it('are actually written in Kannada and Devanagari scripts (not left in English)', () => {
    // Values that are legitimately identical across languages (codes, names, formats).
    const isNeutral = (v) => !/[A-Za-z]{3,}/.test(v) || /^[A-Z0-9 @.%()/·:+–-]+$/.test(v);
    let knScript = 0;
    let hiScript = 0;
    let candidates = 0;
    for (const [key, value] of flat.en) {
      if (isNeutral(value)) continue;
      candidates++;
      if (KANNADA.test(flat.kn.get(key))) knScript++;
      if (DEVANAGARI.test(flat.hi.get(key))) hiScript++;
    }
    assert.ok(knScript / candidates > 0.97, `only ${knScript}/${candidates} Kannada strings use Kannada script`);
    assert.ok(hiScript / candidates > 0.97, `only ${hiScript}/${candidates} Hindi strings use Devanagari`);
  });
});

describe('translator', () => {
  it('interpolates variables and falls back to English for unknown keys', () => {
    assert.equal(i18n.translate('en', 'search.welcome', { name: 'Asha' }), 'Welcome, Asha');
    assert.match(i18n.translate('kn', 'search.welcome', { name: 'Asha' }), /Asha/);
    assert.equal(i18n.translate('hi', 'no.such.key'), 'no.such.key');
  });

  it('chooses plural forms by count', () => {
    const t = i18n.createTranslator('en');
    assert.equal(t.tn('common.hours', 1), '1 hour');
    assert.equal(t.tn('common.hours', 3), '3 hours');
    assert.equal(t.tn('common.hours', 0), '0 hours');
    assert.match(i18n.createTranslator('hi').tn('common.hours', 2), /2/);
  });

  it('formats INR with Indian digit grouping in every language', () => {
    for (const lang of i18n.LANGUAGES) {
      const f = i18n.createFormatters(lang);
      assert.match(f.inr(123456), /₹\s?1,23,456/);
      assert.match(f.inr(40.5, { decimals: true }), /₹\s?40\.50/);
      assert.equal(f.number(1234567), '12,34,567');
    }
  });

  it('formats dates for the selected locale', () => {
    const iso = '2026-11-17T06:30:00Z';
    assert.match(i18n.createFormatters('en').date(iso), /2026/);
    assert.ok(KANNADA.test(i18n.createFormatters('kn').date(iso, { month: 'long' })), 'Kannada month name');
    assert.ok(DEVANAGARI.test(i18n.createFormatters('hi').date(iso, { month: 'long' })), 'Hindi month name');
    assert.equal(i18n.createFormatters('en').date('not a date'), '');
  });
});

describe('language selection and persistence', () => {
  it('exposes the three languages by their own names', () => {
    assert.deepEqual(
      i18n.LANGUAGE_OPTIONS.map((o) => o.label),
      ['English', 'ಕನ್ನಡ', 'हिन्दी']
    );
  });

  it('normalises unknown values to English', () => {
    assert.equal(i18n.normalizeLanguage('kn'), 'kn');
    assert.equal(i18n.normalizeLanguage('fr'), 'en');
    assert.equal(i18n.normalizeLanguage(undefined), 'en');
  });

  it('round-trips the choice through the vpark_lang cookie', () => {
    for (const lang of i18n.LANGUAGES) {
      const cookie = i18n.languageCookieString(lang);
      assert.match(cookie, /Path=\//);
      assert.match(cookie, /SameSite=Lax/);
      assert.match(cookie, /Max-Age=\d+/);
      const header = `other=1; ${cookie.split(';')[0]}; theme=x`;
      assert.equal(i18n.languageFromCookieString(header), lang);
    }
    assert.equal(i18n.languageFromCookieString('vpark_lang=xx'), 'en');
    assert.equal(i18n.languageFromCookieString(''), 'en');
  });
});
