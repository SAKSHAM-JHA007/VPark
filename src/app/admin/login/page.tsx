'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { VParkLogo } from '@/components/VParkLogo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { signInWithGooglePopup, signOutFirebase } from '@/lib/firebase';
import { ShieldCheck, ArrowRight, ArrowLeft, Loader2 } from 'lucide-react';

// Admin access is granted only to Google accounts whose Firebase UID is on the
// server-side VPARK_ADMIN_FIREBASE_UIDS allowlist. There is no admin password.
export default function MasterAdminLoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleAdminSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      const cred = await signInWithGooglePopup();
      const idToken = await cred.user.getIdToken(true);
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, intent: 'driver' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Google sign-in could not be verified.');
        return;
      }
      if (!data.isMasterAdmin) {
        // Not an administrator: do not leave a session behind from the admin page.
        await fetch('/api/auth/logout', { method: 'POST' });
        await signOutFirebase();
        setError('This Google account is not authorized for the admin console.');
        return;
      }
      router.push('/driver/home?tab=admin');
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user') {
        setError('Google sign-in window was closed.');
      } else {
        setError('Google sign-in is unavailable right now. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col justify-between font-mono">
      {/* Header */}
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

      {/* Main Terminal */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md bg-surface rounded-card border border-hairline p-6 sm:p-8 shadow-raised space-y-6 animate-scale-in">
          <div className="space-y-2 text-center">
            <div className="w-12 h-12 rounded-control bg-[var(--nav-active-bg)] text-[var(--transit-accent)] flex items-center justify-center mx-auto shadow-inner animate-pop [animation-delay:150ms]">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h1 className="text-lg font-bold uppercase tracking-wider text-ink">
              Master Admin Terminal
            </h1>
            <p className="text-xs text-ink-2">
              Restricted access for system administrator only.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogleAdminSignIn}
            disabled={loading}
            className="w-full py-3 rounded-control bg-brand hover:bg-brand-hover text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-[background-color,transform] duration-150 enabled:active:scale-[0.98] shadow-lg shadow-blue-500/20 disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verifying Google identity...</span>
              </>
            ) : (
              <>
                <span>Continue with Google</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          <p className="text-[11px] text-ink-3 text-center">
            Sign in with an authorized administrator Google account. Access is verified on the server.
          </p>

          <div className="pt-2 border-t border-hairline text-center">
            <Link href="/login" className="text-[11px] text-ink-3 hover:text-ink transition-colors">
              Return to Standard Login
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-hairline py-3 text-center text-[10px] text-ink-3">
        VPark · Admin access only
      </footer>
    </div>
  );
}
