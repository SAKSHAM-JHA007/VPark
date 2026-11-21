'use client';

import React, { useId, useState } from 'react';
import { ModalBackdrop, ModalPanel } from '@/components/motion/AnimatedModal';
import { useDialog } from '@/components/motion/useDialog';
import { useI18n } from '@/components/i18n/LanguageProvider';
import { Booking, Dispute } from '@/types';
import { X, Clock, ShieldAlert, Loader2 } from 'lucide-react';

interface DisputeModalProps {
  booking: Booking;
  onClose: () => void;
  onDisputeCreated: () => void;
}

const CATEGORIES: Dispute['category'][] = [
  'SPACE_OCCUPIED',
  'SPACE_UNUSABLE',
  'HOST_UNREACHABLE',
  'OVERSTAY_CONFLICT',
  'DAMAGE_SAFETY',
  'PAYMENT_ISSUE',
];

export function DisputeModal({ booking, onClose, onDisputeCreated }: DisputeModalProps) {
  const { t } = useI18n();
  const ids = { title: useId(), category: useId(), description: useId(), photo: useId(), error: useId() };
  const [category, setCategory] = useState<Dispute['category']>('SPACE_OCCUPIED');
  const [description, setDescription] = useState<string>('');
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [descriptionMissing, setDescriptionMissing] = useState(false);
  const ref = useDialog<HTMLDivElement>(onClose);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setDescriptionMissing(true);
      setError(t('dispute.descriptionRequired'));
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setDescriptionMissing(false);

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
        setError(data.error || t('dispute.failed'));
      } else {
        onDisputeCreated();
      }
    } catch {
      setError(t('dispute.network'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalBackdrop
      className="fixed inset-0 z-60 flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <ModalPanel className="my-auto w-full max-w-lg">
        <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={ids.title} className="vp-card overflow-hidden shadow-raised">
          <div className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-4">
            <div className="flex items-center gap-2.5">
              <ShieldAlert className="h-5 w-5 text-[var(--warning-ink)]" aria-hidden="true" />
              <div>
                <h2 id={ids.title} className="text-base font-semibold text-ink">
                  {t('dispute.title')}
                </h2>
                <span className="font-mono text-xs text-ink-3">{t('dispute.reference', { ref: booking.referenceNumber })}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('dispute.close')}
              className="rounded-full p-2 text-ink-3 transition-colors hover:bg-surface-alt hover:text-ink"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 p-5 sm:p-6" noValidate>
            <p className="vp-alert vp-alert-info">
              <Clock className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
              <span>{t('dispute.sla')}</span>
            </p>

            <div>
              <label htmlFor={ids.category} className="vp-label">
                {t('dispute.category')}
              </label>
              <select id={ids.category} value={category} onChange={(e) => setCategory(e.target.value as Dispute['category'])} className="vp-input">
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {t(`dispute.categories.${c}`)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor={ids.description} className="vp-label">
                {t('dispute.description')} <span aria-hidden="true" className="text-[var(--danger-ink)]">*</span>
              </label>
              <textarea
                id={ids.description}
                rows={3}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('dispute.descriptionPlaceholder')}
                aria-invalid={descriptionMissing || undefined}
                aria-describedby={descriptionMissing ? ids.error : undefined}
                className="vp-input"
              />
            </div>

            <div>
              <label htmlFor={ids.photo} className="vp-label">
                {t('dispute.photo')}
              </label>
              <input
                id={ids.photo}
                type="url"
                inputMode="url"
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                placeholder="https://example.com/photo.jpg"
                className="vp-input"
              />
            </div>

            {error && (
              <div id={ids.error} role="alert" className="vp-alert vp-alert-danger">
                {error}
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <button type="button" onClick={onClose} className="vp-btn vp-btn-secondary">
                {t('common.cancel')}
              </button>
              <button type="submit" disabled={isSubmitting} className="vp-btn vp-btn-primary">
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {isSubmitting ? t('dispute.submitting') : t('dispute.submit')}
              </button>
            </div>
          </form>
        </div>
      </ModalPanel>
    </ModalBackdrop>
  );
}
