import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { PrivacyContent } from '@/components/pages/PrivacyContent';
import { LANGUAGE_COOKIE, normalizeLanguage, translate } from '@/lib/i18n';

export function generateMetadata(): Metadata {
  const lang = normalizeLanguage(cookies().get(LANGUAGE_COOKIE)?.value);
  return {
    title: translate(lang, 'meta.privacyTitle'),
    description: translate(lang, 'meta.privacyDescription'),
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default function PrivacyPolicyPage() {
  return <PrivacyContent />;
}
