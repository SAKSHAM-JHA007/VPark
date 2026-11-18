'use client';

import React, { useState } from 'react';
import { ModalBackdrop, ModalPanel } from '@/components/motion/AnimatedModal';
import { Booking, Dispute } from '@/types';
import { APP_CONFIG } from '@/lib/constants';
import { X, AlertCircle, Clock, ShieldAlert, CheckCircle2 } from 'lucide-react';

interface DisputeModalProps {
  booking: Booking;
  onClose: () => void;
  onDisputeCreated: () => void;
}

export function DisputeModal({ booking, onClose, onDisputeCreated }: DisputeModalProps) {
  const [category, setCategory] = useState<Dispute['category']>('SPACE_OCCUPIED');
  const [description, setDescription] = useState<string>('');
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setError('Please provide a description of the issue');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/disputes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: booking.id,
          category,
          description,
          evidencePhotos: photoUrl ? [photoUrl] : [],
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to file dispute');
      } else {
        onDisputeCreated();
      }
    } catch (err) {
      setError('Network error filing dispute');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalBackdrop className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
      <ModalPanel className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
            <div>
              <span className="font-bold text-base block">Report Issue & File Dispute</span>
              <span className="text-xs text-slate-400 font-mono">Booking Ref: {booking.referenceNumber}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {/* SLA Notice (PRD 8.14: under 4 working hours) */}
          <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-blue-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <span>
              <strong>Target SLA:</strong> VPark Trust & Safety team reviews and responds to disputes within 4 working
              hours.
            </span>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Issue Category (PRD 8.14)</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Dispute['category'])}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none"
            >
              <option value="SPACE_OCCUPIED">Space is Occupied / Blocked by Another Car</option>
              <option value="SPACE_UNUSABLE">Space is Unusable / Debris / Hazard</option>
              <option value="HOST_UNREACHABLE">Host Unreachable / Locked Gate</option>
              <option value="OVERSTAY_CONFLICT">Overstay Conflict with Next Vehicle</option>
              <option value="DAMAGE_SAFETY">Physical Safety or Property Concern</option>
              <option value="PAYMENT_ISSUE">Incorrect Charge or Gateway Dispute</option>
            </select>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Description of Issue</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what happened when you arrived at the location..."
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Evidence Photo URL (Optional)</label>
            <input
              type="text"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="https://example.com/photo.jpg"
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          {error && <div className="p-3 bg-red-50 text-red-700 rounded-xl border border-red-200">{error}</div>}

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-md"
            >
              {isSubmitting ? 'Submitting Dispute...' : 'Submit to Trust & Safety'}
            </button>
          </div>
        </form>
      </ModalPanel>
    </ModalBackdrop>
  );
}

