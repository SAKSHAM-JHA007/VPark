'use client';

import React, { useState } from 'react';
import { ModalBackdrop, ModalPanel } from '@/components/motion/AnimatedModal';
import { X, Download, Trash2, CheckCircle2, Lock } from 'lucide-react';

interface DpdpExportModalProps {
  onClose: () => void;
  onDeleted?: () => void;
}

export function DpdpExportModal({ onClose, onDeleted }: DpdpExportModalProps) {
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deletedSuccess, setDeletedSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = () => {
    window.open('/api/user/export', '_blank');
  };

  const handleDelete = async () => {
    if (
      !confirm(
        'Are you sure you want to permanently request deletion of your VPark account and personal data under DPDP 2023?'
      )
    ) {
      return;
    }
    setIsDeleting(true);
    setError(null);
    try {
      const res = await fetch('/api/user/delete', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Could not process deletion request.');
      } else {
        setDeletedSuccess(true);
        if (onDeleted) setTimeout(onDeleted, 1200);
      }
    } catch {
      setError('Network error submitting deletion request.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <ModalBackdrop
      className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="DPDP Data Privacy"
    >
      <ModalPanel className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-blue-400" />
            <div>
              <span className="font-bold text-base block">Data Privacy & Consent Rights</span>
              <span className="text-[11px] text-slate-400">
                India Digital Personal Data Protection Act, 2023 (DPDP)
              </span>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close privacy dialog"
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs">
          <p className="text-slate-600 leading-relaxed">
            Under India&apos;s DPDP Act 2023 (PRD Section 10), your accepted legal consent versions, timestamps, IP audit trail, registered vehicles, listings, and bookings belong to you.
          </p>

          {error && (
            <div role="alert" className="p-3 bg-red-50 text-red-800 rounded-xl border border-red-200 font-medium">
              {error}
            </div>
          )}

          <div className="space-y-3 pt-2">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between gap-4">
              <div>
                <span className="font-bold text-slate-900 text-sm block">Download Personal Data Archive</span>
                <span className="text-slate-500 text-[11px] block">
                  Export complete JSON archive including consent logs, profile, vehicles, and bookings.
                </span>
              </div>
              <button
                type="button"
                onClick={handleDownload}
                className="px-4 py-2 rounded-xl bg-[#0A5CFF] hover:bg-[#0046D5] text-white font-bold flex items-center gap-1.5 shadow-sm flex-shrink-0"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>

            <div className="p-4 bg-red-50 rounded-2xl border border-red-200 flex items-center justify-between gap-4">
              <div>
                <span className="font-bold text-red-900 text-sm block">Request Data Deletion</span>
                <span className="text-red-700 text-[11px] block">
                  Soft-delete account, anonymise PII, and suspend active listings immediately.
                </span>
              </div>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting || deletedSuccess}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-bold flex items-center gap-1.5 shadow-sm flex-shrink-0"
              >
                <Trash2 className="w-4 h-4" />
                {deletedSuccess ? 'Deleted' : isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>

          {deletedSuccess && (
            <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Account marked deletion-pending and personal data purged. Signing out...</span>
            </div>
          )}
        </div>
      </ModalPanel>
    </ModalBackdrop>
  );
}
