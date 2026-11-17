import type { Metadata, Viewport } from 'next';
import './globals.css';
import { GoogleAnalytics } from '@/components/GoogleAnalytics';
import { OrganizationSchema } from '@/components/StructuredData';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://vpark.in';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'VPark · Find Your Spot. Own Your Time. | Bengaluru Smart Parking',
    template: '%s | VPark Bengaluru',
  },
  description:
    'Discover verified residential and commercial parking spaces near you in Yelahanka, Bengaluru, or rent out your unused space safely with VPark.',
  manifest: '/manifest.json',
  alternates: {
    canonical: '/',
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/logo.jpg', type: 'image/jpeg' },
    ],
    apple: '/logo.jpg',
  },
  openGraph: {
    title: 'VPark · Find Your Spot. Own Your Time.',
    description:
      'Verified two-sided parking marketplace in Bengaluru. Rent your unused space or find convenient parking near your destination.',
    type: 'website',
    locale: 'en_IN',
    url: siteUrl,
    siteName: 'VPark',
    images: [
      {
        url: '/logo.jpg',
        width: 1024,
        height: 1024,
        alt: 'VPark Bengaluru Verified Parking',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VPark · Find Your Spot. Own Your Time.',
    description:
      'Verified two-sided parking marketplace in Bengaluru. Rent your unused space or find convenient parking near your destination.',
    images: ['/logo.jpg'],
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GSC_VERIFICATION || undefined,
  },
};

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
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('vpark_theme');
                  var supportDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  if (theme === 'dark' || (!theme && supportDarkMode)) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-screen flex flex-col bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 antialiased transition-colors duration-150">
        <OrganizationSchema url={siteUrl} />
        <GoogleAnalytics />
        {children}
      </body>
    </html>
  );
}
