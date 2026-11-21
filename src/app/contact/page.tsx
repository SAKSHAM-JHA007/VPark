import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { ContactContent } from '@/components/pages/ContactContent';
import { LANGUAGE_COOKIE, normalizeLanguage, translate } from '@/lib/i18n';

export function generateMetadata(): Metadata {
  const lang = normalizeLanguage(cookies().get(LANGUAGE_COOKIE)?.value);
  return {
    title: translate(lang, 'meta.contactTitle'),
    description: translate(lang, 'meta.contactDescription'),
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default function ContactPage() {
  return <ContactContent />;
}
