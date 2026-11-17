import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Identity Access Terminal · VPark Bengaluru',
  description: 'Log in to manage your driver parking reservations or space provider host earnings.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
