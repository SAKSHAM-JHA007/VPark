'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AuthPanel } from '@/components/AuthModal';
import { VParkLogo } from '@/components/VParkLogo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { User } from '@/types';
import { APP_CONFIG } from '@/lib/constants';
import { ArrowLeft } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [intent, setIntent] = useState<'driver' | 'provider'>('driver');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    const intentParam = sp.get('intent');
    if (intentParam === 'provider' || intentParam === 'driver') {
      setIntent(intentParam);
    }
  }, []);

  const handleAuthenticated = (user: User) => {
    if (user.activeRole === 'ADMIN') {
      router.push('/driver/home?tab=admin');
      return;
    }
    if (user.activeRole === 'PROVIDER') {
      router.push('/owner/dashboard');
      return;
    }
    router.push('/driver/home');
  };

  return (
    <div className="min-h-screen bg-[var(--canvas-bg)] text-[var(--ink)] flex flex-col justify-between">
      <header className="bg-[var(--surface-bg)] border-b border-[var(--hairline)] px-4 sm:px-6 lg:px-8 h-15 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <VParkLogo className="h-7 sm:h-8 w-auto" />
          <span className="hidden sm:inline-block text-[10px] font-mono tracking-widest uppercase text-[var(--ink-tertiary)] border-l border-[var(--hairline)] pl-3 py-0.5">
            Authentication Terminal
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            href="/driver/home"
            className="text-xs font-mono uppercase tracking-wider text-[var(--ink-secondary)] hover:text-[var(--ink)] flex items-center gap-1.5 transition-colors border border-[var(--hairline)] px-3 py-1.5 rounded-sm hover:bg-[var(--surface-alt)]"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Registry
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 space-y-6">
        <div className="text-center space-y-1.5 max-w-md animate-fade-up">
          <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--transit-accent)] block">
            Bengaluru Municipal Pilot · Yelahanka Sector 01
          </span>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight uppercase text-[var(--ink)]">
            Driver &amp; Host Email Access
          </h1>
          <p className="text-xs text-[var(--ink-secondary)]">
            Sign in with your email address. Mobile number is stored in user profile for parking access and booking coordination.
          </p>
        </div>

        <div className="w-full max-w-md animate-fade-up [animation-delay:90ms]">
        <AuthPanel
          embedded
          initialIntent={intent}
          onAuthenticated={handleAuthenticated}
        />
        </div>
      </main>

      <footer className="border-t border-[var(--hairline)] bg-[var(--surface-bg)] py-4 px-4 text-center font-mono text-xs text-[var(--ink-tertiary)] flex flex-wrap items-center justify-center gap-3">
        <Link href="/" className="hover:text-[var(--ink)] transition-colors">
          Home
        </Link>
        <span>·</span>
        <Link href="/privacy" className="hover:text-[var(--ink)] transition-colors">
          Privacy Policy
        </Link>
        <span>·</span>
        <Link href="/contact" className="hover:text-[var(--ink)] transition-colors">
          Contact Support
        </Link>
        <span>·</span>
        <span>© {new Date().getFullYear()} {APP_CONFIG.appName} · DPDP ACT 2023 COMPLIANT // SECTOR 01</span>
      </footer>
    </div>
  );
}

