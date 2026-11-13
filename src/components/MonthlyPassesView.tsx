'use client';

import React, { useState, useEffect } from 'react';
import { MonthlyPass, Listing } from '@/types';
import { Calendar, CheckCircle2, ShieldCheck, Car, ArrowRight } from 'lucide-react';

interface MonthlyPassesViewProps {
  onRequireAuth?: () => void;
}

export function MonthlyPassesView({ onRequireAuth }: MonthlyPassesViewProps = {}) {
  const [passes, setPasses] = useState<MonthlyPass[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [selectedListingId, setSelectedListingId] = useState<string>('');
  const [vehiclePlate, setVehiclePlate] = useState<string>('KA-04-MB-1234');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isBuying, setIsBuying] = useState<boolean>(false);

  const fetchData = async () => {
    try {
      const [passesRes, searchRes] = await Promise.all([
        fetch('/api/monthly-passes'),
        fetch('/api/search?radius=10'),
      ]);
      const passesData = await passesRes.json();
      const searchData = await searchRes.json();

      if (passesData.success) setPasses(passesData.data);
      if (searchData.success) {
        const bookableListings = searchData.data
          .map((i: any) => i.listing)
          .filter((l: Listing) => l.isBookable && l.pricing.monthlyRate);
        setListings(bookableListings);
        if (bookableListings.length > 0 && !selectedListingId) {
          setSelectedListingId(bookableListings[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleBuyPass = async () => {
    const selectedListing = listings.find((l) => l.id === selectedListingId);
    if (!selectedListing || !selectedListing.pricing.monthlyRate) return;

    setIsBuying(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/monthly-passes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId: selectedListing.id,
          vehiclePlateNumber: vehiclePlate,
          vehicleType: 'SEDAN',
          month: '2026-11',
          price: selectedListing.pricing.monthlyRate,
        }),
      });
      if (res.status === 401) {
        setStatusMessage('Please sign in with Phone OTP to subscribe to a monthly pass.');
        if (onRequireAuth) onRequireAuth();
        return;
      }
      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMessage(data.message);
        fetchData();
      } else {
        setStatusMessage(data.error || 'Could not issue monthly pass.');
      }
    } catch (err) {
      setStatusMessage('Failed to purchase monthly pass');
    } finally {
      setIsBuying(false);
    }
  };

  const selectedListing = listings.find((l) => l.id === selectedListingId);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Banner */}
      <div className="bg-gradient-to-r from-indigo-900 to-slate-900 text-white p-6 rounded-3xl shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="w-6 h-6 text-indigo-400" />
            <h1 className="text-2xl font-black">Monthly Commuter Passes</h1>
          </div>
          <p className="text-xs text-indigo-200 mt-1">
            Guaranteed 24/7 dedicated bay for daily commuters at Rail Wheel Factory, Aster CMI, and Yelahanka Station (PRD Section 13)
          </p>
        </div>
      </div>

      {statusMessage && (
        <div className="p-3 bg-emerald-50 text-emerald-800 text-xs font-semibold rounded-2xl border border-emerald-200">
          {statusMessage}
        </div>
      )}

      {/* Active Passes */}
      <div className="space-y-4">
        <h2 className="font-bold text-slate-900 text-base">Your Active Monthly Passes</h2>

        {passes.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-3xl border border-slate-200 text-slate-500 text-xs">
            No active monthly passes. Reserve a monthly commuter bay below.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {passes.map((pass) => (
              <div
                key={pass.id}
                className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3 text-xs"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      ACTIVE PASS · {pass.month}
                    </span>
                    <h3 className="font-bold text-base text-slate-900 mt-1">{pass.listingTitle}</h3>
                  </div>
                  <span className="text-lg font-black text-indigo-600 font-mono">₹{pass.price}/mo</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-slate-600 font-mono text-[11px]">
                  <div className="p-2 bg-slate-50 rounded-xl">
                    <span className="text-slate-400 block text-[10px]">Vehicle Plate</span>
                    <span className="font-bold text-slate-900">{pass.vehiclePlateNumber}</span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-xl">
                    <span className="text-slate-400 block text-[10px]">Valid Until</span>
                    <span className="font-bold text-slate-900">{pass.endDate}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Subscribe to Monthly Pass Form */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4 text-xs">
        <h3 className="font-bold text-slate-900 text-base">Reserve a Dedicated Monthly Bay</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="font-bold text-slate-700 block mb-1">Select Verified Parking Location</label>
            <select
              value={selectedListingId}
              onChange={(e) => setSelectedListingId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-semibold text-xs"
            >
              {listings.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title} — ₹{l.pricing.monthlyRate}/mo ({l.locality})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Vehicle Plate Number</label>
            <input
              type="text"
              value={vehiclePlate}
              onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold font-mono text-xs"
            />
          </div>
        </div>

        {selectedListing && (
          <div className="p-4 bg-indigo-50/60 rounded-2xl border border-indigo-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <span className="font-bold text-indigo-950 text-sm block">
                {selectedListing.title} · Dedicated Reserved Bay
              </span>
              <span className="text-indigo-800 text-xs">
                Includes RFID / QR Access, 24/7 in-and-out privileges, and dedicated parking spot.
              </span>
            </div>

            <button
              onClick={handleBuyPass}
              disabled={isBuying}
              className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-md flex items-center gap-2 transition-all self-end sm:self-auto"
            >
              {isBuying ? 'Issuing Pass...' : `Subscribe for ₹${selectedListing.pricing.monthlyRate}/mo`}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

