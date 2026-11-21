import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { NotFoundContent } from '@/components/pages/NotFoundContent';
import { LANGUAGE_COOKIE, normalizeLanguage, translate } from '@/lib/i18n';

export function generateMetadata(): Metadata {
  const lang = normalizeLanguage(cookies().get(LANGUAGE_COOKIE)?.value);
  return { title: translate(lang, 'meta.notFoundTitle'), description: translate(lang, 'notFound.body') };
}

export default function NotFound() {
  return <NotFoundContent />;
}
