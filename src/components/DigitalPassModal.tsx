'use client';

import React, { useId, useState } from 'react';
import { ModalBackdrop, ModalPanel } from '@/components/motion/AnimatedModal';
import { useDialog } from '@/components/motion/useDialog';
import { useI18n } from '@/components/i18n/LanguageProvider';
import { Booking } from '@/types';
import { PassLocationMap } from '@/components/maps/PassLocationMap';
import { X, MapPin, Phone, CheckCircle2, AlertTriangle, FileText, PlusCircle, HelpCircle, ExternalLink, Navigation, Loader2 } from 'lucide-react';

interface DigitalPassModalProps {
  booking: Booking;
  onClose: () => void;
  onRefresh: () => void;
  onOpenDispute: (booking: Booking) => void;
}

export function DigitalPassModal({ booking, onClose, onRefresh, onOpenDispute }: DigitalPassModalProps) {
  const { t, tn, inr, date, time } = useI18n();
  const ids = { title: useId(), reason: useId() };
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [photoUrl] = useState<string>('');
  const [showInvoice, setShowInvoice] = useState<boolean>(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState<boolean>(false);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const ref = useDialog<HTMLDivElement>(onClose);

  // Check-in action (PRD 8.10)
  const handleCheckIn = async () => {
    setIsUpdating(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/bookings/${booking.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CHECK_IN',
          photoUrl: photoUrl || 'https://images.unsplash.com/photo-1590674899484-d5640e854abe?w=400',
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMessage({ ok: true, text: t('pass.checkedIn') });
        onRefresh();
      } else {
        setStatusMessage({ ok: false, text: data.error || t('pass.checkInFailed') });
      }
    } catch {
      setStatusMessage({ ok: false, text: t('pass.checkInFailed') });
    } finally {
      setIsUpdating(false);
    }
  };

  // Check-out action (PRD 8.10)
  const handleCheckOut = async () => {
    setIsUpdating(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/bookings/${booking.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'CHECK_OUT' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMessage({ ok: true, text: t('pass.checkedOut') });
        onRefresh();
      } else {
        setStatusMessage({ ok: false, text: data.error || t('pass.checkOutFailed') });
      }
    } catch {
      setStatusMessage({ ok: false, text: t('pass.checkOutFailed') });
    } finally {
      setIsUpdating(false);
    }
  };

  // Extension action (PRD 8.8 BOOK-6)
  const handleExtend = async (hours: number) => {
    setIsUpdating(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/bookings/${booking.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'EXTEND', additionalHours: hours }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({ ok: true, text: t('pass.extended', { hours: tn('common.hours', hours) }) });
        onRefresh();
      } else {
        setStatusMessage({ ok: false, text: data.error || t('pass.extendFailed') });
      }
    } catch {
      setStatusMessage({ ok: false, text: t('pass.extendFailed') });
    } finally {
      setIsUpdating(false);
    }
  };

  // Cancellation action (PRD 8.9)
  const handleCancelBooking = async () => {
    setIsUpdating(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/bookings/${booking.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CANCEL',
          cancelledBy: 'DRIVER',
          reason: cancelReason || 'Driver plans changed',
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMessage({ ok: true, text: t('pass.cancelled', { amount: inr(data.refundAmount || 0, { decimals: true }) }) });
        setShowCancelConfirm(false);
        onRefresh();
      } else {
        setStatusMessage({ ok: false, text: data.error || t('pass.cancelFailed') });
      }
    } catch {
      setStatusMessage({ ok: false, text: t('pass.cancelFailed') });
    } finally {
      setIsUpdating(false);
    }
  };

  const statusBadge = () => {
    switch (booking.status) {
      case 'CONFIRMED':
        return <span className="vp-badge vp-badge-info">{t('pass.statusConfirmed')}</span>;
      case 'CHECKED_IN':
        return <span className="vp-badge vp-badge-success">{t('pass.statusCheckedIn')}</span>;
      case 'COMPLETED':
        return <span className="vp-badge">{t('pass.statusCompleted')}</span>;
      case 'CANCELLED_BY_DRIVER':
      case 'CANCELLED_BY_PROVIDER':
        return <span className="vp-badge vp-badge-danger">{t('pass.statusCancelled')}</span>;
      case 'DISPUTED':
        return <span className="vp-badge vp-badge-warning">{t('pass.statusDisputed')}</span>;
      default:
        return <span className="vp-badge font-mono">{booking.status}</span>;
    }
  };

  const tile = (label: string, value: React.ReactNode, sub?: React.ReactNode) => (
    <div className="vp-panel p-3">
      <span className="block text-xs text-ink-3">{label}</span>
      <span className="mt-0.5 block text-sm font-semibold text-ink">{value}</span>
      {sub && <span className="block text-xs text-ink-3">{sub}</span>}
    </div>
  );

  const revealed = !(booking.locationRevealed === false || booking.listingLatitude === undefined || booking.listingLongitude === undefined);

  return (
    <ModalBackdrop
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-3 backdrop-blur-sm sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <ModalPanel className="my-auto w-full max-w-lg">
        <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={ids.title} className="vp-card flex max-h-[92vh] flex-col overflow-hidden shadow-raised">
          {/* Pass header */}
          <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
            <div>
              <span className="block text-xs font-semibold text-[var(--success-ink)]">{t('pass.eyebrow')}</span>
              <h2 id={ids.title} className="font-mono text-xl font-semibold text-ink">
                {booking.referenceNumber}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('pass.close')}
              className="rounded-full p-2 text-ink-3 transition-colors hover:bg-surface-alt hover:text-ink"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <div className="space-y-5 overflow-y-auto p-5 sm:p-6">
            {/* Status and sample QR */}
            <div className="vp-panel space-y-3 p-5 text-center">
              <div className="flex justify-center">{statusBadge()}</div>
              <div className="inline-block rounded-card bg-white p-4 shadow-card animate-scale-in [animation-delay:160ms]" aria-hidden="true">
                <div className="flex h-36 w-36 flex-col justify-between border-4 border-slate-900 p-2">
                  <div className="flex justify-between">
                    <div className="h-8 w-8 bg-slate-900" />
                    <div className="h-8 w-8 bg-slate-900" />
                  </div>
                  <div className="text-center font-mono text-[9px] font-bold tracking-tighter text-slate-900">{booking.referenceNumber}</div>
                  <div className="flex justify-between">
                    <div className="h-8 w-8 bg-slate-900" />
                    <div className="h-4 w-4 self-end bg-slate-900" />
                  </div>
                </div>
              </div>
              <p className="text-xs text-ink-3">{t('pass.sampleCode')}</p>
            </div>

            {statusMessage && (
              <div role={statusMessage.ok ? 'status' : 'alert'} className={`vp-alert ${statusMessage.ok ? 'vp-alert-success' : 'vp-alert-danger'}`}>
                {statusMessage.text}
              </div>
            )}

            <div className="space-y-3 text-sm">
              {/* Exact location: only after a qualifying booking (server decides via locationRevealed) */}
              {!revealed ? (
                <div className="vp-panel flex items-start gap-2.5 p-3">
                  <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-ink-3" aria-hidden="true" />
                  <div>
                    <h3 className="font-semibold text-ink">{booking.listingTitle}</h3>
                    <p className="mt-0.5 text-ink-2">{booking.listingAddress}</p>
                  </div>
                </div>
              ) : (
                (() => {
                  const exactLat = booking.listingLatitude as number;
                  const exactLng = booking.listingLongitude as number;
                  const googleMapsNavUrl = `https://www.google.com/maps/dir/?api=1&destination=${exactLat},${exactLng}`;
                  return (
                    <div className="space-y-3 rounded-card border border-[var(--success-border)] bg-[var(--success-bg)] p-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-sm font-semibold text-[var(--success-ink)]">
                          <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
                          {t('pass.exactLocation')}
                        </span>
                        <span className="vp-badge vp-badge-success">{t('pass.bookingConfirmed')}</span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-ink">{booking.listingTitle}</h3>
                        <p className="mt-0.5 text-ink-2">{booking.listingAddress}</p>
                        <p className="mt-1 flex items-center gap-1 font-mono text-xs text-[var(--success-ink)]">
                          <MapPin className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                          {t('pass.gps')}: {exactLat.toFixed(6)}, {exactLng.toFixed(6)}
                        </p>
                      </div>
                      <PassLocationMap latitude={exactLat} longitude={exactLng} title={booking.listingTitle} />
                      <a href={googleMapsNavUrl} target="_blank" rel="noopener noreferrer" className="vp-btn vp-btn-primary w-full rounded-control">
                        <Navigation className="h-4 w-4" aria-hidden="true" />
                        {t('pass.directions')}
                        <ExternalLink className="h-3.5 w-3.5 opacity-80" aria-hidden="true" />
                      </a>
                    </div>
                  );
                })()
              )}

              {booking.listingAccessInstructions && (
                <div className="vp-alert vp-alert-info block">
                  <span className="block font-semibold">{t('pass.gate')}</span>
                  <p className="mt-0.5 text-ink">{booking.listingAccessInstructions}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {tile(t('pass.vehicle'), <span className="font-mono">{booking.vehiclePlateNumber}</span>, t(`vehicles.${booking.vehicleType}`))}
                {tile(t('pass.window'), `${time(booking.startTime)} → ${time(booking.endTime)}`, date(booking.startTime, { day: 'numeric', month: 'short' }))}
              </div>

              <div className="vp-panel flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <span className="block text-xs text-ink-3">{t('pass.hostRelay')}</span>
                  <span className="block font-semibold text-ink">{booking.providerName}</span>
                  <span className="block font-mono text-xs text-ink-3">{booking.providerPhoneMasked}</span>
                </div>
                <a href={`tel:${booking.providerPhoneMasked.replace(/\s+/g, '')}`} className="vp-btn vp-btn-success vp-btn-sm flex-shrink-0">
                  <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                  {t('pass.callRelay')}
                </a>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2">
              {booking.status === 'CONFIRMED' && (
                <button type="button" onClick={handleCheckIn} disabled={isUpdating} className="vp-btn vp-btn-success vp-btn-lg w-full rounded-control">
                  {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
                  {isUpdating ? t('pass.checkingIn') : t('pass.checkIn')}
                </button>
              )}

              {booking.status === 'CHECKED_IN' && (
                <div className="space-y-2">
                  <button type="button" onClick={handleCheckOut} disabled={isUpdating} className="vp-btn vp-btn-primary vp-btn-lg w-full rounded-control">
                    {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
                    {isUpdating ? t('pass.checkingOut') : t('pass.checkOut')}
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => handleExtend(1)} disabled={isUpdating} className="vp-btn vp-btn-secondary vp-btn-sm rounded-control">
                      <PlusCircle className="h-3.5 w-3.5" aria-hidden="true" />
                      {t('pass.extend1')}
                    </button>
                    <button type="button" onClick={() => handleExtend(2)} disabled={isUpdating} className="vp-btn vp-btn-secondary vp-btn-sm rounded-control">
                      <PlusCircle className="h-3.5 w-3.5" aria-hidden="true" />
                      {t('pass.extend2')}
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 pt-1">
                <button type="button" onClick={() => setShowInvoice(!showInvoice)} aria-expanded={showInvoice} className="vp-btn vp-btn-ghost vp-btn-sm -ml-3">
                  <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                  {showInvoice ? t('pass.receiptHide') : t('pass.receiptShow')}
                </button>
                <button type="button" onClick={() => onOpenDispute(booking)} className="vp-btn vp-btn-ghost vp-btn-sm text-[var(--warning-ink)]">
                  <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
                  {t('pass.report')}
                </button>
                {booking.status === 'CONFIRMED' && (
                  <button type="button" onClick={() => setShowCancelConfirm(true)} className="vp-btn vp-btn-ghost vp-btn-sm -mr-3 text-[var(--danger-ink)]">
                    {t('pass.cancel')}
                  </button>
                )}
              </div>
            </div>

            {showCancelConfirm && (
              <div className="space-y-3 rounded-card border border-[var(--danger-border)] bg-[var(--danger-bg)] p-4 text-sm animate-fade-in">
                <p className="flex items-center gap-1.5 font-semibold text-[var(--danger-ink)]">
                  <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                  {t('pass.cancelTitle')}
                </p>
                <p className="text-ink-2">{t('pass.cancelPolicy')}</p>
                <div>
                  <label htmlFor={ids.reason} className="vp-label">
                    {t('pass.cancelReason')}
                  </label>
                  <input id={ids.reason} type="text" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} className="vp-input" />
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <button type="button" onClick={() => setShowCancelConfirm(false)} className="vp-btn vp-btn-secondary vp-btn-sm">
                    {t('pass.keep')}
                  </button>
                  <button type="button" onClick={handleCancelBooking} disabled={isUpdating} className="vp-btn vp-btn-danger vp-btn-sm">
                    {t('pass.confirmCancel')}
                  </button>
                </div>
              </div>
            )}

            {/* Receipt (payments are simulated in the pilot, so this is labelled as a sample) */}
            {showInvoice && (
              <div className="vp-panel space-y-2 p-4 text-xs">
                <p className="vp-alert vp-alert-warning py-1.5 text-xs font-semibold">{t('pass.receiptSample')}</p>
                <div className="flex flex-wrap justify-between gap-2 border-b border-hairline pb-2 font-mono">
                  <span className="font-semibold text-ink">VPARK TECHNOLOGIES INDIA PVT LTD</span>
                  <span className="text-ink-2">GSTIN: 29AABCU9603R1ZM</span>
                </div>
                <dl className="space-y-1 text-ink-2">
                  <div className="flex gap-2">
                    <dt>{t('pass.receiptRef')}:</dt>
                    <dd className="font-mono">INV-{booking.referenceNumber}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt>{t('pass.receiptDate')}:</dt>
                    <dd>{date(booking.createdAt)}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt>{t('pass.receiptDriver')}:</dt>
                    <dd>
                      {booking.driverName} (<span className="font-mono">{booking.driverPhone}</span>)
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt>{t('pass.receiptVehicle')}:</dt>
                    <dd className="font-mono">{booking.vehiclePlateNumber}</dd>
                  </div>
                </dl>
                <dl className="space-y-1 border-t border-hairline pt-2 tabular-nums">
                  <div className="flex justify-between gap-2 text-ink">
                    <dt>{t('pass.receiptParking', { hours: tn('common.hours', booking.pricingSnapshot.durationHours) })}</dt>
                    <dd>{inr(booking.pricingSnapshot.parkingFee, { decimals: true })}</dd>
                  </div>
                  <div className="flex justify-between gap-2 text-ink-2">
                    <dt>{t('pass.receiptCommission')}</dt>
                    <dd>{inr(booking.pricingSnapshot.platformFee, { decimals: true })}</dd>
                  </div>
                  <div className="flex justify-between gap-2 text-ink-2">
                    <dt>{t('pass.receiptCgst')}</dt>
                    <dd>{inr(booking.pricingSnapshot.cgst, { decimals: true })}</dd>
                  </div>
                  <div className="flex justify-between gap-2 text-ink-2">
                    <dt>{t('pass.receiptSgst')}</dt>
                    <dd>{inr(booking.pricingSnapshot.sgst, { decimals: true })}</dd>
                  </div>
                  <div className="flex justify-between gap-2 border-t border-hairline pt-1.5 text-sm font-bold text-ink">
                    <dt>{t('pass.receiptTotal')}</dt>
                    <dd className="text-[var(--success-ink)]">{inr(booking.pricingSnapshot.totalAmount, { decimals: true })}</dd>
                  </div>
                </dl>
              </div>
            )}
          </div>
        </div>
      </ModalPanel>
    </ModalBackdrop>
  );
}
