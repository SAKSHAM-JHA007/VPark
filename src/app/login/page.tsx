'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AuthPanel } from '@/components/AuthModal';
import { PublicHeader } from '@/components/nav/PublicHeader';
import { SiteFooter } from '@/components/nav/SiteFooter';
import { useI18n } from '@/components/i18n/LanguageProvider';
import { User } from '@/types';
import { ArrowLeft } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [intent, setIntent] = useState<'driver' | 'provider'>('driver');

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const intentParam = sp.get('intent');
    if (intentParam === 'provider' || intentParam === 'driver') {
      setIntent(intentParam);
    }
  }, []);

  const handleAuthenticated = (user: User) => {
    if (user.activeRole === 'ADMIN') {
      router.push('/driver/home?tab=admin');
      return;
    }
    if (user.activeRole === 'PROVIDER') {
      router.push('/owner/dashboard');
      return;
    }
    router.push('/driver/home');
  };

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink">
      <PublicHeader />

      <main id="main-content" className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:py-14">
        <div className="w-full max-w-md space-y-6">
          <Link href="/driver/home" className="vp-btn vp-btn-ghost vp-btn-sm -ml-3">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {t('login.back')}
          </Link>
          <div className="space-y-2 animate-fade-up">
            <p className="vp-eyebrow">{t('login.eyebrow')}</p>
            <h1 className="vp-h1 text-[1.75rem] sm:text-[2rem]">{t('login.title')}</h1>
            <p className="text-sm text-ink-2">{t('login.body')}</p>
          </div>
          <div className="vp-card p-5 sm:p-6 animate-fade-up [animation-delay:90ms]">
            <AuthPanel embedded initialIntent={intent} onAuthenticated={handleAuthenticated} />
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
