'use client';

import React, { useState, useEffect } from 'react';
import { ProviderType, User, UserRole } from '@/types';
import { APP_CONFIG } from '@/lib/constants';
import {
  X,
  Phone,
  ShieldCheck,
  Car,
  Building2,
  CheckCircle2,
  ArrowRight,
  Lock,
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
  const [step, setStep] = useState<'phone' | 'otp' | 'onboarding'>('phone');
  const [phone, setPhone] = useState<string>('');
  const [otp, setOtp] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
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

  const handleRequestOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setHint(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REQUEST_OTP', phone }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.retryAfterSeconds) setCooldown(data.retryAfterSeconds);
        setError(data.error || 'Could not send OTP.');
      } else {
        setStep('otp');
        setCooldown(data.cooldownSeconds || APP_CONFIG.otpResendCooldownSeconds);
        setHint(`Demo OTP code: ${data.demoOtp || APP_CONFIG.demoOtp} (valid for ${APP_CONFIG.otpExpiryMinutes} mins)`);
      }
    } catch {
      setError('Network error requesting OTP.');
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
        body: JSON.stringify({ action: 'VERIFY_OTP', phone, otp, intent }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Invalid OTP.');
      } else if (data.onboardingRequired) {
        setStep('onboarding');
      } else {
        onAuthenticated(data.user);
      }
    } catch {
      setError('Network error verifying OTP.');
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
          email: email || undefined,
          providerType: intent === 'provider' ? providerType : undefined,
          acceptTerms,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to save profile.');
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
            System Auth · Telecom OTP
          </span>
          <h2 className="text-sm font-bold tracking-tight uppercase text-[var(--ink)] mt-0.5">
            {step === 'onboarding' ? 'Profile Completion' : 'Driver & Host Terminal'}
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
          <div role="alert" className="p-2.5 rounded-sm bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-400 font-mono text-xs">
            {error}
          </div>
        )}

        {hint && (
          <div className="p-2.5 rounded-sm bg-[var(--surface-alt)] border border-[var(--hairline-strong)] text-[var(--ink)] font-mono text-xs">
            {hint}
          </div>
        )}

        {/* Step 1: Phone Number */}
        {step === 'phone' && (
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <div>
              <label htmlFor="vpark-phone-input" className="font-mono text-[10px] uppercase tracking-wider text-[var(--ink-secondary)] block mb-1.5">
                Primary Mobile Number (+91 E.164)
              </label>
              <div className="relative flex items-center">
                <Phone className="w-4 h-4 text-[var(--ink-tertiary)] absolute left-3" />
                <input
                  id="vpark-phone-input"
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="9876543210"
                  className="w-full pl-9 pr-3 py-2 rounded-sm border border-[var(--hairline-strong)] bg-[var(--canvas-bg)] focus:bg-[var(--surface-bg)] font-mono text-xs text-[var(--ink)]"
                />
              </div>
              <span className="text-[10px] font-mono text-[var(--ink-tertiary)] mt-1 block">
                Single credential handles driver reservations and host payouts.
              </span>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-sm bg-[var(--transit-accent)] hover:bg-[var(--transit-accent-hover)] disabled:opacity-50 text-white font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
            >
              {loading ? 'Transmitting OTP...' : 'Request 6-Digit OTP'}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        )}

        {/* Step 2: Verify OTP */}
        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="vpark-otp-input" className="font-mono text-[10px] uppercase tracking-wider text-[var(--ink-secondary)]">
                  Enter 6-Digit Code
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setStep('phone');
                    setError(null);
                  }}
                  className="text-[var(--transit-accent)] font-mono text-[10px] uppercase hover:underline"
                >
                  Edit Number
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
                className="w-full px-4 py-2.5 rounded-sm border border-[var(--hairline-strong)] bg-[var(--canvas-bg)] focus:bg-[var(--surface-bg)] font-mono text-center text-lg tracking-[0.35em] text-[var(--ink)]"
              />
            </div>

            <button
              type="submit"
              disabled={loading || otp.length < 4}
              className="w-full py-2.5 rounded-sm bg-[var(--transit-accent)] hover:bg-[var(--transit-accent-hover)] disabled:opacity-50 text-white font-mono text-xs uppercase tracking-wider transition-colors"
            >
              {loading ? 'Verifying...' : 'Authenticate & Proceed'}
            </button>

            <div className="text-center">
              <button
                type="button"
                disabled={cooldown > 0 || loading}
                onClick={() => handleRequestOtp()}
                className="text-[var(--ink-secondary)] hover:text-[var(--ink)] disabled:opacity-40 font-mono text-[10px] uppercase tracking-wider"
              >
                {cooldown > 0 ? `Resend Available in ${cooldown}s` : 'Resend OTP Code'}
              </button>
            </div>
          </form>
        )}

        {/* Step 3: Name, Optional Email, DPDP Terms Consent */}
        {step === 'onboarding' && (
          <form onSubmit={handleCompleteOnboarding} className="space-y-3">
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
                placeholder="Karthik Nair"
                className="w-full px-3 py-2 rounded-sm border border-[var(--hairline-strong)] bg-[var(--canvas-bg)] font-mono text-xs text-[var(--ink)]"
              />
            </div>

            <div>
              <label htmlFor="vpark-email" className="font-mono text-[10px] uppercase tracking-wider text-[var(--ink-secondary)] block mb-1">
                Email Address (Receipts / Invoices)
              </label>
              <input
                id="vpark-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="karthik@example.com"
                className="w-full px-3 py-2 rounded-sm border border-[var(--hairline-strong)] bg-[var(--canvas-bg)] font-mono text-xs text-[var(--ink)]"
              />
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
                Accept Terms of Service & Privacy Policy ({APP_CONFIG.legalDocVersions.terms}). Timestamp and consent IP logged under DPDP Act 2023.
              </span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-sm bg-[var(--transit-accent)] hover:bg-[var(--transit-accent-hover)] disabled:opacity-50 text-white font-mono text-xs uppercase tracking-wider transition-colors"
            >
              {loading ? 'Creating Record...' : 'Confirm Registration'}
            </button>
          </form>
        )}

        {/* Quick Demo Persona Launcher */}
        {step !== 'onboarding' && (
          <div className="pt-3 border-t border-[var(--hairline)] space-y-1.5">
            <div className="font-mono text-[10px] text-[var(--ink-tertiary)] uppercase tracking-wider">
              Pilot Quick-Access Personas
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                disabled={loading}
                onClick={() => handleDemoLogin('DRIVER')}
                className="p-1.5 rounded-sm border border-[var(--hairline)] hover:border-[var(--hairline-strong)] bg-[var(--surface-alt)] hover:bg-[var(--surface-bg)] text-center transition-colors font-mono text-xs"
              >
                <span className="font-bold text-[var(--ink)] block text-[11px]">RAJESH</span>
                <span className="text-[9px] text-[var(--ink-tertiary)] uppercase">Driver</span>
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => handleDemoLogin('PROVIDER')}
                className="p-1.5 rounded-sm border border-[var(--hairline)] hover:border-[var(--hairline-strong)] bg-[var(--surface-alt)] hover:bg-[var(--surface-bg)] text-center transition-colors font-mono text-xs"
              >
                <span className="font-bold text-[var(--ink)] block text-[11px]">SURESH</span>
                <span className="text-[9px] text-[var(--ink-tertiary)] uppercase">Host</span>
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => handleDemoLogin('ADMIN')}
                className="p-1.5 rounded-sm border border-[var(--hairline)] hover:border-[var(--hairline-strong)] bg-[var(--surface-alt)] hover:bg-[var(--surface-bg)] text-center transition-colors font-mono text-xs"
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Sign in to VPark"
    >
      <AuthPanel initialIntent={initialIntent} onAuthenticated={onAuthenticated} onClose={onClose} />
    </div>
  );
}

