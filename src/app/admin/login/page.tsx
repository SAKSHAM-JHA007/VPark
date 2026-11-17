'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { VParkLogo } from '@/components/VParkLogo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ShieldCheck, Lock, Mail, ArrowRight, ArrowLeft, Loader2, KeyRound } from 'lucide-react';

export default function MasterAdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('jhasaksham.7453k@gmail.com');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'MASTER_LOGIN',
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Invalid master credentials.');
      } else {
        router.push(data.redirectTo || '/driver/home?tab=admin');
      }
    } catch {
      setError('Connection failure during master authentication.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090E] text-slate-100 flex flex-col justify-between font-mono">
      {/* Header */}
      <header className="bg-[#0B0C10] border-b border-neutral-800 px-4 sm:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <VParkLogo className="h-7 w-auto" />
          <span className="text-[10px] uppercase tracking-widest text-blue-400 border-l border-neutral-800 pl-3 py-0.5">
            Master Console · Root Terminal
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <ThemeToggle />
          <Link
            href="/"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm border border-neutral-800 text-neutral-400 hover:text-white transition-colors text-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Platform Home</span>
          </Link>
        </div>
      </header>

      {/* Main Terminal */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md bg-[#0D0F17] rounded-2xl border border-blue-900/40 p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="space-y-2 text-center">
            <div className="w-12 h-12 rounded-2xl bg-blue-950/60 border border-blue-800/50 text-[#0A5CFF] flex items-center justify-center mx-auto shadow-inner">
              <ShieldCheck className="w-6 h-6 text-blue-400" />
            </div>
            <h1 className="text-lg font-bold uppercase tracking-wider text-white">
              Master Admin Terminal
            </h1>
            <p className="text-xs text-slate-400">
              Restricted access for system administrator only.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="admin_email" className="block text-[10px] uppercase tracking-wider text-slate-400">
                Administrator Email ID
              </label>
              <div className="relative flex items-center">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3" />
                <input
                  id="admin_email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jhasaksham.7453k@gmail.com"
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-neutral-800 bg-[#07090E] text-white text-xs focus:outline-none focus:border-[#0A5CFF] transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="admin_pwd" className="block text-[10px] uppercase tracking-wider text-slate-400">
                Master Secret Password
              </label>
              <div className="relative flex items-center">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3" />
                <input
                  id="admin_pwd"
                  type="password"
                  required
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter master password"
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-neutral-800 bg-[#07090E] text-white text-xs focus:outline-none focus:border-[#0A5CFF] transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full py-3 rounded-lg bg-[#0A5CFF] hover:bg-[#0047d4] text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <span>Authenticate Master Console</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="pt-2 border-t border-neutral-800/80 text-center">
            <Link href="/login" className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors">
              Return to Standard Login
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-900 py-3 text-center text-[10px] text-slate-600">
        VPark Enterprise Security · Restricted Root Console // Yelahanka Sector 01
      </footer>
    </div>
  );
}
