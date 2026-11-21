'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Presence } from '@/components/motion/Presence';
import { ModalBackdrop, ModalPanel } from '@/components/motion/AnimatedModal';
import { CountUp } from '@/components/motion/CountUp';
import { staggerStyle } from '@/components/motion/tokens';
import { ListingSubmissionNotice } from '@/components/HowItWorks';
import { useI18n } from '@/components/i18n/LanguageProvider';
import {
  Listing,
  ProviderType,
  ProviderSituation,
  ParkingCategory,
  VehicleType,
  AccessMethod,
  User,
} from '@/types';
import {
  APP_CONFIG,
  YELAHANKA_ANCHORS,
  PROVIDER_SITUATION_EVIDENCE,
} from '@/lib/constants';
import { ListingLocationPicker } from '@/components/maps/ListingLocationPicker';
import {
  Building2,
  PlusCircle,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Upload,
  ArrowRight,
  ArrowLeft,
  MapPin,
  Camera,
  Trash2,
  Edit3,
  Clock,
  Lock,
  X,
} from 'lucide-react';
import { useDialog } from '@/components/motion/useDialog';

interface ProviderHubProps {
  currentUser?: User | null;
  onRequireAuth?: () => void;
  onEnableProvider?: () => void;
}

const ALL_VEHICLE_TYPES: VehicleType[] = ['TWO_WHEELER', 'HATCHBACK', 'SEDAN', 'SUV', 'EV'];

const STATUS_TONE: Record<Listing['status'], string> = {
  DRAFT: 'vp-badge',
  PENDING_REVIEW: 'vp-badge vp-badge-warning',
  NEEDS_INFO: 'vp-badge vp-badge-warning',
  VERIFIED: 'vp-badge vp-badge-success',
  REJECTED: 'vp-badge vp-badge-danger',
  SUSPENDED: 'vp-badge vp-badge-danger',
};

function situationToProviderType(sit: ProviderSituation): ProviderType {
  if (sit === 'BUSINESS_OPERATOR') return 'OPERATOR';
  if (sit === 'MANAGER') return 'MANAGER';
  return 'OWNER';
}

// Strip EXIF metadata client-side by re-encoding image pixels through an HTML canvas (PRD 7.2)
async function stripImageExif(file: File): Promise<File> {
  if (typeof window === 'undefined' || !file.type.startsWith('image/')) {
    return file;
  }
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      try {
        const maxDim = 1400;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          resolve(file);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const outputMime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(objectUrl);
            if (!blob) {
              resolve(file);
              return;
            }
            const safeName = file.name.replace(/\.[^.]+$/, '') + (outputMime === 'image/png' ? '.png' : '.jpg');
            resolve(new File([blob], safeName, { type: outputMime }));
          },
          outputMime,
          0.85
        );
      } catch {
        URL.revokeObjectURL(objectUrl);
        resolve(file);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };
    img.src = objectUrl;
  });
}

export function ProviderHub({
  currentUser,
  onRequireAuth,
  onEnableProvider,
}: ProviderHubProps) {
  const { t, tn, inr, date } = useI18n();
  const [listings, setListings] = useState<Listing[]>([]);
  const [metrics, setMetrics] = useState<{
    totalListings: number;
    verifiedListings: number;
    pendingListings: number;
    draftListings: number;
    staleListings: number;
    totalBookingsCount: number;
    activeBookingsCount: number;
    totalEarnings: number;
  } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authStateError, setAuthStateError] = useState<'UNAUTH' | 'NO_CAPABILITY' | null>(null);
  const [showAddWizard, setShowAddWizard] = useState<boolean>(false);
  const [editingListingId, setEditingListingId] = useState<string | null>(null);
  const [wizardStep, setWizardStep] = useState<number>(1);
  // Presentation only: slide wizard steps in after the first step change.
  const initialWizardStepRef = useRef(wizardStep);
  const wizardStepChangedRef = useRef(false);
  if (wizardStep !== initialWizardStepRef.current) wizardStepChangedRef.current = true;
  const wizardStepEnter = wizardStepChangedRef.current ? 'animate-slide-in' : '';
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [uploadingPhoto, setUploadingPhoto] = useState<boolean>(false);
  const [uploadingProof, setUploadingProof] = useState<boolean>(false);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const proofInputRef = useRef<HTMLInputElement>(null);

  const emptyForm = {
    title: '',
    description: '',
    providerSituation: 'HOUSE_OWNER' as ProviderSituation,
    providerType: 'OWNER' as ProviderType,
    category: 'PRIVATE' as ParkingCategory,
    address: '',
    locality: 'Yelahanka New Town',
    landmark: '',
    latitude: APP_CONFIG.defaultCenter.lat,
    longitude: APP_CONFIG.defaultCenter.lng,
    pinConfirmed: true,
    hourlyRate: 40,
    dailyRate: 240,
    monthlyRate: 2800,
    totalCapacity: 1,
    vehicleTypes: ['HATCHBACK', 'SEDAN', 'SUV'] as VehicleType[],
    isCovered: true,
    heightClearanceMeters: '',
    dimensionsNotes: '',
    hasEvCharging: false,
    evChargerType: '15A 3-Pin Socket',
    accessMethod: 'GATE_GUARD' as AccessMethod,
    accessInstructions: '',
    houseRules: 'Park within lines, reverse park only',
    photos: [] as string[],
    docType: 'SALE_DEED' as ProviderDocumentDocType,
    docFileName: '',
    docStorageKey: '',
  };

  type ProviderDocumentDocType =
    | 'SALE_DEED'
    | 'TAX_RECEIPT'
    | 'TENANCY_AGREEMENT'
    | 'SOCIETY_NOC'
    | 'TRADE_LICENSE'
    | 'POWER_OF_ATTORNEY';

  const [formData, setFormData] = useState(emptyForm);

  const fetchProviderData = async () => {
    setLoading(true);
    setAuthStateError(null);
    try {
      const res = await fetch('/api/provider/listings');
      if (res.status === 401) {
        setAuthStateError('UNAUTH');
        setListings([]);
        setMetrics(null);
        return;
      }
      if (res.status === 403) {
        setAuthStateError('NO_CAPABILITY');
        setListings([]);
        setMetrics(null);
        return;
      }
      const data = await res.json();
      if (data.success) {
        setListings(data.data);
        setMetrics(data.metrics);
      }
    } catch (err) {
      console.error('Failed to load provider data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProviderData();
  }, [currentUser?.id, currentUser?.activeRole, currentUser?.roles?.length]);

  const openNewWizard = () => {
    setEditingListingId(null);
    setFormData(emptyForm);
    setFormError(null);
    setWizardStep(1);
    setShowAddWizard(true);
  };

  const openEditWizard = (listing: Listing) => {
    const sit = listing.providerSituation || 'HOUSE_OWNER';
    const existingDoc = listing.documents?.[0];
    setEditingListingId(listing.id);
    setFormData({
      title: listing.title,
      description: listing.description || '',
      providerSituation: sit,
      providerType: listing.providerType,
      category: listing.category,
      address: listing.address,
      locality: listing.locality || 'Yelahanka New Town',
      landmark: listing.landmark || '',
      latitude: listing.latitude,
      longitude: listing.longitude,
      pinConfirmed: true,
      hourlyRate: listing.pricing.hourlyRate,
      dailyRate: listing.pricing.dailyRate || 240,
      monthlyRate: listing.pricing.monthlyRate || 2800,
      totalCapacity: listing.totalCapacity,
      vehicleTypes: listing.vehicleTypes || ['HATCHBACK', 'SEDAN'],
      isCovered: listing.isCovered,
      heightClearanceMeters: listing.heightClearanceMeters ? String(listing.heightClearanceMeters) : '',
      dimensionsNotes: listing.dimensionsNotes || '',
      hasEvCharging: listing.hasEvCharging,
      evChargerType: listing.evChargerType || '15A 3-Pin Socket',
      accessMethod: listing.accessMethod,
      accessInstructions: listing.accessInstructions || '',
      houseRules: (listing.houseRules || []).join(', '),
      photos: listing.photos || [],
      docType: (existingDoc?.docType as ProviderDocumentDocType) || PROVIDER_SITUATION_EVIDENCE[sit].docType,
      docFileName: existingDoc?.fileName || '',
      docStorageKey: existingDoc?.storageKey || '',
    });
    setFormError(null);
    setWizardStep(1);
    setShowAddWizard(true);
  };

  const handleSituationChange = (sit: ProviderSituation) => {
    const evidence = PROVIDER_SITUATION_EVIDENCE[sit];
    setFormData((prev) => ({
      ...prev,
      providerSituation: sit,
      providerType: situationToProviderType(sit),
      category: sit === 'BUSINESS_OPERATOR' ? 'COMMERCIAL' : prev.category,
      docType: evidence.docType,
    }));
  };

  const handleToggleVehicle = (vt: VehicleType) => {
    setFormData((prev) => {
      const exists = prev.vehicleTypes.includes(vt);
      const next = exists ? prev.vehicleTypes.filter((t) => t !== vt) : [...prev.vehicleTypes, vt];
      return { ...prev, vehicleTypes: next.length > 0 ? next : [vt] };
    });
  };

  const handlePhotoUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setFormError(null);
    setUploadingPhoto(true);
    try {
      const uploadedUrls: string[] = [];
      for (const rawFile of Array.from(files).slice(0, 6 - formData.photos.length)) {
        if (rawFile.size > 5 * 1024 * 1024) {
          setFormError(t('wizard.errPhotoTooBig', { name: rawFile.name }));
          continue;
        }
        const stripped = await stripImageExif(rawFile);
        const body = new FormData();
        body.append('file', stripped);
        body.append('kind', 'photo');
        const res = await fetch('/api/uploads', { method: 'POST', body });
        const data = await res.json();
        if (res.ok && data.success && data.url) {
          uploadedUrls.push(data.url);
        } else {
          setFormError(data.error || t('wizard.errPhotoFailed'));
        }
      }
      if (uploadedUrls.length > 0) {
        setFormData((prev) => ({
          ...prev,
          photos: [...prev.photos, ...uploadedUrls].slice(0, 6),
        }));
      }
    } catch {
      setFormError(t('wizard.errPhotoNetwork'));
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Upload real generated sample JPEG bytes via canvas -> /api/uploads for quick pilot testing
  const handleGenerateSamplePhotos = async () => {
    if (typeof document === 'undefined') return;
    setUploadingPhoto(true);
    setFormError(null);
    try {
      const labels = ['Driveway Entrance', 'Covered Parking Bay', 'Street Approach'];
      const uploaded: string[] = [];
      for (let i = 0; i < labels.length; i++) {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 420;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = i === 0 ? '#dbeafe' : i === 1 ? '#e0e7ff' : '#f1f5f9';
          ctx.fillRect(0, 0, 640, 420);
          ctx.fillStyle = '#0A5CFF';
          ctx.fillRect(36, 36, 80, 80);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 44px sans-serif';
          ctx.fillText('P', 62, 92);
          ctx.fillStyle = '#0f172a';
          ctx.font = 'bold 26px sans-serif';
          ctx.fillText(`VPark Verified Space · ${labels[i]}`, 36, 200);
          ctx.font = '18px monospace';
          ctx.fillStyle = '#475569';
          ctx.fillText(`EXIF stripped · ${formData.locality}`, 36, 240);
        }
        const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
        if (blob) {
          const fd = new FormData();
          fd.append('file', new File([blob], `space_view_${i + 1}.jpg`, { type: 'image/jpeg' }));
          fd.append('kind', 'photo');
          const res = await fetch('/api/uploads', { method: 'POST', body: fd });
          const data = await res.json();
          if (res.ok && data.success) uploaded.push(data.url);
        }
      }
      setFormData((prev) => ({ ...prev, photos: uploaded }));
    } catch {
      setFormError(t('wizard.errSamplePhotos'));
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleProofUpload = async (file: File | null) => {
    if (!file) return;
    setFormError(null);
    if (file.size > 5 * 1024 * 1024) {
      setFormError(t('wizard.errProofTooBig'));
      return;
    }
    setUploadingProof(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('kind', 'proof');
      const res = await fetch('/api/uploads', { method: 'POST', body: fd });
      const data = await res.json();
      if (res.ok && data.success) {
        setFormData((prev) => ({
          ...prev,
          docFileName: data.fileName,
          docStorageKey: data.storageKey,
        }));
      } else {
        setFormError(data.error || t('wizard.errProofFailed'));
      }
    } catch {
      setFormError(t('wizard.errProofFailed'));
    } finally {
      setUploadingProof(false);
    }
  };

  const handleGenerateSampleProof = async () => {
    const content = `%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%% VPark Proof (${formData.docType}) - ${formData.title || 'New Listing'}`;
    const sampleFile = new File([content], `${formData.docType.toLowerCase()}_proof.pdf`, {
      type: 'application/pdf',
    });
    await handleProofUpload(sampleFile);
  };

  const handleReconfirm = async (listingId: string) => {
    try {
      const res = await fetch(`/api/provider/listings/${listingId}/reconfirm`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMessage(t('provider.reconfirmed'));
        fetchProviderData();
      } else {
        setStatusMessage(data.error || t('provider.reconfirmFailed'));
      }
    } catch {
      setStatusMessage(t('provider.reconfirmFailed'));
    }
  };

  const handleSaveListing = async (asDraft: boolean) => {
    setFormError(null);

    if (!formData.title.trim() || !formData.address.trim()) {
      setFormError(t('wizard.errTitleAddress'));
      setWizardStep(1);
      return;
    }
    const cap = Number(formData.totalCapacity);
    if (!Number.isInteger(cap) || cap < 1) {
      setFormError(t('wizard.errCapacity'));
      setWizardStep(2);
      return;
    }
    if (!formData.hourlyRate || Number(formData.hourlyRate) <= 0) {
      setFormError(t('wizard.errRate'));
      setWizardStep(3);
      return;
    }
    if (!asDraft && formData.photos.length < 3) {
      setFormError(t('wizard.errMinPhotos'));
      setWizardStep(4);
      return;
    }
    if (!asDraft && !formData.docFileName) {
      setFormError(t('wizard.errProof'));
      setWizardStep(4);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        id: editingListingId || undefined,
        title: formData.title.trim(),
        description:
          formData.description.trim() ||
          `${formData.isCovered ? 'Covered' : 'Open'} ${formData.category.toLowerCase()} parking space in ${formData.locality}.`,
        providerType: formData.providerType,
        providerSituation: formData.providerSituation,
        category: formData.category,
        address: formData.address.trim(),
        locality: formData.locality,
        landmark: formData.landmark.trim() || 'Yelahanka Pilot Zone',
        latitude: formData.latitude,
        longitude: formData.longitude,
        totalCapacity: cap,
        vehicleTypes: formData.vehicleTypes,
        isCovered: formData.isCovered,
        heightClearanceMeters: formData.heightClearanceMeters
          ? Number(formData.heightClearanceMeters)
          : undefined,
        dimensionsNotes: formData.dimensionsNotes.trim() || undefined,
        hasEvCharging: formData.hasEvCharging,
        evChargerType: formData.hasEvCharging ? formData.evChargerType : undefined,
        pricing: {
          hourlyRate: Number(formData.hourlyRate),
          dailyRate: formData.dailyRate ? Number(formData.dailyRate) : undefined,
          monthlyRate: formData.monthlyRate ? Number(formData.monthlyRate) : undefined,
        },
        accessMethod: formData.accessMethod,
        accessInstructions:
          formData.accessInstructions.trim() || 'Report to security guard or host on arrival.',
        houseRules: formData.houseRules
          .split(',')
          .map((r) => r.trim())
          .filter(Boolean),
        photos: formData.photos,
        document: formData.docFileName
          ? {
              docType: formData.docType,
              fileName: formData.docFileName,
              storageKey: formData.docStorageKey || undefined,
            }
          : undefined,
        initialStatus: asDraft ? 'DRAFT' : 'PENDING_REVIEW',
        submitForReview: !asDraft,
      };

      const res = await fetch('/api/provider/listings', {
        method: editingListingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setFormError(data.error || t('wizard.errSave'));
      } else {
        setStatusMessage(data.message);
        setShowAddWizard(false);
        setEditingListingId(null);
        fetchProviderData();
      }
    } catch {
      setFormError(t('wizard.errSaveNetwork'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Capability gate views (PRD Section 6.6: unauthenticated 401 or non-provider 403)
  if (!loading && (authStateError === 'UNAUTH' || authStateError === 'NO_CAPABILITY')) {
    const unauth = authStateError === 'UNAUTH';
    return (
      <div className="mx-auto max-w-2xl px-4 py-14">
        <div className="vp-card flex flex-col items-center gap-4 p-8 text-center">
          <span className="vp-icon-tile h-12 w-12" aria-hidden="true">
            {unauth ? <Lock className="h-6 w-6" /> : <Building2 className="h-6 w-6" />}
          </span>
          <h1 className="vp-h2">{unauth ? t('provider.signInTitle') : t('provider.enableTitle')}</h1>
          <p className="max-w-md text-sm leading-relaxed text-ink-2">{unauth ? t('provider.signInBody') : t('provider.enableBody')}</p>
          {unauth && onRequireAuth && (
            <button type="button" onClick={onRequireAuth} className="vp-btn vp-btn-primary">
              {t('provider.signIn')}
            </button>
          )}
          {!unauth && onEnableProvider && (
            <button type="button" onClick={onEnableProvider} className="vp-btn vp-btn-primary">
              {t('provider.enable')}
            </button>
          )}
        </div>
      </div>
    );
  }

  const displayName = currentUser?.name || currentUser?.phone || t('provider.hostFallback');
  const situationLabel = (sit: ProviderSituation) => t(`wizard.situations.${sit}`);
  const required = <span aria-hidden="true" className="text-[var(--danger-ink)]">*</span>;
  const optional = <span className="font-normal text-ink-3">({t('common.optional')})</span>;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      {/* Welcome (PRD 7.1) */}
      <div className="vp-card flex flex-col justify-between gap-4 p-6 sm:flex-row sm:items-center">
        <div>
          <p className="vp-eyebrow flex items-center gap-2">
            <Building2 className="h-4 w-4" aria-hidden="true" />
            {t('provider.eyebrow')}
          </p>
          <h1 className="vp-h2 mt-1.5">{t('provider.welcome', { name: displayName })}</h1>
          <p className="mt-1 text-sm text-ink-2">{t('provider.intro')}</p>
        </div>
        <button type="button" onClick={openNewWizard} className="vp-btn vp-btn-primary self-start sm:self-auto">
          <PlusCircle className="h-4 w-4" aria-hidden="true" />
          {t('provider.add')}
        </button>
      </div>

      <ListingSubmissionNotice />

      {statusMessage && (
        <div role="status" className="vp-alert vp-alert-info items-center justify-between animate-fade-in">
          <span>{statusMessage}</span>
          <button type="button" onClick={() => setStatusMessage(null)} aria-label={t('common.dismiss')} className="rounded-full p-1">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Honest summary cards (PRD 7.1: never invent bookings or earnings) */}
      {metrics && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="vp-card p-4 animate-fade-up">
            <span className="block text-sm font-medium text-ink-2">{t('provider.metricTotal')}</span>
            <span className="mt-1 block text-2xl font-bold tabular-nums text-ink">
              <CountUp value={metrics.totalListings} />
            </span>
            <span className="mt-0.5 block text-xs text-ink-3">
              {t('provider.metricTotalMeta', { draft: metrics.draftListings, pending: metrics.pendingListings })}
            </span>
          </div>
          <div className="vp-card p-4 animate-fade-up [animation-delay:60ms]">
            <span className="block text-sm font-medium text-ink-2">{t('provider.metricActive')}</span>
            <span className="mt-1 block text-2xl font-bold tabular-nums text-[var(--success-ink)]">
              <CountUp value={metrics.verifiedListings} />
            </span>
            <span className="mt-0.5 block text-xs text-ink-3">{t('provider.metricActiveMeta')}</span>
          </div>
          <div className="vp-card p-4 animate-fade-up [animation-delay:120ms]">
            <span className="block text-sm font-medium text-ink-2">{t('provider.metricBookings')}</span>
            {metrics.totalBookingsCount > 0 ? (
              <>
                <span className="mt-1 block text-2xl font-bold tabular-nums text-ink">
                  <CountUp value={metrics.totalBookingsCount} />
                </span>
                <span className="mt-0.5 block text-xs text-ink-3">{t('provider.metricBookingsMeta', { count: metrics.activeBookingsCount })}</span>
              </>
            ) : (
              <span className="mt-2 block text-sm text-ink-3">{t('provider.metricBookingsEmpty')}</span>
            )}
          </div>
          <div className="vp-card p-4 animate-fade-up [animation-delay:180ms]">
            <span className="block text-sm font-medium text-ink-2">{t('provider.metricEarnings')}</span>
            {metrics.totalEarnings > 0 ? (
              <>
                <span className="mt-1 block text-2xl font-bold tabular-nums text-[var(--transit-accent)]">
                  <CountUp value={metrics.totalEarnings} format={(n) => inr(n, { decimals: true })} />
                </span>
                <span className="mt-0.5 block text-xs text-ink-3">{t('provider.metricEarningsMeta')}</span>
              </>
            ) : (
              <span className="mt-2 block text-sm text-ink-3">{t('provider.metricEarningsEmpty')}</span>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        <section className="space-y-3 lg:col-span-2" aria-labelledby="provider-listings">
          <h2 id="provider-listings" className="vp-h3">
            {t('provider.listingsTitle')}
          </h2>

          {loading ? (
            <div role="status" className="space-y-3">
              <span className="sr-only">{t('provider.loading')}</span>
              {[0, 1].map((i) => (
                <div key={i} aria-hidden="true" className="vp-card space-y-3 p-5">
                  <div className="vp-skeleton h-4 w-24 rounded-full" />
                  <div className="vp-skeleton h-5 w-2/3 rounded-full" />
                  <div className="vp-skeleton h-3 w-1/2 rounded-full" />
                </div>
              ))}
            </div>
          ) : listings.length === 0 ? (
            <div className="vp-card flex flex-col items-center gap-3 p-10 text-center animate-fade-in">
              <span className="vp-icon-tile h-12 w-12 rounded-full" aria-hidden="true">
                <MapPin className="h-6 w-6" />
              </span>
              <p className="text-base font-semibold text-ink">{t('provider.emptyTitle')}</p>
              <p className="max-w-md text-sm text-ink-2">{t('provider.emptyBody')}</p>
              <button type="button" onClick={openNewWizard} className="vp-btn vp-btn-primary">
                <PlusCircle className="h-4 w-4" aria-hidden="true" />
                {t('provider.add')}
              </button>
            </div>
          ) : (
            <ul className="space-y-3">
              {listings.map((l, index) => {
                const canEdit = l.status === 'DRAFT' || l.status === 'NEEDS_INFO' || l.status === 'REJECTED';
                return (
                  <li key={l.id} style={staggerStyle(index)} className="vp-card space-y-3 p-5 text-sm animate-fade-up">
                    <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={STATUS_TONE[l.status]}>{t(`provider.statuses.${l.status}`)}</span>
                          {l.status === 'VERIFIED' && l.isStale && (
                            <span className="vp-badge vp-badge-warning">
                              <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                              {t('provider.stale')}
                            </span>
                          )}
                          <span className="text-xs tabular-nums text-ink-3">
                            {tn('provider.photos', l.photos.length)} · {tn('provider.slots', l.totalCapacity)}
                          </span>
                        </div>
                        <h3 className="text-base font-semibold text-ink">{l.title}</h3>
                        <p className="text-ink-2">{l.address}</p>
                        <p className="text-xs tabular-nums text-ink-3">
                          {inr(l.pricing.hourlyRate)}
                          {t('common.perHour')}
                          {l.pricing.dailyRate ? ` · ${inr(l.pricing.dailyRate)}${t('common.perDay')}` : ''}
                          {l.pricing.monthlyRate ? ` · ${inr(l.pricing.monthlyRate)}${t('common.perMonth')}` : ''} ·{' '}
                          {l.isCovered ? t('listing.covered') : t('listing.open')} · {t('provider.confirmed', { date: date(l.lastConfirmedAt) })}
                        </p>
                      </div>

                      <div className="flex flex-shrink-0 flex-wrap items-center gap-2 self-end sm:self-auto">
                        {canEdit && (
                          <button type="button" onClick={() => openEditWizard(l)} className="vp-btn vp-btn-secondary vp-btn-sm">
                            <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                            {t('provider.edit')}
                          </button>
                        )}
                        {l.status === 'VERIFIED' && (
                          <button type="button" onClick={() => handleReconfirm(l.id)} className="vp-btn vp-btn-secondary vp-btn-sm">
                            <CheckCircle2 className="h-3.5 w-3.5 text-[var(--transit-accent)]" aria-hidden="true" />
                            {t('provider.reconfirm')}
                          </button>
                        )}
                      </div>
                    </div>

                    {l.reviewReason && (l.status === 'NEEDS_INFO' || l.status === 'REJECTED' || l.status === 'SUSPENDED') && (
                      <div className="vp-alert vp-alert-warning">
                        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
                        <div>
                          <span className="block font-semibold">{t('provider.reviewerNote')}</span>
                          <span>{l.reviewReason}</span>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Activity and notices (PRD 7.1) */}
        <section className="space-y-3" aria-labelledby="provider-activity">
          <h2 id="provider-activity" className="vp-h3">
            {t('provider.activityTitle')}
          </h2>
          <div className="vp-card space-y-3 p-4 text-sm">
            {!currentUser?.email && (
              <div className="vp-alert vp-alert-warning block">
                <span className="block font-semibold">{t('provider.emailNeeded')}</span>
                <span className="block text-xs">{t('provider.emailNeededBody')}</span>
              </div>
            )}
            {listings.length === 0 ? (
              <p className="text-ink-3">{t('provider.activityEmpty')}</p>
            ) : (
              <ul className="space-y-2.5">
                {listings.slice(0, 5).map((l) => (
                  <li key={l.id} className="flex items-start gap-2 border-b border-hairline pb-2.5 last:border-b-0 last:pb-0">
                    <Clock className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-ink-3" aria-hidden="true" />
                    <div className="min-w-0">
                      <span className="block font-semibold text-ink">{l.title}</span>
                      <span className="text-xs text-ink-3">
                        {t('provider.activityStatus', { status: t(`provider.statuses.${l.status}`), date: date(l.updatedAt) })}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      {/* 4-step listing creation / edit wizard (PRD 7.2 & 7.3) */}
      <Presence>
        {showAddWizard && (
          <ModalBackdrop key="listing-wizard" className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
            <ModalPanel className="my-auto w-full max-w-2xl">
              <WizardDialog onClose={() => setShowAddWizard(false)} label={t('wizard.dialogLabel')}>
                <div className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-4 sm:px-6">
                  <div>
                    <span className="block text-xs font-semibold text-[var(--transit-accent)]">
                      {t('wizard.step', { step: wizardStep })} · {editingListingId ? t('wizard.editTitle') : t('wizard.newTitle')}
                    </span>
                    <h2 className="mt-0.5 text-lg font-bold text-ink">{t('wizard.heading')}</h2>
                  </div>
                  <button
                    type="button"
                    aria-label={t('wizard.close')}
                    onClick={() => setShowAddWizard(false)}
                    className="rounded-full p-2 text-ink-3 transition-colors hover:bg-surface-alt hover:text-ink"
                  >
                    <X className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>

                <div
                  role="progressbar"
                  aria-label={t('wizard.step', { step: wizardStep })}
                  aria-valuemin={1}
                  aria-valuemax={4}
                  aria-valuenow={wizardStep}
                  className="h-1 bg-surface-alt"
                >
                  <div
                    className="h-full w-full origin-left bg-[var(--transit-accent)] transition-transform duration-500 ease-out-quart"
                    style={{ transform: `scaleX(${wizardStep / 4})` }}
                  />
                </div>

                <div className="space-y-4 overflow-y-auto p-5 text-sm sm:p-6">
                  <ListingSubmissionNotice />

                  {formError && (
                    <div role="alert" className="vp-alert vp-alert-danger animate-fade-in">
                      {formError}
                    </div>
                  )}

                  {wizardStep === 1 && (
                    <fieldset key="wizard-step-1" className={`${wizardStepEnter} space-y-4`}>
                      <legend className="vp-h3 mb-3">1. {t('wizard.step1')}</legend>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label htmlFor="prov-situation" className="vp-label">
                            {t('wizard.situation')}
                          </label>
                          <select
                            id="prov-situation"
                            value={formData.providerSituation}
                            onChange={(e) => handleSituationChange(e.target.value as ProviderSituation)}
                            className="vp-input"
                          >
                            {(Object.keys(PROVIDER_SITUATION_EVIDENCE) as ProviderSituation[]).map((key) => (
                              <option key={key} value={key}>
                                {situationLabel(key)}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label htmlFor="space-category" className="vp-label">
                            {t('wizard.spaceType')}
                          </label>
                          <select
                            id="space-category"
                            value={formData.category}
                            onChange={(e) => setFormData({ ...formData, category: e.target.value as ParkingCategory })}
                            className="vp-input"
                          >
                            <option value="PRIVATE">{t('wizard.spaceTypes.PRIVATE')}</option>
                            <option value="COMMERCIAL">{t('wizard.spaceTypes.COMMERCIAL')}</option>
                            <option value="OTHER">{t('wizard.spaceTypes.OTHER')}</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label htmlFor="listing-title" className="vp-label">
                          {t('wizard.title')} {required}
                        </label>
                        <input
                          id="listing-title"
                          type="text"
                          required
                          placeholder={t('wizard.titlePlaceholder')}
                          value={formData.title}
                          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                          className="vp-input"
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label htmlFor="listing-address" className="vp-label">
                            {t('wizard.address')} {required}
                          </label>
                          <input
                            id="listing-address"
                            type="text"
                            required
                            placeholder={t('wizard.addressPlaceholder')}
                            value={formData.address}
                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                            className="vp-input"
                          />
                        </div>
                        <div>
                          <label htmlFor="listing-locality" className="vp-label">
                            {t('wizard.locality')}
                          </label>
                          <select
                            id="listing-locality"
                            value={formData.locality}
                            onChange={(e) => {
                              const anchor = YELAHANKA_ANCHORS.find((a) => a.locality === e.target.value);
                              setFormData({
                                ...formData,
                                locality: e.target.value,
                                latitude: anchor ? anchor.latitude : formData.latitude,
                                longitude: anchor ? anchor.longitude : formData.longitude,
                              });
                            }}
                            className="vp-input"
                          >
                            {YELAHANKA_ANCHORS.map((a) => (
                              <option key={a.id} value={a.locality}>
                                {a.locality}
                              </option>
                            ))}
                            <option value="Kogilu Cross">Kogilu Cross</option>
                          </select>
                        </div>
                      </div>

                      {/* Google Maps pin picker (host listing wizard) */}
                      <ListingLocationPicker
                        latitude={formData.latitude}
                        longitude={formData.longitude}
                        locality={formData.locality}
                        onChange={(lat, lng) =>
                          setFormData((prev) => ({
                            ...prev,
                            latitude: lat,
                            longitude: lng,
                            pinConfirmed: true,
                          }))
                        }
                      />
                    </fieldset>
                  )}

                  {wizardStep === 2 && (
                    <fieldset key="wizard-step-2" className={`${wizardStepEnter} space-y-4`}>
                      <legend className="vp-h3 mb-3">2. {t('wizard.step2')}</legend>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label htmlFor="total-capacity" className="vp-label">
                            {t('wizard.capacity')} {required}
                          </label>
                          <input
                            id="total-capacity"
                            type="number"
                            min={1}
                            max={200}
                            step={1}
                            value={formData.totalCapacity}
                            onChange={(e) => setFormData({ ...formData, totalCapacity: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                            className="vp-input tabular-nums"
                          />
                        </div>
                        <div>
                          <label htmlFor="cover-type" className="vp-label">
                            {t('wizard.coverLabel')}
                          </label>
                          <select
                            id="cover-type"
                            value={formData.isCovered ? 'true' : 'false'}
                            onChange={(e) => setFormData({ ...formData, isCovered: e.target.value === 'true' })}
                            className="vp-input"
                          >
                            <option value="true">{t('wizard.coveredOption')}</option>
                            <option value="false">{t('wizard.openOption')}</option>
                          </select>
                        </div>
                      </div>

                      <div role="group" aria-labelledby="wizard-vehicles">
                        <span id="wizard-vehicles" className="vp-label">
                          {t('wizard.vehicles')}
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {ALL_VEHICLE_TYPES.map((vt) => {
                            const checked = formData.vehicleTypes.includes(vt);
                            return (
                              <button
                                key={vt}
                                type="button"
                                aria-pressed={checked}
                                onClick={() => handleToggleVehicle(vt)}
                                className={`inline-flex min-h-[2.25rem] items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors ${
                                  checked
                                    ? 'border-[var(--transit-accent)] bg-[var(--accent-soft)] text-[var(--accent-soft-ink)]'
                                    : 'border-hairline-strong bg-surface text-ink-2 hover:text-ink'
                                }`}
                              >
                                {checked && <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />}
                                {t(`wizard.vehicleTypes.${vt}`)}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label htmlFor="dim-notes" className="vp-label">
                            {t('wizard.dims')} {optional}
                          </label>
                          <input
                            id="dim-notes"
                            type="text"
                            placeholder={t('wizard.dimsPlaceholder')}
                            value={formData.dimensionsNotes}
                            onChange={(e) => setFormData({ ...formData, dimensionsNotes: e.target.value })}
                            className="vp-input"
                          />
                        </div>
                        <div>
                          <label htmlFor="height-clear" className="vp-label">
                            {t('wizard.height')} {optional}
                          </label>
                          <input
                            id="height-clear"
                            type="number"
                            step="0.1"
                            placeholder={t('wizard.heightPlaceholder')}
                            value={formData.heightClearanceMeters}
                            onChange={(e) => setFormData({ ...formData, heightClearanceMeters: e.target.value })}
                            className="vp-input tabular-nums"
                          />
                        </div>
                      </div>

                      <label className="vp-panel flex cursor-pointer items-center justify-between gap-3 p-3.5">
                        <span>
                          <span className="block font-semibold text-ink">{t('wizard.ev')}</span>
                          <span className="block text-xs text-ink-3">{t('wizard.evHint')}</span>
                        </span>
                        <input
                          type="checkbox"
                          checked={formData.hasEvCharging}
                          onChange={(e) => setFormData({ ...formData, hasEvCharging: e.target.checked })}
                          className="vp-check h-5 w-5"
                        />
                      </label>
                    </fieldset>
                  )}

                  {wizardStep === 3 && (
                    <fieldset key="wizard-step-3" className={`${wizardStepEnter} space-y-4`}>
                      <legend className="vp-h3 mb-3">3. {t('wizard.step3')}</legend>

                      <div className="grid grid-cols-1 gap-3 tabular-nums sm:grid-cols-3">
                        <div>
                          <label htmlFor="rate-hourly" className="vp-label">
                            {t('wizard.hourly')} {required}
                          </label>
                          <input
                            id="rate-hourly"
                            type="number"
                            min={10}
                            value={formData.hourlyRate}
                            onChange={(e) => setFormData({ ...formData, hourlyRate: parseInt(e.target.value, 10) || 40 })}
                            className="vp-input font-semibold"
                          />
                        </div>
                        <div>
                          <label htmlFor="rate-daily" className="vp-label">
                            {t('wizard.daily')} {optional}
                          </label>
                          <input
                            id="rate-daily"
                            type="number"
                            value={formData.dailyRate}
                            onChange={(e) => setFormData({ ...formData, dailyRate: parseInt(e.target.value, 10) || 0 })}
                            className="vp-input font-semibold"
                          />
                        </div>
                        <div>
                          <label htmlFor="rate-monthly" className="vp-label">
                            {t('wizard.monthly')} {optional}
                          </label>
                          <input
                            id="rate-monthly"
                            type="number"
                            value={formData.monthlyRate}
                            onChange={(e) => setFormData({ ...formData, monthlyRate: parseInt(e.target.value, 10) || 0 })}
                            className="vp-input font-semibold"
                          />
                        </div>
                      </div>

                      <div>
                        <label htmlFor="access-method" className="vp-label">
                          {t('wizard.accessMethod')}
                        </label>
                        <select
                          id="access-method"
                          value={formData.accessMethod}
                          onChange={(e) => setFormData({ ...formData, accessMethod: e.target.value as AccessMethod })}
                          className="vp-input"
                        >
                          <option value="GATE_GUARD">{t('accessMethods.GATE_GUARD')}</option>
                          <option value="BOOM_BARRIER">{t('accessMethods.BOOM_BARRIER')}</option>
                          <option value="LOCKBOX_KEY">{t('accessMethods.LOCKBOX_KEY')}</option>
                          <option value="REMOTE_CALL">{t('accessMethods.REMOTE_CALL')}</option>
                          <option value="RFID">{t('accessMethods.RFID')}</option>
                        </select>
                      </div>

                      <div>
                        <label htmlFor="access-instructions" className="vp-label">
                          {t('wizard.instructions')}
                        </label>
                        <textarea
                          id="access-instructions"
                          rows={2}
                          value={formData.accessInstructions}
                          onChange={(e) => setFormData({ ...formData, accessInstructions: e.target.value })}
                          placeholder={t('wizard.instructionsPlaceholder')}
                          aria-describedby="access-instructions-help"
                          className="vp-input"
                        />
                        <p id="access-instructions-help" className="mt-1.5 flex items-center gap-1 text-xs font-medium text-[var(--info-ink)]">
                          <Lock className="h-3 w-3" aria-hidden="true" />
                          {t('wizard.instructionsPrivacy')}
                        </p>
                      </div>

                      <div>
                        <label htmlFor="house-rules" className="vp-label">
                          {t('wizard.houseRules')}
                        </label>
                        <input
                          id="house-rules"
                          type="text"
                          value={formData.houseRules}
                          onChange={(e) => setFormData({ ...formData, houseRules: e.target.value })}
                          className="vp-input"
                        />
                      </div>
                    </fieldset>
                  )}

                  {wizardStep === 4 && (
                    <fieldset key="wizard-step-4" className={`${wizardStepEnter} space-y-4`}>
                      <legend className="vp-h3 mb-3">4. {t('wizard.step4')}</legend>
                      <p className="text-xs text-ink-2">
                        {t('wizard.evidenceFor', {
                          situation: situationLabel(formData.providerSituation),
                          requirement: t(`wizard.requirements.${formData.providerSituation}`),
                        })}
                      </p>

                      {/* Photos */}
                      <div className="vp-panel space-y-3 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-ink">{t('wizard.photos', { count: formData.photos.length })}</span>
                          <div className="flex flex-wrap gap-2">
                            <input
                              ref={photoInputRef}
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              multiple
                              className="hidden"
                              onChange={(e) => handlePhotoUpload(e.target.files)}
                            />
                            <button type="button" disabled={uploadingPhoto} onClick={() => photoInputRef.current?.click()} className="vp-btn vp-btn-primary vp-btn-sm">
                              <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                              {uploadingPhoto ? t('wizard.uploading') : t('wizard.upload')}
                            </button>
                            {formData.photos.length < 3 && (
                              <button type="button" disabled={uploadingPhoto} onClick={handleGenerateSamplePhotos} className="vp-btn vp-btn-secondary vp-btn-sm">
                                {t('wizard.testPhotos')}
                              </button>
                            )}
                          </div>
                        </div>

                        {formData.photos.length > 0 ? (
                          <div className="grid grid-cols-3 gap-2">
                            {formData.photos.map((url, idx) => (
                              <div key={idx} className="relative h-24 overflow-hidden rounded-control border border-hairline bg-surface">
                                <img src={url} alt={t('wizard.photoAlt', { n: idx + 1 })} className="h-full w-full object-cover" />
                                <button
                                  type="button"
                                  aria-label={t('wizard.removePhoto', { n: idx + 1 })}
                                  onClick={() =>
                                    setFormData((prev) => ({
                                      ...prev,
                                      photos: prev.photos.filter((_, i) => i !== idx),
                                    }))
                                  }
                                  className="absolute right-1 top-1 rounded-full bg-black/75 p-1.5 text-white hover:bg-red-600"
                                >
                                  <Trash2 className="h-3 w-3" aria-hidden="true" />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-ink-3">{t('wizard.photosHint')}</p>
                        )}
                      </div>

                      {/* Private right-to-rent proof */}
                      <div className="vp-panel space-y-2.5 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <span className="block font-semibold text-ink">{t('wizard.proof')}</span>
                            <span className="text-xs text-ink-3">{t('wizard.docType', { type: t(`wizard.docTypes.${formData.docType}`) })}</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <input
                              ref={proofInputRef}
                              type="file"
                              accept=".pdf,image/jpeg,image/png,image/webp"
                              className="hidden"
                              onChange={(e) => handleProofUpload(e.target.files?.[0] || null)}
                            />
                            <button type="button" disabled={uploadingProof} onClick={() => proofInputRef.current?.click()} className="vp-btn vp-btn-inverse vp-btn-sm">
                              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                              {uploadingProof ? t('wizard.uploading') : t('wizard.selectDoc')}
                            </button>
                            {!formData.docFileName && (
                              <button type="button" disabled={uploadingProof} onClick={handleGenerateSampleProof} className="vp-btn vp-btn-secondary vp-btn-sm">
                                {t('wizard.samplePdf')}
                              </button>
                            )}
                          </div>
                        </div>

                        {formData.docFileName ? (
                          <div className="vp-alert vp-alert-success text-xs">
                            <FileText className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                            <span>{t('wizard.uploaded', { file: formData.docFileName })}</span>
                          </div>
                        ) : (
                          <p className="text-xs text-ink-3">{t('wizard.docHint')}</p>
                        )}
                      </div>
                    </fieldset>
                  )}

                  {/* Footer: back / save draft / next or submit */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-hairline pt-4">
                    <div className="flex flex-wrap items-center gap-2">
                      {wizardStep > 1 && (
                        <button type="button" onClick={() => setWizardStep(wizardStep - 1)} className="vp-btn vp-btn-ghost vp-btn-sm">
                          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                          {t('wizard.back')}
                        </button>
                      )}
                      <button type="button" disabled={isSubmitting} onClick={() => handleSaveListing(true)} className="vp-btn vp-btn-secondary vp-btn-sm">
                        {t('wizard.draft')}
                      </button>
                    </div>

                    {wizardStep < 4 ? (
                      <button type="button" onClick={() => setWizardStep(wizardStep + 1)} className="group/cta vp-btn vp-btn-primary vp-btn-sm">
                        {t('wizard.next')}
                        <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 ease-out-quart group-hover/cta:translate-x-0.5" aria-hidden="true" />
                      </button>
                    ) : (
                      <button type="button" disabled={isSubmitting} onClick={() => handleSaveListing(false)} className="vp-btn vp-btn-primary vp-btn-sm">
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                        {isSubmitting ? t('wizard.submitting') : t('wizard.submit')}
                      </button>
                    )}
                  </div>
                </div>
              </WizardDialog>
            </ModalPanel>
          </ModalBackdrop>
        )}
      </Presence>
    </div>
  );
}

/** Dialog shell for the listing wizard: focus trap, Escape to close, labelled. */
function WizardDialog({ onClose, label, children }: { onClose: () => void; label: string; children: React.ReactNode }) {
  const ref = useDialog<HTMLDivElement>(onClose);
  return (
    <div ref={ref} role="dialog" aria-modal="true" aria-label={label} className="vp-card flex max-h-[92vh] flex-col overflow-hidden shadow-raised">
      {children}
    </div>
  );
}
