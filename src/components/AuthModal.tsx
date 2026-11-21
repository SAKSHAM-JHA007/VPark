'use client';

import React, { useState } from 'react';
import { User } from '@/types';
import { ModalBackdrop, ModalPanel } from '@/components/motion/AnimatedModal';
import { VParkLogo } from '@/components/VParkLogo';
import { signInWithGooglePopup } from '@/lib/firebase';
import { X, Car, Building2, AlertCircle } from 'lucide-react';

interface AuthPanelProps {
  initialIntent?: 'driver' | 'provider';
  onAuthenticated: (user: User) => void;
  onClose?: () => void;
  embedded?: boolean;
}

export function AuthPanel({
  initialIntent = 'driver',
  onAuthenticated,
  onClose,
  embedded = false,
}: AuthPanelProps) {
  const [intent, setIntent] = useState<'driver' | 'provider'>(initialIntent);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acceptTerms, setAcceptTerms] = useState(true);

  const handleGoogleSignIn = async () => {
    setError(null);
    if (!acceptTerms) {
      setError('Please accept the Terms of Service & DPDP Act 2023 Privacy Notice.');
      return;
    }

    setLoading(true);
    try {
      const cred = await signInWithGooglePopup();
      const fbUser = cred.user;

      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: fbUser.uid,
          email: fbUser.email,
          name: fbUser.displayName,
          photoUrl: fbUser.photoURL,
          intent,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to authenticate.');
        return;
      }

      onAuthenticated(data.user);
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      if (err?.code === 'auth/popup-closed-by-user') {
        setError('Google sign-in popup was closed before completing.');
      } else if (err?.code === 'auth/unauthorized-domain' || (err?.message && err.message.includes('auth/unauthorized-domain'))) {
        setError('Domain not authorized yet in Firebase Console. Add "vpark-one.vercel.app" to Firebase Console > Authentication > Settings > Authorized domains.');
      } else {
        setError(err?.message || 'Google authentication encountered an error. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`w-full max-w-md bg-[var(--surface-bg)] rounded-sm border border-[var(--hairline-strong)] overflow-hidden ${
        embedded ? 'mx-auto' : 'shadow-md'
      }`}
    >
      {/* Masthead */}
      <div className="bg-[var(--surface-alt)] border-b border-[var(--hairline)] px-5 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <VParkLogo variant="stacked" className="h-8 w-auto" />
          <div>
            <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-secondary)] block">
              System Access Terminal
            </span>
            <h2 className="text-sm font-bold tracking-tight uppercase text-[var(--ink)] mt-0.5">
              Sign In with Google
            </h2>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close login modal"
            className="p-1 rounded-sm text-[var(--ink-tertiary)] hover:text-[var(--ink)] hover:bg-[var(--surface-bg)] transition-colors border border-transparent hover:border-[var(--hairline)]"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="p-5 space-y-4 text-xs font-mono">
        {/* Operating Mode Selector */}
        <div>
          <span className="text-[10px] uppercase tracking-wider text-[var(--ink-secondary)] block mb-1.5">
            Select Operating Mode:
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setIntent('driver')}
              className={`p-2.5 rounded-sm border text-left transition-colors flex items-center gap-2.5 text-xs ${
                intent === 'driver'
                  ? 'border-[var(--transit-accent)] bg-[var(--surface-bg)] text-[var(--transit-accent)] font-semibold'
                  : 'border-[var(--hairline)] text-[var(--ink-secondary)] hover:bg-[var(--surface-alt)]'
              }`}
            >
              <Car className="w-4 h-4 shrink-0" />
              <div>
                <span className="block text-xs uppercase">Drive / Park</span>
                <span className="text-[10px] text-[var(--ink-tertiary)] font-normal">Reserve bay</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setIntent('provider')}
              className={`p-2.5 rounded-sm border text-left transition-colors flex items-center gap-2.5 text-xs ${
                intent === 'provider'
                  ? 'border-[var(--transit-accent)] bg-[var(--surface-bg)] text-[var(--transit-accent)] font-semibold'
                  : 'border-[var(--hairline)] text-[var(--ink-secondary)] hover:bg-[var(--surface-alt)]'
              }`}
            >
              <Building2 className="w-4 h-4 shrink-0" />
              <div>
                <span className="block text-xs uppercase">Host / List</span>
                <span className="text-[10px] text-[var(--ink-tertiary)] font-normal">Rent driveway</span>
              </div>
            </button>
          </div>
        </div>

        {error && (
          <div role="alert" className="p-2.5 rounded-sm bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-400 text-xs flex items-start gap-2 animate-fade-in">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="flex-1 leading-relaxed">{error}</span>
          </div>
        )}

        {/* Google Authentication 1-Click Button */}
        <div className="space-y-3 pt-1">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full py-3 px-4 rounded-sm bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border-2 border-[var(--hairline-strong)] hover:border-[var(--transit-accent)] text-[var(--ink)] font-bold text-xs flex items-center justify-center gap-3 transition-all cursor-pointer shadow-xs hover:shadow-sm disabled:opacity-60"
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.3 0 6.08-1.09 8.1-2.96l-3.88-3.05c-1.1.74-2.51 1.18-4.22 1.18-3.24 0-5.99-2.19-6.97-5.13H1.05v3.14C3.07 21.2 7.24 24 12 24Z"
              />
              <path
                fill="#FBBC05"
                d="M5.03 14.04c-.25-.74-.39-1.53-.39-2.34s.14-1.6.39-2.34V6.22H1.05C.38 7.56 0 9.09 0 11.7s.38 4.14 1.05 5.48l3.98-3.14Z"
              />
              <path
                fill="#EA4335"
                d="M12 4.65c1.8 0 3.41.62 4.68 1.83l3.51-3.51C18.07 1.09 15.3 0 12 0 7.24 0 3.07 2.8 1.05 6.22l3.98 3.14c.98-2.94 3.73-5.13 6.97-5.13Z"
              />
            </svg>
            <span className="text-xs">
              {loading ? 'Connecting to Google...' : 'Continue with Google'}
            </span>
          </button>

          {/* Terms & DPDP Notice Checkbox */}
          <label className="flex items-start gap-2 p-2 rounded-sm bg-[var(--surface-alt)] border border-[var(--hairline)] cursor-pointer">
            <input
              type="checkbox"
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
              className="mt-0.5 w-3.5 h-3.5 accent-[var(--transit-accent)]"
            />
            <span className="text-[10px] text-[var(--ink-secondary)] leading-relaxed">
              I agree to VPark Terms of Service &amp; DPDP Act 2023 Privacy Notice.
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}

interface AuthModalProps {
  initialIntent?: 'driver' | 'provider';
  onAuthenticated: (user: User) => void;
  onClose: () => void;
}

export function AuthModal({ initialIntent = 'driver', onAuthenticated, onClose }: AuthModalProps) {
  return (
    <ModalBackdrop
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Sign in to VPark"
    >
      <ModalPanel className="w-full max-w-md">
        <AuthPanel initialIntent={initialIntent} onAuthenticated={onAuthenticated} onClose={onClose} />
      </ModalPanel>
    </ModalBackdrop>
  );
}
