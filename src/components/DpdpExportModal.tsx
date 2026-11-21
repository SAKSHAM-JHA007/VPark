'use client';

import React, { useId, useState } from 'react';
import { ModalBackdrop, ModalPanel } from '@/components/motion/AnimatedModal';
import { useDialog } from '@/components/motion/useDialog';
import { useI18n } from '@/components/i18n/LanguageProvider';
import { X, Download, Trash2, CheckCircle2, Lock, Loader2 } from 'lucide-react';

interface DpdpExportModalProps {
  onClose: () => void;
  onDeleted?: () => void;
}

export function DpdpExportModal({ onClose, onDeleted }: DpdpExportModalProps) {
  const { t } = useI18n();
  const titleId = useId();
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deletedSuccess, setDeletedSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useDialog<HTMLDivElement>(onClose);

  const handleDownload = () => {
    window.open('/api/user/export', '_blank');
  };

  const handleDelete = async () => {
    if (!confirm(t('dpdp.confirm'))) {
      return;
    }
    setIsDeleting(true);
    setError(null);
    try {
      const res = await fetch('/api/user/delete', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || t('dpdp.failed'));
      } else {
        setDeletedSuccess(true);
        if (onDeleted) setTimeout(onDeleted, 1200);
      }
    } catch {
      setError(t('dpdp.network'));
    } finally {
      setIsDeleting(false);
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
        <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} className="vp-card overflow-hidden shadow-raised">
          <div className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-4">
            <div className="flex items-center gap-2.5">
              <Lock className="h-5 w-5 text-[var(--transit-accent)]" aria-hidden="true" />
              <div>
                <h2 id={titleId} className="text-base font-semibold text-ink">
                  {t('dpdp.title')}
                </h2>
                <span className="text-xs text-ink-3">{t('dpdp.subtitle')}</span>
              </div>
            </div>
            <button
              type="button"
              aria-label={t('dpdp.close')}
              onClick={onClose}
              className="rounded-full p-2 text-ink-3 transition-colors hover:bg-surface-alt hover:text-ink"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <div className="space-y-4 p-5 text-sm sm:p-6">
            <p className="leading-relaxed text-ink-2">{t('dpdp.intro')}</p>

            {error && (
              <div role="alert" className="vp-alert vp-alert-danger">
                {error}
              </div>
            )}

            <div className="vp-panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-semibold text-ink">{t('dpdp.exportTitle')}</h3>
                <p className="mt-0.5 text-xs text-ink-3">{t('dpdp.exportBody')}</p>
              </div>
              <button type="button" onClick={handleDownload} className="vp-btn vp-btn-primary vp-btn-sm flex-shrink-0">
                <Download className="h-4 w-4" aria-hidden="true" />
                {t('dpdp.exportCta')}
              </button>
            </div>

            <div className="flex flex-col gap-3 rounded-control border border-[var(--danger-border)] bg-[var(--danger-bg)] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-semibold text-[var(--danger-ink)]">{t('dpdp.deleteTitle')}</h3>
                <p className="mt-0.5 text-xs text-ink-2">{t('dpdp.deleteBody')}</p>
              </div>
              <button type="button" onClick={handleDelete} disabled={isDeleting || deletedSuccess} className="vp-btn vp-btn-danger vp-btn-sm flex-shrink-0">
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
                {deletedSuccess ? t('dpdp.deleted') : isDeleting ? t('dpdp.deleting') : t('dpdp.deleteCta')}
              </button>
            </div>

            {deletedSuccess && (
              <div role="status" className="vp-alert vp-alert-success">
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
                <span>{t('dpdp.deletedNotice')}</span>
              </div>
            )}
          </div>
        </div>
      </ModalPanel>
    </ModalBackdrop>
  );
}
