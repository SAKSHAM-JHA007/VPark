// Domain types aligned with VPARK PRD v2.2 (Foundation Release)

export type UserRole = 'DRIVER' | 'PROVIDER' | 'ADMIN';

export type ProviderType = 'OWNER' | 'OPERATOR' | 'MANAGER';

export type ProviderSituation =
  | 'HOUSE_OWNER'
  | 'TENANT'
  | 'APARTMENT_RESIDENT'
  | 'BUSINESS_OPERATOR'
  | 'MANAGER';

export type AccountStatus = 'ACTIVE' | 'SUSPENDED' | 'DELETION_PENDING';

export type ParkingCategory = 'PRIVATE' | 'COMMERCIAL' | 'OTHER' | 'PUBLIC';

export type ListingStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'NEEDS_INFO'
  | 'VERIFIED'
  | 'REJECTED'
  | 'SUSPENDED';

export type AvailabilityConfidence = 'PROVIDER_MANAGED' | 'BOOKED_ON_VPARK' | 'BOOKED_ON_PARKORA' | 'UNCONFIRMED';

export type BookingStatus =
  | 'PENDING_PAYMENT'
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'COMPLETED'
  | 'CANCELLED_BY_DRIVER'
  | 'CANCELLED_BY_PROVIDER'
  | 'NO_SHOW'
  | 'OVERSTAY'
  | 'DISPUTED'
  | 'EXPIRED';

export type VehicleType = 'TWO_WHEELER' | 'HATCHBACK' | 'SEDAN' | 'SUV' | 'EV';

export type AccessMethod = 'GATE_GUARD' | 'REMOTE_CALL' | 'LOCKBOX_KEY' | 'QR_SCAN' | 'BOOM_BARRIER';

export type PaymentMethod = 'UPI' | 'CARD' | 'NETBANKING';

export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';

export type DisputeStatus = 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'DISMISSED';

export interface Vehicle {
  id: string;
  userId: string;
  type: VehicleType;
  makeModel: string;
  plateNumber: string;
  isEv: boolean;
  isDefault?: boolean;
  deletedAt?: string | null;
}

export interface RoleDefinition {
  id: string;
  roleName: UserRole;
}

export interface UserRoleGrant {
  userId: string;
  roleId: string;
  roleName: UserRole;
  grantedAt: string;
  grantedBy: string;
}

export interface ProviderProfile {
  userId: string;
  providerType: ProviderType;
  providerSituation?: ProviderSituation;
  displayName: string;
  businessName?: string;
}

export interface DriverProfile {
  userId: string;
  preferences?: {
    preferredLocality?: string;
    needsEv?: boolean;
  };
}

export interface ConsentRecord {
  id: string;
  userId: string;
  documentType: 'TERMS_OF_SERVICE' | 'PRIVACY_POLICY' | 'PROVIDER_TERMS';
  documentVersion: string;
  acceptedAt: string;
  ipAddress: string;
  userAgent: string;
}

export interface OtpChallenge {
  id: string;
  phone?: string; // E.164 e.g. +919876543210
  email?: string; // e.g. driver@vpark.in
  codeHash: string;
  purpose: 'SIGNUP' | 'LOGIN' | 'RECOVERY';
  expiresAt: string;
  attempts: number;
  consumedAt: string | null;
  createdAt: string;
}

export interface User {
  id: string;
  phone: string; // E.164 form
  name: string;
  email?: string;
  roles: UserRole[]; // Derived from user_roles join records
  activeRole: UserRole;
  providerType?: ProviderType;
  // Timestamps instead of booleans per PRD v2.2 Section 9.1
  phoneVerifiedAt?: string | null;
  emailVerifiedAt?: string | null;
  isPhoneVerified: boolean;
  accountStatus: AccountStatus;
  lastLoginAt?: string | null;
  deletedAt?: string | null;
  avatarUrl?: string;
  vehicles: Vehicle[];
  createdAt: string;
  updatedAt?: string;
}

export interface SlotCapacity {
  twoWheeler: number;
  hatchback: number;
  sedan: number;
  suv: number;
  ev: number;
}

export interface PricingRule {
  // Integer paise storage per PRD v2.2 Section 9.2 (1 INR = 100 paise)
  hourlyRatePaise?: number;
  dailyRatePaise?: number;
  monthlyRatePaise?: number;
  // INR convenience projections derived from paise
  hourlyRate: number;
  dailyRate: number;
  monthlyRate?: number;
  currency: 'INR';
}

export interface OperatingHours {
  is24x7: boolean;
  openTime?: string; // "08:00"
  closeTime?: string; // "22:00"
  daysOfWeek: number[]; // 0=Sunday, 1=Monday... 6=Saturday
}

export interface ProviderDocument {
  id: string;
  listingId: string;
  providerId: string;
  docType: 'SALE_DEED' | 'TAX_RECEIPT' | 'TENANCY_AGREEMENT' | 'SOCIETY_NOC' | 'TRADE_LICENSE' | 'POWER_OF_ATTORNEY' | 'ID_PROOF';
  fileName: string;
  fileUrl: string;
  storageKey?: string;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED';
  rejectionReason?: string;
  uploadedAt: string;
  verifiedAt?: string;
  verifiedBy?: string;
}

export interface ListingVerification {
  id: string;
  listingId: string;
  status: ListingStatus;
  reviewerId: string;
  reason?: string;
  reviewedAt: string;
  evidenceDocIds: string[];
}

export interface Listing {
  id: string;
  title: string;
  description: string;
  providerId: string;
  providerName: string;
  providerType: ProviderType;
  providerSituation?: ProviderSituation;
  category: ParkingCategory;
  status: ListingStatus;

  // Location
  address: string;
  locality: string;
  city: string; // "Bengaluru"
  latitude: number;
  longitude: number;
  landmark: string;

  // Capacity and dimensions
  totalCapacity: number;
  vehicleTypes?: VehicleType[];
  capacityBreakdown: SlotCapacity;
  isCovered: boolean;
  heightClearanceMeters?: number;
  dimensionsNotes?: string;
  hasEvCharging: boolean;
  evChargerType?: string;

  // Pricing and access
  pricing: PricingRule;
  accessMethod: AccessMethod;
  accessInstructions: string;
  houseRules: string[];
  photos: string[];

  // Availability & Freshness
  operatingHours: OperatingHours;
  availabilityConfidence: AvailabilityConfidence;
  lastConfirmedAt: string; // Date of provider confirmation
  isStale: boolean; // True if > 30 days since confirmation
  surveyDate?: string; // For PUBLIC listings: "Surveyed on 15 Oct 2026"
  isBookable: boolean; // False for Public listings

  // Review workflow metadata
  submittedAt?: string;
  approvedAt?: string;
  reviewReason?: string;
  deletedAt?: string | null;

  // Metrics & Trust
  rating: number; // 0 to 5.0
  reviewCount: number;
  createdAt: string;
  updatedAt: string;

  // Documents (restricted to provider and admin; stripped in driver search results)
  documents?: ProviderDocument[];
}

export interface SlotHold {
  id: string;
  listingId: string;
  userId: string;
  vehicleType: VehicleType;
  startTime: string; // ISO string
  endTime: string; // ISO string
  expiresAt: string; // 10 minutes from hold creation
  createdAt: string;
}

export interface PriceBreakdown {
  durationHours: number;
  parkingFeePaise?: number;
  platformFeePaise?: number;
  cgstPaise?: number;
  sgstPaise?: number;
  totalTaxesPaise?: number;
  totalAmountPaise?: number;
  parkingFee: number;
  platformFee: number; // 12%
  cgst: number; // 9% of platform fee
  sgst: number; // 9% of platform fee
  totalTaxes: number;
  totalAmount: number;
}

export interface Booking {
  id: string;
  referenceNumber: string; // e.g. "VPK-BLR-489201"
  listingId: string;
  listingTitle: string;
  listingAddress: string;
  listingAccessInstructions?: string;
  listingLatitude?: number;
  listingLongitude?: number;
  driverId: string;
  driverName: string;
  driverPhone: string;
  providerId: string;
  providerName: string;
  providerPhoneMasked: string;

  vehicleType: VehicleType;
  vehiclePlateNumber: string;

  startTime: string; // ISO
  endTime: string; // ISO
  actualCheckInTime?: string;
  actualCheckOutTime?: string;
  checkInPhotoUrl?: string;

  status: BookingStatus;
  pricingSnapshot: PriceBreakdown;

  paymentId?: string;
  paymentMethod?: PaymentMethod;
  paymentStatus: PaymentStatus;

  cancelledAt?: string;
  cancelledBy?: 'DRIVER' | 'PROVIDER';
  cancellationReason?: string;
  refundAmount?: number;
  refundAmountPaise?: number;
  isDisputed?: boolean;
  disputeId?: string;

  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  bookingId: string;
  referenceNumber: string;
  amount: number; // in INR
  amountPaise?: number;
  currency: 'INR';
  method: PaymentMethod;
  status: PaymentStatus;
  gatewayTransactionId: string;
  gatewaySignature?: string;
  platformCommission: number;
  platformCommissionPaise?: number;
  providerEarning: number;
  providerEarningPaise?: number;
  payoutStatus: 'PENDING' | 'SCHEDULED' | 'PAID';
  reconciled: boolean;
  createdAt: string;
}

export interface Payout {
  id: string;
  providerId: string;
  amount: number;
  amountPaise?: number;
  status: 'PENDING' | 'PROCESSING' | 'SETTLED' | 'FAILED';
  periodStart: string;
  periodEnd: string;
  settledAt?: string;
  utrNumber?: string;
}

export interface Dispute {
  id: string;
  bookingId: string;
  bookingReference: string;
  raisedByUserId: string;
  raisedByRole: 'DRIVER' | 'PROVIDER';
  againstUserId: string;
  category:
    | 'SPACE_OCCUPIED'
    | 'SPACE_UNUSABLE'
    | 'HOST_UNREACHABLE'
    | 'OVERSTAY_CONFLICT'
    | 'DAMAGE_SAFETY'
    | 'PAYMENT_ISSUE';
  description: string;
  evidencePhotos: string[];
  status: DisputeStatus;
  slaDeadline: string; // Within 4 hours
  adminResolutionNotes?: string;
  refundGranted?: number;
  resolvedAt?: string;
  resolvedByAdminId?: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  action:
    | 'APPROVE_LISTING'
    | 'REJECT_LISTING'
    | 'REQUEST_LISTING_INFO'
    | 'SUSPEND_LISTING'
    | 'REINSTATE_LISTING'
    | 'SUBMIT_LISTING'
    | 'RESOLVE_DISPUTE'
    | 'TRIGGER_REFUND'
    | 'RECONFIRM_AVAILABILITY'
    | 'LOGIN_OTP'
    | 'GRANT_CAPABILITY'
    | 'CONSENT_ACCEPTED'
    | 'VIEW_VERIFICATION_DOC'
    | 'ACCOUNT_DELETION_REQUESTED'
    | 'MANUAL_OVERRIDE';
  targetType: 'LISTING' | 'BOOKING' | 'USER' | 'DISPUTE' | 'DOCUMENT' | 'CONSENT';
  targetId: string;
  details: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface Review {
  id: string;
  listingId: string;
  bookingId: string;
  driverId: string;
  driverName: string;
  rating: number; // 1 to 5
  comment: string;
  createdAt: string;
}

export interface MonthlyPass {
  id: string;
  listingId: string;
  listingTitle: string;
  driverId: string;
  driverName: string;
  vehiclePlateNumber: string;
  vehicleType: VehicleType;
  month: string; // e.g. "2026-11"
  startDate: string;
  endDate: string;
  price: number;
  pricePaise?: number;
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
  createdAt: string;
}

export interface SearchFilters {
  destination?: string;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  category?: ParkingCategory[];
  vehicleType?: VehicleType;
  maxHourlyRate?: number;
  isCovered?: boolean;
  hasEvCharging?: boolean;
  bookableNow?: boolean;
  startTime?: string;
  endTime?: string;
  sortBy?: 'BEST_MATCH' | 'PRICE_LOW' | 'DISTANCE_NEAR' | 'RATING_HIGH';
}

export interface RankingBreakdown {
  distanceKm: number;
  distanceScore: number;
  priceScore: number;
  verificationScore: number;
  confidenceScore: number;
  ratingScore: number;
  stalePenalty: number;
  totalScore: number;
}

export interface SearchResultItem {
  listing: Listing;
  distanceKm: number;
  ranking: RankingBreakdown;
  availableCapacity: number;
  activeHoldsCount: number;
}
