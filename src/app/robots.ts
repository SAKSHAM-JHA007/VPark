import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://vpark.in';

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/privacy', '/contact'],
        disallow: [
          '/owner/',
          '/driver/',
          '/admin/',
          '/api/',
          '/login',
          '/*?*anchor=',
          '/*?*intent=',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
