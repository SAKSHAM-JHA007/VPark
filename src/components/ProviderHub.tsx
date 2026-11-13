'use client';

import React, { useState, useEffect, useRef } from 'react';
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
} from 'lucide-react';

interface ProviderHubProps {
  currentUser?: User | null;
  onRequireAuth?: () => void;
  onEnableProvider?: () => void;
}

const ALL_VEHICLE_TYPES: { id: VehicleType; label: string }[] = [
  { id: 'TWO_WHEELER', label: 'Two-wheeler' },
  { id: 'HATCHBACK', label: 'Hatchback Car' },
  { id: 'SEDAN', label: 'Sedan Car' },
  { id: 'SUV', label: 'SUV / MUV' },
  { id: 'EV', label: 'EV' },
];

const STATUS_CHIP: Record<
  Listing['status'],
  { label: string; classes: string }
> = {
  DRAFT: { label: 'Draft', classes: 'bg-slate-100 text-slate-700 border-slate-200' },
  PENDING_REVIEW: { label: 'Submitted', classes: 'bg-amber-100 text-amber-800 border-amber-200' },
  NEEDS_INFO: { label: 'Needs info', classes: 'bg-orange-100 text-orange-800 border-orange-200' },
  VERIFIED: { label: 'Approved', classes: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  REJECTED: { label: 'Rejected', classes: 'bg-red-100 text-red-800 border-red-200' },
  SUSPENDED: { label: 'Suspended', classes: 'bg-red-100 text-red-900 border-red-300' },
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

  // Pin click inside compact Yelahanka bounding box (13.06..13.12 lat, 77.575..77.620 lng)
  const handleMapPinClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const yRatio = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    const lng = Number((77.575 + xRatio * (77.620 - 77.575)).toFixed(4));
    const lat = Number((13.120 - yRatio * (13.120 - 13.060)).toFixed(4));
    setFormData((prev) => ({ ...prev, latitude: lat, longitude: lng, pinConfirmed: true }));
  };

  const handlePhotoUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setFormError(null);
    setUploadingPhoto(true);
    try {
      const uploadedUrls: string[] = [];
      for (const rawFile of Array.from(files).slice(0, 6 - formData.photos.length)) {
        if (rawFile.size > 5 * 1024 * 1024) {
          setFormError(`Photo "${rawFile.name}" exceeds the 5 MB limit.`);
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
          setFormError(data.error || 'Failed to upload photo.');
        }
      }
      if (uploadedUrls.length > 0) {
        setFormData((prev) => ({
          ...prev,
          photos: [...prev.photos, ...uploadedUrls].slice(0, 6),
        }));
      }
    } catch {
      setFormError('Network error uploading space photos.');
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
      setFormError('Could not prepare sample photos.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleProofUpload = async (file: File | null) => {
    if (!file) return;
    setFormError(null);
    if (file.size > 5 * 1024 * 1024) {
      setFormError('Proof document exceeds the 5 MB limit.');
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
        setFormError(data.error || 'Could not upload verification document.');
      }
    } catch {
      setFormError('Failed to upload verification document.');
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
        setStatusMessage('Availability reconfirmed! Freshness indicator updated and stale penalty cleared.');
        fetchProviderData();
      } else {
        setStatusMessage(data.error || 'Failed to reconfirm availability.');
      }
    } catch {
      setStatusMessage('Failed to reconfirm availability.');
    }
  };

  const handleSaveListing = async (asDraft: boolean) => {
    setFormError(null);

    if (!formData.title.trim() || !formData.address.trim()) {
      setFormError('Listing title and street address are required.');
      setWizardStep(1);
      return;
    }
    const cap = Number(formData.totalCapacity);
    if (!Number.isInteger(cap) || cap < 1) {
      setFormError('Capacity must be a whole number of at least 1 vehicle.');
      setWizardStep(2);
      return;
    }
    if (!formData.hourlyRate || Number(formData.hourlyRate) <= 0) {
      setFormError('Enter a valid hourly rate in ₹.');
      setWizardStep(3);
      return;
    }
    if (!asDraft && formData.photos.length < 3) {
      setFormError('Please upload at least 3 photos of the parking space before submitting.');
      setWizardStep(4);
      return;
    }
    if (!asDraft && !formData.docFileName) {
      setFormError('Please upload your right-to-rent verification proof before submitting.');
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
        setFormError(data.error || 'Could not save listing.');
      } else {
        setStatusMessage(data.message);
        setShowAddWizard(false);
        setEditingListingId(null);
        fetchProviderData();
      }
    } catch {
      setFormError('Network error saving listing.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Capability Gate Views (PRD Section 6.6: unauthenticated 401 or non-provider 403)
  if (!loading && authStateError === 'UNAUTH') {
    return (
      <div className="max-w-3xl mx-auto px-4 py-14 text-center space-y-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#0A5CFF] flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-black text-slate-900">Sign in to manage your parking spaces</h1>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Use one VPark phone OTP account to list spaces, upload verification documents, and track reservations.
          </p>
          {onRequireAuth && (
            <button
              type="button"
              onClick={onRequireAuth}
              className="px-6 py-3 rounded-xl bg-[#0A5CFF] hover:bg-[#0046D5] text-white font-bold text-sm shadow-md"
            >
              Sign in with Phone OTP
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!loading && authStateError === 'NO_CAPABILITY') {
    return (
      <div className="max-w-3xl mx-auto px-4 py-14 text-center space-y-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#0A5CFF] flex items-center justify-center mx-auto">
            <Building2 className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-black text-slate-900">Turn on Host mode in one click</h1>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Your VPark account is currently active for Driver parking only. Add the Host capability without re-entering your personal information.
          </p>
          {onEnableProvider && (
            <button
              type="button"
              onClick={onEnableProvider}
              className="px-6 py-3 rounded-xl bg-[#0A5CFF] hover:bg-[#0046D5] text-white font-bold text-sm shadow-md"
            >
              Enable Host Mode & Rent Your Space
            </button>
          )}
        </div>
      </div>
    );
  }

  const displayName = currentUser?.name || currentUser?.phone || 'Host';
  const pinLeftPct = ((formData.longitude - 77.575) / (77.620 - 77.575)) * 100;
  const pinTopPct = ((13.120 - formData.latitude) / (13.120 - 13.060)) * 100;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Welcome Banner (PRD 7.1) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#0A5CFF] uppercase tracking-wider">
            <Building2 className="w-4 h-4" />
            <span>Host Dashboard · /owner/dashboard</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 mt-1">
            Welcome, {displayName}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Add unused driveways, gated bays, or commercial slots and keep availability confirmed.
          </p>
        </div>

        <button
          type="button"
          onClick={openNewWizard}
          className="px-5 py-3 rounded-xl bg-[#0A5CFF] hover:bg-[#0046D5] text-white font-bold text-sm shadow-md flex items-center gap-2 self-start sm:self-auto transition-all"
        >
          <PlusCircle className="w-4 h-4" />
          Add your parking space
        </button>
      </div>

      {statusMessage && (
        <div className="p-3.5 bg-blue-50 text-blue-900 text-xs font-semibold rounded-2xl border border-blue-200 flex items-center justify-between">
          <span>{statusMessage}</span>
          <button type="button" onClick={() => setStatusMessage(null)} className="text-blue-700 font-bold ml-3">
            ✕
          </button>
        </div>
      )}

      {/* Honest Summary Cards (PRD 7.1 — never invent fake bookings/earnings) */}
      {metrics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-slate-500 block font-semibold">Total listings</span>
            <span className="text-2xl font-black text-slate-900 mt-1 block">{metrics.totalListings}</span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              {metrics.draftListings} draft · {metrics.pendingListings} in review
            </span>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-slate-500 block font-semibold">Active listings</span>
            <span className="text-2xl font-black text-emerald-700 mt-1 block">{metrics.verifiedListings}</span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">Approved &amp; visible to drivers</span>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-slate-500 block font-semibold">Bookings</span>
            {metrics.totalBookingsCount > 0 ? (
              <>
                <span className="text-2xl font-black text-slate-900 mt-1 block">{metrics.totalBookingsCount}</span>
                <span className="text-[11px] text-slate-500 mt-0.5 block">
                  {metrics.activeBookingsCount} active now
                </span>
              </>
            ) : (
              <span className="text-xs font-medium text-slate-500 mt-2 block">
                Bookings will appear here once reservations open.
              </span>
            )}
          </div>

          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-slate-500 block font-semibold">Earnings</span>
            {metrics.totalEarnings > 0 ? (
              <>
                <span className="text-2xl font-black text-[#0A5CFF] mt-1 block">
                  ₹{metrics.totalEarnings.toFixed(2)}
                </span>
                <span className="text-[11px] text-slate-500 mt-0.5 block">Host gross parking fees</span>
              </>
            ) : (
              <span className="text-xs font-medium text-slate-500 mt-2 block">
                No earnings yet. Verify email before payouts begin.
              </span>
            )}
          </div>
        </div>
      )}

      {/* Listings & Activity Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-3">
          <h2 className="font-black text-slate-900 text-base">Your Parking Spaces</h2>

          {loading ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 text-xs">
              Loading your listings...
            </div>
          ) : listings.length === 0 ? (
            <div className="p-10 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 text-xs space-y-3">
              <p className="font-semibold text-slate-700 text-sm">You haven&apos;t added a parking space yet.</p>
              <p>Start with a draft and upload 3 photos + ownership/society proof when ready.</p>
              <button
                type="button"
                onClick={openNewWizard}
                className="px-4 py-2 rounded-xl bg-[#0A5CFF] text-white font-bold text-xs"
              >
                Add your parking space
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {listings.map((l) => {
                const chip = STATUS_CHIP[l.status];
                const canEdit = l.status === 'DRAFT' || l.status === 'NEEDS_INFO' || l.status === 'REJECTED';
                return (
                  <div
                    key={l.id}
                    className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3 text-xs"
                  >
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${chip.classes}`}>
                            {chip.label}
                          </span>
                          {l.status === 'VERIFIED' && l.isStale && (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Unconfirmed &gt;30d (Demoted)
                            </span>
                          )}
                          <span className="text-slate-400 font-mono text-[11px]">
                            {l.photos.length} photos · {l.totalCapacity} {l.totalCapacity === 1 ? 'slot' : 'slots'}
                          </span>
                        </div>

                        <h3 className="font-black text-base text-slate-900">{l.title}</h3>
                        <p className="text-slate-600">{l.address}</p>
                        <p className="text-slate-500 text-[11px]">
                          ₹{l.pricing.hourlyRate}/hr
                          {l.pricing.dailyRate ? ` · ₹${l.pricing.dailyRate}/day` : ''}
                          {l.pricing.monthlyRate ? ` · ₹${l.pricing.monthlyRate}/mo` : ''} · {l.isCovered ? 'Covered' : 'Open'} · Confirmed{' '}
                          {new Date(l.lastConfirmedAt).toLocaleDateString('en-IN')}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => openEditWizard(l)}
                            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold flex items-center gap-1.5"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            Edit / Submit
                          </button>
                        )}
                        {l.status === 'VERIFIED' && (
                          <button
                            type="button"
                            onClick={() => handleReconfirm(l.id)}
                            className="px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-[#0A5CFF] font-bold border border-blue-200 flex items-center gap-1.5 transition-colors"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Reconfirm Availability
                          </button>
                        )}
                      </div>
                    </div>

                    {l.reviewReason && (l.status === 'NEEDS_INFO' || l.status === 'REJECTED' || l.status === 'SUSPENDED') && (
                      <div className="p-3 rounded-xl bg-orange-50 border border-orange-200 text-orange-900 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold block">Reviewer Note:</span>
                          <span>{l.reviewReason}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Activity & Notices (PRD 7.1) */}
        <div className="space-y-3 text-xs">
          <h2 className="font-black text-slate-900 text-base">Activity &amp; Notices</h2>
          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-sm">
            {!currentUser?.email && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1">
                <span className="font-bold block">Email needed for payouts</span>
                <span className="text-[11px] block">
                  Optional at sign-up, required before bank settlement payouts open.
                </span>
              </div>
            )}
            {listings.length === 0 ? (
              <p className="text-slate-500">
                Verification updates, admin review requests, and reconfirmation reminders will appear here.
              </p>
            ) : (
              listings.slice(0, 5).map((l) => (
                <div key={l.id} className="pb-2.5 border-b border-slate-100 last:border-b-0 last:pb-0 flex items-start gap-2">
                  <Clock className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-bold text-slate-800 block">{l.title}</span>
                    <span className="text-slate-500">
                      Status: <strong>{STATUS_CHIP[l.status].label}</strong> · Updated{' '}
                      {new Date(l.updatedAt).toLocaleDateString('en-IN')}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 4-Step Listing Creation / Edit Wizard Modal (PRD 7.2 & 7.3) */}
      {showAddWizard && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Add or edit parking space"
        >
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-mono uppercase text-blue-400 font-bold block">
                  Step {wizardStep} of 4 · {editingListingId ? 'Edit Listing' : 'Add your parking space'}
                </span>
                <h2 className="font-black text-lg">Space Details &amp; Verification</h2>
              </div>
              <button
                type="button"
                aria-label="Close wizard"
                onClick={() => setShowAddWizard(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs overflow-y-auto">
              {formError && (
                <div role="alert" className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 font-semibold">
                  {formError}
                </div>
              )}

              {/* STEP 1 */}
              {wizardStep === 1 && (
                <div className="space-y-3.5">
                  <h3 className="font-black text-slate-900 text-sm">1. Provider Situation, Type &amp; Map Pin</h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="prov-situation" className="font-bold text-slate-700 block mb-1">
                        Your Situation (PRD 7.3)
                      </label>
                      <select
                        id="prov-situation"
                        value={formData.providerSituation}
                        onChange={(e) => handleSituationChange(e.target.value as ProviderSituation)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-semibold"
                      >
                        {(Object.keys(PROVIDER_SITUATION_EVIDENCE) as ProviderSituation[]).map((key) => (
                          <option key={key} value={key}>
                            {PROVIDER_SITUATION_EVIDENCE[key].label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="space-category" className="font-bold text-slate-700 block mb-1">
                        Space Type
                      </label>
                      <select
                        id="space-category"
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value as ParkingCategory })}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-semibold"
                      >
                        <option value="PRIVATE">Residential Slot (Driveway / Stilt / Villa)</option>
                        <option value="COMMERCIAL">Commercial Lot / Complex</option>
                        <option value="OTHER">Other Authorized Space</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="listing-title" className="font-bold text-slate-700 block mb-1">
                      Space Title *
                    </label>
                    <input
                      id="listing-title"
                      type="text"
                      placeholder="e.g. Shree Nivas Covered Driveway"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="listing-address" className="font-bold text-slate-700 block mb-1">
                        Complete Address *
                      </label>
                      <input
                        id="listing-address"
                        type="text"
                        placeholder="#142, 4th Phase, Yelahanka New Town"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5"
                      />
                    </div>
                    <div>
                      <label htmlFor="listing-locality" className="font-bold text-slate-700 block mb-1">
                        Neighbourhood / Anchor
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
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-semibold"
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

                  {/* Interactive Map Pin Picker (PRD 7.2) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-700">Confirm Map Pin (Click anywhere on grid)</span>
                      <span className="font-mono text-[11px] text-[#0A5CFF] font-bold">
                        Pin: {formData.latitude.toFixed(4)}, {formData.longitude.toFixed(4)}
                      </span>
                    </div>
                    <div
                      onClick={handleMapPinClick}
                      role="application"
                      aria-label="Click to confirm parking coordinates"
                      className="relative h-36 rounded-xl border border-slate-300 bg-[#f4f6f8] overflow-hidden cursor-crosshair select-none"
                    >
                      <div className="absolute inset-0 opacity-40 bg-[radial-gradient(#94a3b8_1px,transparent_1px)] [background-size:16px_16px]" />
                      <span className="absolute top-2 left-2.5 text-[10px] font-bold text-slate-500 uppercase">
                        Yelahanka Map Grid
                      </span>
                      <div
                        style={{
                          left: `${Math.max(5, Math.min(95, pinLeftPct))}%`,
                          top: `${Math.max(8, Math.min(92, pinTopPct))}%`,
                        }}
                        className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none"
                      >
                        <div className="px-2 py-0.5 rounded-full bg-[#0A5CFF] text-white font-bold text-[10px] shadow-md flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          Exact Bay
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2 */}
              {wizardStep === 2 && (
                <div className="space-y-4">
                  <h3 className="font-black text-slate-900 text-sm">2. Capacity, Vehicles &amp; Dimensions</h3>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="total-capacity" className="font-bold text-slate-700 block mb-1">
                        Total Vehicle Capacity (Whole Number) *
                      </label>
                      <input
                        id="total-capacity"
                        type="number"
                        min={1}
                        max={200}
                        step={1}
                        value={formData.totalCapacity}
                        onChange={(e) =>
                          setFormData({ ...formData, totalCapacity: Math.max(1, parseInt(e.target.value, 10) || 1) })
                        }
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold font-mono"
                      />
                    </div>
                    <div>
                      <label htmlFor="cover-type" className="font-bold text-slate-700 block mb-1">
                        Covered or Open *
                      </label>
                      <select
                        id="cover-type"
                        value={formData.isCovered ? 'true' : 'false'}
                        onChange={(e) => setFormData({ ...formData, isCovered: e.target.value === 'true' })}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-semibold"
                      >
                        <option value="true">Covered / Basement / Stilt</option>
                        <option value="false">Open Ground / Driveway</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <span className="font-bold text-slate-700 block mb-1.5">Allowed Vehicle Types</span>
                    <div className="flex flex-wrap gap-2">
                      {ALL_VEHICLE_TYPES.map((vt) => {
                        const checked = formData.vehicleTypes.includes(vt.id);
                        return (
                          <button
                            key={vt.id}
                            type="button"
                            onClick={() => handleToggleVehicle(vt.id)}
                            className={`px-3 py-1.5 rounded-full border font-semibold transition-colors ${
                              checked
                                ? 'bg-blue-50 border-[#0A5CFF] text-[#0A5CFF]'
                                : 'bg-white border-slate-200 text-slate-600'
                            }`}
                          >
                            {checked ? '✓ ' : ''}
                            {vt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="dim-notes" className="font-bold text-slate-700 block mb-1">
                        Dimensions / Notes (Optional)
                      </label>
                      <input
                        id="dim-notes"
                        type="text"
                        placeholder="e.g. Fits SUVs up to 4.7m; straight reverse entry"
                        value={formData.dimensionsNotes}
                        onChange={(e) => setFormData({ ...formData, dimensionsNotes: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5"
                      />
                    </div>
                    <div>
                      <label htmlFor="height-clear" className="font-bold text-slate-700 block mb-1">
                        Height Clearance in meters (Optional)
                      </label>
                      <input
                        id="height-clear"
                        type="number"
                        step="0.1"
                        placeholder="e.g. 2.2"
                        value={formData.heightClearanceMeters}
                        onChange={(e) => setFormData({ ...formData, heightClearanceMeters: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-mono"
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900 block">EV Charging Point Available?</span>
                      <span className="text-[11px] text-slate-600">Attract EV commuters needing slow/7.4kW charging</span>
                    </div>
                    <input
                      type="checkbox"
                      aria-label="EV charging available"
                      checked={formData.hasEvCharging}
                      onChange={(e) => setFormData({ ...formData, hasEvCharging: e.target.checked })}
                      className="w-5 h-5 accent-[#0A5CFF] rounded"
                    />
                  </div>
                </div>
              )}

              {/* STEP 3 */}
              {wizardStep === 3 && (
                <div className="space-y-4">
                  <h3 className="font-black text-slate-900 text-sm">3. Pricing (₹) &amp; Access Instructions</h3>

                  <div className="grid grid-cols-3 gap-2 font-mono">
                    <div>
                      <label htmlFor="rate-hourly" className="font-bold text-slate-700 block mb-1">
                        Hourly (₹) *
                      </label>
                      <input
                        id="rate-hourly"
                        type="number"
                        min={10}
                        value={formData.hourlyRate}
                        onChange={(e) => setFormData({ ...formData, hourlyRate: parseInt(e.target.value, 10) || 40 })}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold"
                      />
                    </div>
                    <div>
                      <label htmlFor="rate-daily" className="font-bold text-slate-700 block mb-1">
                        Daily Optional (₹)
                      </label>
                      <input
                        id="rate-daily"
                        type="number"
                        value={formData.dailyRate}
                        onChange={(e) => setFormData({ ...formData, dailyRate: parseInt(e.target.value, 10) || 0 })}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold"
                      />
                    </div>
                    <div>
                      <label htmlFor="rate-monthly" className="font-bold text-slate-700 block mb-1">
                        Monthly Optional (₹)
                      </label>
                      <input
                        id="rate-monthly"
                        type="number"
                        value={formData.monthlyRate}
                        onChange={(e) => setFormData({ ...formData, monthlyRate: parseInt(e.target.value, 10) || 0 })}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="access-method" className="font-bold text-slate-700 block mb-1">
                      Entry Access Method
                    </label>
                    <select
                      id="access-method"
                      value={formData.accessMethod}
                      onChange={(e) => setFormData({ ...formData, accessMethod: e.target.value as AccessMethod })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-semibold"
                    >
                      <option value="GATE_GUARD">Security Guard / Gate Verification</option>
                      <option value="BOOM_BARRIER">Boom Barrier / Scanner</option>
                      <option value="LOCKBOX_KEY">Key Lockbox</option>
                      <option value="REMOTE_CALL">Call Host on Arrival</option>
                      <option value="RFID">RFID Tag</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="access-instructions" className="font-bold text-slate-700 block mb-1">
                      Driver Entry Instructions
                    </label>
                    <textarea
                      id="access-instructions"
                      rows={2}
                      value={formData.accessInstructions}
                      onChange={(e) => setFormData({ ...formData, accessInstructions: e.target.value })}
                      placeholder="e.g. Ring bell at Gate 2 or share QR pass with society watchman."
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5"
                    />
                    <span className="text-[11px] text-[#0A5CFF] mt-1 block font-medium">
                      Privacy rule: shown to drivers only after confirmed booking.
                    </span>
                  </div>

                  <div>
                    <label htmlFor="house-rules" className="font-bold text-slate-700 block mb-1">
                      House Rules (comma-separated)
                    </label>
                    <input
                      id="house-rules"
                      type="text"
                      value={formData.houseRules}
                      onChange={(e) => setFormData({ ...formData, houseRules: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5"
                    />
                  </div>
                </div>
              )}

              {/* STEP 4: Photos (Min 3, EXIF stripped) & Right-to-Rent Proof */}
              {wizardStep === 4 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-black text-slate-900 text-sm">
                      4. Space Photos (Min 3, EXIF Stripped) &amp; Verification Proof
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Required evidence for <strong>{PROVIDER_SITUATION_EVIDENCE[formData.providerSituation].label}</strong>:{' '}
                      {PROVIDER_SITUATION_EVIDENCE[formData.providerSituation].requirement}.
                    </p>
                  </div>

                  {/* Photos Uploader */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="font-bold text-slate-800">
                        Space Photos ({formData.photos.length}/3 minimum required)
                      </span>
                      <div className="flex gap-2">
                        <input
                          ref={photoInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          multiple
                          className="hidden"
                          onChange={(e) => handlePhotoUpload(e.target.files)}
                        />
                        <button
                          type="button"
                          disabled={uploadingPhoto}
                          onClick={() => photoInputRef.current?.click()}
                          className="px-3 py-1.5 rounded-lg bg-[#0A5CFF] text-white font-bold flex items-center gap-1"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          {uploadingPhoto ? 'Uploading...' : 'Upload Photos'}
                        </button>
                        {formData.photos.length < 3 && (
                          <button
                            type="button"
                            disabled={uploadingPhoto}
                            onClick={handleGenerateSamplePhotos}
                            className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 font-semibold hover:bg-slate-100"
                          >
                            + Add 3 Test Photos
                          </button>
                        )}
                      </div>
                    </div>

                    {formData.photos.length > 0 ? (
                      <div className="grid grid-cols-3 gap-2">
                        {formData.photos.map((url, idx) => (
                          <div key={idx} className="relative h-24 rounded-xl overflow-hidden border border-slate-200 bg-white">
                            <img src={url} alt={`Space photo ${idx + 1}`} className="w-full h-full object-cover" />
                            <button
                              type="button"
                              aria-label="Remove photo"
                              onClick={() =>
                                setFormData((prev) => ({
                                  ...prev,
                                  photos: prev.photos.filter((_, i) => i !== idx),
                                }))
                              }
                              className="absolute top-1 right-1 p-1 rounded-full bg-slate-900/75 text-white hover:bg-red-600"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-500">
                        Upload clear entrance, parking bay, and lane approach photos (JPEG/PNG/WebP, max 5 MB each; GPS EXIF removed automatically).
                      </p>
                    )}
                  </div>

                  {/* Private Verification Proof Upload */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <span className="font-bold text-slate-800 block">
                          Proof of Right to Rent (Private &amp; Audit-Logged)
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Document type: <strong>{formData.docType.replace(/_/g, ' ')}</strong>
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <input
                          ref={proofInputRef}
                          type="file"
                          accept=".pdf,image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={(e) => handleProofUpload(e.target.files?.[0] || null)}
                        />
                        <button
                          type="button"
                          disabled={uploadingProof}
                          onClick={() => proofInputRef.current?.click()}
                          className="px-3 py-1.5 rounded-lg bg-slate-900 text-white font-bold flex items-center gap-1"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          {uploadingProof ? 'Uploading...' : 'Select Document'}
                        </button>
                        {!formData.docFileName && (
                          <button
                            type="button"
                            disabled={uploadingProof}
                            onClick={handleGenerateSampleProof}
                            className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 font-semibold hover:bg-slate-100"
                          >
                            Attach Sample PDF
                          </button>
                        )}
                      </div>
                    </div>

                    {formData.docFileName ? (
                      <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-2 font-mono text-[11px]">
                        <FileText className="w-4 h-4 text-emerald-600" />
                        <span>Uploaded to private storage: {formData.docFileName}</span>
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-500">
                        Stored outside public web directories; only accessible to authorized trust reviewers.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Footer Nav & Save Draft / Submit */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  {wizardStep > 1 && (
                    <button
                      type="button"
                      onClick={() => setWizardStep(wizardStep - 1)}
                      className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold flex items-center gap-1"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      Back
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleSaveListing(true)}
                    className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-800 font-bold"
                  >
                    Save as Draft
                  </button>
                </div>

                {wizardStep < 4 ? (
                  <button
                    type="button"
                    onClick={() => setWizardStep(wizardStep + 1)}
                    className="px-5 py-2 rounded-xl bg-[#0A5CFF] hover:bg-[#0046D5] text-white font-bold flex items-center gap-1 shadow-md"
                  >
                    Next Step
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleSaveListing(false)}
                    className="px-5 py-2.5 rounded-xl bg-[#0A5CFF] hover:bg-[#0046D5] disabled:opacity-60 text-white font-bold flex items-center gap-1.5 shadow-md"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {isSubmitting ? 'Submitting...' : 'Submit for Verification'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
