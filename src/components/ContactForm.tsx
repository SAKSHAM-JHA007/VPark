'use client';

import React, { useId, useRef, useState } from 'react';
import { Send, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useI18n } from '@/components/i18n/LanguageProvider';

type Field = 'name' | 'email' | 'subject' | 'message';

export function ContactForm() {
  const { t } = useI18n();
  const uid = useId();
  const fieldId = (f: Field) => `${uid}-${f}`;
  const errorId = (f: Field) => `${uid}-${f}-error`;
  const formRef = useRef<HTMLFormElement>(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
    hp: '', // spam honeypot
  });
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, string>>>({});

  const validate = (): Partial<Record<Field, string>> => {
    const errors: Partial<Record<Field, string>> = {};
    if (formData.name.trim().length < 2) errors.name = t('contactForm.errName');
    if (!formData.email.trim() || !formData.email.includes('@')) errors.email = t('contactForm.errEmail');
    if (formData.subject.trim().length < 3) errors.subject = t('contactForm.errSubject');
    if (formData.message.trim().length < 10) errors.message = t('contactForm.errMessage');
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const errors = validate();
    setFieldErrors(errors);
    const firstInvalid = (Object.keys(errors) as Field[])[0];
    if (firstInvalid) {
      setErrorMessage(t('contactForm.errSummary'));
      formRef.current?.querySelector<HTMLElement>(`#${CSS.escape(fieldId(firstInvalid))}`)?.focus();
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMessage(data.message || t('contactForm.successDefault'));
        setFormData({ name: '', email: '', subject: '', message: '', hp: '' });
      } else {
        setErrorMessage(data.error || t('contactForm.errFailed'));
      }
    } catch {
      setErrorMessage(t('common.networkError'));
    } finally {
      setSubmitting(false);
    }
  };

  const update = (field: Field, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const inputProps = (field: Field) => ({
    id: fieldId(field),
    'aria-invalid': fieldErrors[field] ? true : undefined,
    'aria-describedby': fieldErrors[field] ? errorId(field) : undefined,
    className: 'vp-input',
  });

  const label = (field: Field, text: string) => (
    <label htmlFor={fieldId(field)} className="vp-label">
      {text} <span aria-hidden="true" className="text-[var(--danger-ink)]">*</span>
      <span className="sr-only">({t('common.required')})</span>
    </label>
  );

  const fieldError = (field: Field) =>
    fieldErrors[field] ? (
      <p id={errorId(field)} className="vp-field-error">
        {fieldErrors[field]}
      </p>
    ) : null;

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4" noValidate>
      {/* Honeypot field for bot spam prevention */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor={`${uid}-hp`}>{t('contactForm.honeypot')}</label>
        <input
          id={`${uid}-hp`}
          type="text"
          value={formData.hp}
          onChange={(e) => setFormData({ ...formData, hp: e.target.value })}
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      {successMessage && (
        <div role="status" className="vp-alert vp-alert-success animate-fade-in">
          <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 animate-pop" aria-hidden="true" />
          <div className="space-y-0.5">
            <p className="font-semibold">{t('contactForm.successTitle')}</p>
            <p>{successMessage}</p>
          </div>
        </div>
      )}

      {errorMessage && (
        <div role="alert" className="vp-alert vp-alert-danger animate-fade-in">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" aria-hidden="true" />
          <p className="font-semibold">{errorMessage}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          {label('name', t('contactForm.name'))}
          <input
            {...inputProps('name')}
            type="text"
            required
            autoComplete="name"
            placeholder={t('contactForm.namePlaceholder')}
            value={formData.name}
            onChange={(e) => update('name', e.target.value)}
          />
          {fieldError('name')}
        </div>
        <div>
          {label('email', t('contactForm.email'))}
          <input
            {...inputProps('email')}
            type="email"
            required
            autoComplete="email"
            placeholder={t('contactForm.emailPlaceholder')}
            value={formData.email}
            onChange={(e) => update('email', e.target.value)}
          />
          {fieldError('email')}
        </div>
      </div>

      <div>
        {label('subject', t('contactForm.subject'))}
        <input
          {...inputProps('subject')}
          type="text"
          required
          placeholder={t('contactForm.subjectPlaceholder')}
          value={formData.subject}
          onChange={(e) => update('subject', e.target.value)}
        />
        {fieldError('subject')}
      </div>

      <div>
        {label('message', t('contactForm.message'))}
        <textarea
          {...inputProps('message')}
          required
          rows={5}
          maxLength={2000}
          placeholder={t('contactForm.messagePlaceholder')}
          value={formData.message}
          onChange={(e) => update('message', e.target.value)}
        />
        {fieldError('message')}
        <p className="mt-1 text-right text-xs tabular-nums text-ink-3">{t('contactForm.chars', { count: formData.message.length })}</p>
      </div>

      <button type="submit" disabled={submitting} className="vp-btn vp-btn-primary w-full sm:w-auto">
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
        {submitting ? t('contactForm.sending') : t('contactForm.send')}
      </button>
    </form>
  );
}
