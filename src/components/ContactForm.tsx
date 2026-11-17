'use client';

import React, { useState } from 'react';
import { Send, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export function ContactForm() {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // Validation
    if (!formData.name.trim() || formData.name.trim().length < 2) {
      setErrorMessage('Please provide your name (minimum 2 characters).');
      return;
    }
    if (!formData.email.trim() || !formData.email.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (!formData.subject.trim() || formData.subject.trim().length < 3) {
      setErrorMessage('Please provide a subject for your inquiry.');
      return;
    }
    if (!formData.message.trim() || formData.message.trim().length < 10) {
      setErrorMessage('Message must be at least 10 characters long.');
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
        setSuccessMessage(data.message || 'Thank you for your message! Our team will respond within 24 hours.');
        setFormData({ name: '', email: '', subject: '', message: '', hp: '' });
      } else {
        setErrorMessage(data.error || 'Failed to send message. Please try again.');
      }
    } catch {
      setErrorMessage('A network error occurred while submitting. Please check your connection.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {/* Honeypot field for bot spam prevention */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor="form_hp_field">Do not fill this</label>
        <input
          id="form_hp_field"
          type="text"
          value={formData.hp}
          onChange={(e) => setFormData({ ...formData, hp: e.target.value })}
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      {successMessage && (
        <div
          role="status"
          className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 flex items-start gap-3 text-sm animate-in fade-in"
        >
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Message Delivered</p>
            <p className="text-xs leading-relaxed">{successMessage}</p>
          </div>
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 flex items-start gap-3 text-sm animate-in fade-in"
        >
          <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs font-semibold">{errorMessage}</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label htmlFor="contact_name" className="block text-xs font-bold text-slate-700 dark:text-slate-300">
            Full Name <span className="text-rose-500">*</span>
          </label>
          <input
            id="contact_name"
            type="text"
            required
            autoComplete="name"
            placeholder="e.g. Ramesh Patel"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#0A5CFF] transition-all"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="contact_email" className="block text-xs font-bold text-slate-700 dark:text-slate-300">
            Email Address <span className="text-rose-500">*</span>
          </label>
          <input
            id="contact_email"
            type="email"
            required
            autoComplete="email"
            placeholder="name@example.com"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#0A5CFF] transition-all"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="contact_subject" className="block text-xs font-bold text-slate-700 dark:text-slate-300">
          Subject / Inquiry Type <span className="text-rose-500">*</span>
        </label>
        <input
          id="contact_subject"
          type="text"
          required
          placeholder="e.g. Host listing inquiry, EV charger request, or booking support"
          value={formData.subject}
          onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#0A5CFF] transition-all"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="contact_message" className="block text-xs font-bold text-slate-700 dark:text-slate-300">
          Your Message <span className="text-rose-500">*</span>
        </label>
        <textarea
          id="contact_message"
          required
          rows={5}
          placeholder="Please describe how we can assist you..."
          value={formData.message}
          onChange={(e) => setFormData({ ...formData, message: e.target.value })}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#0A5CFF] transition-all resize-y"
        />
        <p className="text-[11px] text-slate-400 dark:text-slate-500 text-right">
          {formData.message.length}/2000 characters
        </p>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full sm:w-auto px-6 py-3 rounded-full bg-[#0A5CFF] hover:bg-[#0047d4] text-white font-bold text-sm inline-flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        {submitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Sending Message...</span>
          </>
        ) : (
          <>
            <Send className="w-4 h-4" />
            <span>Send Message</span>
          </>
        )}
      </button>
    </form>
  );
}
