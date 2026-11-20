'use client';

import React, { useState } from 'react';
import { ModalBackdrop, ModalPanel } from '@/components/motion/AnimatedModal';
import { Booking } from '@/types';
import { CANCELLATION_POLICY_RULES } from '@/lib/constants';
import { PassLocationMap } from '@/components/maps/PassLocationMap';
import {
  X,
  QrCode,
  MapPin,
  Car,
  Clock,
  Phone,
  CheckCircle2,
  AlertTriangle,
  FileText,
  RotateCcw,
  PlusCircle,
  HelpCircle,
  Camera,
  ExternalLink,
  Navigation,
  ShieldCheck,
} from 'lucide-react';

interface DigitalPassModalProps {
  booking: Booking;
  onClose: () => void;
  onRefresh: () => void;
  onOpenDispute: (booking: Booking) => void;
}

export function DigitalPassModal({
  booking,
  onClose,
  onRefresh,
  onOpenDispute,
}: DigitalPassModalProps) {
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [showInvoice, setShowInvoice] = useState<boolean>(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState<boolean>(false);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

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
        setStatusMessage('Checked in successfully! Slot marked active.');
        onRefresh();
      } else {
        setStatusMessage(data.error || 'Check-in failed');
      }
    } catch (err) {
      setStatusMessage('Check-in failed');
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
        setStatusMessage('Check out complete. Session marked completed.');
        onRefresh();
      } else {
        setStatusMessage(data.error || 'Check out failed');
      }
    } catch (err) {
      setStatusMessage('Check out failed');
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
        setStatusMessage(`Extended by ${hours} hr(s)!`);
        onRefresh();
      } else {
        setStatusMessage(data.error || 'Extension unavailable');
      }
    } catch (err) {
      setStatusMessage('Extension failed');
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
        setStatusMessage(`Cancelled! Refund: ₹${data.refundAmount || 0}`);
        setShowCancelConfirm(false);
        onRefresh();
      } else {
        setStatusMessage(data.error || 'Cancellation failed');
      }
    } catch (err) {
      setStatusMessage('Cancellation failed');
    } finally {
      setIsUpdating(false);
    }
  };

  const getStatusBadge = () => {
    switch (booking.status) {
      case 'CONFIRMED':
        return <span className="bg-blue-100 dark:bg-blue-500/15 text-blue-800 dark:text-blue-300 font-bold px-2.5 py-0.5 rounded-full text-xs">Confirmed · Ready</span>;
      case 'CHECKED_IN':
        return <span className="bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 font-bold px-2.5 py-0.5 rounded-full text-xs animate-pulse">Parked · In Session</span>;
      case 'COMPLETED':
        return <span className="bg-slate-100 dark:bg-surface-alt text-slate-800 dark:text-ink font-bold px-2.5 py-0.5 rounded-full text-xs">Completed</span>;
      case 'CANCELLED_BY_DRIVER':
      case 'CANCELLED_BY_PROVIDER':
        return <span className="bg-red-100 dark:bg-red-500/15 text-red-800 dark:text-red-300 font-bold px-2.5 py-0.5 rounded-full text-xs">Cancelled</span>;
      case 'DISPUTED':
        return <span className="bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 font-bold px-2.5 py-0.5 rounded-full text-xs">Disputed · Under Review</span>;
      default:
        return <span className="bg-slate-100 dark:bg-surface-alt text-slate-800 dark:text-ink font-bold px-2.5 py-0.5 rounded-full text-xs">{booking.status}</span>;
    }
  };

  return (
    <ModalBackdrop className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-sm overflow-y-auto">
      <ModalPanel className="relative w-full max-w-lg bg-white dark:bg-surface rounded-3xl shadow-2xl border border-slate-200 dark:border-hairline overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Pass Header */}
        <div className="bg-gradient-to-r from-emerald-800 to-teal-900 text-white p-5 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-mono tracking-widest text-emerald-300 font-bold block">
              VPark booking pass
            </span>
            <span className="text-xl font-black font-mono tracking-wider">{booking.referenceNumber}</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-full text-emerald-200 hover:text-white transition-[color,transform] duration-150 active:scale-90">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-6 space-y-5">
          {/* Status & QR Container */}
          <div className="p-5 bg-slate-50 dark:bg-surface-alt rounded-2xl border border-slate-200 dark:border-hairline text-center space-y-3">
            <div className="flex justify-center">{getStatusBadge()}</div>

            {/* Simulated QR code (QR check-in is not live yet) */}
            <div className="inline-block p-4 bg-white rounded-2xl shadow-sm border border-slate-200 dark:border-transparent animate-scale-in [animation-delay:160ms]">
              <div className="w-36 h-36 border-4 border-slate-900 p-2 flex flex-col justify-between">
                <div className="flex justify-between">
                  <div className="w-8 h-8 bg-slate-900"></div>
                  <div className="w-8 h-8 bg-slate-900"></div>
                </div>
                <div className="text-[9px] font-mono font-bold text-slate-900 text-center tracking-tighter">
                  {booking.referenceNumber}
                </div>
                <div className="flex justify-between">
                  <div className="w-8 h-8 bg-slate-900"></div>
                  <div className="w-4 h-4 bg-slate-900 self-end"></div>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-500 dark:text-ink-3 font-medium">
              Sample pass code. QR check-in isn&apos;t live yet, so show your booking reference to the host or guard.
            </p>
          </div>

          {statusMessage && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 text-xs font-semibold rounded-xl border border-emerald-200 dark:border-emerald-500/30">
              {statusMessage}
            </div>
          )}

          {/* Booking Summary */}
          <div className="space-y-3 text-xs">
            {/* Precise Exact Location Map (Unlocked After Payment) */}
            {(booking.locationRevealed === false ||
              booking.listingLatitude === undefined ||
              booking.listingLongitude === undefined) ? (
              <div className="p-3 bg-slate-50 dark:bg-surface-alt rounded-xl border border-slate-200 dark:border-hairline flex items-start gap-2">
                <MapPin className="w-4 h-4 text-slate-400 dark:text-ink-3 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-ink uppercase">{booking.listingTitle}</h4>
                  <p className="text-xs text-slate-600 dark:text-ink-2 mt-0.5">{booking.listingAddress}</p>
                </div>
              </div>
            ) : (() => {
              const exactLat = booking.listingLatitude;
              const exactLng = booking.listingLongitude;
              const googleMapsNavUrl = `https://www.google.com/maps/dir/?api=1&destination=${exactLat},${exactLng}`;

              return (
                <div className="p-4 bg-emerald-50/80 dark:bg-emerald-500/10 border-2 border-emerald-500/40 rounded-2xl space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-xs font-bold text-emerald-950 dark:text-emerald-300 uppercase tracking-wide">
                        Exact location
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 font-mono text-[10px] font-bold">
                      Booking confirmed
                    </span>
                  </div>

                  <div>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-ink uppercase">{booking.listingTitle}</h4>
                    <p className="text-xs text-slate-700 dark:text-ink-2 font-medium mt-0.5">{booking.listingAddress}</p>
                    <p className="text-[11px] font-mono text-emerald-800 dark:text-emerald-300 mt-1 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                      <span>GPS: {exactLat.toFixed(6)}, {exactLng.toFixed(6)}</span>
                    </p>
                  </div>

                  {/* Exact location map: themed Google Maps JS API when a key is configured, iframe otherwise */}
                  <PassLocationMap latitude={exactLat} longitude={exactLng} title={booking.listingTitle} />


                  {/* Turn-by-Turn Navigation Action */}
                  <a
                    href={googleMapsNavUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 rounded-xl bg-[#0A5CFF] hover:bg-[#0046D5] text-white font-bold text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                  >
                    <Navigation className="w-4 h-4 fill-white" />
                    <span>Get directions in Google Maps</span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                  </a>
                </div>
              );
            })()}

            {booking.listingAccessInstructions && (
              <div className="p-3 bg-blue-50 dark:bg-blue-500/10 rounded-xl border border-blue-200 dark:border-blue-500/30 space-y-1">
                <span className="text-[#0A5CFF] dark:text-[var(--transit-accent)] font-bold block">Gate &amp; entry instructions</span>
                <p className="text-slate-800 dark:text-ink font-medium">{booking.listingAccessInstructions}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-slate-50 dark:bg-surface-alt rounded-xl border border-slate-200 dark:border-hairline">
                <span className="text-slate-400 dark:text-ink-3 block font-medium">Reserved Vehicle</span>
                <span className="font-bold text-slate-900 dark:text-ink text-sm font-mono">{booking.vehiclePlateNumber}</span>
                <span className="text-slate-500 dark:text-ink-3 text-[11px] block">{booking.vehicleType}</span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-surface-alt rounded-xl border border-slate-200 dark:border-hairline">
                <span className="text-slate-400 dark:text-ink-3 block font-medium">Time Window</span>
                <span className="font-bold text-slate-900 dark:text-ink text-xs">
                  {new Date(booking.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} →{' '}
                  {new Date(booking.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="text-slate-500 dark:text-ink-3 text-[11px] block">
                  {new Date(booking.startTime).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                </span>
              </div>
            </div>

            {/* Provider Privacy Masked Relay (PRD 8.8 BOOK-7) */}
            <div className="p-3 bg-slate-50 dark:bg-surface-alt rounded-xl border border-slate-200 dark:border-hairline flex items-center justify-between">
              <div>
                <span className="text-slate-400 dark:text-ink-3 block font-medium">Host Contact (Privacy Relay)</span>
                <span className="font-bold text-slate-900 dark:text-ink">{booking.providerName}</span>
                <span className="text-[11px] text-slate-500 dark:text-ink-3 block font-mono">{booking.providerPhoneMasked}</span>
              </div>
              <a
                href={`tel:${booking.providerPhoneMasked.replace(/\s+/g, '')}`}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-xs flex items-center gap-1 shadow-sm"
              >
                <Phone className="w-3.5 h-3.5" />
                Call Relay
              </a>
            </div>
          </div>

          {/* Action Buttons based on status */}
          <div className="space-y-2 pt-2">
            {booking.status === 'CONFIRMED' && (
              <button
                onClick={handleCheckIn}
                disabled={isUpdating}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                {isUpdating ? 'Recording Check-in...' : 'I Have Arrived · Check In Now'}
              </button>
            )}

            {booking.status === 'CHECKED_IN' && (
              <div className="space-y-2">
                <button
                  onClick={handleCheckOut}
                  disabled={isUpdating}
                  className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {isUpdating ? 'Ending Session...' : 'I Am Leaving · Check Out Now'}
                </button>

                {/* Extend session buttons (PRD 8.8 BOOK-6) */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleExtend(1)}
                    disabled={isUpdating}
                    className="flex-1 py-2 rounded-xl bg-slate-100 dark:bg-surface-alt hover:bg-slate-200 dark:hover:bg-hairline-strong text-slate-800 dark:text-ink font-bold text-xs border border-slate-200 dark:border-hairline flex items-center justify-center gap-1"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    Extend +1 Hour
                  </button>
                  <button
                    onClick={() => handleExtend(2)}
                    disabled={isUpdating}
                    className="flex-1 py-2 rounded-xl bg-slate-100 dark:bg-surface-alt hover:bg-slate-200 dark:hover:bg-hairline-strong text-slate-800 dark:text-ink font-bold text-xs border border-slate-200 dark:border-hairline flex items-center justify-center gap-1"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    Extend +2 Hours
                  </button>
                </div>
              </div>
            )}

            {/* Secondary actions */}
            <div className="flex items-center justify-between text-xs pt-2">
              <button
                onClick={() => setShowInvoice(!showInvoice)}
                className="text-slate-600 dark:text-ink-2 hover:text-slate-900 dark:hover:text-ink font-medium flex items-center gap-1"
              >
                <FileText className="w-3.5 h-3.5" />
                {showInvoice ? 'Hide receipt' : 'View receipt (test mode)'}
              </button>

              <button
                onClick={() => onOpenDispute(booking)}
                className="text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-300 font-medium flex items-center gap-1"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                Report Issue / Dispute
              </button>

              {booking.status === 'CONFIRMED' && (
                <button
                  onClick={() => setShowCancelConfirm(true)}
                  className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-medium"
                >
                  Cancel Booking
                </button>
              )}
            </div>
          </div>

          {/* Cancellation Confirmation Dialog (PRD 8.9) */}
          {showCancelConfirm && (
            <div className="p-4 bg-red-50 dark:bg-red-500/10 rounded-2xl border border-red-200 dark:border-red-500/30 space-y-3 text-xs animate-fade-in">
              <div className="font-bold text-red-900 dark:text-red-300 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                Cancel Reservation & Process Refund
              </div>
              <p className="text-red-700 dark:text-red-300">
                Per Section 8.9: Cancelling 2+ hours before start qualifies for 100% refund of parking fee. Cancelling
                under 2 hours receives 50% refund.
              </p>

              <input
                type="text"
                placeholder="Reason for cancellation (optional)"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full bg-white dark:bg-surface border border-red-200 dark:border-red-500/30 rounded-xl px-3 py-2 text-xs focus:outline-none"
              />

              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-hairline text-slate-700 dark:text-ink-2 font-medium"
                >
                  Keep Booking
                </button>
                <button
                  onClick={handleCancelBooking}
                  disabled={isUpdating}
                  className="px-3 py-1.5 rounded-lg bg-red-600 text-white font-bold"
                >
                  Confirm Cancellation
                </button>
              </div>
            </div>
          )}

          {/* Receipt view (PRD 8.11). Payments are simulated in the pilot, so this is labelled as a sample. */}
          {showInvoice && (
            <div className="p-4 bg-slate-900 text-slate-100 rounded-2xl text-xs space-y-2 font-mono">
              <p className="rounded-md bg-amber-400/15 px-2 py-1 text-[11px] font-semibold text-amber-300">
                Sample receipt from a test-mode booking. Not a tax invoice.
              </p>
              <div className="flex justify-between border-b border-slate-700 pb-2">
                <span className="font-bold text-emerald-400">VPARK TECHNOLOGIES INDIA PVT LTD</span>
                <span>GSTIN: 29AABCU9603R1ZM</span>
              </div>
              <div className="space-y-1 text-[11px] text-slate-300">
                <p>Tax Invoice Ref: INV-{booking.referenceNumber}</p>
                <p>Date: {new Date(booking.createdAt).toLocaleDateString()}</p>
                <p>Driver: {booking.driverName} ({booking.driverPhone})</p>
                <p>Vehicle: {booking.vehiclePlateNumber}</p>
              </div>
              <div className="pt-2 border-t border-slate-800 space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span>Parking Fee ({booking.pricingSnapshot.durationHours} hrs)</span>
                  <span>₹{booking.pricingSnapshot.parkingFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-400 dark:text-ink-3">
                  <span>VPark Commission (12%)</span>
                  <span>₹{booking.pricingSnapshot.platformFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-400 dark:text-ink-3">
                  <span>CGST @ 9%</span>
                  <span>₹{booking.pricingSnapshot.cgst.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-400 dark:text-ink-3">
                  <span>SGST @ 9%</span>
                  <span>₹{booking.pricingSnapshot.sgst.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-white pt-1 border-t border-slate-700 text-xs">
                  <span>Total Paid (INR)</span>
                  <span className="text-emerald-400">₹{booking.pricingSnapshot.totalAmount.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </ModalPanel>
    </ModalBackdrop>
  );
}

