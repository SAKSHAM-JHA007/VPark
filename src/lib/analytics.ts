/**
 * VPark Analytics & Conversion Event Dispatcher (GA4 & Privacy Compliant)
 */

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
  }
}

export type VParkAnalyticsEvent =
  | { name: 'registration_start'; params?: { intent?: 'driver' | 'provider' } }
  | { name: 'registration_complete'; params?: { userId?: string; role?: string } }
  | { name: 'login_complete'; params?: { userId?: string; role?: string } }
  | { name: 'rent_space_select'; params?: { source?: string } }
  | { name: 'get_parking_select'; params?: { source?: string; anchor?: string; date?: string } }
  | { name: 'contact_form_submit'; params?: { subject?: string } };

export function trackEvent(event: VParkAnalyticsEvent) {
  if (typeof window === 'undefined') return;

  if (typeof window.gtag === 'function') {
    try {
      window.gtag('event', event.name, event.params || {});
    } catch (err) {
      console.debug('[Analytics] Failed to dispatch gtag event:', err);
    }
  } else {
    // Development / Console logging fallback
    if (process.env.NODE_ENV !== 'production') {
      console.debug('[Analytics Event]:', event.name, event.params);
    }
  }
}
