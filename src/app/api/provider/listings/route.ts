import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireCapability } from '@/lib/auth';
import type { ParkingCategory } from '@/types';

export const dynamic = 'force-dynamic';

const PROVIDER_CATEGORIES: ParkingCategory[] = ['PRIVATE', 'COMMERCIAL', 'OTHER'];

export async function GET(req: NextRequest) {
  const auth = await requireCapability(req, 'PROVIDER');
  if (auth.error) return auth.error;

  try {
    const userId = auth.user.id;
    const listings = db.getListingsByProvider(userId);
    const allBookings = db.getBookings().filter((b) => b.providerId === userId);

    const activeBookings = allBookings.filter((b) => b.status === 'CONFIRMED' || b.status === 'CHECKED_IN');
    const totalEarnings = allBookings.reduce(
      (sum, b) => (b.paymentStatus === 'SUCCESS' ? sum + b.pricingSnapshot.parkingFee : sum),
      0
    );

    return NextResponse.json({
      success: true,
      data: listings,
      metrics: {
        totalListings: listings.length,
        verifiedListings: listings.filter((l) => l.status === 'VERIFIED').length,
        pendingListings: listings.filter((l) => l.status === 'PENDING_REVIEW' || l.status === 'NEEDS_INFO').length,
        draftListings: listings.filter((l) => l.status === 'DRAFT').length,
        staleListings: listings.filter((l) => l.isStale).length,
        totalBookingsCount: allBookings.length,
        activeBookingsCount: activeBookings.length,
        totalEarnings,
      },
    });
  } catch (error) {
    console.error('Provider listings error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch provider listings' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireCapability(req, 'PROVIDER');
  if (auth.error) return auth.error;

  try {
    const user = auth.user;
    const body = await req.json();
    const {
      title,
      description,
      providerType,
      providerSituation,
      category,
      address,
      locality,
      latitude,
      longitude,
      landmark,
      totalCapacity,
      vehicleTypes,
      capacityBreakdown,
      isCovered,
      heightClearanceMeters,
      dimensionsNotes,
      hasEvCharging,
      evChargerType,
      pricing,
      accessMethod,
      accessInstructions,
      houseRules,
      photos,
      operatingHours,
      document,
      initialStatus,
    } = body;

    const isDraft = initialStatus === 'DRAFT';

    if (!title || !address || !pricing?.hourlyRate || Number(pricing.hourlyRate) <= 0) {
      return NextResponse.json(
        { success: false, error: 'Title, complete address, and a valid hourly rate (₹) are required.' },
        { status: 400 }
      );
    }

    // Providers list private / commercial / other spaces only. PUBLIC entries are
    // VPark-surveyed public parking whose exact location is published, so a provider
    // must not be able to opt their own (private) space into that treatment.
    if (category !== undefined && !PROVIDER_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { success: false, error: 'Space type must be PRIVATE, COMMERCIAL or OTHER.' },
        { status: 400 }
      );
    }
    if (
      (latitude !== undefined && (typeof latitude !== 'number' || !Number.isFinite(latitude) || Math.abs(latitude) > 90)) ||
      (longitude !== undefined && (typeof longitude !== 'number' || !Number.isFinite(longitude) || Math.abs(longitude) > 180))
    ) {
      return NextResponse.json({ success: false, error: 'Invalid map coordinates.' }, { status: 400 });
    }

    const cap = Number(totalCapacity);
    if (!Number.isInteger(cap) || cap < 1) {
      return NextResponse.json(
        { success: false, error: 'Capacity must be a whole number of at least 1 vehicle.' },
        { status: 400 }
      );
    }

    const photoList: string[] = Array.isArray(photos) ? photos.filter(Boolean) : [];
    if (!isDraft && photoList.length < 3) {
      return NextResponse.json(
        { success: false, error: 'Minimum 3 photos are required before submitting for verification.' },
        { status: 400 }
      );
    }

    if (!isDraft && !document?.fileName) {
      return NextResponse.json(
        { success: false, error: 'Proof of right to rent must be uploaded before submitting.' },
        { status: 400 }
      );
    }

    const selectedTypes =
      Array.isArray(vehicleTypes) && vehicleTypes.length > 0
        ? vehicleTypes
        : ['TWO_WHEELER', 'HATCHBACK', 'SEDAN', 'SUV'];

    const computedBreakdown = capacityBreakdown || {
      twoWheeler: selectedTypes.includes('TWO_WHEELER') ? cap : 0,
      hatchback: selectedTypes.includes('HATCHBACK') ? cap : 0,
      sedan: selectedTypes.includes('SEDAN') ? cap : 0,
      suv: selectedTypes.includes('SUV') ? cap : 0,
      ev: hasEvCharging || selectedTypes.includes('EV') ? cap : 0,
    };

    const docId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const newListing = db.createListing({
      title: String(title).trim(),
      description: String(description || 'Verified private parking space in Bengaluru.').trim(),
      providerId: user.id,
      providerName: user.name || user.phone,
      providerType: providerType || user.providerType || 'OWNER',
      providerSituation: providerSituation || 'HOUSE_OWNER',
      category: category || 'PRIVATE',
      address: String(address).trim(),
      locality: locality || 'Yelahanka New Town',
      city: 'Bengaluru',
      latitude: typeof latitude === 'number' ? latitude : 13.1007,
      longitude: typeof longitude === 'number' ? longitude : 77.5963,
      landmark: landmark || 'Near Yelahanka Anchor',
      totalCapacity: cap,
      vehicleTypes: selectedTypes,
      capacityBreakdown: computedBreakdown,
      isCovered: Boolean(isCovered),
      heightClearanceMeters: heightClearanceMeters ? Number(heightClearanceMeters) : undefined,
      dimensionsNotes: dimensionsNotes ? String(dimensionsNotes).trim() : undefined,
      hasEvCharging: Boolean(hasEvCharging),
      evChargerType: hasEvCharging ? evChargerType || '15A Socket' : undefined,
      pricing: {
        hourlyRate: Number(pricing.hourlyRate),
        dailyRate: pricing.dailyRate ? Number(pricing.dailyRate) : Number(pricing.hourlyRate) * 6,
        monthlyRate: pricing.monthlyRate ? Number(pricing.monthlyRate) : undefined,
        currency: 'INR',
      },
      accessMethod: accessMethod || 'GATE_GUARD',
      accessInstructions: String(accessInstructions || 'Report to security guard / host on arrival.').trim(),
      houseRules: Array.isArray(houseRules) && houseRules.length > 0 ? houseRules : ['Park within lines'],
      photos: photoList,
      operatingHours: operatingHours || { is24x7: true, daysOfWeek: [0, 1, 2, 3, 4, 5, 6] },
      availabilityConfidence: 'PROVIDER_MANAGED',
      lastConfirmedAt: new Date().toISOString(),
      isBookable: true,
      initialStatus: isDraft ? 'DRAFT' : 'PENDING_REVIEW',
      documents: document?.fileName
        ? [
            {
              id: docId,
              listingId: '',
              providerId: user.id,
              docType: document.docType || 'SALE_DEED',
              fileName: document.fileName,
              fileUrl: `/api/private-docs/${docId}`,
              // A client-chosen storage key could point at another provider's private
              // upload. Storage keys must be assigned server-side by an upload handler.
              storageKey: undefined,
              status: 'PENDING',
              uploadedAt: new Date().toISOString(),
            },
          ]
        : [],
    });

    return NextResponse.json({
      success: true,
      listing: newListing,
      message: isDraft
        ? 'Listing saved as draft. Add remaining details and submit when ready.'
        : 'Listing submitted for Admin verification. Invisible to drivers until approved.',
    });
  } catch (error) {
    console.error('Create listing error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create listing' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireCapability(req, 'PROVIDER');
  if (auth.error) return auth.error;

  try {
    const body = await req.json();
    const { id, submitForReview, ...updates } = body;
    if (!id) {
      return NextResponse.json({ success: false, error: 'Listing ID is required.' }, { status: 400 });
    }

    const existing = db.getListingById(id);
    if (!existing || existing.providerId !== auth.user.id) {
      return NextResponse.json({ success: false, error: 'Listing not found or unauthorized.' }, { status: 403 });
    }

    const photosToCheck = updates.photos || existing.photos;
    if (submitForReview && (!Array.isArray(photosToCheck) || photosToCheck.length < 3)) {
      return NextResponse.json(
        { success: false, error: 'Minimum 3 photos required before submitting for verification.' },
        { status: 400 }
      );
    }

    const result = db.updateProviderListing(id, auth.user.id, { ...updates, submitForReview });
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      listing: result.listing,
      message: submitForReview ? 'Listing submitted for Admin review!' : 'Draft updated.',
    });
  } catch (error) {
    console.error('Update listing error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update listing' }, { status: 500 });
  }
}
