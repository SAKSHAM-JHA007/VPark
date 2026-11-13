'use client';

import React, { useState, useEffect } from 'react';
import { SearchResultItem, Vehicle, VehicleType } from '@/types';
import { APP_CONFIG } from '@/lib/constants';
import { calculatePricingPaise } from '@/lib/engine.mjs';
import { toPaise } from '@/lib/constants';
import {
  X,
  ShieldCheck,
  MapPin,
  AlertTriangle,
  Lock,
  ChevronRight,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';

interface ListingDetailModalProps {
  item: SearchResultItem;
  userVehicles: Vehicle[];
  isAuthenticated: boolean;
  onRequireAuth: () => void;
  onClose: () => void;
  onBookingSuccess: (bookingId: string) => void;
}

export function ListingDetailModal({
  item,
  userVehicles,
  isAuthenticated,
  onRequireAuth,
  onClose,
  onBookingSuccess,
}: ListingDetailModalProps) {
  const { listing } = item;

  const [selectedVehicleType, setSelectedVehicleType] = useState<VehicleType>(
    userVehicles[0]?.type || 'SEDAN'
  );
  const [plateNumber, setPlateNumber] = useState<string>(
    userVehicles[0]?.plateNumber || 'KA-04-MB-1234'
  );

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

  const endTimeIso = new Date(new Date(startTime).getTime() + durationHours * 60 * 60 * 1000).toISOString();
  const hourlyPaise = listing.pricing.hourlyRatePaise ?? toPaise(listing.pricing.hourlyRate);
  const pricing = calculatePricingPaise(hourlyPaise, startTime, endTimeIso);

  useEffect(() => {
    if (!activeHold) return;

    const timer = setInterval(() => {
      const remainingMs = new Date(activeHold.expiresAt).getTime() - Date.now();
      const secs = Math.max(0, Math.floor(remainingMs / 1000));
      setSecondsRemaining(secs);

      if (secs <= 0) {
        setActiveHold(null);
        setErrorMessage('Your 10-minute slot hold has expired. Please lock the slot again.');
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [activeHold]);

  const handleSecureHold = async () => {
    if (!isAuthenticated) {
      onRequireAuth();
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
        setErrorMessage(data.error || 'Failed to lock slot hold');
      } else {
        setActiveHold({ id: data.hold.id, expiresAt: data.hold.expiresAt });
        setSecondsRemaining(600);
        setShowPaymentModal(true);
      }
    } catch {
      setErrorMessage('Network error securing hold');
    } finally {
      setIsHolding(false);
    }
  };

  const handleConfirmPayment = async () => {
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
        setErrorMessage(data.error || 'Payment failed');
      } else {
        onBookingSuccess(data.booking.id);
      }
    } catch {
      setErrorMessage('Failed to complete booking');
    } finally {
      setIsBooking(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={listing.title}
    >
      <div className="relative w-full max-w-3xl bg-[var(--surface-bg)] rounded-sm border border-[var(--hairline-strong)] shadow-sm overflow-hidden my-auto max-h-[92vh] flex flex-col text-[var(--ink)]">
        {/* Header bar */}
        <div className="px-5 py-3.5 border-b border-[var(--hairline)] flex items-center justify-between bg-[var(--surface-alt)]">
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-0.5 rounded-none font-mono text-[10px] font-bold uppercase tracking-wider border ${
                listing.category === 'PRIVATE'
                  ? 'border-purple-600/40 text-purple-700 dark:text-purple-400 bg-[var(--surface-bg)]'
                  : listing.category === 'COMMERCIAL'
                  ? 'border-[var(--transit-accent)] text-[var(--transit-accent)] bg-[var(--surface-bg)]'
                  : 'border-[var(--hairline-strong)] text-[var(--ink-secondary)] bg-[var(--surface-bg)]'
              }`}
            >
              {listing.category}
            </span>
            {listing.status === 'VERIFIED' && (
              <span className="flex items-center gap-1 font-mono text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 bg-[var(--surface-bg)] px-2 py-0.5 border border-emerald-600/40">
                <ShieldCheck className="w-3 h-3" />
                Verified Deed
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close listing details"
            className="p-1 rounded-sm text-[var(--ink-tertiary)] hover:text-[var(--ink)] hover:bg-[var(--surface-bg)] border border-transparent hover:border-[var(--hairline)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto p-5 sm:p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {listing.photos.map((photo, i) => (
              <div key={i} className="h-36 sm:h-40 rounded-xs overflow-hidden bg-[var(--surface-alt)] border border-[var(--hairline)]">
                <img src={photo} alt={`${listing.title} view ${i + 1}`} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>

          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg sm:text-xl font-bold uppercase tracking-tight text-[var(--ink)] leading-tight">{listing.title}</h2>
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--ink-secondary)] mt-1">
                <span>{listing.address}</span>
                <span className="text-[var(--hairline-strong)]">·</span>
                <span className="font-mono text-[11px]">Landmark: {listing.landmark}</span>
              </div>
              {listing.dimensionsNotes && (
                <p className="text-xs font-mono text-[var(--ink-tertiary)] mt-1">{listing.dimensionsNotes}</p>
              )}
            </div>

            <div className="text-right flex-shrink-0 font-mono">
              <span className="text-2xl font-bold text-slate-900">₹{listing.pricing.hourlyRate}</span>
              <span className="text-xs text-slate-500 block">per hour</span>
            </div>
          </div>

          {listing.category === 'PUBLIC' && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-sm space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Public Parking Discovery Context (Not Reservable)
              </div>
              <p className="text-xs text-amber-800">
                {listing.surveyDate || 'Surveyed recently'}. Public parking is shown for discovery only. VPark does not control or reserve these spaces.
              </p>
            </div>
          )}

          {/* Specs Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-slate-400 block font-medium">Cover Type</span>
              <span className="font-bold text-slate-800 text-sm">{listing.isCovered ? 'Covered / Basement' : 'Open Ground'}</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-slate-400 block font-medium">Height Clearance</span>
              <span className="font-bold text-slate-800 text-sm">{listing.heightClearanceMeters || '2.2'} meters</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-slate-400 block font-medium">EV Charging</span>
              <span className="font-bold text-slate-800 text-sm">
                {listing.hasEvCharging ? listing.evChargerType || 'Available' : 'No Charger'}
              </span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-slate-400 block font-medium">Access Method</span>
              <span className="font-bold text-slate-800 text-sm">{listing.accessMethod.replace('_', ' ')}</span>
            </div>
          </div>

          {/* Access Instructions Privacy Protection (PRD 7.2) & House Rules */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
              <span className="font-bold text-slate-900 flex items-center gap-1.5 text-sm">
                <Lock className="w-3.5 h-3.5 text-[#0A5CFF]" />
                Access Instructions
              </span>
              {listing.category === 'PUBLIC' ? (
                <p className="text-slate-600">{listing.accessInstructions}</p>
              ) : (
                <p className="text-slate-600">
                  Entry via <span className="font-semibold text-slate-800">{listing.accessMethod.replace('_', ' ')}</span>. Exact gate instructions, codes, and masked host relay unlock immediately after booking confirmation.
                </p>
              )}
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
              <span className="font-bold text-slate-900 block text-sm">House Rules</span>
              <ul className="list-disc pl-4 text-slate-600 space-y-0.5">
                {listing.houseRules.map((rule, idx) => (
                  <li key={idx}>{rule}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Provider & Trust Info */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-700">
                {listing.providerName[0]}
              </div>
              <div>
                <span className="font-bold text-slate-900 text-sm">{listing.providerName}</span>
                <span className="text-slate-500 block text-[11px]">
                  {listing.providerType} · Verified Proof on File · Last confirmed {new Date(listing.lastConfirmedAt).toLocaleDateString('en-IN')}
                </span>
              </div>
            </div>
            <div className="text-right text-[11px] text-slate-500 hidden sm:block">
              <span className="font-semibold text-slate-700">Privacy Relay</span>
              <p>Contact masked until confirmed</p>
            </div>
          </div>

          {activeHold && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border-2 border-amber-500/40 text-amber-950 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <div>
                  <span className="font-bold text-sm block">Slot Temporarily Locked (10 min hold)</span>
                  <span className="text-xs text-amber-800">Complete payment before the timer reaches zero.</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xl font-black font-mono text-amber-700">
                  {Math.floor(secondsRemaining / 60)}:{(secondsRemaining % 60).toString().padStart(2, '0')}
                </span>
                <span className="text-[10px] text-amber-700 block uppercase font-bold tracking-wider">Remaining</span>
              </div>
            </div>
          )}

          {listing.isBookable ? (
            <div className="p-5 rounded-2xl bg-blue-50/50 border border-blue-200 space-y-4">
              <div className="flex items-center justify-between font-bold text-slate-900">
                <span className="text-base">Reserve Your Slot</span>
                <span className="text-xs text-[#0A5CFF] font-semibold bg-blue-100 px-2.5 py-0.5 rounded-full">
                  Instant Confirmation
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label htmlFor="booking-vehicle-type" className="font-bold text-slate-700 block mb-1">
                    Vehicle Type
                  </label>
                  <select
                    id="booking-vehicle-type"
                    value={selectedVehicleType}
                    onChange={(e) => setSelectedVehicleType(e.target.value as VehicleType)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold"
                  >
                    <option value="SEDAN">Sedan (Honda City, Verna, Dzire)</option>
                    <option value="HATCHBACK">Hatchback (Swift, i20, Baleno)</option>
                    <option value="SUV">SUV / MUV (Creta, Nexon, Innova)</option>
                    <option value="EV">Electric Vehicle (EV Charging Socket)</option>
                    <option value="TWO_WHEELER">2-Wheeler (Motorcycle / Scooter)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="booking-plate-input" className="font-bold text-slate-700 block mb-1">
                    Vehicle Registration Plate
                  </label>
                  <input
                    id="booking-plate-input"
                    type="text"
                    value={plateNumber}
                    onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
                    placeholder="e.g. KA-04-MB-1234"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between font-bold text-slate-700">
                  <label htmlFor="booking-duration">Duration: {durationHours} Hours</label>
                  <span className="text-slate-500 font-normal">
                    {new Date(startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} →{' '}
                    {new Date(endTimeIso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <input
                  id="booking-duration"
                  type="range"
                  min="1"
                  max="12"
                  value={durationHours}
                  onChange={(e) => setDurationHours(parseInt(e.target.value, 10))}
                  className="w-full accent-[#0A5CFF] cursor-pointer"
                />
              </div>

              <div className="p-3.5 bg-white rounded-xl border border-slate-200 text-xs space-y-1.5 font-mono">
                <div className="flex justify-between text-slate-600">
                  <span>Parking Fee ({durationHours} hrs × ₹{listing.pricing.hourlyRate})</span>
                  <span>₹{pricing.parkingFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>VPark Convenience Fee (12%)</span>
                  <span>₹{pricing.platformFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-500 text-[11px]">
                  <span>Taxes (CGST 9% + SGST 9%)</span>
                  <span>₹{pricing.totalTaxes.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-black text-slate-900 pt-2 border-t border-slate-200 text-sm">
                  <span>Total Payable (INR)</span>
                  <span className="text-[#0A5CFF]">₹{pricing.totalAmount.toFixed(2)}</span>
                </div>
              </div>

              {errorMessage && (
                <div role="alert" className="p-3 rounded-xl bg-red-50 text-red-800 text-xs font-medium border border-red-200">
                  {errorMessage}
                </div>
              )}

              <div className="pt-2">
                {!activeHold ? (
                  <button
                    type="button"
                    onClick={handleSecureHold}
                    disabled={isHolding}
                    className="w-full py-3 rounded-xl bg-[#0A5CFF] hover:bg-[#0046D5] disabled:opacity-60 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    <Lock className="w-4 h-4" />
                    {!isAuthenticated
                      ? `Log in with Phone OTP to Reserve (₹${pricing.totalAmount.toFixed(2)})`
                      : isHolding
                      ? 'Locking Hold...'
                      : `Lock Slot for 10 Mins & Pay (₹${pricing.totalAmount.toFixed(2)})`}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowPaymentModal(true)}
                    className="w-full py-3 rounded-xl bg-[#0A5CFF] hover:bg-[#0046D5] text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    Proceed to Payment (₹{pricing.totalAmount.toFixed(2)})
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="pt-2">
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${listing.latitude},${listing.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 rounded-xl bg-[#0A5CFF] hover:bg-[#0046D5] text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 transition-all"
              >
                <ExternalLink className="w-4 h-4" />
                Navigate to Public Spot via Google Maps
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Simulated Razorpay Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-blue-400 font-bold uppercase tracking-wider block">
                  Razorpay Route · Pilot Test Mode
                </span>
                <span className="font-black text-lg">{APP_CONFIG.appName} Bengaluru</span>
              </div>
              <button
                type="button"
                aria-label="Close payment modal"
                onClick={() => setShowPaymentModal(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-500 font-medium block">Total Amount</span>
                  <span className="text-2xl font-black text-slate-900">₹{pricing.totalAmount.toFixed(2)}</span>
                </div>
                <span className="text-xs font-mono text-slate-500">Ref: VPK-{listing.id.slice(-4)}</span>
              </div>

              <div className="space-y-2 text-xs">
                <span className="font-bold text-slate-700 block">Select Payment Method</span>

                {(['UPI', 'CARD', 'NETBANKING'] as const).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setSelectedPaymentMethod(method)}
                    className={`w-full p-3 rounded-xl border flex items-center justify-between transition-all ${
                      selectedPaymentMethod === method
                        ? 'border-[#0A5CFF] bg-blue-50 text-blue-950 font-bold ring-2 ring-[#0A5CFF]/20'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>
                      {method === 'UPI'
                        ? 'Instant UPI (GPay / PhonePe / BHIM)'
                        : method === 'CARD'
                        ? 'Credit / Debit Card (RuPay, Visa, Mastercard)'
                        : 'Netbanking (SBI, HDFC, ICICI, Axis)'}
                    </span>
                    {selectedPaymentMethod === method && <CheckCircle2 className="w-4 h-4 text-[#0A5CFF]" />}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleConfirmPayment}
                disabled={isBooking}
                className="w-full py-3 rounded-xl bg-[#0A5CFF] hover:bg-[#0047CC] text-white font-semibold text-sm shadow-xs transition-colors flex items-center justify-center gap-2"
              >
                {isBooking ? 'Confirming Reservation...' : `Pay ₹${pricing.totalAmount.toFixed(2)} Securely`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
