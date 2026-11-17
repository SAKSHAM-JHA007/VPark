import React from 'react';
import { APP_CONFIG } from '@/lib/constants';

interface OrganizationSchemaProps {
  url?: string;
}

export function OrganizationSchema({ url }: OrganizationSchemaProps) {
  const siteUrl = url || process.env.NEXT_PUBLIC_SITE_URL || 'https://vpark.in';

  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${siteUrl}/#organization`,
        name: APP_CONFIG.appName,
        url: siteUrl,
        logo: {
          '@type': 'ImageObject',
          url: `${siteUrl}/logo.jpg`,
          caption: 'VPark Smart Parking Platform',
        },
        description:
          'VPark is a verified two-sided smart parking marketplace connecting drivers with secure parking spaces and hosts in Bengaluru.',
        email: APP_CONFIG.contactEmail,
        telephone: APP_CONFIG.contactPhone,
        address: {
          '@type': 'PostalAddress',
          addressLocality: APP_CONFIG.city,
          addressRegion: 'Karnataka',
          addressCountry: 'IN',
        },
      },
      {
        '@type': 'WebSite',
        '@id': `${siteUrl}/#website`,
        url: siteUrl,
        name: APP_CONFIG.appName,
        description: APP_CONFIG.brandTagline,
        publisher: {
          '@id': `${siteUrl}/#organization`,
        },
        potentialAction: {
          '@type': 'SearchAction',
          target: `${siteUrl}/driver/home?q={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
        inLanguage: 'en-IN',
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export function BreadcrumbSchema({ items }: { items: BreadcrumbItem[] }) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://vpark.in';

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url.startsWith('http') ? item.url : `${siteUrl}${item.url}`,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
