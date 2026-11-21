'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { VParkLogo } from '@/components/VParkLogo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ShieldCheck, ArrowLeft, Loader2 } from 'lucide-react';

export default function MasterAdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdminSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    // Scratchpad ready for your new custom admin authentication
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role: 'ADMIN' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Authentication endpoint ready to be built.');
        return;
      }
      router.push('/driver/home?tab=admin');
    } catch {
      setError('Admin auth ready for implementation.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col justify-between font-mono">
      <header className="vp-nav px-4 sm:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <VParkLogo className="h-7 w-auto" />
          <span className="text-[10px] uppercase tracking-widest text-[var(--transit-accent)] border-l border-hairline pl-3 py-0.5">
            Master Console · Root Terminal
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <ThemeToggle />
          <Link
            href="/"
            className="flex items-center gap-1.5 vp-nav-control px-3 py-1.5 rounded-full text-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Platform Home</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md bg-surface rounded-card border border-hairline p-6 sm:p-8 shadow-raised space-y-6 animate-scale-in">
          <div className="space-y-2 text-center">
            <div className="w-12 h-12 rounded-control bg-[var(--nav-active-bg)] text-[var(--transit-accent)] flex items-center justify-center mx-auto shadow-inner">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h1 className="text-lg font-bold uppercase tracking-wider text-ink">
              Master Admin Terminal
            </h1>
            <p className="text-xs text-ink-2">
              Clean admin scratchpad ready for your new auth flow.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs">
              {error}
            </div>
          )}

          <form onSubmit={handleAdminSignIn} className="space-y-4">
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-ink-2 mb-1">
                Admin Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@vpark.in"
                className="w-full px-3 py-2 text-xs rounded-sm border border-hairline bg-canvas text-ink focus:outline-none focus:border-brand"
              />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-ink-2 mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 text-xs rounded-sm border border-hairline bg-canvas text-ink focus:outline-none focus:border-brand"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-sm bg-brand hover:bg-brand-hover text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign In'}
            </button>
          </form>

          <div className="pt-2 border-t border-hairline text-center">
            <Link href="/" className="text-[11px] text-ink-3 hover:text-ink transition-colors">
              Return to Platform Home
            </Link>
          </div>
        </div>
      </main>

      <footer className="border-t border-hairline py-3 text-center text-[10px] text-ink-3">
        VPark · Admin access only
      </footer>
    </div>
  );
}
