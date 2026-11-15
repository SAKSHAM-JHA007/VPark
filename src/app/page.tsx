'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AuthPanel } from '@/components/AuthModal';
import { VParkLogo } from '@/components/VParkLogo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { User } from '@/types';
import { APP_CONFIG } from '@/lib/constants';
import {
  ShieldCheck,
  Clock,
  Lock,
  ArrowRight,
  Loader2,
} from 'lucide-react';

export default function RootLoginPage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [intent, setIntent] = useState<'driver' | 'provider'>('driver');

  // Check if session already exists
  useEffect(() => {
    let mounted = true;
    async function checkSession() {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (mounted && data.success && data.user) {
          const user: User = data.user;
          if (user.activeRole === 'ADMIN') {
            router.replace('/driver/home?tab=admin');
          } else if (user.activeRole === 'PROVIDER') {
            router.replace('/owner/dashboard');
          } else {
            router.replace('/driver/home');
          }
          return;
        }
      } catch {
        // Fall through to login
      } finally {
        if (mounted) {
          setCheckingAuth(false);
        }
      }
    }

    checkSession();
    return () => {
      mounted = false;
    };
  }, [router]);

  const handleAuthenticated = (user: User) => {
    if (user.activeRole === 'ADMIN') {
      router.push('/driver/home?tab=admin');
    } else if (user.activeRole === 'PROVIDER') {
      router.push('/owner/dashboard');
    } else {
      router.push('/driver/home');
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[var(--canvas-bg)] flex flex-col items-center justify-center p-6 text-center select-none font-mono text-xs text-[var(--ink-secondary)]">
        <span className="animate-pulse tracking-wider uppercase">INITIALIZING VPARK TERMINAL...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--canvas-bg)] text-[var(--ink)] flex flex-col justify-between">
      {/* Top Masthead */}
      <header className="sticky top-0 z-30 bg-[var(--surface-bg)] border-b border-[var(--hairline)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-15 flex items-center justify-between gap-4">
          {/* Brand Logo */}
          <div className="flex items-center gap-3">
            <VParkLogo className="w-8 h-8" />
            <div className="flex items-baseline gap-2.5">
              <span className="text-base font-bold tracking-tight uppercase leading-none">
                {APP_CONFIG.appName}
              </span>
              <span className="text-[10px] font-mono tracking-widest uppercase text-[var(--ink-tertiary)] border-l border-[var(--hairline)] pl-2.5">
                Pilot Zone 01 · Yelahanka
              </span>
            </div>
          </div>

          {/* Right Navigation */}
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/driver/home"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-sm text-xs font-mono uppercase tracking-wider text-[var(--ink)] hover:bg-[var(--surface-alt)] border border-[var(--hairline)] transition-colors"
            >
              <span>Explore as Guest</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content: Asymmetric Swiss Layout */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 sm:py-16 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
        {/* Left Column: Urban Transit Bulletin */}
        <div className="lg:col-span-7 space-y-8">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-[var(--transit-accent)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--transit-accent)]" />
              Bengaluru Urban Parking Network · DULT Aligned
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight uppercase leading-[1.05]">
              Decentralized<br />
              Parking Infrastructure
            </h1>
            <p className="text-sm sm:text-base text-[var(--ink-secondary)] leading-relaxed max-w-xl">
              An inspected peer-to-peer parking network connecting Bengaluru drivers with unused residential driveways and commercial bays. Accurate down to the minute and paise.
            </p>
          </div>

          {/* Architectural Specification Matrix (Replaces generic 3-card grid) */}
          <div className="border border-[var(--hairline)] divide-y divide-[var(--hairline)] bg-[var(--surface-bg)] text-xs">
            <div className="p-4 grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-4 items-baseline">
              <div className="sm:col-span-4 font-mono font-bold text-[11px] tracking-wider text-[var(--ink)] uppercase flex items-center gap-1.5">
                <span className="text-[var(--ink-tertiary)] font-normal">01/</span>
                GPS Bay-Anchor
              </div>
              <div className="sm:col-span-8 text-[var(--ink-secondary)] leading-normal">
                Every bay is geolocated and verified on-site. No phantom slots, duplicate allocations, or roadside guesswork.
              </div>
            </div>

            <div className="p-4 grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-4 items-baseline">
              <div className="sm:col-span-4 font-mono font-bold text-[11px] tracking-wider text-[var(--ink)] uppercase flex items-center gap-1.5">
                <span className="text-[var(--ink-tertiary)] font-normal">02/</span>
                15-Min Arrival Buffer
              </div>
              <div className="sm:col-span-8 text-[var(--ink-secondary)] leading-normal">
                10-minute hold lockout on reservation, paired with a 15-minute traffic grace buffer and exact integer paise billing.
              </div>
            </div>

            <div className="p-4 grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-4 items-baseline">
              <div className="sm:col-span-4 font-mono font-bold text-[11px] tracking-wider text-[var(--ink)] uppercase flex items-center gap-1.5">
                <span className="text-[var(--ink-tertiary)] font-normal">03/</span>
                DPDP 2023 Shield
              </div>
              <div className="sm:col-span-8 text-[var(--ink-secondary)] leading-normal">
                Driver-host phone number masking, EXIF-stripped property photos, and tamper-evident audit logs.
              </div>
            </div>
          </div>

          {/* Pilot Dispatch Status Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-3 bg-[var(--surface-alt)] border border-[var(--hairline)] font-mono text-[11px] text-[var(--ink-secondary)]">
            <div className="flex items-center gap-3">
              <span className="font-bold text-[var(--ink)]">PILOT STATUS: ACTIVE</span>
              <span>·</span>
              <span>ZONE: YELAHANKA MICRO-MARKET</span>
            </div>
            <div className="text-[var(--ink-tertiary)]">
              13.1007° N, 77.5963° E
            </div>
          </div>

          <div>
            <Link
              href="/driver/home"
              className="font-mono text-xs text-[var(--ink-secondary)] hover:text-[var(--transit-accent)] inline-flex items-center gap-1.5 transition-colors"
            >
              <span>View live parking zone map without signing in</span>
              <span className="text-[var(--transit-accent)] font-semibold">→</span>
            </Link>
          </div>
        </div>

        {/* Right Column: Utilitarian Auth Terminal */}
        <div className="lg:col-span-5 w-full">
          <AuthPanel
            embedded
            initialIntent={intent}
            onAuthenticated={handleAuthenticated}
          />
        </div>
      </main>

      {/* Clean Swiss Footer */}
      <footer className="border-t border-[var(--hairline)] bg-[var(--surface-bg)] py-4 px-4 sm:px-6 lg:px-8 text-xs font-mono text-[var(--ink-tertiary)]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <span>
            © {new Date().getFullYear()} {APP_CONFIG.appName} · BENGALURU, KA
          </span>
          <div className="flex items-center gap-4 text-[11px]">
            <span>DULT POLICY ALIGNED</span>
            <span>·</span>
            <span>DPDP ACT 2023 COMPLIANT</span>
            <span>·</span>
            <Link href="/driver/home" className="text-[var(--ink)] hover:text-[var(--transit-accent)] transition-colors underline">
              LIVE SEARCH MAP
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
