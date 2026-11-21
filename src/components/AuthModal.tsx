'use client';

import React, { useState, useEffect, useRef, useId } from 'react';
import { ProviderType, User, VehicleType } from '@/types';
import { APP_CONFIG } from '@/lib/constants';
import { signInWithGooglePopup } from '@/lib/firebase';
import { validatePlateNumber, normalizeIndianPhone } from '@/lib/validation';
import { ModalBackdrop, ModalPanel } from '@/components/motion/AnimatedModal';
import { useDialog } from '@/components/motion/useDialog';
import { useI18n } from '@/components/i18n/LanguageProvider';
import { X, Phone, Car, Building2, AlertCircle, UserCheck, Loader2 } from 'lucide-react';

interface AuthPanelProps {
  initialIntent?: 'driver' | 'provider';
  onAuthenticated: (user: User) => void;
  onClose?: () => void;
  /** Render without the panel's own card and header (the host page provides them). */
  embedded?: boolean;
}

const VEHICLE_OPTIONS: VehicleType[] = ['TWO_WHEELER', 'HATCHBACK', 'SEDAN', 'SUV', 'EV'];
const HOST_TYPES: ProviderType[] = ['OWNER', 'OPERATOR', 'MANAGER'];

export function AuthPanel({
  initialIntent = 'driver',
  onAuthenticated,
  onClose,
  embedded = false,
}: AuthPanelProps) {
  const { t } = useI18n();
  const [intent, setIntent] = useState<'driver' | 'provider'>(initialIntent);
  const [step, setStep] = useState<'google_auth' | 'onboarding'>('google_auth');
  const ids = { error: useId(), name: useId(), phone: useId(), phoneHint: useId(), plate: useId(), vtype: useId(), htype: useId(), title: useId() };

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
  const [makeModel] = useState<string>('');
  const [vehicleType, setVehicleType] = useState<VehicleType>('SEDAN');
  const [error, setError] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<'phone' | 'plate' | null>(null);

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
    setErrorField(null);
    if (!acceptTerms) {
      setError(t('auth.errAcceptTerms'));
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

      // The server derives identity and establishes the session.
      const idToken = await fbUser.getIdToken(true);
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idToken,
          uid: fbUser.uid,
          email: fbUser.email,
          name: fbUser.displayName,
          photoUrl: fbUser.photoURL,
          intent,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || t('auth.errGoogle'));
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
        setError(t('auth.errPopupClosed'));
      } else if (err?.code === 'auth/unauthorized-domain' || (err?.message && err.message.includes('auth/unauthorized-domain'))) {
        setError(t('auth.errDomain'));
      } else {
        setError(t('auth.errGoogleGeneric'));
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
    setErrorField(null);

    if (phone.trim()) {
      const normalized = normalizeIndianPhone(phone.trim());
      if (!normalized) {
        setError(t('auth.errPhone'));
        setErrorField('phone');
        return;
      }
    }

    if (plateNumber.trim()) {
      if (!validatePlateNumber(plateNumber.trim())) {
        setError(t('auth.errPlate'));
        setErrorField('plate');
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
        setError(data.error || t('auth.errProfile'));
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
      setError(t('auth.errProfile'));
    } finally {
      setLoading(false);
    }
  };

  const intentButton = (value: 'driver' | 'provider') => {
    const active = intent === value;
    const Icon = value === 'driver' ? Car : Building2;
    return (
      <button
        type="button"
        aria-pressed={active}
        onClick={() => setIntent(value)}
        className={`flex min-h-[3.5rem] items-center gap-3 rounded-control border px-3.5 py-2.5 text-left transition-colors ${
          active
            ? 'border-[var(--transit-accent)] bg-[var(--accent-soft)] text-ink ring-1 ring-[var(--transit-accent)]'
            : 'border-hairline-strong text-ink-2 hover:bg-surface-alt hover:text-ink'
        }`}
      >
        <Icon className={`h-5 w-5 flex-shrink-0 ${active ? 'text-[var(--transit-accent)]' : ''}`} aria-hidden="true" />
        <span className="min-w-0">
          <span className="block text-sm font-semibold">{value === 'driver' ? t('auth.driver') : t('auth.host')}</span>
          <span className="block text-xs text-ink-3">{value === 'driver' ? t('auth.driverHint') : t('auth.hostHint')}</span>
        </span>
      </button>
    );
  };

  const body = (
    <div className="space-y-4">
      {step !== 'onboarding' && (
        <div role="group" aria-label={t('auth.intentLabel')}>
          <p className="mb-2 text-sm font-semibold text-ink">{t('auth.intentLabel')}</p>
          <div className="grid grid-cols-2 gap-2">
            {intentButton('driver')}
            {intentButton('provider')}
          </div>
        </div>
      )}

      {error && (
        <div id={ids.error} role="alert" className="vp-alert vp-alert-danger animate-fade-in">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <span className="flex-1">{error}</span>
        </div>
      )}

      {/* Step 1: Google sign-in (sole authentication method) with a remembered account */}
      {step === 'google_auth' && (
        <div className={`space-y-3${stepEnterClass}`}>
          {rememberedEmail && (
            <div className="vp-panel flex items-center justify-between gap-3 p-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="vp-icon-tile h-8 w-8 rounded-full" aria-hidden="true">
                  <UserCheck className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <span className="block text-xs text-ink-3">{t('auth.remembered')}</span>
                  <span className="block truncate text-sm font-semibold text-ink">
                    {rememberedName ? `${rememberedName} (${rememberedEmail})` : rememberedEmail}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleForgetSavedId}
                className="vp-btn vp-btn-ghost vp-btn-sm flex-shrink-0"
                title={t('auth.switchHint')}
              >
                {t('auth.switchAccount')}
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleSigningIn || loading}
            className="vp-btn vp-btn-secondary vp-btn-lg w-full rounded-control"
          >
            {googleSigningIn ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            ) : (
              <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z" />
                <path fill="#34A853" d="M12 24c3.3 0 6.08-1.09 8.1-2.96l-3.88-3.05c-1.1.74-2.51 1.18-4.22 1.18-3.24 0-5.99-2.19-6.97-5.13H1.05v3.14C3.07 21.2 7.24 24 12 24Z" />
                <path fill="#FBBC05" d="M5.03 14.04c-.25-.74-.39-1.53-.39-2.34s.14-1.6.39-2.34V6.22H1.05C.38 7.56 0 9.09 0 11.7s.38 4.14 1.05 5.48l3.98-3.14Z" />
                <path fill="#EA4335" d="M12 4.65c1.8 0 3.41.62 4.68 1.83l3.51-3.51C18.07 1.09 15.3 0 12 0 7.24 0 3.07 2.8 1.05 6.22l3.98 3.14c.98-2.94 3.73-5.13 6.97-5.13Z" />
              </svg>
            )}
            <span className="min-w-0 truncate">
              {googleSigningIn
                ? t('auth.connecting')
                : rememberedEmail
                ? t('auth.googleAs', { email: rememberedEmail })
                : t('auth.google')}
            </span>
          </button>

          <div className="space-y-2 pt-1">
            <label className="flex cursor-pointer items-center gap-2.5 rounded-control px-1 py-1 text-sm text-ink">
              <input type="checkbox" checked={rememberId} onChange={(e) => setRememberId(e.target.checked)} className="vp-check" />
              <span>{t('auth.remember')}</span>
            </label>
            <label className="flex cursor-pointer items-start gap-2.5 rounded-control px-1 py-1 text-sm text-ink-2">
              <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} className="vp-check mt-0.5" />
              <span className="leading-relaxed">{t('auth.terms')}</span>
            </label>
          </div>
        </div>
      )}

      {/* Step 2: user details (mobile number and vehicle stored in the profile) */}
      {step === 'onboarding' && (
        <form key="step-onboarding" onSubmit={handleCompleteOnboarding} className={`space-y-4${stepEnterClass}`} noValidate>
          {embedded && <h3 className="text-base font-semibold text-ink">{t('auth.onboardingTitle')}</h3>}
          <div>
            <label htmlFor={ids.name} className="vp-label">
              {t('auth.fullName')} <span aria-hidden="true" className="text-[var(--danger-ink)]">*</span>
            </label>
            <input
              id={ids.name}
              type="text"
              required
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={t('auth.fullNamePlaceholder')}
              className="vp-input"
            />
          </div>

          <div>
            <label htmlFor={ids.phone} className="vp-label">
              {t('auth.phone')}
            </label>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
              <input
                id={ids.phone}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 9876543210"
                aria-invalid={errorField === 'phone' || undefined}
                aria-describedby={`${ids.phoneHint}${errorField === 'phone' ? ` ${ids.error}` : ''}`}
                className="vp-input pl-10"
              />
            </div>
            <p id={ids.phoneHint} className="vp-help">
              {t('auth.phoneHint')}
            </p>
          </div>

          {intent === 'driver' && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor={ids.plate} className="vp-label">
                  {t('auth.plate')}
                </label>
                <input
                  id={ids.plate}
                  type="text"
                  value={plateNumber}
                  onChange={(e) => setPlateNumber(e.target.value)}
                  placeholder="KA-04-MB-1234"
                  autoCapitalize="characters"
                  aria-invalid={errorField === 'plate' || undefined}
                  aria-describedby={errorField === 'plate' ? ids.error : undefined}
                  className="vp-input font-mono uppercase"
                />
              </div>
              <div>
                <label htmlFor={ids.vtype} className="vp-label">
                  {t('auth.vehicleClass')}
                </label>
                <select id={ids.vtype} value={vehicleType} onChange={(e) => setVehicleType(e.target.value as VehicleType)} className="vp-input">
                  {VEHICLE_OPTIONS.map((v) => (
                    <option key={v} value={v}>
                      {t(`vehicles.${v}`)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {intent === 'provider' && (
            <div>
              <label htmlFor={ids.htype} className="vp-label">
                {t('auth.hostType')}
              </label>
              <select id={ids.htype} value={providerType} onChange={(e) => setProviderType(e.target.value as ProviderType)} className="vp-input">
                {HOST_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(`auth.hostTypes.${type}`)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <label className="vp-panel flex cursor-pointer items-start gap-2.5 p-3 text-sm text-ink-2">
            <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} className="vp-check mt-0.5" />
            <span className="leading-relaxed">{t('auth.acceptTerms', { version: APP_CONFIG.legalDocVersions.terms })}</span>
          </label>

          <button type="submit" disabled={loading} className="vp-btn vp-btn-primary w-full rounded-control">
            {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {loading ? t('auth.saving') : t('auth.submit')}
          </button>
        </form>
      )}
    </div>
  );

  if (embedded) return body;

  return (
    <div className="vp-card w-full max-w-md overflow-hidden shadow-raised">
      <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
        <div>
          <p className="text-xs font-semibold text-[var(--transit-accent)]">{t('auth.eyebrow')}</p>
          <h2 id="vpark-auth-title" className="mt-0.5 text-lg font-bold text-ink">
            {step === 'onboarding' ? t('auth.onboardingTitle') : t('auth.signInTitle')}
          </h2>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label={t('auth.close')}
            className="rounded-full p-2 text-ink-3 transition-colors hover:bg-surface-alt hover:text-ink"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
      <div className="p-5">{body}</div>
    </div>
  );
}

interface AuthModalProps {
  initialIntent?: 'driver' | 'provider';
  onAuthenticated: (user: User) => void;
  onClose: () => void;
}

export function AuthModal({ initialIntent = 'driver', onAuthenticated, onClose }: AuthModalProps) {
  const ref = useDialog<HTMLDivElement>(onClose);
  return (
    <ModalBackdrop
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <ModalPanel className="my-auto w-full max-w-md">
        <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="vpark-auth-title">
          <AuthPanel initialIntent={initialIntent} onAuthenticated={onAuthenticated} onClose={onClose} />
        </div>
      </ModalPanel>
    </ModalBackdrop>
  );
}
