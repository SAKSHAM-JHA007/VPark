import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import './globals.css';
import { LANGUAGE_COOKIE, normalizeLanguage, translate } from '@/lib/i18n';
import { THEME_INIT_SCRIPT } from '@/lib/theme';
import { LanguageProvider } from '@/components/i18n/LanguageProvider';

/** Title and description follow the visitor's language (the vpark_lang cookie). */
export function generateMetadata(): Metadata {
  const lang = normalizeLanguage(cookies().get(LANGUAGE_COOKIE)?.value);
  return {
    title: translate(lang, 'meta.siteTitle'),
    description: translate(lang, 'meta.siteDescription'),
    manifest: '/manifest.json',
    robots: {
      index: false,
      follow: false,
    },
    icons: {
      icon: [
        { url: '/favicon.svg', type: 'image/svg+xml' },
        { url: '/logo.jpg', type: 'image/jpeg' },
      ],
      apple: '/logo.jpg',
    },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#0A5CFF',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The language lives in a cookie (not localStorage) so the server renders the chosen
  // language directly: no hydration mismatch and no flash of English.
  const lang = normalizeLanguage(cookies().get(LANGUAGE_COOKIE)?.value);

  return (
    <html lang={lang} suppressHydrationWarning>
      <head>
        <meta name="robots" content="noindex, nofollow" />
        {/* Applies Light / Dark / OLED before first paint (see src/lib/theme.ts). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen flex flex-col bg-canvas text-ink font-sans antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-full focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink focus:shadow-raised"
        >
          {translate(lang, 'common.skipToContent')}
        </a>
        <LanguageProvider initialLang={lang}>{children}</LanguageProvider>
      </body>
    </html>
  );
}
