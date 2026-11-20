'use client';

import React, { useState, useEffect, useId } from 'react';
import { MonthlyPass, Listing } from '@/types';
import { staggerStyle } from '@/components/motion/tokens';
import { useI18n } from '@/components/i18n/LanguageProvider';
import { Calendar, ArrowRight, Loader2, Ticket } from 'lucide-react';

interface MonthlyPassesViewProps {
  onRequireAuth?: () => void;
}

export function MonthlyPassesView({ onRequireAuth }: MonthlyPassesViewProps = {}) {
  const { t, inr, date } = useI18n();
  const ids = { listing: useId(), plate: useId() };
  const [passes, setPasses] = useState<MonthlyPass[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedListingId, setSelectedListingId] = useState<string>('');
  const [vehiclePlate, setVehiclePlate] = useState<string>('KA-04-MB-1234');
  const [statusMessage, setStatusMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [isBuying, setIsBuying] = useState<boolean>(false);

  const fetchData = async () => {
    try {
      const [passesRes, searchRes] = await Promise.all([fetch('/api/monthly-passes'), fetch('/api/search?radius=10')]);
      const passesData = await passesRes.json();
      const searchData = await searchRes.json();

      if (passesData.success) setPasses(passesData.data);
      if (searchData.success) {
        const bookableListings = searchData.data
          .map((i: any) => i.listing)
          .filter((l: Listing) => l.isBookable && l.pricing.monthlyRate);
        setListings(bookableListings);
        if (bookableListings.length > 0 && !selectedListingId) {
          setSelectedListingId(bookableListings[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBuyPass = async () => {
    const selectedListing = listings.find((l) => l.id === selectedListingId);
    if (!selectedListing || !selectedListing.pricing.monthlyRate) return;

    setIsBuying(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/monthly-passes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId: selectedListing.id,
          vehiclePlateNumber: vehiclePlate,
          vehicleType: 'SEDAN',
          month: '2026-11',
          price: selectedListing.pricing.monthlyRate,
        }),
      });
      if (res.status === 401) {
        setStatusMessage({ ok: false, text: t('monthly.signIn') });
        if (onRequireAuth) onRequireAuth();
        return;
      }
      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMessage({ ok: true, text: data.message });
        fetchData();
      } else {
        setStatusMessage({ ok: false, text: data.error || t('monthly.failed') });
      }
    } catch {
      setStatusMessage({ ok: false, text: t('monthly.network') });
    } finally {
      setIsBuying(false);
    }
  };

  const selectedListing = listings.find((l) => l.id === selectedListingId);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="vp-card flex flex-col gap-4 p-6 sm:flex-row sm:items-center animate-fade-up">
        <span className="vp-icon-tile h-12 w-12" aria-hidden="true">
          <Calendar className="h-6 w-6" />
        </span>
        <div>
          <h1 className="vp-h2">{t('monthly.title')}</h1>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ink-2">{t('monthly.body')}</p>
        </div>
      </div>

      {statusMessage && (
        <div role={statusMessage.ok ? 'status' : 'alert'} className={`vp-alert ${statusMessage.ok ? 'vp-alert-success' : 'vp-alert-warning'} animate-fade-in`}>
          {statusMessage.text}
        </div>
      )}

      <section className="space-y-3" aria-labelledby="monthly-yours">
        <h2 id="monthly-yours" className="vp-h3">
          {t('monthly.yourPasses')}
        </h2>
        {!loaded ? (
          <p role="status" className="vp-card p-6 text-sm text-ink-2">
            {t('monthly.loading')}
          </p>
        ) : passes.length === 0 ? (
          <div className="vp-card flex flex-col items-center gap-2 p-8 text-center text-sm text-ink-2">
            <Ticket className="h-6 w-6 text-ink-3" aria-hidden="true" />
            {t('monthly.empty')}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {passes.map((pass, index) => (
              <div key={pass.id} style={staggerStyle(index)} className="vp-card space-y-3 p-5 text-sm animate-fade-up">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="vp-badge vp-badge-success">{t('monthly.activePass', { month: pass.month })}</span>
                    <h3 className="mt-1.5 text-base font-semibold text-ink">{pass.listingTitle}</h3>
                  </div>
                  <span className="flex-shrink-0 text-lg font-bold tabular-nums text-[var(--transit-accent)]">
                    {inr(pass.price)}
                    <span className="text-xs font-medium text-ink-3">{t('common.perMonth')}</span>
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="vp-panel p-2.5">
                    <span className="block text-xs text-ink-3">{t('monthly.plate')}</span>
                    <span className="font-mono font-semibold text-ink">{pass.vehiclePlateNumber}</span>
                  </div>
                  <div className="vp-panel p-2.5">
                    <span className="block text-xs text-ink-3">{t('monthly.validUntil')}</span>
                    <span className="font-semibold text-ink">{date(pass.endDate)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="vp-card space-y-4 p-5 sm:p-6 animate-fade-up [animation-delay:120ms]" aria-labelledby="monthly-reserve">
        <h2 id="monthly-reserve" className="vp-h3">
          {t('monthly.reserveTitle')}
        </h2>

        {loaded && listings.length === 0 ? (
          <p className="text-sm text-ink-2">{t('monthly.noListings')}</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={ids.listing} className="vp-label">
                {t('monthly.location')}
              </label>
              <select id={ids.listing} value={selectedListingId} onChange={(e) => setSelectedListingId(e.target.value)} className="vp-input">
                {listings.map((l) => (
                  <option key={l.id} value={l.id}>
                    {t('monthly.option', { title: l.title, amount: inr(l.pricing.monthlyRate || 0), locality: l.locality })}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={ids.plate} className="vp-label">
                {t('monthly.plateLabel')}
              </label>
              <input
                id={ids.plate}
                type="text"
                value={vehiclePlate}
                autoCapitalize="characters"
                onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())}
                className="vp-input font-mono font-semibold"
              />
            </div>
          </div>
        )}

        {selectedListing && (
          <div
            key={selectedListing.id}
            className="flex flex-col gap-4 rounded-control border border-[var(--info-border)] bg-[var(--accent-soft)] p-4 sm:flex-row sm:items-center sm:justify-between animate-fade-in oled:bg-black"
          >
            <div>
              <span className="block text-sm font-semibold text-ink">{t('monthly.dedicated', { title: selectedListing.title })}</span>
              <span className="text-sm text-ink-2">{t('monthly.dedicatedBody')}</span>
            </div>
            <button type="button" onClick={handleBuyPass} disabled={isBuying} className="group/cta vp-btn vp-btn-primary flex-shrink-0 self-start sm:self-auto">
              {isBuying && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {isBuying ? t('monthly.issuing') : t('monthly.subscribe', { amount: inr(selectedListing.pricing.monthlyRate || 0) })}
              {!isBuying && <ArrowRight className="h-4 w-4 transition-transform duration-200 ease-out-quart group-hover/cta:translate-x-0.5" aria-hidden="true" />}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
