import React from 'react';
import type { Metadata } from 'next';
import { HomePageClient } from '@/components/HomePageClient';

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://vpark.in';

export const metadata: Metadata = {
  title: 'VPark · Smart Parking & Space Rental Platform in Bengaluru',
  description:
    'Find and book verified parking bays in Bengaluru or list your private driveway, basement, or commercial slot to earn steady passive income. Real-time availability, EV charging, and secure access.',
  alternates: {
    canonical: `${baseUrl}`,
  },
  openGraph: {
    title: 'VPark · Smart Parking & Space Rental Platform in Bengaluru',
    description:
      'Find and book verified parking bays in Bengaluru or list your private space to earn monthly revenue. Real-time availability and verified security.',
    url: `${baseUrl}`,
    type: 'website',
  },
};

export default function RootHomePage() {
  return <HomePageClient />;
}
