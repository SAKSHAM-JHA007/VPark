'use client';

import React, { useState, useEffect, useId } from 'react';
import { ModalBackdrop, ModalPanel } from '@/components/motion/AnimatedModal';
import { useDialog } from '@/components/motion/useDialog';
import { useI18n } from '@/components/i18n/LanguageProvider';
import { SearchResultItem, Vehicle, VehicleType } from '@/types';
import { calculatePricingPaise } from '@/lib/engine.mjs';
import { toPaise } from '@/lib/constants';
import { validatePlateNumber } from '@/lib/validation';
import { X, ShieldCheck, AlertTriangle, Lock, ChevronRight, ExternalLink, CheckCircle2, MapPin, Loader2, ImageOff } from 'lucide-react';

interface ListingDetailModalProps {
  item: SearchResultItem;
  userVehicles: Vehicle[];
  isAuthenticated: boolean;
  onRequireAuth: () => void;
  onClose: () => void;
  onBookingSuccess: (bookingId: string) => void;
}

const VEHICLE_ORDER: VehicleType[] = ['SEDAN', 'HATCHBACK', 'SUV', 'EV', 'TWO_WHEELER'];
const PAYMENT_METHODS = ['UPI', 'CARD', 'NETBANKING'] as const;

export function ListingDetailModal({
  item,
  userVehicles,
  isAuthenticated,
  onRequireAuth,
  onClose,
  onBookingSuccess,
}: ListingDetailModalProps) {
  const { t, tn, inr, date, time } = useI18n();
  const { listing } = item;
  const ids = { title: useId(), vehicle: useId(), plate: useId(), plateMsg: useId(), duration: useId(), error: useId(), payTitle: useId() };

  const [selectedVehicleType, setSelectedVehicleType] = useState<VehicleType>(userVehicles[0]?.type || 'SEDAN');
  const [plateNumber, setPlateNumber] = useState<string>(userVehicles[0]?.plateNumber || 'KA-04-MB-1234');

  const [durationHours, setDurationHours] = useState<number>(2);
  const [startTime] = useState<string>(() => {
    const d = new Date();
    d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
    return d.toISOString();
  });

  const [activeHold, setActiveHold] = useState<{ id: string; expiresAt: string } | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(600);
  const [isHolding, setIsHolding] = useState<boolean>(false);
  const [isBooking, setIsBooking] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'UPI' | 'CARD' | 'NETBANKING'>('UPI');

  const dialogRef = useDialog<HTMLDivElement>(showPaymentModal ? undefined : onClose, true);
  const paymentRef = useDialog<HTMLDivElement>(() => setShowPaymentModal(false), showPaymentModal);

  const endTimeIso = new Date(new Date(startTime).getTime() + durationHours * 60 * 60 * 1000).toISOString();
  const hourlyPaise = listing.pricing.hourlyRatePaise ?? toPaise(listing.pricing.hourlyRate);
  const pricing = calculatePricingPaise(hourlyPaise, startTime, endTimeIso);
  const total = inr(pricing.totalAmount, { decimals: true });
  const plateInvalid = plateNumber.trim() !== '' && !validatePlateNumber(plateNumber);

  useEffect(() => {
    if (!activeHold) return;

    const timer = setInterval(() => {
      const remainingMs = new Date(activeHold.expiresAt).getTime() - Date.now();
      const secs = Math.max(0, Math.floor(remainingMs / 1000));
      setSecondsRemaining(secs);

      if (secs <= 0) {
        setActiveHold(null);
        setErrorMessage(t('detail.holdExpired'));
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [activeHold, t]);

  const handleSecureHold = async () => {
    if (!isAuthenticated) {
      onRequireAuth();
      return;
    }

    if (!validatePlateNumber(plateNumber)) {
      setErrorMessage(t('detail.plateInvalid'));
      return;
    }

    setIsHolding(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/holds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId: listing.id,
          vehicleType: selectedVehicleType,
          startTime,
          endTime: endTimeIso,
        }),
      });

      if (res.status === 401) {
        onRequireAuth();
        return;
      }

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data.error || t('detail.holdFailed'));
      } else {
        setActiveHold({ id: data.hold.id, expiresAt: data.hold.expiresAt });
        setSecondsRemaining(600);
        setShowPaymentModal(true);
      }
    } catch {
      setErrorMessage(t('detail.holdNetwork'));
    } finally {
      setIsHolding(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!validatePlateNumber(plateNumber)) {
      setErrorMessage(t('detail.plateInvalid'));
      return;
    }

    setIsBooking(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId: listing.id,
          vehicleType: selectedVehicleType,
          vehiclePlateNumber: plateNumber,
          startTime,
          endTime: endTimeIso,
          paymentMethod: selectedPaymentMethod,
          holdId: activeHold?.id,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data.error || t('detail.paymentFailed'));
        setShowPaymentModal(false);
      } else {
        onBookingSuccess(data.booking.id);
      }
    } catch {
      setErrorMessage(t('detail.bookingFailed'));
      setShowPaymentModal(false);
    } finally {
      setIsBooking(false);
    }
  };

  const spec = (label: string, value: React.ReactNode) => (
    <div className="vp-panel p-3">
      <span className="block text-xs text-ink-3">{label}</span>
      <span className="mt-0.5 block text-sm font-semibold text-ink">{value}</span>
    </div>
  );

  const accessLabel = t(`accessMethods.${listing.accessMethod}` as 'accessMethods.GATE_GUARD');

  return (
    <ModalBackdrop
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-3 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !showPaymentModal) onClose();
      }}
    >
      <ModalPanel className="my-auto w-full max-w-3xl">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={ids.title}
          className="vp-card flex max-h-[92vh] flex-col overflow-hidden text-ink shadow-raised"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={
                  listing.category === 'PRIVATE'
                    ? 'vp-badge vp-badge-host'
                    : listing.category === 'COMMERCIAL'
                    ? 'vp-badge vp-badge-info'
                    : 'vp-badge'
                }
              >
                {t(`categories.${listing.category}`)}
              </span>
              {listing.status === 'VERIFIED' && (
                <span className="vp-badge vp-badge-success">
                  <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                  {t('listing.verified')}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('detail.close')}
              className="rounded-full p-2 text-ink-3 transition-colors hover:bg-surface-alt hover:text-ink"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {/* Scrollable content */}
          <div className="space-y-5 overflow-y-auto p-5 sm:p-6">
            {listing.photos.length > 0 ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {listing.photos.map((photo, i) => (
                  <div key={i} className="h-40 overflow-hidden rounded-control border border-hairline bg-surface-alt">
                    <img src={photo} alt={`${listing.title} (${i + 1})`} className="h-full w-full object-cover" loading="lazy" decoding="async" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="vp-panel flex h-28 items-center justify-center gap-2 text-sm text-ink-3">
                <ImageOff className="h-5 w-5" aria-hidden="true" />
                {t('listing.noPhoto')}
              </div>
            )}

            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 id={ids.title} className="text-xl font-bold leading-tight text-ink sm:text-2xl">
                  {listing.title}
                </h2>
                <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-2">
                  <span className="inline-flex items-center gap-1 font-medium text-ink">
                    <MapPin className="h-3.5 w-3.5 text-ink-3" aria-hidden="true" />
                    {listing.locality || 'Yelahanka'}
                  </span>
                  {listing.landmark && <span>· {t('listing.near', { landmark: listing.landmark })}</span>}
                </p>
                {listing.locationPrecision === 'APPROXIMATE' && (
                  <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--info-ink)]">
                    <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                    {t('detail.exactAfterBooking')}
                  </p>
                )}
                {listing.dimensionsNotes && <p className="mt-1.5 text-sm text-ink-3">{listing.dimensionsNotes}</p>}
              </div>
              <div className="flex-shrink-0 text-right tabular-nums">
                <span className="block text-2xl font-bold text-ink">{inr(listing.pricing.hourlyRate)}</span>
                <span className="block text-xs text-ink-3">{t('detail.perHour')}</span>
              </div>
            </div>

            {listing.category === 'PUBLIC' && (
              <div role="note" className="vp-alert vp-alert-warning">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-semibold">{t('detail.publicTitle')}</p>
                  <p className="mt-0.5">
                    {listing.surveyDate || t('detail.surveyedRecently')}. {t('detail.publicBody')}
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {spec(t('detail.specCover'), listing.isCovered ? t('detail.specCovered') : t('detail.specOpen'))}
              {spec(t('detail.specHeight'), t('detail.specHeightValue', { meters: listing.heightClearanceMeters || '2.2' }))}
              {spec(t('detail.specEv'), listing.hasEvCharging ? listing.evChargerType || t('detail.specEvAvailable') : t('detail.specEvNone'))}
              {spec(t('detail.specAccess'), accessLabel)}
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="vp-panel space-y-1.5 p-4 text-sm">
                <h3 className="flex items-center gap-1.5 font-semibold text-ink">
                  <Lock className="h-4 w-4 text-[var(--transit-accent)]" aria-hidden="true" />
                  {t('detail.accessTitle')}
                </h3>
                <p className="leading-relaxed text-ink-2">
                  {listing.category === 'PUBLIC' ? listing.accessInstructions : t('detail.accessPrivate', { method: accessLabel })}
                </p>
              </div>
              <div className="vp-panel space-y-1.5 p-4 text-sm">
                <h3 className="font-semibold text-ink">{t('detail.houseRules')}</h3>
                <ul className="list-disc space-y-0.5 pl-4 text-ink-2">
                  {listing.houseRules.map((rule, idx) => (
                    <li key={idx}>{rule}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="vp-panel flex items-center justify-between gap-3 p-4 text-sm">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-surface font-bold text-ink ring-1 ring-[var(--hairline)]" aria-hidden="true">
                  {listing.providerName[0]}
                </span>
                <div className="min-w-0">
                  <span className="block font-semibold text-ink">{listing.providerName}</span>
                  <span className="block text-xs text-ink-3">
                    {t('detail.hostMeta', {
                      type: t(`providerTypes.${listing.providerType}`),
                      date: date(listing.lastConfirmedAt),
                    })}
                  </span>
                </div>
              </div>
              <div className="hidden text-right text-xs text-ink-3 sm:block">
                <span className="block font-semibold text-ink-2">{t('detail.relayTitle')}</span>
                <span>{t('detail.relayBody')}</span>
              </div>
            </div>

            {activeHold && (
              <div className="relative flex items-center justify-between gap-4 overflow-hidden rounded-control border border-[var(--warning-border)] bg-[var(--warning-bg)] p-4 text-[var(--warning-ink)] animate-fade-up">
                <span
                  aria-hidden="true"
                  className="absolute bottom-0 left-0 h-1 w-full origin-left bg-amber-500/60 transition-transform duration-1000 ease-linear"
                  style={{ transform: `scaleX(${Math.max(0, Math.min(1, secondsRemaining / 600))})` }}
                />
                <div className="flex items-center gap-2.5">
                  <Lock className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                  <div>
                    <span className="block text-sm font-semibold">{t('detail.holdTitle')}</span>
                    <span className="text-xs">{t('detail.holdBody')}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-mono text-xl font-semibold" aria-live="off">
                    {Math.floor(secondsRemaining / 60)}:{(secondsRemaining % 60).toString().padStart(2, '0')}
                  </span>
                  <span className="block text-[11px] font-semibold">{t('detail.holdRemaining')}</span>
                </div>
              </div>
            )}

            {listing.isBookable ? (
              <section aria-labelledby={`${ids.title}-reserve`} className="space-y-4 rounded-card border border-[var(--info-border)] bg-[var(--accent-soft)] p-4 sm:p-5 oled:bg-black">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 id={`${ids.title}-reserve`} className="text-base font-semibold text-ink">
                    {t('detail.reserveTitle')}
                  </h3>
                  <span className="vp-badge vp-badge-warning">{t('detail.testBadge')}</span>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor={ids.vehicle} className="vp-label">
                      {t('detail.vehicleType')}
                    </label>
                    <select
                      id={ids.vehicle}
                      value={selectedVehicleType}
                      onChange={(e) => setSelectedVehicleType(e.target.value as VehicleType)}
                      className="vp-input"
                    >
                      {VEHICLE_ORDER.map((v) => (
                        <option key={v} value={v}>
                          {t(`vehicleExamples.${v}`)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor={ids.plate} className="vp-label">
                      {t('detail.plate')}
                    </label>
                    <input
                      id={ids.plate}
                      type="text"
                      value={plateNumber}
                      onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
                      placeholder={t('detail.platePlaceholder')}
                      autoCapitalize="characters"
                      aria-invalid={plateInvalid || undefined}
                      aria-describedby={plateNumber.trim() ? ids.plateMsg : undefined}
                      className="vp-input font-mono font-semibold"
                    />
                    {plateInvalid && (
                      <p id={ids.plateMsg} className="vp-field-error">
                        {t('detail.plateInvalid')}
                      </p>
                    )}
                    {plateNumber.trim() && !plateInvalid && (
                      <p id={ids.plateMsg} className="mt-1.5 flex items-center gap-1 text-xs font-medium text-[var(--success-ink)]">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        {t('detail.plateValid')}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <label htmlFor={ids.duration} className="font-semibold text-ink">
                      {t('detail.duration')}: {tn('common.hours', durationHours)}
                    </label>
                    <span className="tabular-nums text-ink-2">
                      {time(startTime)} → {time(endTimeIso)}
                    </span>
                  </div>
                  <input
                    id={ids.duration}
                    type="range"
                    min="1"
                    max="12"
                    value={durationHours}
                    onChange={(e) => setDurationHours(parseInt(e.target.value, 10))}
                    aria-valuetext={tn('common.hours', durationHours)}
                    className="w-full cursor-pointer accent-[var(--transit-accent)]"
                  />
                </div>

                <dl className="space-y-1.5 rounded-control border border-hairline bg-surface p-4 text-sm tabular-nums">
                  <div className="flex justify-between gap-3 text-ink-2">
                    <dt>{t('detail.feeParking', { hours: tn('common.hours', durationHours), rate: inr(listing.pricing.hourlyRate) })}</dt>
                    <dd>{inr(pricing.parkingFee, { decimals: true })}</dd>
                  </div>
                  <div className="flex justify-between gap-3 text-ink-2">
                    <dt>{t('detail.feeConvenience')}</dt>
                    <dd>{inr(pricing.platformFee, { decimals: true })}</dd>
                  </div>
                  <div className="flex justify-between gap-3 text-xs text-ink-3">
                    <dt>{t('detail.feeTaxes')}</dt>
                    <dd>{inr(pricing.totalTaxes, { decimals: true })}</dd>
                  </div>
                  <div className="flex justify-between gap-3 border-t border-hairline pt-2 text-base font-bold text-ink">
                    <dt>{t('detail.feeTotal')}</dt>
                    <dd className="text-[var(--transit-accent)]">{total}</dd>
                  </div>
                </dl>

                {errorMessage && (
                  <div id={ids.error} role="alert" className="vp-alert vp-alert-danger">
                    {errorMessage}
                  </div>
                )}

                {!activeHold ? (
                  <button
                    type="button"
                    onClick={handleSecureHold}
                    disabled={isHolding}
                    className="vp-btn vp-btn-primary vp-btn-lg w-full rounded-control"
                  >
                    {isHolding ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Lock className="h-4 w-4" aria-hidden="true" />}
                    {!isAuthenticated
                      ? t('detail.loginToReserve', { amount: total })
                      : isHolding
                      ? t('detail.holding')
                      : t('detail.hold', { amount: total })}
                  </button>
                ) : (
                  <button type="button" onClick={() => setShowPaymentModal(true)} className="vp-btn vp-btn-primary vp-btn-lg w-full rounded-control">
                    {t('detail.proceed', { amount: total })}
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </section>
            ) : (
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${listing.latitude},${listing.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="vp-btn vp-btn-primary vp-btn-lg w-full rounded-control"
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                {t('detail.directions')}
              </a>
            )}
          </div>
        </div>
      </ModalPanel>

      {/* Test-mode payment step */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-fade-in">
          <div
            ref={paymentRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={ids.payTitle}
            className="vp-card w-full max-w-md overflow-hidden shadow-raised animate-scale-in"
          >
            <div className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-4">
              <div>
                <span className="vp-badge vp-badge-warning">{t('payment.badge')}</span>
                <h3 id={ids.payTitle} className="mt-1.5 text-lg font-bold text-ink">
                  {t('payment.merchant')}
                </h3>
              </div>
              <button
                type="button"
                aria-label={t('payment.close')}
                onClick={() => setShowPaymentModal(false)}
                className="rounded-full p-2 text-ink-3 transition-colors hover:bg-surface-alt hover:text-ink"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div className="vp-panel flex items-center justify-between p-4">
                <div>
                  <span className="block text-xs text-ink-3">{t('payment.total')}</span>
                  <span className="text-2xl font-bold tabular-nums text-ink">{total}</span>
                </div>
                <span className="font-mono text-xs text-ink-3">
                  {t('payment.reference')}: VPK-{listing.id.slice(-4)}
                </span>
              </div>

              <fieldset className="space-y-2">
                <legend className="mb-2 text-sm font-semibold text-ink">{t('payment.method')}</legend>
                {PAYMENT_METHODS.map((method) => {
                  const selected = selectedPaymentMethod === method;
                  return (
                    <label
                      key={method}
                      className={`flex min-h-[3rem] cursor-pointer items-center justify-between gap-3 rounded-control border px-3.5 py-2.5 text-sm transition-colors ${
                        selected
                          ? 'border-[var(--transit-accent)] bg-[var(--accent-soft)] font-semibold text-ink ring-1 ring-[var(--transit-accent)]'
                          : 'border-hairline-strong text-ink-2 hover:bg-surface-alt'
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <input
                          type="radio"
                          name="vp-payment-method"
                          value={method}
                          checked={selected}
                          onChange={() => setSelectedPaymentMethod(method)}
                          className="vp-check"
                        />
                        {t(`payment.${method}`)}
                      </span>
                      {selected && <CheckCircle2 className="h-4 w-4 text-[var(--transit-accent)]" aria-hidden="true" />}
                    </label>
                  );
                })}
              </fieldset>

              <button type="button" onClick={handleConfirmPayment} disabled={isBooking} className="vp-btn vp-btn-primary vp-btn-lg w-full rounded-control">
                {isBooking && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {isBooking ? t('payment.confirming') : t('payment.pay', { amount: total })}
              </button>
            </div>
          </div>
        </div>
      )}
    </ModalBackdrop>
  );
}
