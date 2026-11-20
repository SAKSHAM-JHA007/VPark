'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ProviderType, User, VehicleType } from '@/types';
import { APP_CONFIG } from '@/lib/constants';
import { signInWithGooglePopup } from '@/lib/firebase';
import { validatePlateNumber, normalizeIndianPhone } from '@/lib/validation';
import { ModalBackdrop, ModalPanel } from '@/components/motion/AnimatedModal';
import { VParkLogo } from '@/components/VParkLogo';
import {
  X,
  Phone,
  ShieldCheck,
  Car,
  Building2,
  AlertCircle,
  UserCheck,
} from 'lucide-react';

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
  const [step, setStep] = useState<'google_auth' | 'onboarding'>('google_auth');

  const initialStepRef = useRef(step);
  const stepChangedRef = useRef(false);
  if (step !== initialStepRef.current) stepChangedRef.current = true;
  const stepEnterClass = stepChangedRef.current ? ' animate-slide-in' : '';

  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [providerType, setProviderType] = useState<ProviderType>('OWNER');
  const [acceptTerms, setAcceptTerms] = useState<boolean>(true);
  const [rememberId, setRememberId] = useState<boolean>(true);
  const [rememberedEmail, setRememberedEmail] = useState<string | null>(null);
  const [rememberedName, setRememberedName] = useState<string | null>(null);

  const [loading, setLoading] = useState<boolean>(false);
  const [googleSigningIn, setGoogleSigningIn] = useState<boolean>(false);
  const [plateNumber, setPlateNumber] = useState<string>('');
  const [makeModel, setMakeModel] = useState<string>('');
  const [vehicleType, setVehicleType] = useState<VehicleType>('SEDAN');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIntent(initialIntent);
  }, [initialIntent]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedEmail = localStorage.getItem('vpark_remembered_email');
        const savedName = localStorage.getItem('vpark_remembered_name');
        if (savedEmail) {
          setRememberedEmail(savedEmail);
          setEmail(savedEmail);
          if (savedName) setRememberedName(savedName);
        }
      } catch {
        // LocalStorage disabled or not accessible
      }
    }
  }, []);

  const handleGoogleSignIn = async () => {
    setError(null);
    if (!acceptTerms) {
      setError('Please accept the Terms of Service & DPDP Act 2023 Privacy Notice.');
      return;
    }

    setGoogleSigningIn(true);
    try {
      const cred = await signInWithGooglePopup();
      const fbUser = cred.user;

      if (rememberId && fbUser.email) {
        try {
          localStorage.setItem('vpark_remembered_email', fbUser.email);
          if (fbUser.displayName) localStorage.setItem('vpark_remembered_name', fbUser.displayName);
        } catch {
          // Ignore storage quota
        }
      }

      // The server derives identity only from this Firebase ID token, verified server-side.
      const idToken = await fbUser.getIdToken(true);
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, intent }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to authenticate with Google.');
        return;
      }

      const user: User = data.user;
      if (user.roles.includes('ADMIN') || (user.phone && user.vehicles.length > 0)) {
        onAuthenticated(user);
      } else {
        setFullName(user.name || fbUser.displayName || '');
        setEmail(user.email || fbUser.email || '');
        setStep('onboarding');
      }
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      if (err?.code === 'auth/popup-closed-by-user') {
        setError('Google sign-in popup was closed before completing.');
      } else if (err?.code === 'auth/unauthorized-domain' || (err?.message && err.message.includes('auth/unauthorized-domain'))) {
        setError('Domain not authorized yet in Firebase Console. Please add "vpark-one.vercel.app" to Firebase Console > Authentication > Settings > Authorized domains.');
      } else if (err?.message && err.message.includes('temporarily unavailable')) {
        setError('Google Sign-In is temporarily unavailable on this domain. Please ensure "vpark-one.vercel.app" is added under Firebase Console > Authentication > Settings > Authorized domains.');
      } else {
        setError(err?.message || 'Google authentication encountered an error. Please try again.');
      }
    } finally {
      setGoogleSigningIn(false);
    }
  };

  const handleForgetSavedId = () => {
    try {
      localStorage.removeItem('vpark_remembered_email');
      localStorage.removeItem('vpark_remembered_name');
      localStorage.removeItem('vpark_remembered_id');
      setRememberedEmail(null);
      setRememberedName(null);
      setEmail('');
    } catch {}
  };

  const handleCompleteOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (phone.trim()) {
      const normalized = normalizeIndianPhone(phone.trim());
      if (!normalized) {
        setError('Please enter a valid 10-digit mobile number starting with 6-9 (e.g. 9876543210).');
        return;
      }
    }

    if (plateNumber.trim()) {
      if (!validatePlateNumber(plateNumber.trim())) {
        setError('Please enter a valid Indian vehicle registration plate (e.g. KA-04-MB-1234 or 22-BH-1234-AA).');
        return;
      }
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          providerType: intent === 'provider' ? providerType : undefined,
          acceptTerms,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to save profile details.');
        return;
      }

      let finalUser = data.user;

      if (plateNumber.trim()) {
        try {
          const vRes = await fetch('/api/user/vehicles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: vehicleType,
              makeModel: makeModel.trim() || 'Primary Vehicle',
              plateNumber: plateNumber.trim().toUpperCase(),
              isEv: vehicleType === 'EV',
            }),
          });
          const vData = await vRes.json();
          if (vData.success && vData.user) {
            finalUser = vData.user;
          }
        } catch {
          // non-fatal
        }
      }

      onAuthenticated(finalUser);
    } catch {
      setError('Failed to save profile details.');
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
              {step === 'onboarding'
                ? 'Complete User Details'
                : 'Sign In with Google'}
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

      <div className="p-5 space-y-4 text-xs">
        {/* Two-door intent selector */}
        {step !== 'onboarding' && (
          <div>
            <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--ink-secondary)] block mb-1.5">
              Select Operating Mode:
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIntent('driver')}
                className={`p-2.5 rounded-sm border text-left transition-colors flex items-center gap-2.5 font-mono text-xs ${
                  intent === 'driver'
                    ? 'border-[var(--transit-accent)] bg-[var(--surface-bg)] text-[var(--transit-accent)] font-semibold'
                    : 'border-[var(--hairline)] text-[var(--ink-secondary)] hover:bg-[var(--surface-alt)]'
                }`}
              >
                <Car className="w-4 h-4 flex-shrink-0" />
                <div>
                  <span className="block text-xs uppercase">Drive / Park</span>
                  <span className="text-[10px] text-[var(--ink-tertiary)] font-normal">Reserve bay</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setIntent('provider')}
                className={`p-2.5 rounded-sm border text-left transition-colors flex items-center gap-2.5 font-mono text-xs ${
                  intent === 'provider'
                    ? 'border-[var(--transit-accent)] bg-[var(--surface-bg)] text-[var(--transit-accent)] font-semibold'
                    : 'border-[var(--hairline)] text-[var(--ink-secondary)] hover:bg-[var(--surface-alt)]'
                }`}
              >
                <Building2 className="w-4 h-4 flex-shrink-0" />
                <div>
                  <span className="block text-xs uppercase">Host / List</span>
                  <span className="text-[10px] text-[var(--ink-tertiary)] font-normal">Rent driveway</span>
                </div>
              </button>
            </div>
          </div>
        )}

        {error && (
          <div role="alert" className="p-2.5 rounded-sm bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-400 font-mono text-xs flex items-start gap-2 animate-fade-in">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="flex-1">{error}</span>
          </div>
        )}

        {/* Step 1: Sole Authentication Method - Google Sign-In with Remembered ID */}
        {step === 'google_auth' && (
          <div className={`space-y-4 py-1${stepEnterClass}`}>
            {/* Remembered Sign-In Identity Banner */}
            {rememberedEmail && (
              <div className="p-3 rounded-sm bg-[var(--surface-alt)] border border-[var(--hairline-strong)] flex items-center justify-between">
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <div className="w-7 h-7 rounded-full bg-[var(--transit-accent)]/15 text-[var(--transit-accent)] flex items-center justify-center font-bold text-xs shrink-0">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[9px] font-mono text-[var(--ink-tertiary)] uppercase tracking-wider block">
                      Remembered Sign-In ID
                    </span>
                    <span className="text-xs font-semibold text-[var(--ink)] block truncate">
                      {rememberedName ? `${rememberedName} (${rememberedEmail})` : rememberedEmail}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleForgetSavedId}
                  className="text-[10px] font-mono text-[var(--ink-tertiary)] hover:text-red-500 underline ml-2 shrink-0 cursor-pointer"
                  title="Clear remembered sign-in ID"
                >
                  Switch
                </button>
              </div>
            )}

            {/* Google Authentication 1-Click Button */}
            <div className="space-y-3 pt-1">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={googleSigningIn || loading}
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
                  {googleSigningIn
                    ? 'Connecting to Google...'
                    : rememberedEmail
                    ? `Continue as ${rememberedEmail}`
                    : 'Continue with Google'}
                </span>
              </button>

              <div className="space-y-2 pt-1">
                {/* Remember Sign-In ID Checkbox */}
                <label className="flex items-center gap-2 p-2 rounded-sm bg-[var(--surface-alt)] border border-[var(--hairline)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberId}
                    onChange={(e) => setRememberId(e.target.checked)}
                    className="w-3.5 h-3.5 accent-[var(--transit-accent)]"
                  />
                  <span className="text-[10px] font-mono text-[var(--ink)] leading-tight">
                    Remember sign-in ID on this device
                  </span>
                </label>

                {/* Terms & DPDP Notice Checkbox */}
                <label className="flex items-start gap-2 p-2 rounded-sm bg-[var(--surface-alt)] border border-[var(--hairline)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                    className="mt-0.5 w-3.5 h-3.5 accent-[var(--transit-accent)]"
                  />
                  <span className="text-[10px] font-mono text-[var(--ink-secondary)] leading-relaxed">
                    I agree to VPark Terms of Service &amp; DPDP Act 2023 Privacy Notice.
                  </span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Complete User Details (Mobile Number & Vehicle Details Stored Here) */}
        {step === 'onboarding' && (
          <form key="step-onboarding" onSubmit={handleCompleteOnboarding} className={`space-y-3${stepEnterClass}`}>
            <div>
              <label
                htmlFor="vpark-fullname"
                className="font-mono text-[10px] uppercase tracking-wider text-[var(--ink-secondary)] block mb-1"
              >
                Full Legal Name *
              </label>
              <input
                id="vpark-fullname"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Ramesh Patel"
                className="w-full px-3 py-2 rounded-sm border border-[var(--hairline-strong)] bg-[var(--canvas-bg)] font-mono text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--transit-accent)]"
              />
            </div>

            <div>
              <label
                htmlFor="vpark-user-phone"
                className="font-mono text-[10px] uppercase tracking-wider text-[var(--ink-secondary)] block mb-1"
              >
                Mobile Number (User Contact Details)
              </label>
              <div className="relative flex items-center">
                <Phone className="w-4 h-4 text-[var(--ink-tertiary)] absolute left-3" />
                <input
                  id="vpark-user-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 9876543210"
                  className="w-full pl-9 pr-3 py-2 rounded-sm border border-[var(--hairline-strong)] bg-[var(--canvas-bg)] font-mono text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--transit-accent)]"
                />
              </div>
              <span className="text-[9px] font-mono text-[var(--ink-tertiary)] mt-0.5 block">
                Saved in your user profile for parking gate access and driver-host coordination. Not used for login.
              </span>
            </div>

            {intent === 'driver' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label
                    htmlFor="vpark-onboard-plate"
                    className="font-mono text-[10px] uppercase tracking-wider text-[var(--ink-secondary)] block mb-1"
                  >
                    Vehicle Plate (Optional)
                  </label>
                  <input
                    id="vpark-onboard-plate"
                    type="text"
                    value={plateNumber}
                    onChange={(e) => setPlateNumber(e.target.value)}
                    placeholder="e.g. KA-04-MB-1234"
                    className="w-full px-3 py-2 rounded-sm border border-[var(--hairline-strong)] bg-[var(--canvas-bg)] font-mono text-xs uppercase text-[var(--ink)] focus:outline-none focus:border-[var(--transit-accent)]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="vpark-onboard-vtype"
                    className="font-mono text-[10px] uppercase tracking-wider text-[var(--ink-secondary)] block mb-1"
                  >
                    Vehicle Class
                  </label>
                  <select
                    id="vpark-onboard-vtype"
                    value={vehicleType}
                    onChange={(e) => setVehicleType(e.target.value as VehicleType)}
                    className="w-full px-3 py-2 rounded-sm border border-[var(--hairline-strong)] bg-[var(--canvas-bg)] text-xs text-[var(--ink)]"
                  >
                    <option value="TWO_WHEELER">2-Wheeler</option>
                    <option value="HATCHBACK">Hatchback</option>
                    <option value="SEDAN">Sedan</option>
                    <option value="SUV">SUV</option>
                    <option value="EV">Electric Vehicle (EV)</option>
                  </select>
                </div>
              </div>
            )}

            {intent === 'provider' && (
              <div>
                <label
                  htmlFor="vpark-prov-type"
                  className="font-mono text-[10px] uppercase tracking-wider text-[var(--ink-secondary)] block mb-1"
                >
                  Host Capacity Tier
                </label>
                <select
                  id="vpark-prov-type"
                  value={providerType}
                  onChange={(e) => setProviderType(e.target.value as ProviderType)}
                  className="w-full px-3 py-2 rounded-sm border border-[var(--hairline-strong)] bg-[var(--canvas-bg)] font-mono text-xs text-[var(--ink)]"
                >
                  <option value="OWNER">Owner (Driveway / Residential bay)</option>
                  <option value="OPERATOR">Operator (Commercial facility)</option>
                  <option value="MANAGER">Authorised Building Manager</option>
                </select>
              </div>
            )}

            <label className="flex items-start gap-2 p-2.5 rounded-sm bg-[var(--surface-alt)] border border-[var(--hairline)] cursor-pointer">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                className="mt-0.5 w-3.5 h-3.5 accent-[var(--transit-accent)]"
              />
              <span className="text-[10px] font-mono text-[var(--ink-secondary)] leading-relaxed">
                Accept Terms of Service &amp; Privacy Policy ({APP_CONFIG.legalDocVersions.terms}). Stored under DPDP Act 2023 regulations.
              </span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-sm bg-brand hover:bg-brand-hover disabled:opacity-50 text-white font-mono text-xs uppercase tracking-wider transition-[background-color,transform] duration-150 enabled:active:scale-[0.98] cursor-pointer"
            >
              {loading ? 'Saving Details...' : 'Confirm Registration'}
            </button>
          </form>
        )}
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto"
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
