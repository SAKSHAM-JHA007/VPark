'use client';

import React from 'react';
import Link from 'next/link';
import { Mail, Phone, MapPin, Clock, ShieldCheck, ChevronRight, ArrowRight } from 'lucide-react';
import { ContactForm } from '@/components/ContactForm';
import { PublicHeader } from '@/components/nav/PublicHeader';
import { SiteFooter } from '@/components/nav/SiteFooter';
import { useI18n } from '@/components/i18n/LanguageProvider';
import { APP_CONFIG } from '@/lib/constants';

export function ContactContent() {
  const { t } = useI18n();

  const channel = (icon: React.ReactNode, title: string, body: React.ReactNode, meta?: string) => (
    <li className="flex items-start gap-3">
      <span className="vp-icon-tile h-9 w-9" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0 text-sm">
        <span className="block font-semibold text-ink">{title}</span>
        <div className="mt-0.5 text-ink-2">{body}</div>
        {meta && <p className="mt-0.5 text-xs text-ink-3">{meta}</p>}
      </div>
    </li>
  );

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink">
      <PublicHeader active="contact" />

      <main id="main-content" className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <nav aria-label={t('contact.breadcrumb')} className="text-sm text-ink-3">
          <ol className="flex items-center gap-1.5">
            <li>
              <Link href="/" className="rounded-sm transition-colors hover:text-ink">
                {t('common.home')}
              </Link>
            </li>
            <li aria-hidden="true">
              <ChevronRight className="h-3.5 w-3.5" />
            </li>
            <li className="font-semibold text-ink" aria-current="page">
              {t('contact.title')}
            </li>
          </ol>
        </nav>

        <header className="max-w-3xl space-y-2 animate-fade-up">
          <p className="vp-eyebrow">{t('contact.eyebrow')}</p>
          <h1 className="vp-h1">{t('contact.title')}</h1>
          <p className="vp-lead">{t('contact.intro')}</p>
        </header>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12 animate-fade-up [animation-delay:100ms]">
          <div className="space-y-6 lg:col-span-5">
            <section className="vp-card space-y-5 p-6" aria-labelledby="contact-channels">
              <h2 id="contact-channels" className="vp-h3">
                {t('contact.channels')}
              </h2>
              <ul className="space-y-4">
                {channel(
                  <Mail className="h-4 w-4" />,
                  t('contact.email'),
                  <a href={`mailto:${APP_CONFIG.contactEmail}`} className="vp-link font-mono font-medium">
                    {APP_CONFIG.contactEmail}
                  </a>,
                  t('contact.emailMeta')
                )}
                {channel(
                  <Phone className="h-4 w-4" />,
                  t('contact.phone'),
                  <a href="tel:+918045682026" className="vp-link font-mono font-medium">
                    {APP_CONFIG.contactPhone}
                  </a>,
                  t('contact.phoneMeta')
                )}
                {channel(<MapPin className="h-4 w-4" />, t('contact.office'), <p>Sector 01, Yelahanka New Town, Bengaluru, Karnataka 560064, India</p>)}
                {channel(<Clock className="h-4 w-4" />, t('contact.hours'), <p>{t('contact.hoursBody')}</p>)}
              </ul>
            </section>

            <section className="vp-card space-y-3 p-6" aria-labelledby="contact-hosts">
              <p className="flex items-center gap-2 text-sm font-semibold text-[var(--host-ink)]">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                {t('contact.hostEyebrow')}
              </p>
              <h2 id="contact-hosts" className="vp-h3">
                {t('contact.hostTitle')}
              </h2>
              <p className="text-sm leading-relaxed text-ink-2">{t('contact.hostBody')}</p>
              <Link href="/login?intent=provider" className="group/cta vp-btn vp-btn-secondary vp-btn-sm">
                {t('contact.hostCta')}
                <ArrowRight className="h-4 w-4 transition-transform duration-200 ease-out-quart group-hover/cta:translate-x-0.5" aria-hidden="true" />
              </Link>
            </section>
          </div>

          <section className="vp-card space-y-5 p-6 sm:p-8 lg:col-span-7" aria-labelledby="contact-form-title">
            <div>
              <h2 id="contact-form-title" className="vp-h3 text-xl">
                {t('contact.formTitle')}
              </h2>
              <p className="mt-1 text-sm text-ink-2">{t('contact.formIntro')}</p>
            </div>
            <ContactForm />
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
