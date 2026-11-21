import type { BookingStatus } from '@/types';
import type { TranslationKey } from '@/lib/i18n';

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'host';

export function badgeClass(tone: BadgeTone): string {
  return tone === 'neutral' ? 'vp-badge' : `vp-badge vp-badge-${tone}`;
}

/** Dictionary key and badge colour for a booking status. */
export function bookingStatusInfo(status: BookingStatus): { key: TranslationKey; tone: BadgeTone } {
  switch (status) {
    case 'CONFIRMED':
      return { key: 'bookingStatus.CONFIRMED', tone: 'info' };
    case 'CHECKED_IN':
      return { key: 'bookingStatus.CHECKED_IN', tone: 'success' };
    case 'COMPLETED':
      return { key: 'bookingStatus.COMPLETED', tone: 'neutral' };
    case 'CANCELLED_BY_DRIVER':
    case 'CANCELLED_BY_PROVIDER':
      return { key: 'bookingStatus.CANCELLED', tone: 'danger' };
    case 'DISPUTED':
      return { key: 'bookingStatus.DISPUTED', tone: 'warning' };
    case 'OVERSTAY':
      return { key: 'bookingStatus.OVERSTAY', tone: 'warning' };
    case 'PENDING_PAYMENT':
      return { key: 'bookingStatus.PENDING', tone: 'neutral' };
    case 'NO_SHOW':
      return { key: 'bookingStatus.NO_SHOW', tone: 'neutral' };
    case 'EXPIRED':
    default:
      return { key: 'bookingStatus.EXPIRED', tone: 'neutral' };
  }
}
