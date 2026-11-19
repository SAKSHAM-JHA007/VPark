'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ProviderType, User, VehicleType } from '@/types';
import { APP_CONFIG } from '@/lib/constants';
import { signInWithGooglePopup } from '@/lib/firebase';
import { validatePlateNumber, normalizeIndianPhone } from '@/lib/validation';
import { ModalBackdrop, ModalPanel } from '@/components/motion/AnimatedModal';
import {
  X,
  Mail,
  Phone,
  ShieldCheck,
  Car,
  Building2,
  CheckCircle2,
  ArrowRight,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  AlertCircle,
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
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signup');
  const [step, setStep] = useState<'credentials' | 'master_password' | 'onboarding'>('credentials');

  const initialStepRef = useRef(step);
  const stepChangedRef = useRef(false);
  if (step !== initialStepRef.current) stepChangedRef.current = true;
  const stepEnterClass = stepChangedRef.current ? ' animate-slide-in' : '';

  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);

  const [phone, setPhone] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [providerType, setProviderType] = useState<ProviderType>('OWNER');
  const [acceptTerms, setAcceptTerms] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [googleSigningIn, setGoogleSigningIn] = useState<boolean>(false);
  const [plateNumber, setPlateNumber] = useState<string>('');
  const [makeModel, setMakeModel] = useState<string>('');
  const [vehicleType, setVehicleType] = useState<VehicleType>('SEDAN');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIntent(initialIntent);
  }, [initialIntent]);

  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

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
        setError(data.error || 'Failed to authenticate with Google.');
        return;
      }

      const user: User = data.user;
      if (user.roles.includes('ADMIN') || (user.phone && user.vehicles.length > 0)) {
        onAuthenticated(user);
      } else {
        setFullName(user.name || '');
        setEmail(user.email || '');
        setStep('onboarding');
      }
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      if (err?.code === 'auth/popup-closed-by-user') {
        setError('Google sign-in was closed before completion.');
      } else if (err?.code === 'auth/unauthorized-domain' || (err?.message && err.message.includes('auth/unauthorized-domain'))) {
        const domain = typeof window !== 'undefined' ? window.location.hostname : 'vpark-one.vercel.app';
        setError(
          `Domain "${domain}" is not in the Firebase Authorized Domains list. Please add "${domain}" in Firebase Console → Authentication → Settings → Authorized domains. You can sign in using your Email & Password below!`
        );
      } else {
        setError(err?.message || 'Google authentication encountered an error.');
      }
    } finally {
      setGoogleSigningIn(false);
    }
  };

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    // Direct client detection for Master Administrator
    if (cleanEmail === 'jhasaksham.7453k@gmail.com') {
      setStep('master_password');
      return;
    }

    if (!password) {
      setError('Please enter a password.');
      return;
    }

    if (authMode === 'signup') {
      if (password.length < 6) {
        setError('Password must be at least 6 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match. Please verify both password fields.');
        return;
      }
      if (!acceptTerms) {
        setError('Please agree to the VPark Terms of Service & Privacy Policy.');
        return;
      }
    }

    setLoading(true);
    try {
      const endpoint = '/api/auth/email';
      const payload =
        authMode === 'signup'
          ? { action: 'SIGNUP', email: cleanEmail, password, confirmPassword, intent }
          : { action: 'LOGIN', email: cleanEmail, password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        // Helpful redirection if user tried to login on an unregistered email
        if (authMode === 'signin' && data.error && data.error.includes('No account found')) {
          setError('No account found for this email. Switched to Sign Up so you can set your password.');
          setAuthMode('signup');
        } else if (authMode === 'signup' && data.error && data.error.includes('already exists')) {
          setError('An account with this email already exists. Switched to Sign In.');
          setAuthMode('signin');
        } else {
          setError(data.error || 'Authentication failed. Please check your credentials.');
        }
        return;
      }

      if (data.onboardingRequired) {
        setFullName(data.user.name || '');
        setStep('onboarding');
      } else {
        onAuthenticated(data.user);
      }
    } catch {
      setError('Network error during authentication. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleMasterLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/email', {
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
        onAuthenticated(data.user);
      }
    } catch {
      setError('Network error during master authentication.');
    } finally {
      setLoading(false);
    }
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
        <div>
          <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-secondary)] block">
            {step === 'master_password' ? 'Security Gate · Master Console' : 'System Access Terminal'}
          </span>
          <h2 className="text-sm font-bold tracking-tight uppercase text-[var(--ink)] mt-0.5">
            {step === 'onboarding'
              ? 'Complete User Details'
              : step === 'master_password'
              ? 'Master Admin Authentication'
              : authMode === 'signup'
              ? 'Create VPark Account'
              : 'Sign In to VPark'}
          </h2>
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
        {step !== 'onboarding' && step !== 'master_password' && (
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

        {/* Step 1: Credentials (Google Sign-In + Email with 2-Step Password) */}
        {step === 'credentials' && (
          <div className={`space-y-4${stepEnterClass}`}>
            {/* Google Authentication 1-Click Button */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={googleSigningIn || loading}
                className="w-full py-2.5 px-4 rounded-sm bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-[var(--hairline-strong)] text-[var(--ink)] font-semibold text-xs flex items-center justify-center gap-2.5 transition-colors cursor-pointer shadow-xs disabled:opacity-60"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
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
                <span>{googleSigningIn ? 'Connecting to Google...' : 'Continue with Google'}</span>
              </button>

              <div className="flex items-center gap-2 font-mono text-[10px] text-[var(--ink-tertiary)] uppercase tracking-wider">
                <div className="flex-1 h-px bg-[var(--hairline)]" />
                <span>Or continue with Email</span>
                <div className="flex-1 h-px bg-[var(--hairline)]" />
              </div>
            </div>

            {/* Mode Tabs: Sign Up (Create Account) vs Sign In */}
            <div className="flex border-b border-[var(--hairline-strong)] mb-2">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signup');
                  setError(null);
                }}
                className={`flex-1 py-2 font-mono text-xs uppercase tracking-wider text-center border-b-2 transition-colors cursor-pointer ${
                  authMode === 'signup'
                    ? 'border-[var(--transit-accent)] text-[var(--transit-accent)] font-bold'
                    : 'border-transparent text-[var(--ink-tertiary)] hover:text-[var(--ink)]'
                }`}
              >
                Sign Up (New Account)
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signin');
                  setError(null);
                }}
                className={`flex-1 py-2 font-mono text-xs uppercase tracking-wider text-center border-b-2 transition-colors cursor-pointer ${
                  authMode === 'signin'
                    ? 'border-[var(--transit-accent)] text-[var(--transit-accent)] font-bold'
                    : 'border-transparent text-[var(--ink-tertiary)] hover:text-[var(--ink)]'
                }`}
              >
                Sign In
              </button>
            </div>

            <form onSubmit={handleCredentialsSubmit} className="space-y-3.5">
              {/* Email Input */}
              <div>
                <label
                  htmlFor="vpark-email-input"
                  className="font-mono text-[10px] uppercase tracking-wider text-[var(--ink-secondary)] block mb-1.5"
                >
                  Primary Email ID
                </label>
                <div className="relative flex items-center">
                  <Mail className="w-4 h-4 text-[var(--ink-tertiary)] absolute left-3" />
                  <input
                    id="vpark-email-input"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (e.target.value.trim().toLowerCase() === 'jhasaksham.7453k@gmail.com') {
                        setStep('master_password');
                      }
                    }}
                    placeholder="e.g. driver@vpark.in or your.name@example.com"
                    className="w-full pl-9 pr-3 py-2 rounded-sm border border-[var(--hairline-strong)] bg-[var(--canvas-bg)] focus:bg-[var(--surface-bg)] font-mono text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--transit-accent)]"
                  />
                </div>
              </div>

              {/* Password Input (Step 1) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="vpark-password-input"
                    className="font-mono text-[10px] uppercase tracking-wider text-[var(--ink-secondary)]"
                  >
                    {authMode === 'signup' ? 'Step 1: Set Password (min 6 characters)' : 'Password'}
                  </label>
                </div>
                <div className="relative flex items-center">
                  <Lock className="w-4 h-4 text-[var(--ink-tertiary)] absolute left-3" />
                  <input
                    id="vpark-password-input"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={authMode === 'signup' ? 'Create a secure password' : 'Enter your password'}
                    className="w-full pl-9 pr-9 py-2 rounded-sm border border-[var(--hairline-strong)] bg-[var(--canvas-bg)] focus:bg-[var(--surface-bg)] font-mono text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--transit-accent)]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 text-[var(--ink-tertiary)] hover:text-[var(--ink)] cursor-pointer"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password (Step 2 - Only during Sign Up) */}
              {authMode === 'signup' && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="vpark-confirm-password-input"
                      className="font-mono text-[10px] uppercase tracking-wider text-[var(--ink-secondary)]"
                    >
                      Step 2: Confirm Password
                    </label>
                    {passwordsMatch && (
                      <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold">
                        <CheckCircle2 className="w-3 h-3" /> Passwords match
                      </span>
                    )}
                    {passwordsMismatch && (
                      <span className="font-mono text-[10px] text-red-600 dark:text-red-400 font-semibold">
                        Passwords do not match
                      </span>
                    )}
                  </div>
                  <div className="relative flex items-center">
                    <Lock className="w-4 h-4 text-[var(--ink-tertiary)] absolute left-3" />
                    <input
                      id="vpark-confirm-password-input"
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter your password to confirm"
                      className={`w-full pl-9 pr-9 py-2 rounded-sm border bg-[var(--canvas-bg)] focus:bg-[var(--surface-bg)] font-mono text-xs text-[var(--ink)] focus:outline-none ${
                        passwordsMismatch
                          ? 'border-red-500 focus:border-red-500'
                          : passwordsMatch
                          ? 'border-emerald-500 focus:border-emerald-500'
                          : 'border-[var(--hairline-strong)] focus:border-[var(--transit-accent)]'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 text-[var(--ink-tertiary)] hover:text-[var(--ink)] cursor-pointer"
                      aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {authMode === 'signup' && (
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
              )}

              <button
                type="submit"
                disabled={loading || (authMode === 'signup' && passwordsMismatch)}
                className="w-full py-2.5 rounded-sm bg-[var(--transit-accent)] hover:bg-[var(--transit-accent-hover)] disabled:opacity-50 text-white font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-[background-color,transform] duration-150 enabled:active:scale-[0.98] cursor-pointer"
              >
                {loading
                  ? 'Authenticating...'
                  : authMode === 'signup'
                  ? 'Create Account & Proceed'
                  : 'Continue with Email'}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <div className="text-center pt-1 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode(authMode === 'signup' ? 'signin' : 'signup');
                    setError(null);
                  }}
                  className="text-[var(--ink-secondary)] hover:text-[var(--ink)] font-mono text-[10px] uppercase hover:underline cursor-pointer"
                >
                  {authMode === 'signup'
                    ? 'Already have an account? Sign in'
                    : "Don't have an account? Sign up"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEmail('jhasaksham.7453k@gmail.com');
                    setStep('master_password');
                  }}
                  className="text-[10px] text-[var(--transit-accent)] hover:underline flex items-center gap-1 font-mono cursor-pointer"
                  title="Master Administrator Portal"
                >
                  <Lock className="w-3 h-3" />
                  <span>Master Login</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Master Admin Hidden Password Prompt */}
        {step === 'master_password' && (
          <form key="step-master" onSubmit={handleMasterLogin} className={`space-y-4${stepEnterClass}`}>
            <div className="p-3 rounded-sm bg-blue-500/10 border border-blue-500/30 flex items-center gap-2.5">
              <KeyRound className="w-5 h-5 text-[var(--transit-accent)] flex-shrink-0" />
              <div>
                <span className="font-bold text-[11px] uppercase tracking-wider block text-[var(--ink)]">
                  Master Administrator Identified
                </span>
                <span className="text-[10px] font-mono text-[var(--ink-secondary)]">{email}</span>
              </div>
            </div>

            <div>
              <label
                htmlFor="vpark-master-pwd"
                className="font-mono text-[10px] uppercase tracking-wider text-[var(--ink-secondary)] block mb-1.5"
              >
                Master Security Key
              </label>
              <div className="relative flex items-center">
                <Lock className="w-4 h-4 text-[var(--ink-tertiary)] absolute left-3" />
                <input
                  id="vpark-master-pwd"
                  type="password"
                  required
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter master password"
                  className="w-full pl-9 pr-3 py-2 rounded-sm border border-[var(--hairline-strong)] bg-[var(--canvas-bg)] focus:bg-[var(--surface-bg)] font-mono text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--transit-accent)]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full py-2.5 rounded-sm bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 font-bold font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-[background-color,transform] duration-150 enabled:active:scale-[0.98] cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Access Master Console'}
              <ShieldCheck className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
            </button>

            <button
              type="button"
              onClick={() => {
                setStep('credentials');
                setPassword('');
                setError(null);
              }}
              className="text-center w-full text-[var(--ink-secondary)] hover:text-[var(--ink)] font-mono text-[10px] uppercase hover:underline cursor-pointer"
            >
              Switch Account
            </button>
          </form>
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
              className="w-full py-2.5 rounded-sm bg-[var(--transit-accent)] hover:bg-[var(--transit-accent-hover)] disabled:opacity-50 text-white font-mono text-xs uppercase tracking-wider transition-[background-color,transform] duration-150 enabled:active:scale-[0.98] cursor-pointer"
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
