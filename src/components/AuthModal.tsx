'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ProviderType, User, UserRole } from '@/types';
import { APP_CONFIG } from '@/lib/constants';
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
  const [step, setStep] = useState<'email' | 'otp' | 'master_password' | 'onboarding'>('email');
  // Presentation only: slide a step in after the first step change (not on initial open).
  const initialStepRef = useRef(step);
  const stepChangedRef = useRef(false);
  if (step !== initialStepRef.current) stepChangedRef.current = true;
  const stepEnterClass = stepChangedRef.current ? ' animate-slide-in' : '';
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [otp, setOtp] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [providerType, setProviderType] = useState<ProviderType>('OWNER');
  const [acceptTerms, setAcceptTerms] = useState<boolean>(true);
  const [cooldown, setCooldown] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    setIntent(initialIntent);
  }, [initialIntent]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => {
      setCooldown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const handleEmailSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setHint(null);

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

    setLoading(true);
    try {
      const res = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REQUEST_OTP', email: cleanEmail }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.retryAfterSeconds) setCooldown(data.retryAfterSeconds);
        setError(data.error || 'Could not send verification code.');
      } else if (data.isMasterAdmin) {
        setStep('master_password');
      } else {
        setStep('otp');
        setCooldown(data.cooldownSeconds || APP_CONFIG.otpResendCooldownSeconds);
        setHint(`Demo code: ${data.demoOtp || APP_CONFIG.demoOtp} (valid for ${APP_CONFIG.otpExpiryMinutes} mins)`);
      }
    } catch {
      setError('Network error requesting verification code.');
    } finally {
      setLoading(false);
    }
  };

  const handleMasterLogin = async (e: React.FormEvent) => {
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
        onAuthenticated(data.user);
      }
    } catch {
      setError('Network error during master authentication.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'VERIFY_OTP', email: email.trim().toLowerCase(), otp, intent }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Invalid verification code.');
      } else if (data.onboardingRequired) {
        setStep('onboarding');
      } else {
        onAuthenticated(data.user);
      }
    } catch {
      setError('Network error verifying code.');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
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
      } else {
        onAuthenticated(data.user);
      }
    } catch {
      setError('Failed to save profile details.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (role: UserRole) => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'SWITCH_DEMO_PERSONA', role, switchDemoUser: true }),
      });
      const data = await res.json();
      if (data.success && data.user) {
        onAuthenticated(data.user);
      } else {
        setError(data.error || 'Could not switch demo profile.');
      }
    } catch {
      setError('Failed to sign into demo account.');
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
              : 'Driver & Host Login'}
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

      <div className="p-5 space-y-5 text-xs">
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
          <div role="alert" className="p-2.5 rounded-sm bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-400 font-mono text-xs animate-fade-in">
            {error}
          </div>
        )}

        {hint && (
          <div className="p-2.5 rounded-sm bg-[var(--surface-alt)] border border-[var(--hairline-strong)] text-[var(--ink)] font-mono text-xs animate-fade-in">
            {hint}
          </div>
        )}

        {/* Step 1: Email Address (Replaces Phone Login) */}
        {step === 'email' && (
          <form key="step-email" onSubmit={handleEmailSubmit} className={`space-y-4${stepEnterClass}`}>
            <div>
              <label htmlFor="vpark-email-input" className="font-mono text-[10px] uppercase tracking-wider text-[var(--ink-secondary)] block mb-1.5">
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
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. driver@vpark.in or your.name@example.com"
                  className="w-full pl-9 pr-3 py-2 rounded-sm border border-[var(--hairline-strong)] bg-[var(--canvas-bg)] focus:bg-[var(--surface-bg)] font-mono text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--transit-accent)]"
                />
              </div>
              <span className="text-[10px] font-mono text-[var(--ink-tertiary)] mt-1 block">
                Single email handles driver reservations, host listings, and audit payouts.
              </span>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-sm bg-[var(--transit-accent)] hover:bg-[var(--transit-accent-hover)] disabled:opacity-50 text-white font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-[background-color,transform] duration-150 enabled:active:scale-[0.98] cursor-pointer"
            >
              {loading ? 'Processing...' : 'Continue with Email'}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
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
              <label htmlFor="vpark-master-pwd" className="font-mono text-[10px] uppercase tracking-wider text-[var(--ink-secondary)] block mb-1.5">
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
                setStep('email');
                setPassword('');
                setError(null);
              }}
              className="text-center w-full text-[var(--ink-secondary)] hover:text-[var(--ink)] font-mono text-[10px] uppercase hover:underline"
            >
              Switch Account
            </button>
          </form>
        )}

        {/* Step 2: Verify Email OTP */}
        {step === 'otp' && (
          <form key="step-otp" onSubmit={handleVerifyOtp} className={`space-y-4${stepEnterClass}`}>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="vpark-otp-input" className="font-mono text-[10px] uppercase tracking-wider text-[var(--ink-secondary)]">
                  Enter 6-Digit Email Code
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setStep('email');
                    setError(null);
                  }}
                  className="text-[var(--transit-accent)] font-mono text-[10px] uppercase hover:underline cursor-pointer"
                >
                  Edit Email
                </button>
              </div>
              <input
                id="vpark-otp-input"
                type="text"
                inputMode="numeric"
                maxLength={6}
                required
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="w-full px-4 py-2.5 rounded-sm border border-[var(--hairline-strong)] bg-[var(--canvas-bg)] focus:bg-[var(--surface-bg)] font-mono text-center text-lg tracking-[0.35em] text-[var(--ink)] focus:outline-none focus:border-[var(--transit-accent)]"
              />
            </div>

            <button
              type="submit"
              disabled={loading || otp.length < 4}
              className="w-full py-2.5 rounded-sm bg-[var(--transit-accent)] hover:bg-[var(--transit-accent-hover)] disabled:opacity-50 text-white font-mono text-xs uppercase tracking-wider transition-[background-color,transform] duration-150 enabled:active:scale-[0.98] cursor-pointer"
            >
              {loading ? 'Verifying...' : 'Authenticate & Proceed'}
            </button>

            <div className="text-center">
              <button
                type="button"
                disabled={cooldown > 0 || loading}
                onClick={() => handleEmailSubmit()}
                className="text-[var(--ink-secondary)] hover:text-[var(--ink)] disabled:opacity-40 font-mono text-[10px] uppercase tracking-wider cursor-pointer"
              >
                {cooldown > 0 ? `Resend Available in ${cooldown}s` : 'Resend Verification Code'}
              </button>
            </div>
          </form>
        )}

        {/* Step 3: Complete User Details (Mobile Number Stored Here Exclusively as User Detail) */}
        {step === 'onboarding' && (
          <form key="step-onboarding" onSubmit={handleCompleteOnboarding} className={`space-y-3${stepEnterClass}`}>
            <div>
              <label htmlFor="vpark-fullname" className="font-mono text-[10px] uppercase tracking-wider text-[var(--ink-secondary)] block mb-1">
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
              <label htmlFor="vpark-user-phone" className="font-mono text-[10px] uppercase tracking-wider text-[var(--ink-secondary)] block mb-1">
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

            {intent === 'provider' && (
              <div>
                <label htmlFor="vpark-prov-type" className="font-mono text-[10px] uppercase tracking-wider text-[var(--ink-secondary)] block mb-1">
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

        {/* Quick Demo Persona Launcher */}
        {step !== 'onboarding' && step !== 'master_password' && (
          <div className="pt-3 border-t border-[var(--hairline)] space-y-1.5">
            <div className="flex items-center justify-between font-mono text-[10px] text-[var(--ink-tertiary)] uppercase tracking-wider">
              <span>Pilot Quick-Access Personas</span>
              <button
                type="button"
                onClick={() => {
                  setEmail('jhasaksham.7453k@gmail.com');
                  setStep('master_password');
                }}
                className="text-[9px] text-[var(--transit-accent)] hover:underline flex items-center gap-1 cursor-pointer"
                title="Master Console Access"
              >
                <Lock className="w-3 h-3" />
                <span>Master Login</span>
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                disabled={loading}
                onClick={() => handleDemoLogin('DRIVER')}
                className="p-1.5 rounded-sm border border-[var(--hairline)] hover:border-[var(--hairline-strong)] bg-[var(--surface-alt)] hover:bg-[var(--surface-bg)] text-center transition-colors font-mono text-xs cursor-pointer"
              >
                <span className="font-bold text-[var(--ink)] block text-[11px]">RAJESH</span>
                <span className="text-[9px] text-[var(--ink-tertiary)] uppercase">Driver</span>
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => handleDemoLogin('PROVIDER')}
                className="p-1.5 rounded-sm border border-[var(--hairline)] hover:border-[var(--hairline-strong)] bg-[var(--surface-alt)] hover:bg-[var(--surface-bg)] text-center transition-colors font-mono text-xs cursor-pointer"
              >
                <span className="font-bold text-[var(--ink)] block text-[11px]">SURESH</span>
                <span className="text-[9px] text-[var(--ink-tertiary)] uppercase">Host</span>
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => handleDemoLogin('ADMIN')}
                className="p-1.5 rounded-sm border border-[var(--hairline)] hover:border-[var(--hairline-strong)] bg-[var(--surface-alt)] hover:bg-[var(--surface-bg)] text-center transition-colors font-mono text-xs cursor-pointer"
              >
                <span className="font-bold text-[var(--ink)] block text-[11px]">VIKRAM</span>
                <span className="text-[9px] text-[var(--ink-tertiary)] uppercase">Admin</span>
              </button>
            </div>
          </div>
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
