import fs from 'fs';
import path from 'path';
import {
  User,
  UserRole,
  RoleDefinition,
  UserRoleGrant,
  ProviderProfile,
  DriverProfile,
  ConsentRecord,
  OtpChallenge,
  Listing,
  ListingStatus,
  ListingVerification,
  ProviderDocument,
  SlotHold,
  Booking,
  Payment,
  Payout,
  Dispute,
  AuditLog,
  Review,
  MonthlyPass,
  SearchFilters,
  SearchResultItem,
  RankingBreakdown,
  PriceBreakdown,
  BookingStatus,
  ProviderType,
  ProviderSituation,
} from '@/types';
import { APP_CONFIG, toPaise, fromPaise } from './constants';
import {
  normalizeIndianPhone,
  calculateDistance as engineCalculateDistance,
  calculatePricingPaise,
  calculateCancellationRefundPaise,
  isListingStale,
  calculateRankingScore,
} from './engine.mjs';
import { hashOtp, verifyOtpHash } from './otp-crypto.mjs';

export interface DatabaseState {
  users: User[];
  roles: RoleDefinition[];
  userRoles: UserRoleGrant[];
  providerProfiles: ProviderProfile[];
  driverProfiles: DriverProfile[];
  consents: ConsentRecord[];
  otpChallenges: OtpChallenge[];
  listings: Listing[];
  listingVerifications: ListingVerification[];
  holds: SlotHold[];
  bookings: Booking[];
  payments: Payment[];
  payouts: Payout[];
  disputes: Dispute[];
  auditLogs: AuditLog[];
  reviews: Review[];
  monthlyPasses: MonthlyPass[];
}

const DATA_DIR = path.join(process.cwd(), '.data');
const PRIVATE_UPLOADS_DIR = path.join(DATA_DIR, 'private_uploads');
const DB_FILE = path.join(DATA_DIR, 'vpark_database.json');

export const calculateDistance = engineCalculateDistance;

function withPaisePricing(hourlyInr: number, dailyInr: number, monthlyInr?: number) {
  return {
    hourlyRatePaise: toPaise(hourlyInr),
    dailyRatePaise: toPaise(dailyInr),
    monthlyRatePaise: monthlyInr !== undefined ? toPaise(monthlyInr) : undefined,
    hourlyRate: hourlyInr,
    dailyRate: dailyInr,
    monthlyRate: monthlyInr,
    currency: 'INR' as const,
  };
}

// Initial Seed Data aligned with PRD v2.2 Section 9
function getSeedData(): DatabaseState {
  const now = new Date();
  const past40Days = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000).toISOString();
  const recentConfirmed = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const yesterday = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString();

  const roles: RoleDefinition[] = [
    { id: 'role_driver', roleName: 'DRIVER' },
    { id: 'role_provider', roleName: 'PROVIDER' },
    { id: 'role_admin', roleName: 'ADMIN' },
  ];

  const users: User[] = [
    {
      id: 'usr_driver_1',
      phone: '+919876543210',
      name: 'Rajesh Kumar',
      email: 'rajesh.kumar@example.com',
      roles: ['DRIVER'],
      activeRole: 'DRIVER',
      phoneVerifiedAt: yesterday,
      emailVerifiedAt: yesterday,
      isPhoneVerified: true,
      accountStatus: 'ACTIVE',
      lastLoginAt: yesterday,
      deletedAt: null,
      createdAt: yesterday,
      vehicles: [
        {
          id: 'veh_1',
          userId: 'usr_driver_1',
          type: 'SEDAN',
          makeModel: 'Honda City ZX',
          plateNumber: 'KA-04-MB-1234',
          isEv: false,
          isDefault: true,
        },
        {
          id: 'veh_2',
          userId: 'usr_driver_1',
          type: 'EV',
          makeModel: 'Tata Nexon EV Max',
          plateNumber: 'KA-51-EV-9021',
          isEv: true,
          isDefault: false,
        },
      ],
    },
    {
      id: 'usr_owner_1',
      phone: '+919888811223',
      name: 'Suresh Sharma',
      email: 'suresh.sharma@example.com',
      roles: ['DRIVER', 'PROVIDER'],
      activeRole: 'PROVIDER',
      providerType: 'OWNER',
      phoneVerifiedAt: past40Days,
      emailVerifiedAt: past40Days,
      isPhoneVerified: true,
      accountStatus: 'ACTIVE',
      lastLoginAt: recentConfirmed,
      deletedAt: null,
      createdAt: past40Days,
      vehicles: [
        {
          id: 'veh_3',
          userId: 'usr_owner_1',
          type: 'SUV',
          makeModel: 'Hyundai Creta',
          plateNumber: 'KA-04-JJ-8877',
          isEv: false,
          isDefault: true,
        },
      ],
    },
    {
      id: 'usr_owner_2',
      phone: '+919811122334',
      name: 'Ananya Swaminathan',
      email: 'ananya.s@example.com',
      roles: ['PROVIDER'],
      activeRole: 'PROVIDER',
      providerType: 'OWNER',
      phoneVerifiedAt: past40Days,
      emailVerifiedAt: past40Days,
      isPhoneVerified: true,
      accountStatus: 'ACTIVE',
      lastLoginAt: recentConfirmed,
      deletedAt: null,
      createdAt: past40Days,
      vehicles: [],
    },
    {
      id: 'usr_operator_1',
      phone: '+919777744556',
      name: 'Apex Smart Parking Operators',
      email: 'ops@apexparking.in',
      roles: ['PROVIDER'],
      activeRole: 'PROVIDER',
      providerType: 'OPERATOR',
      phoneVerifiedAt: past40Days,
      emailVerifiedAt: past40Days,
      isPhoneVerified: true,
      accountStatus: 'ACTIVE',
      lastLoginAt: recentConfirmed,
      deletedAt: null,
      createdAt: past40Days,
      vehicles: [],
    },
    {
      id: 'usr_admin_1',
      phone: '+919900000001',
      name: 'Vikram Rao (Trust & Safety Admin)',
      email: 'admin@vpark.in',
      roles: ['ADMIN', 'DRIVER', 'PROVIDER'],
      activeRole: 'ADMIN',
      phoneVerifiedAt: past40Days,
      emailVerifiedAt: past40Days,
      isPhoneVerified: true,
      accountStatus: 'ACTIVE',
      lastLoginAt: recentConfirmed,
      deletedAt: null,
      createdAt: past40Days,
      vehicles: [],
    },
  ];

  const userRoles: UserRoleGrant[] = [
    { userId: 'usr_driver_1', roleId: 'role_driver', roleName: 'DRIVER', grantedAt: yesterday, grantedBy: 'SIGNUP' },
    { userId: 'usr_owner_1', roleId: 'role_driver', roleName: 'DRIVER', grantedAt: past40Days, grantedBy: 'SIGNUP' },
    { userId: 'usr_owner_1', roleId: 'role_provider', roleName: 'PROVIDER', grantedAt: past40Days, grantedBy: 'SIGNUP' },
    { userId: 'usr_owner_2', roleId: 'role_provider', roleName: 'PROVIDER', grantedAt: past40Days, grantedBy: 'SIGNUP' },
    { userId: 'usr_operator_1', roleId: 'role_provider', roleName: 'PROVIDER', grantedAt: past40Days, grantedBy: 'SIGNUP' },
    { userId: 'usr_admin_1', roleId: 'role_admin', roleName: 'ADMIN', grantedAt: past40Days, grantedBy: 'SYSTEM_SEED' },
    { userId: 'usr_admin_1', roleId: 'role_driver', roleName: 'DRIVER', grantedAt: past40Days, grantedBy: 'SYSTEM_SEED' },
    { userId: 'usr_admin_1', roleId: 'role_provider', roleName: 'PROVIDER', grantedAt: past40Days, grantedBy: 'SYSTEM_SEED' },
  ];

  const providerProfiles: ProviderProfile[] = [
    { userId: 'usr_owner_1', providerType: 'OWNER', providerSituation: 'HOUSE_OWNER', displayName: 'Suresh Sharma' },
    { userId: 'usr_owner_2', providerType: 'OWNER', providerSituation: 'APARTMENT_RESIDENT', displayName: 'Ananya Swaminathan' },
    { userId: 'usr_operator_1', providerType: 'OPERATOR', providerSituation: 'BUSINESS_OPERATOR', displayName: 'Apex Smart Parking', businessName: 'Apex Smart Parking Operators' },
  ];

  const driverProfiles: DriverProfile[] = [
    { userId: 'usr_driver_1', preferences: { preferredLocality: 'Yelahanka New Town', needsEv: false } },
    { userId: 'usr_owner_1', preferences: { preferredLocality: 'Yelahanka New Town' } },
  ];

  const consents: ConsentRecord[] = users.map((u, idx) => ({
    id: `cons_seed_${idx + 1}`,
    userId: u.id,
    documentType: 'TERMS_OF_SERVICE',
    documentVersion: APP_CONFIG.legalDocVersions.terms,
    acceptedAt: u.createdAt,
    ipAddress: '127.0.0.1',
    userAgent: 'VPark-Seed/2.2',
  }));

  const listings: Listing[] = [
    // 1. Private: Shree Nivas Driveway (Mother Dairy anchor)
    {
      id: 'lst_1',
      title: 'Shree Nivas Covered Driveway & Portico',
      description: 'Private 2-slot driveway with full CCTV coverage, 24/7 security guard, and easy ramp access. 3 minutes walk from Mother Dairy Circle.',
      providerId: 'usr_owner_1',
      providerName: 'Suresh Sharma',
      providerType: 'OWNER',
      providerSituation: 'HOUSE_OWNER',
      category: 'PRIVATE',
      status: 'VERIFIED',
      address: '#142, 4th Phase, Near Mother Dairy Circle',
      locality: 'Yelahanka New Town',
      city: 'Bengaluru',
      latitude: 13.0995,
      longitude: 77.5968,
      landmark: 'Opposite New Town Park',
      totalCapacity: 2,
      vehicleTypes: ['TWO_WHEELER', 'HATCHBACK', 'SEDAN', 'SUV', 'EV'],
      capacityBreakdown: { twoWheeler: 2, hatchback: 2, sedan: 2, suv: 1, ev: 1 },
      isCovered: true,
      heightClearanceMeters: 2.3,
      dimensionsNotes: '2.3m canopy height, 5.2m length. Comfortably fits compact SUVs and sedans.',
      hasEvCharging: true,
      evChargerType: '15A 3-Pin Socket',
      pricing: withPaisePricing(40, 250, 2800),
      accessMethod: 'GATE_GUARD',
      accessInstructions: 'Tell security guard at gate you have a VPark reservation. Park in Bay A1 or A2.',
      houseRules: ['Reverse park only', 'No engine idling', 'Lock car before leaving'],
      photos: [
        'https://images.unsplash.com/photo-1590674899484-d5640e854abe?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1573348722427-f1d6819fdf98?w=800&auto=format&fit=crop&q=80',
      ],
      operatingHours: { is24x7: true, daysOfWeek: [0, 1, 2, 3, 4, 5, 6] },
      availabilityConfidence: 'PROVIDER_MANAGED',
      lastConfirmedAt: recentConfirmed,
      approvedAt: past40Days,
      isStale: false,
      isBookable: true,
      rating: 4.9,
      reviewCount: 38,
      createdAt: past40Days,
      updatedAt: recentConfirmed,
      documents: [
        {
          id: 'doc_1',
          listingId: 'lst_1',
          providerId: 'usr_owner_1',
          docType: 'SALE_DEED',
          fileName: 'property_tax_receipt_2026.pdf',
          fileUrl: '/api/private-docs/doc_1',
          status: 'VERIFIED',
          uploadedAt: past40Days,
          verifiedAt: past40Days,
          verifiedBy: 'usr_admin_1',
        },
      ],
    },
    // 2. Private: Sobha Emerald Gated Bay
    {
      id: 'lst_2',
      title: 'Sobha Emerald Dedicated Basement Bay',
      description: 'Covered basement slot in premium gated society. RWA Association NOC on file. Level 2 EV charging ready.',
      providerId: 'usr_owner_2',
      providerName: 'Ananya Swaminathan',
      providerType: 'OWNER',
      providerSituation: 'APARTMENT_RESIDENT',
      category: 'PRIVATE',
      status: 'VERIFIED',
      address: 'Slot B-44, Sobha Emerald, Major Sandeep Unnikrishnan Rd',
      locality: 'Yelahanka New Town',
      city: 'Bengaluru',
      latitude: 13.1012,
      longitude: 77.5954,
      landmark: 'Near Major Sandeep Unnikrishnan Statue',
      totalCapacity: 1,
      vehicleTypes: ['TWO_WHEELER', 'HATCHBACK', 'SEDAN', 'SUV', 'EV'],
      capacityBreakdown: { twoWheeler: 1, hatchback: 1, sedan: 1, suv: 1, ev: 1 },
      isCovered: true,
      heightClearanceMeters: 2.1,
      dimensionsNotes: '2.1m basement beam height. Pillar-protected single bay B-44.',
      hasEvCharging: true,
      evChargerType: '7.4kW Type 2 AC',
      pricing: withPaisePricing(50, 320, 3500),
      accessMethod: 'BOOM_BARRIER',
      accessInstructions: 'Show VPark QR code to society intercom guard. Guard will raise boom barrier for Basement 1.',
      houseRules: ['Designated slot B-44 only', 'Strict 10 km/h speed limit inside complex', 'No horn blowing'],
      photos: [
        'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1621929747188-0b4dc28498d2?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1590674899484-d5640e854abe?w=800&auto=format&fit=crop&q=80',
      ],
      operatingHours: { is24x7: false, openTime: '06:00', closeTime: '23:00', daysOfWeek: [0, 1, 2, 3, 4, 5, 6] },
      availabilityConfidence: 'PROVIDER_MANAGED',
      lastConfirmedAt: recentConfirmed,
      approvedAt: past40Days,
      isStale: false,
      isBookable: true,
      rating: 4.8,
      reviewCount: 24,
      createdAt: past40Days,
      updatedAt: recentConfirmed,
      documents: [
        {
          id: 'doc_2',
          listingId: 'lst_2',
          providerId: 'usr_owner_2',
          docType: 'SOCIETY_NOC',
          fileName: 'sobha_emerald_association_noc.pdf',
          fileUrl: '/api/private-docs/doc_2',
          status: 'VERIFIED',
          uploadedAt: past40Days,
          verifiedAt: past40Days,
          verifiedBy: 'usr_admin_1',
        },
      ],
    },
    // 3. Commercial: RMZ Galleria Mall Multi-Level Deck
    {
      id: 'lst_3',
      title: 'RMZ Galleria Mall Express Reserved Deck',
      description: 'Official partner parking with guaranteed reserved bays on Level P2. Rapid access via automated license plate recognition or QR scanner.',
      providerId: 'usr_operator_1',
      providerName: 'Apex Smart Parking Operators',
      providerType: 'OPERATOR',
      providerSituation: 'BUSINESS_OPERATOR',
      category: 'COMMERCIAL',
      status: 'VERIFIED',
      address: 'Level P2, RMZ Galleria Mall, BBMP Office Road',
      locality: 'Yelahanka Old Town',
      city: 'Bengaluru',
      latitude: 13.1042,
      longitude: 77.5931,
      landmark: 'Next to Yelahanka Traffic Police Station',
      totalCapacity: 30,
      vehicleTypes: ['TWO_WHEELER', 'HATCHBACK', 'SEDAN', 'SUV', 'EV'],
      capacityBreakdown: { twoWheeler: 15, hatchback: 10, sedan: 10, suv: 8, ev: 5 },
      isCovered: true,
      heightClearanceMeters: 2.4,
      dimensionsNotes: 'Standard multi-level commercial deck with wide turning radius.',
      hasEvCharging: true,
      evChargerType: '22kW Fast DC & Type 2 AC',
      pricing: withPaisePricing(60, 400, 4500),
      accessMethod: 'QR_SCAN',
      accessInstructions: 'Drive to Entry Lane 2 marked "VPark Reserved". Scan QR from your booking pass at the kiosk.',
      houseRules: ['Retain parking ticket as secondary pass', 'EV bays reserved for active charging only'],
      photos: [
        'https://images.unsplash.com/photo-1573348722427-f1d6819fdf98?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1590674899484-d5640e854abe?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?w=800&auto=format&fit=crop&q=80',
      ],
      operatingHours: { is24x7: false, openTime: '08:00', closeTime: '23:30', daysOfWeek: [0, 1, 2, 3, 4, 5, 6] },
      availabilityConfidence: 'BOOKED_ON_VPARK',
      lastConfirmedAt: recentConfirmed,
      approvedAt: past40Days,
      isStale: false,
      isBookable: true,
      rating: 4.7,
      reviewCount: 92,
      createdAt: past40Days,
      updatedAt: recentConfirmed,
    },
    // 4. Commercial: Aster CMI Hospital Visitor & Doctor Annex Lot
    {
      id: 'lst_4',
      title: 'Aster CMI Corridor Visitor & Clinic Parking',
      description: 'Dedicated reserved spaces adjacent to Aster CMI Hospital emergency wing. Clean, paved, staffed with round-the-clock attendants.',
      providerId: 'usr_operator_1',
      providerName: 'Apex Smart Parking Operators',
      providerType: 'OPERATOR',
      providerSituation: 'BUSINESS_OPERATOR',
      category: 'COMMERCIAL',
      status: 'VERIFIED',
      address: 'NH 44 Service Road, Sahakar Nagar Corridor',
      locality: 'Hebbal / Sahakar Nagar',
      city: 'Bengaluru',
      latitude: 13.0588,
      longitude: 77.5928,
      landmark: '200m from Aster CMI Hospital Main Gate',
      totalCapacity: 25,
      vehicleTypes: ['TWO_WHEELER', 'HATCHBACK', 'SEDAN', 'SUV', 'EV'],
      capacityBreakdown: { twoWheeler: 10, hatchback: 8, sedan: 8, suv: 5, ev: 4 },
      isCovered: true,
      heightClearanceMeters: 2.5,
      hasEvCharging: true,
      evChargerType: 'Type 2 11kW',
      pricing: withPaisePricing(60, 450, 4800),
      accessMethod: 'GATE_GUARD',
      accessInstructions: 'Show active booking to the supervisor at the entrance booth.',
      houseRules: ['Emergency lane must remain clear', 'No unattended hazardous materials'],
      photos: [
        'https://images.unsplash.com/photo-1621929747188-0b4dc28498d2?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1590674899484-d5640e854abe?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1573348722427-f1d6819fdf98?w=800&auto=format&fit=crop&q=80',
      ],
      operatingHours: { is24x7: true, daysOfWeek: [0, 1, 2, 3, 4, 5, 6] },
      availabilityConfidence: 'PROVIDER_MANAGED',
      lastConfirmedAt: recentConfirmed,
      approvedAt: past40Days,
      isStale: false,
      isBookable: true,
      rating: 4.9,
      reviewCount: 65,
      createdAt: past40Days,
      updatedAt: recentConfirmed,
    },
    // 5. Private: RWF West Gate Commuter Portico
    {
      id: 'lst_5',
      title: 'Rail Wheel Factory Commuter Portico',
      description: 'Secure, gated private home slot right across from the Rail Wheel Factory West Gate. Ideal for engineers, contractors, and visitors.',
      providerId: 'usr_owner_1',
      providerName: 'Suresh Sharma',
      providerType: 'OWNER',
      providerSituation: 'HOUSE_OWNER',
      category: 'PRIVATE',
      status: 'VERIFIED',
      address: '#28, Factory Layout, Near RWF West Gate',
      locality: 'Yelahanka West',
      city: 'Bengaluru',
      latitude: 13.1118,
      longitude: 77.5852,
      landmark: 'Behind Technical Training Center',
      totalCapacity: 3,
      vehicleTypes: ['TWO_WHEELER', 'HATCHBACK', 'SEDAN', 'SUV'],
      capacityBreakdown: { twoWheeler: 4, hatchback: 2, sedan: 2, suv: 1, ev: 0 },
      isCovered: true,
      heightClearanceMeters: 2.2,
      hasEvCharging: false,
      pricing: withPaisePricing(35, 220, 2400),
      accessMethod: 'REMOTE_CALL',
      accessInstructions: 'Call host on VPark relay phone when arriving; host will open the electric sliding gate.',
      houseRules: ['Quiet residential area; no loud music', 'Park nose-in'],
      photos: [
        'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1590674899484-d5640e854abe?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1573348722427-f1d6819fdf98?w=800&auto=format&fit=crop&q=80',
      ],
      operatingHours: { is24x7: false, openTime: '07:00', closeTime: '21:00', daysOfWeek: [1, 2, 3, 4, 5, 6] },
      availabilityConfidence: 'PROVIDER_MANAGED',
      lastConfirmedAt: recentConfirmed,
      approvedAt: past40Days,
      isStale: false,
      isBookable: true,
      rating: 4.9,
      reviewCount: 19,
      createdAt: past40Days,
      updatedAt: recentConfirmed,
    },
    // 6. Private: Yelahanka Junction Station Link Driveway
    {
      id: 'lst_6',
      title: 'Yelahanka Junction Station Link Driveway',
      description: 'Walking distance (180 meters) from Yelahanka Junction Railway Station Platform 1. Fenced perimeter with floodlights.',
      providerId: 'usr_owner_2',
      providerName: 'Ananya Swaminathan',
      providerType: 'OWNER',
      providerSituation: 'HOUSE_OWNER',
      category: 'PRIVATE',
      status: 'VERIFIED',
      address: '#19, Railway Colony Main Road',
      locality: 'Yelahanka Station Area',
      city: 'Bengaluru',
      latitude: 13.1022,
      longitude: 77.6006,
      landmark: 'Opposite Railway High School',
      totalCapacity: 4,
      vehicleTypes: ['TWO_WHEELER', 'HATCHBACK', 'SEDAN', 'SUV', 'EV'],
      capacityBreakdown: { twoWheeler: 5, hatchback: 3, sedan: 2, suv: 1, ev: 1 },
      isCovered: false,
      heightClearanceMeters: 3.0,
      hasEvCharging: true,
      evChargerType: '15A Socket',
      pricing: withPaisePricing(35, 200, 2500),
      accessMethod: 'LOCKBOX_KEY',
      accessInstructions: 'Lockbox code sent on booking confirmation. Take key, open padlock, park, and return key to lockbox.',
      houseRules: ['Always re-lock chain after parking', 'Do not block pedestrian gate'],
      photos: [
        'https://images.unsplash.com/photo-1590674899484-d5640e854abe?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1573348722427-f1d6819fdf98?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?w=800&auto=format&fit=crop&q=80',
      ],
      operatingHours: { is24x7: true, daysOfWeek: [0, 1, 2, 3, 4, 5, 6] },
      availabilityConfidence: 'PROVIDER_MANAGED',
      lastConfirmedAt: recentConfirmed,
      approvedAt: past40Days,
      isStale: false,
      isBookable: true,
      rating: 4.6,
      reviewCount: 31,
      createdAt: past40Days,
      updatedAt: recentConfirmed,
    },
    // 7. Private: Kogilu Cross Gated Villa Slot
    {
      id: 'lst_7',
      title: 'Kogilu Cross Gated Villa Slot',
      description: 'Shaded paver slot in an independent villa. CCTV, automatic night lights, peaceful neighborhood.',
      providerId: 'usr_owner_1',
      providerName: 'Suresh Sharma',
      providerType: 'OWNER',
      category: 'PRIVATE',
      status: 'VERIFIED',
      address: '#88, Kogilu Main Road, Near Maruthi Driving School',
      locality: 'Kogilu Cross',
      city: 'Bengaluru',
      latitude: 13.1082,
      longitude: 77.6085,
      landmark: 'Near Kogilu Lake Junction',
      totalCapacity: 2,
      vehicleTypes: ['TWO_WHEELER', 'HATCHBACK', 'SEDAN', 'SUV'],
      capacityBreakdown: { twoWheeler: 2, hatchback: 2, sedan: 1, suv: 1, ev: 0 },
      isCovered: true,
      heightClearanceMeters: 2.3,
      hasEvCharging: false,
      pricing: withPaisePricing(35, 230, 2600),
      accessMethod: 'GATE_GUARD',
      accessInstructions: 'Security guard on duty 24/7. Show booking reference.',
      houseRules: ['No overnight honking'],
      photos: [
        'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1590674899484-d5640e854abe?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1573348722427-f1d6819fdf98?w=800&auto=format&fit=crop&q=80',
      ],
      operatingHours: { is24x7: true, daysOfWeek: [0, 1, 2, 3, 4, 5, 6] },
      availabilityConfidence: 'PROVIDER_MANAGED',
      lastConfirmedAt: recentConfirmed,
      approvedAt: past40Days,
      isStale: false,
      isBookable: true,
      rating: 4.8,
      reviewCount: 14,
      createdAt: past40Days,
      updatedAt: recentConfirmed,
    },
    // 8. Private: Judicial Layout Shaded Porch
    {
      id: 'lst_8',
      title: 'Judicial Layout Shaded Porch',
      description: 'Wide, peaceful residential slot in upscale Judicial Layout. Close to GKVK gate and Bellary Road.',
      providerId: 'usr_owner_2',
      providerName: 'Ananya Swaminathan',
      providerType: 'OWNER',
      category: 'PRIVATE',
      status: 'VERIFIED',
      address: 'Plot 412, 7th Cross, Judicial Layout',
      locality: 'Judicial Layout / Allalasandra',
      city: 'Bengaluru',
      latitude: 13.0874,
      longitude: 77.5892,
      landmark: 'Opposite Judicial Layout Club',
      totalCapacity: 2,
      vehicleTypes: ['TWO_WHEELER', 'HATCHBACK', 'SEDAN', 'SUV', 'EV'],
      capacityBreakdown: { twoWheeler: 3, hatchback: 2, sedan: 2, suv: 2, ev: 1 },
      isCovered: true,
      heightClearanceMeters: 2.6,
      hasEvCharging: true,
      evChargerType: '15A Slow Charger',
      pricing: withPaisePricing(50, 300, 3200),
      accessMethod: 'GATE_GUARD',
      accessInstructions: 'Tell community guard at Arch 2 you are visiting Plot 412.',
      houseRules: ['Speed limit 20km/h in layout'],
      photos: [
        'https://images.unsplash.com/photo-1590674899484-d5640e854abe?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1621929747188-0b4dc28498d2?w=800&auto=format&fit=crop&q=80',
      ],
      operatingHours: { is24x7: true, daysOfWeek: [0, 1, 2, 3, 4, 5, 6] },
      availabilityConfidence: 'PROVIDER_MANAGED',
      lastConfirmedAt: recentConfirmed,
      approvedAt: past40Days,
      isStale: false,
      isBookable: true,
      rating: 4.9,
      reviewCount: 22,
      createdAt: past40Days,
      updatedAt: recentConfirmed,
    },
    // 9. Commercial: Yelahanka Commercial Plaza P1
    {
      id: 'lst_9',
      title: 'Yelahanka Commercial Plaza P1',
      description: 'Multi-level commercial parking plaza with manned booths and boom barrier entry. CCTV surveillance throughout.',
      providerId: 'usr_operator_1',
      providerName: 'Apex Smart Parking Operators',
      providerType: 'OPERATOR',
      category: 'COMMERCIAL',
      status: 'VERIFIED',
      address: 'Commercial Complex, 16th B Cross, Sector B',
      locality: 'Yelahanka New Town',
      city: 'Bengaluru',
      latitude: 13.0988,
      longitude: 77.5992,
      landmark: 'Next to Canara Bank Circle',
      totalCapacity: 20,
      vehicleTypes: ['TWO_WHEELER', 'HATCHBACK', 'SEDAN', 'SUV', 'EV'],
      capacityBreakdown: { twoWheeler: 10, hatchback: 8, sedan: 6, suv: 4, ev: 2 },
      isCovered: true,
      heightClearanceMeters: 2.2,
      hasEvCharging: true,
      evChargerType: 'Type 2 7.4kW',
      pricing: withPaisePricing(45, 300, 3200),
      accessMethod: 'BOOM_BARRIER',
      accessInstructions: 'Scan mobile pass at the entry terminal to open barrier.',
      houseRules: ['Park within painted yellow bays'],
      photos: [
        'https://images.unsplash.com/photo-1573348722427-f1d6819fdf98?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1590674899484-d5640e854abe?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?w=800&auto=format&fit=crop&q=80',
      ],
      operatingHours: { is24x7: false, openTime: '07:30', closeTime: '23:00', daysOfWeek: [0, 1, 2, 3, 4, 5, 6] },
      availabilityConfidence: 'BOOKED_ON_VPARK',
      lastConfirmedAt: recentConfirmed,
      approvedAt: past40Days,
      isStale: false,
      isBookable: true,
      rating: 4.5,
      reviewCount: 45,
      createdAt: past40Days,
      updatedAt: recentConfirmed,
    },
    // 10. Private: STALE listing demonstration (demoted in ranking)
    {
      id: 'lst_10',
      title: 'Aditi Enclave Open Porch (Unconfirmed)',
      description: 'Paver porch in quiet lane. Provider has not reconfirmed availability in over 30 days.',
      providerId: 'usr_owner_1',
      providerName: 'Suresh Sharma',
      providerType: 'OWNER',
      category: 'PRIVATE',
      status: 'VERIFIED',
      address: '12th Cross, Aditi Enclave, Attur Road',
      locality: 'Yelahanka West',
      city: 'Bengaluru',
      latitude: 13.1070,
      longitude: 77.5810,
      landmark: 'Near Attur Lake Jogging Track',
      totalCapacity: 1,
      vehicleTypes: ['TWO_WHEELER', 'HATCHBACK', 'SEDAN'],
      capacityBreakdown: { twoWheeler: 1, hatchback: 1, sedan: 1, suv: 0, ev: 0 },
      isCovered: false,
      heightClearanceMeters: 2.8,
      hasEvCharging: false,
      pricing: withPaisePricing(30, 180, 2000),
      accessMethod: 'REMOTE_CALL',
      accessInstructions: 'Call host on arrival.',
      houseRules: ['Park on the left side of driveway'],
      photos: [
        'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1590674899484-d5640e854abe?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1573348722427-f1d6819fdf98?w=800&auto=format&fit=crop&q=80',
      ],
      operatingHours: { is24x7: false, openTime: '08:00', closeTime: '20:00', daysOfWeek: [1, 2, 3, 4, 5, 6] },
      availabilityConfidence: 'UNCONFIRMED',
      lastConfirmedAt: past40Days,
      approvedAt: past40Days,
      isStale: true,
      isBookable: true,
      rating: 4.1,
      reviewCount: 7,
      createdAt: past40Days,
      updatedAt: past40Days,
    },
    // 11. Private: PENDING REVIEW demonstration (admin verification queue)
    {
      id: 'lst_11',
      title: 'Prestige North Point Dedicated Slot',
      description: 'Covered apartment basement bay submitted for trust & safety verification.',
      providerId: 'usr_owner_2',
      providerName: 'Ananya Swaminathan',
      providerType: 'OWNER',
      providerSituation: 'APARTMENT_RESIDENT',
      category: 'PRIVATE',
      status: 'PENDING_REVIEW',
      address: 'Tower 3 Basement, Prestige North Point, NH 44',
      locality: 'Yelahanka Hebbal Road',
      city: 'Bengaluru',
      latitude: 13.0725,
      longitude: 77.5910,
      landmark: 'Next to Prestige North Point Clubhouse',
      totalCapacity: 1,
      vehicleTypes: ['TWO_WHEELER', 'HATCHBACK', 'SEDAN', 'SUV', 'EV'],
      capacityBreakdown: { twoWheeler: 1, hatchback: 1, sedan: 1, suv: 1, ev: 1 },
      isCovered: true,
      heightClearanceMeters: 2.2,
      hasEvCharging: true,
      evChargerType: 'Type 2 7.4kW',
      pricing: withPaisePricing(55, 350, 3800),
      accessMethod: 'BOOM_BARRIER',
      accessInstructions: 'Show pass to Tower 3 basement security.',
      houseRules: ['Strictly slot T3-104 only'],
      photos: [
        'https://images.unsplash.com/photo-1621929747188-0b4dc28498d2?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1590674899484-d5640e854abe?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?w=800&auto=format&fit=crop&q=80',
      ],
      operatingHours: { is24x7: true, daysOfWeek: [0, 1, 2, 3, 4, 5, 6] },
      availabilityConfidence: 'UNCONFIRMED',
      lastConfirmedAt: yesterday,
      submittedAt: yesterday,
      isStale: false,
      isBookable: false,
      rating: 0,
      reviewCount: 0,
      createdAt: yesterday,
      updatedAt: yesterday,
      documents: [
        {
          id: 'doc_11',
          listingId: 'lst_11',
          providerId: 'usr_owner_2',
          docType: 'SOCIETY_NOC',
          fileName: 'prestige_north_point_association_noc.pdf',
          fileUrl: '/api/private-docs/doc_11',
          status: 'PENDING',
          uploadedAt: yesterday,
        },
      ],
    },
    // 12. PUBLIC: Yelahanka Mini Vidhana Soudha Public Street Parking (Discovery Only)
    {
      id: 'lst_12',
      title: 'Mini Vidhana Soudha Public Kerbside Parking',
      description: 'BBMP surveyed public on-street parking bays. Discovery-only context. VPark does not control or reserve these spaces.',
      providerId: 'usr_admin_1',
      providerName: 'BBMP Civic Survey',
      providerType: 'MANAGER',
      category: 'PUBLIC',
      status: 'VERIFIED',
      address: 'Mini Vidhana Soudha Complex, Seshadripuram College Road',
      locality: 'Yelahanka New Town',
      city: 'Bengaluru',
      latitude: 13.0972,
      longitude: 77.5941,
      landmark: 'In front of Yelahanka Sub-Registrar Office',
      totalCapacity: 25,
      vehicleTypes: ['TWO_WHEELER', 'HATCHBACK', 'SEDAN', 'SUV'],
      capacityBreakdown: { twoWheeler: 15, hatchback: 6, sedan: 6, suv: 3, ev: 0 },
      isCovered: false,
      heightClearanceMeters: 3.5,
      hasEvCharging: false,
      pricing: withPaisePricing(20, 120),
      accessMethod: 'GATE_GUARD',
      accessInstructions: 'First-come first-served on-street parking. Pay BBMP attendant on duty ₹20/hr.',
      houseRules: ['Park within white kerb lines', 'Do not block emergency access'],
      photos: [
        'https://images.unsplash.com/photo-1590674899484-d5640e854abe?w=800&auto=format&fit=crop&q=80',
      ],
      operatingHours: { is24x7: false, openTime: '08:00', closeTime: '20:00', daysOfWeek: [1, 2, 3, 4, 5, 6] },
      availabilityConfidence: 'UNCONFIRMED',
      lastConfirmedAt: recentConfirmed,
      isStale: false,
      surveyDate: 'Surveyed on 15 Oct 2026',
      isBookable: false,
      rating: 3.6,
      reviewCount: 12,
      createdAt: past40Days,
      updatedAt: past40Days,
    },
    // 13. PUBLIC: Yelahanka New Town Bus Stand Public Parking Bay
    {
      id: 'lst_13',
      title: 'Yelahanka New Town Bus Stand Public Parking',
      description: 'Public BMTC bus stand parking lot. Pay-and-park operated by local municipality. Discovery-only.',
      providerId: 'usr_admin_1',
      providerName: 'BMTC / Civic Survey',
      providerType: 'MANAGER',
      category: 'PUBLIC',
      status: 'VERIFIED',
      address: 'BMTC Bus Station, 4th Phase, New Town',
      locality: 'Yelahanka New Town',
      city: 'Bengaluru',
      latitude: 13.0982,
      longitude: 77.5985,
      landmark: 'Yelahanka New Town BMTC Terminal Gate 2',
      totalCapacity: 35,
      vehicleTypes: ['TWO_WHEELER', 'HATCHBACK', 'SEDAN'],
      capacityBreakdown: { twoWheeler: 25, hatchback: 8, sedan: 5, suv: 2, ev: 0 },
      isCovered: false,
      heightClearanceMeters: 3.5,
      hasEvCharging: false,
      pricing: withPaisePricing(20, 100),
      accessMethod: 'GATE_GUARD',
      accessInstructions: 'Collect token at municipal gate. Pay cash or UPI to BMTC parking contractor.',
      houseRules: ['BMTC buses have right of way'],
      photos: [
        'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?w=800&auto=format&fit=crop&q=80',
      ],
      operatingHours: { is24x7: false, openTime: '06:00', closeTime: '22:30', daysOfWeek: [0, 1, 2, 3, 4, 5, 6] },
      availabilityConfidence: 'UNCONFIRMED',
      lastConfirmedAt: recentConfirmed,
      isStale: false,
      surveyDate: 'Surveyed on 20 Oct 2026',
      isBookable: false,
      rating: 3.4,
      reviewCount: 18,
      createdAt: past40Days,
      updatedAt: past40Days,
    },
  ];

  const listingVerifications: ListingVerification[] = [
    {
      id: 'ver_1',
      listingId: 'lst_1',
      status: 'VERIFIED',
      reviewerId: 'usr_admin_1',
      reason: 'Ownership property tax receipt & photos verified.',
      reviewedAt: past40Days,
      evidenceDocIds: ['doc_1'],
    },
    {
      id: 'ver_2',
      listingId: 'lst_2',
      status: 'VERIFIED',
      reviewerId: 'usr_admin_1',
      reason: 'Sobha Emerald RWA NOC verified.',
      reviewedAt: past40Days,
      evidenceDocIds: ['doc_2'],
    },
  ];

  const bookings: Booking[] = [
    {
      id: 'bkg_1',
      referenceNumber: 'VPK-BLR-849201',
      listingId: 'lst_1',
      listingTitle: 'Shree Nivas Covered Driveway & Portico',
      listingAddress: '#142, 4th Phase, Near Mother Dairy Circle, Yelahanka',
      listingAccessInstructions: 'Tell security guard at gate you have a VPark reservation. Park in Bay A1 or A2.',
      driverId: 'usr_driver_1',
      driverName: 'Rajesh Kumar',
      driverPhone: '+919876543210',
      providerId: 'usr_owner_1',
      providerName: 'Suresh Sharma',
      providerPhoneMasked: '+91 80 4XXX 9201',
      vehicleType: 'SEDAN',
      vehiclePlateNumber: 'KA-04-MB-1234',
      startTime: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      actualCheckInTime: new Date(now.getTime() - 110 * 60 * 1000).toISOString(),
      status: 'CHECKED_IN',
      pricingSnapshot: calculatePricingPaise(
        4000,
        new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
        new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString()
      ),
      paymentId: 'pay_1',
      paymentMethod: 'UPI',
      paymentStatus: 'SUCCESS',
      createdAt: yesterday,
      updatedAt: yesterday,
    },
    {
      id: 'bkg_2',
      referenceNumber: 'VPK-BLR-739104',
      listingId: 'lst_2',
      listingTitle: 'Sobha Emerald Dedicated Basement Bay',
      listingAddress: 'Slot B-44, Sobha Emerald, Major Sandeep Unnikrishnan Rd',
      listingAccessInstructions: 'Show VPark QR code to society intercom guard. Guard will raise boom barrier for Basement 1.',
      driverId: 'usr_driver_1',
      driverName: 'Rajesh Kumar',
      driverPhone: '+919876543210',
      providerId: 'usr_owner_2',
      providerName: 'Ananya Swaminathan',
      providerPhoneMasked: '+91 80 4XXX 9104',
      vehicleType: 'EV',
      vehiclePlateNumber: 'KA-51-EV-9021',
      startTime: new Date(now.getTime() - 26 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(now.getTime() - 22 * 60 * 60 * 1000).toISOString(),
      actualCheckInTime: new Date(now.getTime() - 25 * 60 * 60 * 1000).toISOString(),
      actualCheckOutTime: new Date(now.getTime() - 22 * 60 * 60 * 1000).toISOString(),
      status: 'COMPLETED',
      pricingSnapshot: calculatePricingPaise(
        5000,
        new Date(now.getTime() - 26 * 60 * 60 * 1000).toISOString(),
        new Date(now.getTime() - 22 * 60 * 60 * 1000).toISOString()
      ),
      paymentId: 'pay_2',
      paymentMethod: 'UPI',
      paymentStatus: 'SUCCESS',
      createdAt: past40Days,
      updatedAt: yesterday,
    },
  ];

  const payments: Payment[] = [
    {
      id: 'pay_1',
      bookingId: 'bkg_1',
      referenceNumber: 'VPK-BLR-849201',
      amount: 182.66,
      amountPaise: 18266,
      currency: 'INR',
      method: 'UPI',
      status: 'SUCCESS',
      gatewayTransactionId: 'pay_rzp_test_992102910',
      gatewaySignature: 'sig_mock_verified_0129',
      platformCommission: 22.66,
      platformCommissionPaise: 2266,
      providerEarning: 160.0,
      providerEarningPaise: 16000,
      payoutStatus: 'SCHEDULED',
      reconciled: true,
      createdAt: yesterday,
    },
    {
      id: 'pay_2',
      bookingId: 'bkg_2',
      referenceNumber: 'VPK-BLR-739104',
      amount: 228.32,
      amountPaise: 22832,
      currency: 'INR',
      method: 'UPI',
      status: 'SUCCESS',
      gatewayTransactionId: 'pay_rzp_test_881290312',
      gatewaySignature: 'sig_mock_verified_8812',
      platformCommission: 28.32,
      platformCommissionPaise: 2832,
      providerEarning: 200.0,
      providerEarningPaise: 20000,
      payoutStatus: 'PAID',
      reconciled: true,
      createdAt: past40Days,
    },
  ];

  const payouts: Payout[] = [
    {
      id: 'payout_1',
      providerId: 'usr_owner_2',
      amount: 200.0,
      amountPaise: 20000,
      status: 'SETTLED',
      periodStart: past40Days,
      periodEnd: yesterday,
      settledAt: yesterday,
      utrNumber: 'CMS2026110900192',
    },
  ];

  const auditLogs: AuditLog[] = [
    {
      id: 'aud_1',
      actorId: 'usr_admin_1',
      actorName: 'Vikram Rao (Trust & Safety Admin)',
      actorRole: 'ADMIN',
      action: 'APPROVE_LISTING',
      targetType: 'LISTING',
      targetId: 'lst_1',
      details: 'Approved private listing after physical deed verification and photo inspection.',
      timestamp: past40Days,
    },
    {
      id: 'aud_2',
      actorId: 'usr_admin_1',
      actorName: 'Vikram Rao (Trust & Safety Admin)',
      actorRole: 'ADMIN',
      action: 'APPROVE_LISTING',
      targetType: 'LISTING',
      targetId: 'lst_2',
      details: 'Approved apartment resident listing with verified Sobha Emerald RWA NOC letter.',
      timestamp: past40Days,
    },
  ];

  const reviews: Review[] = [
    {
      id: 'rev_1',
      listingId: 'lst_1',
      bookingId: 'bkg_1',
      driverId: 'usr_driver_1',
      driverName: 'Rajesh Kumar',
      rating: 5,
      comment: 'Super easy access! Security guard was polite and the EV charging socket worked without a hitch.',
      createdAt: yesterday,
    },
  ];

  const monthlyPasses: MonthlyPass[] = [
    {
      id: 'pass_1',
      listingId: 'lst_1',
      listingTitle: 'Shree Nivas Covered Driveway & Portico',
      driverId: 'usr_driver_1',
      driverName: 'Rajesh Kumar',
      vehiclePlateNumber: 'KA-04-MB-1234',
      vehicleType: 'SEDAN',
      month: '2026-11',
      startDate: '2026-11-01',
      endDate: '2026-11-30',
      price: 2800,
      pricePaise: 280000,
      status: 'ACTIVE',
      createdAt: '2026-11-01T08:00:00Z',
    },
  ];

  return {
    users,
    roles,
    userRoles,
    providerProfiles,
    driverProfiles,
    consents,
    otpChallenges: [],
    listings,
    listingVerifications,
    holds: [],
    bookings,
    payments,
    payouts,
    disputes: [],
    auditLogs,
    reviews,
    monthlyPasses,
  };
}

class Database {
  private state: DatabaseState;

  constructor() {
    this.state = this.loadDatabase();
    this.cleanExpiredHolds();
  }

  private migrateLoadedState(parsed: Partial<DatabaseState>): DatabaseState {
    const seed = getSeedData();
    const state: DatabaseState = {
      users: Array.isArray(parsed.users) ? parsed.users : seed.users,
      roles: Array.isArray(parsed.roles) && parsed.roles.length > 0 ? parsed.roles : seed.roles,
      userRoles: Array.isArray(parsed.userRoles) ? parsed.userRoles : seed.userRoles,
      providerProfiles: Array.isArray(parsed.providerProfiles) ? parsed.providerProfiles : seed.providerProfiles,
      driverProfiles: Array.isArray(parsed.driverProfiles) ? parsed.driverProfiles : seed.driverProfiles,
      consents: Array.isArray(parsed.consents) ? parsed.consents : seed.consents,
      otpChallenges: Array.isArray(parsed.otpChallenges) ? parsed.otpChallenges : [],
      listings: Array.isArray(parsed.listings) ? parsed.listings : seed.listings,
      listingVerifications: Array.isArray(parsed.listingVerifications) ? parsed.listingVerifications : seed.listingVerifications,
      holds: Array.isArray(parsed.holds) ? parsed.holds : [],
      bookings: Array.isArray(parsed.bookings) ? parsed.bookings : seed.bookings,
      payments: Array.isArray(parsed.payments) ? parsed.payments : seed.payments,
      payouts: Array.isArray(parsed.payouts) ? parsed.payouts : seed.payouts,
      disputes: Array.isArray(parsed.disputes) ? parsed.disputes : [],
      auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : seed.auditLogs,
      reviews: Array.isArray(parsed.reviews) ? parsed.reviews : seed.reviews,
      monthlyPasses: Array.isArray(parsed.monthlyPasses) ? parsed.monthlyPasses : seed.monthlyPasses,
    };

    // Normalize legacy user rows to PRD v2.2
    for (const u of state.users) {
      u.phone = normalizeIndianPhone(u.phone) || u.phone.replace(/\s+/g, '');
      if (!u.accountStatus) u.accountStatus = 'ACTIVE';
      if (u.phoneVerifiedAt === undefined) u.phoneVerifiedAt = u.isPhoneVerified ? u.createdAt : null;
      if (u.deletedAt === undefined) u.deletedAt = null;
      for (const role of u.roles) {
        const existsGrant = state.userRoles.some((ur) => ur.userId === u.id && ur.roleName === role);
        if (!existsGrant) {
          state.userRoles.push({
            userId: u.id,
            roleId: `role_${role.toLowerCase()}`,
            roleName: role,
            grantedAt: u.createdAt,
            grantedBy: 'MIGRATION',
          });
        }
      }
    }

    // Normalize listings: migrate Parkora string & backfill integer paise fields
    for (const l of state.listings) {
      if (l.availabilityConfidence === 'BOOKED_ON_PARKORA') {
        l.availabilityConfidence = 'BOOKED_ON_VPARK';
      }
      if (l.pricing.hourlyRatePaise === undefined) {
        l.pricing.hourlyRatePaise = toPaise(l.pricing.hourlyRate || 0);
        l.pricing.dailyRatePaise = toPaise(l.pricing.dailyRate || 0);
        if (l.pricing.monthlyRate !== undefined) {
          l.pricing.monthlyRatePaise = toPaise(l.pricing.monthlyRate);
        }
      }
      if (l.deletedAt === undefined) l.deletedAt = null;
      if (l.documents) {
        for (const doc of l.documents) {
          if (doc.fileUrl.startsWith('/docs/')) {
            doc.fileUrl = `/api/private-docs/${doc.id}`;
          }
        }
      }
    }

    return state;
  }

  private loadDatabase(): DatabaseState {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const migrated = this.migrateLoadedState(JSON.parse(raw));
        return migrated;
      }
    } catch (err) {
      console.warn('Error reading db file, re-initializing with seed data:', err);
    }

    const initial = getSeedData();
    this.saveDatabase(initial);
    return initial;
  }

  private saveDatabase(state: DatabaseState) {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save database file:', err);
    }
  }

  private persist() {
    this.saveDatabase(this.state);
  }

  public getPrivateUploadsDir(): string {
    if (!fs.existsSync(PRIVATE_UPLOADS_DIR)) {
      fs.mkdirSync(PRIVATE_UPLOADS_DIR, { recursive: true });
    }
    return PRIVATE_UPLOADS_DIR;
  }

  // Hold cleaner
  public cleanExpiredHolds() {
    const nowIso = new Date().toISOString();
    const prevCount = this.state.holds.length;
    this.state.holds = this.state.holds.filter((h) => h.expiresAt > nowIso);
    if (this.state.holds.length !== prevCount) {
      this.persist();
    }
  }

  // --- Users, Auth, OTP Challenges & Consents (PRD Section 6 & 9) ---
  public getUsers(): User[] {
    return this.state.users;
  }

  public getUserById(id: string): User | undefined {
    const user = this.state.users.find((u) => u.id === id);
    if (!user || user.deletedAt || user.accountStatus === 'DELETION_PENDING') {
      return undefined;
    }
    return user;
  }

  public getUserByPhone(phone: string): User | undefined {
    const normalized = normalizeIndianPhone(phone) || phone.replace(/\s+/g, '');
    return this.state.users.find((u) => {
      if (u.deletedAt || u.accountStatus === 'DELETION_PENDING') return false;
      const storedNormalized = normalizeIndianPhone(u.phone) || u.phone.replace(/\s+/g, '');
      return storedNormalized === normalized;
    });
  }

  public requestOtpChallenge(
    rawPhone: string,
    purpose: OtpChallenge['purpose'] = 'LOGIN'
  ): { success: boolean; phone?: string; challengeId?: string; expiresAt?: string; retryAfterSeconds?: number; error?: string } {
    const phone = normalizeIndianPhone(rawPhone);
    if (!phone) {
      return { success: false, error: 'Enter a valid mobile number (+91 10 digits or E.164 format).' };
    }

    const nowMs = Date.now();
    // Resend cooldown check
    const recent = [...this.state.otpChallenges]
      .reverse()
      .find((c) => c.phone === phone && !c.consumedAt);
    if (recent) {
      const elapsedSec = Math.floor((nowMs - new Date(recent.createdAt).getTime()) / 1000);
      if (elapsedSec < APP_CONFIG.otpResendCooldownSeconds) {
        return {
          success: false,
          retryAfterSeconds: APP_CONFIG.otpResendCooldownSeconds - elapsedSec,
          error: `Please wait ${APP_CONFIG.otpResendCooldownSeconds - elapsedSec}s before requesting a new OTP.`,
        };
      }
    }

    const challengeId = `otp_${nowMs}_${Math.random().toString(36).substring(2, 7)}`;
    const expiresAt = new Date(nowMs + APP_CONFIG.otpExpiryMinutes * 60 * 1000).toISOString();
    const challenge: OtpChallenge = {
      id: challengeId,
      phone,
      codeHash: hashOtp(phone, APP_CONFIG.demoOtp, challengeId),
      purpose,
      expiresAt,
      attempts: 0,
      consumedAt: null,
      createdAt: new Date(nowMs).toISOString(),
    };

    // Prune very old challenges (keep last 200)
    if (this.state.otpChallenges.length > 200) {
      this.state.otpChallenges = this.state.otpChallenges.slice(-150);
    }

    this.state.otpChallenges.push(challenge);
    this.persist();

    return {
      success: true,
      phone,
      challengeId,
      expiresAt,
    };
  }

  public verifyOtpAndSignIn(params: {
    phone: string;
    otp: string;
    intent?: 'driver' | 'provider';
    ipAddress?: string;
    userAgent?: string;
  }): {
    success: boolean;
    user?: User;
    onboardingRequired?: boolean;
    error?: string;
    status?: number;
  } {
    const phone = normalizeIndianPhone(params.phone);
    if (!phone) {
      return { success: false, error: 'Invalid phone number format.', status: 400 };
    }

    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();

    // Find latest challenge for phone
    const challenge = [...this.state.otpChallenges]
      .reverse()
      .find((c) => c.phone === phone);

    if (!challenge) {
      return { success: false, error: 'No active OTP challenge found. Request a new code.', status: 400 };
    }

    if (challenge.consumedAt) {
      return { success: false, error: 'OTP has already been used. Request a new code.', status: 400 };
    }

    if (new Date(challenge.expiresAt).getTime() <= nowMs) {
      return { success: false, error: 'OTP has expired. Request a new code.', status: 400 };
    }

    if (challenge.attempts >= APP_CONFIG.otpMaxAttempts) {
      return { success: false, error: 'Too many invalid attempts. Request a new OTP.', status: 429 };
    }

    challenge.attempts += 1;
    const isMatch = verifyOtpHash(phone, params.otp, challenge.id, challenge.codeHash);
    if (!isMatch) {
      this.persist();
      const remaining = APP_CONFIG.otpMaxAttempts - challenge.attempts;
      return {
        success: false,
        error:
          remaining > 0
            ? `Invalid OTP code (${remaining} attempt${remaining === 1 ? '' : 's'} remaining). Demo code: ${APP_CONFIG.demoOtp}`
            : 'Too many invalid attempts. Request a new OTP.',
        status: 400,
      };
    }

    // Valid OTP — consume single-use challenge
    challenge.consumedAt = nowIso;

    let user = this.getUserByPhone(phone);
    const requestedRole: UserRole = params.intent === 'provider' ? 'PROVIDER' : 'DRIVER';
    let onboardingRequired = false;

    if (!user) {
      // Create single account with chosen initial capability; onboarding collects name & Terms consent
      const userId = `usr_${nowMs}_${Math.random().toString(36).substring(2, 7)}`;
      user = {
        id: userId,
        phone,
        name: '',
        roles: [requestedRole],
        activeRole: requestedRole,
        providerType: requestedRole === 'PROVIDER' ? 'OWNER' : undefined,
        phoneVerifiedAt: nowIso,
        emailVerifiedAt: null,
        isPhoneVerified: true,
        accountStatus: 'ACTIVE',
        lastLoginAt: nowIso,
        deletedAt: null,
        vehicles: [],
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      this.state.users.push(user);
      this.state.userRoles.push({
        userId,
        roleId: requestedRole === 'PROVIDER' ? 'role_provider' : 'role_driver',
        roleName: requestedRole,
        grantedAt: nowIso,
        grantedBy: 'OTP_SIGNUP',
      });
      if (requestedRole === 'DRIVER') {
        this.state.driverProfiles.push({ userId, preferences: {} });
      } else {
        this.state.providerProfiles.push({ userId, providerType: 'OWNER', displayName: 'New Host' });
      }
      onboardingRequired = true;
    } else {
      if (user.accountStatus === 'SUSPENDED') {
        this.persist();
        return { success: false, error: 'Account is suspended. Contact support@vpark.in.', status: 403 };
      }
      user.phoneVerifiedAt = user.phoneVerifiedAt || nowIso;
      user.isPhoneVerified = true;
      user.lastLoginAt = nowIso;
      user.updatedAt = nowIso;

      // Grant intent capability cleanly if user re-enters via the other door without duplicating account
      if (params.intent) {
        if (!user.roles.includes(requestedRole)) {
          this.grantCapabilityInternal(user, requestedRole, 'INTENT_DOOR');
        }
        user.activeRole = requestedRole;
      }

      const hasTermsConsent = this.state.consents.some(
        (c) => c.userId === user!.id && c.documentType === 'TERMS_OF_SERVICE'
      );
      if (!user.name || !hasTermsConsent) {
        onboardingRequired = true;
      }
    }

    this.createAuditLog({
      actorId: user.id,
      actorName: user.name || user.phone,
      actorRole: user.activeRole,
      action: 'LOGIN_OTP',
      targetType: 'USER',
      targetId: user.id,
      details: `Phone OTP sign-in completed (onboardingRequired=${onboardingRequired}).`,
      metadata: { ipAddress: params.ipAddress, userAgent: params.userAgent },
    });

    this.persist();
    return { success: true, user, onboardingRequired };
  }

  public completeOnboarding(params: {
    userId: string;
    fullName: string;
    email?: string;
    providerType?: ProviderType;
    acceptTerms: boolean;
    ipAddress: string;
    userAgent: string;
  }): { success: boolean; user?: User; consents?: ConsentRecord[]; error?: string } {
    const user = this.getUserById(params.userId);
    if (!user) return { success: false, error: 'User session not found.' };

    const cleanName = params.fullName.trim();
    if (!cleanName || cleanName.length < 2) {
      return { success: false, error: 'Please enter your full name.' };
    }
    if (!params.acceptTerms) {
      return { success: false, error: 'Acceptance of Terms and Privacy Policy is required.' };
    }

    const nowIso = new Date().toISOString();
    user.name = cleanName;
    if (params.email && params.email.trim()) {
      user.email = params.email.trim().toLowerCase();
    }
    if (params.providerType) {
      user.providerType = params.providerType;
      const profile = this.state.providerProfiles.find((p) => p.userId === user.id);
      if (profile) {
        profile.providerType = params.providerType;
        profile.displayName = cleanName;
      } else {
        this.state.providerProfiles.push({
          userId: user.id,
          providerType: params.providerType,
          displayName: cleanName,
        });
      }
    }
    user.updatedAt = nowIso;

    const newConsents: ConsentRecord[] = [
      {
        id: `cons_${Date.now()}_tos`,
        userId: user.id,
        documentType: 'TERMS_OF_SERVICE',
        documentVersion: APP_CONFIG.legalDocVersions.terms,
        acceptedAt: nowIso,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
      {
        id: `cons_${Date.now()}_priv`,
        userId: user.id,
        documentType: 'PRIVACY_POLICY',
        documentVersion: APP_CONFIG.legalDocVersions.privacy,
        acceptedAt: nowIso,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    ];

    if (user.roles.includes('PROVIDER')) {
      newConsents.push({
        id: `cons_${Date.now()}_prov`,
        userId: user.id,
        documentType: 'PROVIDER_TERMS',
        documentVersion: APP_CONFIG.legalDocVersions.providerTerms,
        acceptedAt: nowIso,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      });
    }

    this.state.consents.push(...newConsents);
    this.createAuditLog({
      actorId: user.id,
      actorName: user.name,
      actorRole: user.activeRole,
      action: 'CONSENT_ACCEPTED',
      targetType: 'CONSENT',
      targetId: newConsents[0].id,
      details: `User completed onboarding and accepted Terms (${APP_CONFIG.legalDocVersions.terms}) & Privacy Policy.`,
      metadata: { ipAddress: params.ipAddress, documentVersions: APP_CONFIG.legalDocVersions },
    });

    this.persist();
    return { success: true, user, consents: newConsents };
  }

  private grantCapabilityInternal(user: User, role: UserRole, grantedBy: string) {
    if (!user.roles.includes(role)) {
      user.roles.push(role);
    }
    const nowIso = new Date().toISOString();
    const exists = this.state.userRoles.some((ur) => ur.userId === user.id && ur.roleName === role);
    if (!exists) {
      this.state.userRoles.push({
        userId: user.id,
        roleId: `role_${role.toLowerCase()}`,
        roleName: role,
        grantedAt: nowIso,
        grantedBy,
      });
    }
    if (role === 'PROVIDER') {
      if (!user.providerType) user.providerType = 'OWNER';
      if (!this.state.providerProfiles.some((p) => p.userId === user.id)) {
        this.state.providerProfiles.push({
          userId: user.id,
          providerType: user.providerType,
          displayName: user.name || user.phone,
        });
      }
    } else if (role === 'DRIVER') {
      if (!this.state.driverProfiles.some((d) => d.userId === user.id)) {
        this.state.driverProfiles.push({ userId: user.id, preferences: {} });
      }
    }
  }

  public grantCapability(userId: string, role: 'DRIVER' | 'PROVIDER', providerType?: ProviderType): { success: boolean; user?: User; error?: string } {
    const user = this.getUserById(userId);
    if (!user) return { success: false, error: 'User not found.' };

    if (providerType) user.providerType = providerType;
    this.grantCapabilityInternal(user, role, 'SELF_ADD');
    user.activeRole = role;
    user.updatedAt = new Date().toISOString();

    this.createAuditLog({
      actorId: user.id,
      actorName: user.name || user.phone,
      actorRole: role,
      action: 'GRANT_CAPABILITY',
      targetType: 'USER',
      targetId: user.id,
      details: `Added ${role} capability without re-entering account details.`,
    });

    this.persist();
    return { success: true, user };
  }

  public switchActiveMode(userId: string, role: UserRole): { success: boolean; user?: User; error?: string } {
    const user = this.getUserById(userId);
    if (!user) return { success: false, error: 'User not found.' };
    if (!user.roles.includes(role)) {
      return { success: false, error: `Capability ${role} is not enabled on this account.` };
    }
    user.activeRole = role;
    user.updatedAt = new Date().toISOString();
    this.persist();
    return { success: true, user };
  }

  public updateUserEmail(userId: string, email: string): { success: boolean; user?: User; error?: string } {
    const user = this.getUserById(userId);
    if (!user) return { success: false, error: 'User not found.' };
    const clean = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      return { success: false, error: 'Enter a valid email address.' };
    }
    const nowIso = new Date().toISOString();
    user.email = clean;
    user.emailVerifiedAt = nowIso; // Demo verification timestamp
    user.updatedAt = nowIso;
    this.persist();
    return { success: true, user };
  }

  public getUserConsents(userId: string): ConsentRecord[] {
    return this.state.consents.filter((c) => c.userId === userId);
  }

  public softDeleteUser(userId: string): { success: boolean; error?: string } {
    const user = this.state.users.find((u) => u.id === userId);
    if (!user) return { success: false, error: 'User not found.' };
    const nowIso = new Date().toISOString();
    user.accountStatus = 'DELETION_PENDING';
    user.deletedAt = nowIso;
    user.name = 'Deleted User';
    user.email = undefined;
    user.phone = `deleted_${user.id}`;
    user.vehicles = [];
    user.updatedAt = nowIso;

    // Suspend user's active listings
    for (const listing of this.state.listings) {
      if (listing.providerId === userId && listing.status === 'VERIFIED') {
        listing.status = 'SUSPENDED';
        listing.deletedAt = nowIso;
        listing.updatedAt = nowIso;
      }
    }

    this.createAuditLog({
      actorId: userId,
      actorName: 'DPDP Self-Service Request',
      actorRole: 'DRIVER',
      action: 'ACCOUNT_DELETION_REQUESTED',
      targetType: 'USER',
      targetId: userId,
      details: 'User initiated account soft-deletion and PII anonymisation under DPDP Act 2023.',
    });

    this.persist();
    return { success: true };
  }

  public addVehicle(userId: string, vehicle: Omit<User['vehicles'][0], 'id' | 'userId'>): User | undefined {
    const user = this.getUserById(userId);
    if (!user) return undefined;

    const newVehicle = {
      ...vehicle,
      id: `veh_${Date.now()}`,
      userId,
      deletedAt: null,
    };

    user.vehicles.push(newVehicle);
    this.persist();
    return user;
  }

  // --- Search & Ranking (SRCH-1 to SRCH-6, PRD 8.2) ---
  public searchListings(filters: SearchFilters): SearchResultItem[] {
    this.cleanExpiredHolds();

    const targetLat = filters.latitude ?? APP_CONFIG.defaultCenter.lat;
    const targetLng = filters.longitude ?? APP_CONFIG.defaultCenter.lng;
    const maxRadius = filters.radiusKm ?? 5.0;

    const candidateListings = this.state.listings.filter((listing) => {
      if (listing.deletedAt) return false;
      if (listing.status !== 'VERIFIED') return false;

      if (filters.category && filters.category.length > 0) {
        if (!filters.category.includes(listing.category)) return false;
      }

      if (filters.vehicleType) {
        const typeKey =
          filters.vehicleType === 'TWO_WHEELER'
            ? 'twoWheeler'
            : filters.vehicleType === 'HATCHBACK'
            ? 'hatchback'
            : filters.vehicleType === 'SEDAN'
            ? 'sedan'
            : filters.vehicleType === 'SUV'
            ? 'suv'
            : 'ev';
        if ((listing.capacityBreakdown[typeKey] ?? 0) <= 0) return false;
      }

      if (filters.maxHourlyRate !== undefined && listing.pricing.hourlyRate > filters.maxHourlyRate) {
        return false;
      }

      if (filters.isCovered !== undefined && listing.isCovered !== filters.isCovered) {
        return false;
      }

      if (filters.hasEvCharging && !listing.hasEvCharging) {
        return false;
      }

      if (filters.bookableNow && !listing.isBookable) {
        return false;
      }

      return true;
    });

    const results: SearchResultItem[] = [];
    const nowMs = Date.now();

    for (const rawListing of candidateListings) {
      const distance = engineCalculateDistance(targetLat, targetLng, rawListing.latitude, rawListing.longitude);
      if (distance > maxRadius) continue;

      const windowStart = filters.startTime ? new Date(filters.startTime).toISOString() : new Date(nowMs).toISOString();
      const windowEnd = filters.endTime
        ? new Date(filters.endTime).toISOString()
        : new Date(nowMs + 2 * 60 * 60 * 1000).toISOString();

      const { availableCapacity, activeHoldsCount } = this.calculateAvailability(rawListing.id, windowStart, windowEnd);

      const staleFlag = isListingStale(rawListing.lastConfirmedAt, APP_CONFIG.staleThresholdDays, nowMs);
      const distanceScore = Math.max(0, 1 - distance / 10);
      const priceScore = Math.max(0, 1 - rawListing.pricing.hourlyRate / 150);
      const verificationScore = rawListing.status === 'VERIFIED' ? 1.0 : 0.4;
      const confidenceScore =
        rawListing.availabilityConfidence === 'PROVIDER_MANAGED'
          ? 1.0
          : rawListing.availabilityConfidence === 'BOOKED_ON_VPARK' ||
            rawListing.availabilityConfidence === 'BOOKED_ON_PARKORA'
          ? 0.8
          : 0.3;
      const ratingScore = rawListing.rating > 0 ? rawListing.rating / 5.0 : 0.7;
      const stalePenalty = staleFlag ? 0.25 : 0.0;

      const totalScore = calculateRankingScore({
        distanceKm: distance,
        hourlyRate: rawListing.pricing.hourlyRate,
        isVerified: rawListing.status === 'VERIFIED',
        confidence: rawListing.availabilityConfidence,
        rating: rawListing.rating,
        isStale: staleFlag,
      });

      const ranking: RankingBreakdown = {
        distanceKm: distance,
        distanceScore: Math.round(distanceScore * 100) / 100,
        priceScore: Math.round(priceScore * 100) / 100,
        verificationScore,
        confidenceScore,
        ratingScore: Math.round(ratingScore * 100) / 100,
        stalePenalty,
        totalScore,
      };

      // PRD Section 7.2 & 7.3: Redact private verification docs & exact access instructions before booking confirmation
      const redactedListing: Listing = {
        ...rawListing,
        isStale: staleFlag,
        accessInstructions:
          rawListing.category === 'PUBLIC'
            ? rawListing.accessInstructions
            : 'Exact gate code & entry instructions are shared automatically after booking confirmation.',
        documents: undefined,
      };

      results.push({
        listing: redactedListing,
        distanceKm: distance,
        ranking,
        availableCapacity,
        activeHoldsCount,
      });
    }

    if (filters.sortBy === 'PRICE_LOW') {
      results.sort((a, b) => a.listing.pricing.hourlyRate - b.listing.pricing.hourlyRate);
    } else if (filters.sortBy === 'DISTANCE_NEAR') {
      results.sort((a, b) => a.distanceKm - b.distanceKm);
    } else if (filters.sortBy === 'RATING_HIGH') {
      results.sort((a, b) => b.listing.rating - a.listing.rating);
    } else {
      results.sort((a, b) => b.ranking.totalScore - a.ranking.totalScore);
    }

    return results;
  }

  public calculateAvailability(listingId: string, startTime: string, endTime: string): {
    totalCapacity: number;
    bookedCount: number;
    activeHoldsCount: number;
    availableCapacity: number;
  } {
    const listing = this.getListingById(listingId);
    if (!listing) return { totalCapacity: 0, bookedCount: 0, activeHoldsCount: 0, availableCapacity: 0 };

    const overlappingBookings = this.state.bookings.filter((b) => {
      if (b.listingId !== listingId) return false;
      if (b.status !== 'CONFIRMED' && b.status !== 'CHECKED_IN') return false;
      return startTime < b.endTime && endTime > b.startTime;
    });

    const nowIso = new Date().toISOString();
    const activeHolds = this.state.holds.filter((h) => {
      if (h.listingId !== listingId) return false;
      if (h.expiresAt <= nowIso) return false;
      return startTime < h.endTime && endTime > h.startTime;
    });

    const bookedCount = overlappingBookings.length;
    const activeHoldsCount = activeHolds.length;
    const availableCapacity = Math.max(0, listing.totalCapacity - bookedCount - activeHoldsCount);

    return {
      totalCapacity: listing.totalCapacity,
      bookedCount,
      activeHoldsCount,
      availableCapacity,
    };
  }

  // --- Slot Holds ---
  public createSlotHold(data: {
    listingId: string;
    userId: string;
    vehicleType: User['vehicles'][0]['type'];
    startTime: string;
    endTime: string;
  }): { success: boolean; hold?: SlotHold; error?: string } {
    this.cleanExpiredHolds();

    const listing = this.getListingById(data.listingId);
    if (!listing || listing.status !== 'VERIFIED' || !listing.isBookable) {
      return { success: false, error: 'Listing is not available for reservation.' };
    }

    const availability = this.calculateAvailability(data.listingId, data.startTime, data.endTime);
    if (availability.availableCapacity <= 0) {
      return { success: false, error: 'No slots available for the selected time window.' };
    }

    const expiresAt = new Date(Date.now() + APP_CONFIG.holdDurationMinutes * 60 * 1000).toISOString();
    const hold: SlotHold = {
      id: `hld_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      listingId: data.listingId,
      userId: data.userId,
      vehicleType: data.vehicleType,
      startTime: data.startTime,
      endTime: data.endTime,
      expiresAt,
      createdAt: new Date().toISOString(),
    };

    this.state.holds.push(hold);
    this.persist();
    return { success: true, hold };
  }

  public releaseSlotHold(holdId: string) {
    this.state.holds = this.state.holds.filter((h) => h.id !== holdId);
    this.persist();
  }

  // --- Pricing Calculation in Integer Paise ---
  public calculatePricing(hourlyRate: number, startTime: string, endTime: string): PriceBreakdown {
    return calculatePricingPaise(toPaise(hourlyRate), startTime, endTime);
  }

  // --- Bookings ---
  public createBooking(data: {
    listingId: string;
    driverId: string;
    vehicleType: User['vehicles'][0]['type'];
    vehiclePlateNumber: string;
    startTime: string;
    endTime: string;
    paymentMethod: Payment['method'];
    holdId?: string;
  }): { success: boolean; booking?: Booking; payment?: Payment; error?: string } {
    this.cleanExpiredHolds();

    const listing = this.getListingById(data.listingId);
    if (!listing || listing.status !== 'VERIFIED') return { success: false, error: 'Verified listing not found.' };
    if (!listing.isBookable) return { success: false, error: 'Public spaces are discovery-only and cannot be booked.' };

    const availability = this.calculateAvailability(data.listingId, data.startTime, data.endTime);
    const userHold = data.holdId ? this.state.holds.find((h) => h.id === data.holdId && h.userId === data.driverId) : undefined;
    if (availability.availableCapacity <= 0 && !userHold) {
      return { success: false, error: 'This slot was just taken by another driver. Please choose another time or spot.' };
    }

    const driver = this.getUserById(data.driverId);
    if (!driver) return { success: false, error: 'Authenticated driver record not found.' };

    const hourlyPaise = listing.pricing.hourlyRatePaise ?? toPaise(listing.pricing.hourlyRate);
    const pricing = calculatePricingPaise(hourlyPaise, data.startTime, data.endTime);
    const refNum = `VPK-BLR-${Math.floor(100000 + Math.random() * 900000)}`;

    const bookingId = `bkg_${Date.now()}`;
    const paymentId = `pay_${Date.now()}`;

    const newBooking: Booking = {
      id: bookingId,
      referenceNumber: refNum,
      listingId: listing.id,
      listingTitle: listing.title,
      listingAddress: listing.address,
      listingAccessInstructions: listing.accessInstructions,
      driverId: driver.id,
      driverName: driver.name || driver.phone,
      driverPhone: driver.phone,
      providerId: listing.providerId,
      providerName: listing.providerName,
      providerPhoneMasked: `+91 80 4XXX ${refNum.slice(-4)}`,
      vehicleType: data.vehicleType,
      vehiclePlateNumber: data.vehiclePlateNumber,
      startTime: data.startTime,
      endTime: data.endTime,
      status: 'CONFIRMED',
      pricingSnapshot: pricing,
      paymentId,
      paymentMethod: data.paymentMethod,
      paymentStatus: 'SUCCESS',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const platformCommissionPaise = (pricing.platformFeePaise ?? toPaise(pricing.platformFee)) + (pricing.totalTaxesPaise ?? toPaise(pricing.totalTaxes));
    const providerEarningPaise = pricing.parkingFeePaise ?? toPaise(pricing.parkingFee);

    const newPayment: Payment = {
      id: paymentId,
      bookingId,
      referenceNumber: refNum,
      amount: pricing.totalAmount,
      amountPaise: pricing.totalAmountPaise ?? toPaise(pricing.totalAmount),
      currency: 'INR',
      method: data.paymentMethod,
      status: 'SUCCESS',
      gatewayTransactionId: `rzp_live_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      gatewaySignature: `sig_verified_${Date.now()}`,
      platformCommission: fromPaise(platformCommissionPaise),
      platformCommissionPaise,
      providerEarning: fromPaise(providerEarningPaise),
      providerEarningPaise,
      payoutStatus: 'SCHEDULED',
      reconciled: true,
      createdAt: new Date().toISOString(),
    };

    if (data.holdId) {
      this.releaseSlotHold(data.holdId);
    }

    this.state.bookings.push(newBooking);
    this.state.payments.push(newPayment);
    this.persist();

    return { success: true, booking: newBooking, payment: newPayment };
  }

  public updateBookingStatus(
    bookingId: string,
    status: BookingStatus,
    metadata?: {
      photoUrl?: string;
      reason?: string;
      cancelledBy?: 'DRIVER' | 'PROVIDER';
    }
  ): { success: boolean; booking?: Booking; error?: string } {
    const booking = this.state.bookings.find((b) => b.id === bookingId);
    if (!booking) return { success: false, error: 'Booking not found.' };

    const nowIso = new Date().toISOString();

    if (status === 'CHECKED_IN') {
      booking.status = 'CHECKED_IN';
      booking.actualCheckInTime = nowIso;
      if (metadata?.photoUrl) booking.checkInPhotoUrl = metadata.photoUrl;
    } else if (status === 'COMPLETED') {
      booking.status = 'COMPLETED';
      booking.actualCheckOutTime = nowIso;
    } else if (status === 'CANCELLED_BY_DRIVER' || status === 'CANCELLED_BY_PROVIDER') {
      booking.status = status;
      booking.cancelledAt = nowIso;
      booking.cancelledBy = metadata?.cancelledBy || (status === 'CANCELLED_BY_DRIVER' ? 'DRIVER' : 'PROVIDER');
      booking.cancellationReason = metadata?.reason;

      const startTimeMs = new Date(booking.startTime).getTime();
      const hoursToStart = (startTimeMs - Date.now()) / (1000 * 60 * 60);
      const parkingFeePaise = booking.pricingSnapshot.parkingFeePaise ?? toPaise(booking.pricingSnapshot.parkingFee);
      const totalAmountPaise = booking.pricingSnapshot.totalAmountPaise ?? toPaise(booking.pricingSnapshot.totalAmount);

      const refundPaise = calculateCancellationRefundPaise({
        hoursBeforeStart: hoursToStart,
        parkingFeePaise,
        totalAmountPaise,
        cancelledBy: booking.cancelledBy,
      });
      booking.refundAmountPaise = refundPaise;
      booking.refundAmount = fromPaise(refundPaise);
    } else {
      booking.status = status;
    }

    booking.updatedAt = nowIso;
    this.persist();
    return { success: true, booking };
  }

  public extendBooking(bookingId: string, additionalHours: number): { success: boolean; booking?: Booking; error?: string } {
    const booking = this.state.bookings.find((b) => b.id === bookingId);
    if (!booking) return { success: false, error: 'Booking not found.' };

    const currentEnd = new Date(booking.endTime).getTime();
    const newEndTime = new Date(currentEnd + additionalHours * 60 * 60 * 1000).toISOString();

    const listing = this.getListingById(booking.listingId);
    if (!listing) return { success: false, error: 'Listing not found.' };

    const availability = this.calculateAvailability(booking.listingId, booking.endTime, newEndTime);
    if (availability.availableCapacity <= 0) {
      return { success: false, error: 'Cannot extend: slot is reserved by another driver right after your session.' };
    }

    const hourlyPaise = listing.pricing.hourlyRatePaise ?? toPaise(listing.pricing.hourlyRate);
    const additionalPricing = calculatePricingPaise(hourlyPaise, booking.endTime, newEndTime);
    booking.endTime = newEndTime;

    const newParkingPaise = (booking.pricingSnapshot.parkingFeePaise ?? toPaise(booking.pricingSnapshot.parkingFee)) + (additionalPricing.parkingFeePaise ?? 0);
    const newPlatformPaise = (booking.pricingSnapshot.platformFeePaise ?? toPaise(booking.pricingSnapshot.platformFee)) + (additionalPricing.platformFeePaise ?? 0);
    const newTaxesPaise = (booking.pricingSnapshot.totalTaxesPaise ?? toPaise(booking.pricingSnapshot.totalTaxes)) + (additionalPricing.totalTaxesPaise ?? 0);
    const newTotalPaise = (booking.pricingSnapshot.totalAmountPaise ?? toPaise(booking.pricingSnapshot.totalAmount)) + (additionalPricing.totalAmountPaise ?? 0);

    booking.pricingSnapshot.durationHours += additionalPricing.durationHours;
    booking.pricingSnapshot.parkingFeePaise = newParkingPaise;
    booking.pricingSnapshot.platformFeePaise = newPlatformPaise;
    booking.pricingSnapshot.totalTaxesPaise = newTaxesPaise;
    booking.pricingSnapshot.totalAmountPaise = newTotalPaise;
    booking.pricingSnapshot.parkingFee = fromPaise(newParkingPaise);
    booking.pricingSnapshot.platformFee = fromPaise(newPlatformPaise);
    booking.pricingSnapshot.totalTaxes = fromPaise(newTaxesPaise);
    booking.pricingSnapshot.totalAmount = fromPaise(newTotalPaise);
    booking.updatedAt = new Date().toISOString();

    this.persist();
    return { success: true, booking };
  }

  // --- Listings Management ---
  public getListings(): Listing[] {
    return this.state.listings.filter((l) => !l.deletedAt);
  }

  public getAdminListings(): Listing[] {
    const priority: Record<ListingStatus, number> = {
      PENDING_REVIEW: 0,
      NEEDS_INFO: 1,
      DRAFT: 2,
      SUSPENDED: 3,
      REJECTED: 4,
      VERIFIED: 5,
    };
    return this.state.listings
      .filter((l) => !l.deletedAt)
      .map((l) => ({
        ...l,
        isStale: isListingStale(l.lastConfirmedAt, APP_CONFIG.staleThresholdDays),
      }))
      .sort((a, b) => (priority[a.status] ?? 9) - (priority[b.status] ?? 9));
  }

  public getListingById(id: string): Listing | undefined {
    const l = this.state.listings.find((item) => item.id === id && !item.deletedAt);
    return l;
  }

  public getListingsByProvider(providerId: string): Listing[] {
    return this.state.listings
      .filter((l) => l.providerId === providerId && !l.deletedAt)
      .map((l) => ({
        ...l,
        isStale: isListingStale(l.lastConfirmedAt, APP_CONFIG.staleThresholdDays),
      }));
  }

  public createListing(
    listingData: Omit<Listing, 'id' | 'status' | 'rating' | 'reviewCount' | 'createdAt' | 'updatedAt' | 'isStale'> & {
      initialStatus?: 'DRAFT' | 'PENDING_REVIEW';
    }
  ): Listing {
    const nowIso = new Date().toISOString();
    const listingId = `lst_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const status: ListingStatus = listingData.initialStatus === 'DRAFT' ? 'DRAFT' : 'PENDING_REVIEW';

    const { initialStatus: _omit, ...rest } = listingData;
    const docs = (rest.documents || []).map((doc) => ({
      ...doc,
      listingId,
      fileUrl: `/api/private-docs/${doc.id}`,
    }));

    const pricing = withPaisePricing(
      rest.pricing.hourlyRate,
      rest.pricing.dailyRate,
      rest.pricing.monthlyRate
    );

    const newListing: Listing = {
      ...rest,
      id: listingId,
      status,
      pricing,
      documents: docs,
      submittedAt: status === 'PENDING_REVIEW' ? nowIso : undefined,
      rating: 0,
      reviewCount: 0,
      isStale: false,
      deletedAt: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    this.state.listings.push(newListing);

    if (status === 'PENDING_REVIEW') {
      this.createAuditLog({
        actorId: newListing.providerId,
        actorName: newListing.providerName,
        actorRole: 'PROVIDER',
        action: 'SUBMIT_LISTING',
        targetType: 'LISTING',
        targetId: listingId,
        details: `Submitted parking space "${newListing.title}" for admin verification.`,
      });
    }

    this.persist();
    return newListing;
  }

  public updateProviderListing(
    listingId: string,
    providerId: string,
    updates: Partial<Listing> & { submitForReview?: boolean }
  ): { success: boolean; listing?: Listing; error?: string } {
    const listing = this.getListingById(listingId);
    if (!listing) return { success: false, error: 'Listing not found.' };
    if (listing.providerId !== providerId) return { success: false, error: 'Forbidden: you do not own this listing.' };
    if (listing.status === 'VERIFIED' || listing.status === 'SUSPENDED') {
      return { success: false, error: 'Live or suspended listings cannot be overwritten directly.' };
    }

    const nowIso = new Date().toISOString();
    if (updates.title) listing.title = updates.title;
    if (updates.description !== undefined) listing.description = updates.description;
    if (updates.address) listing.address = updates.address;
    if (updates.locality) listing.locality = updates.locality;
    if (updates.latitude !== undefined) listing.latitude = updates.latitude;
    if (updates.longitude !== undefined) listing.longitude = updates.longitude;
    if (updates.totalCapacity !== undefined) listing.totalCapacity = updates.totalCapacity;
    if (updates.vehicleTypes) listing.vehicleTypes = updates.vehicleTypes;
    if (updates.isCovered !== undefined) listing.isCovered = updates.isCovered;
    if (updates.hasEvCharging !== undefined) listing.hasEvCharging = updates.hasEvCharging;
    if (updates.dimensionsNotes !== undefined) listing.dimensionsNotes = updates.dimensionsNotes;
    if (updates.accessMethod) listing.accessMethod = updates.accessMethod;
    if (updates.accessInstructions) listing.accessInstructions = updates.accessInstructions;
    if (updates.photos && updates.photos.length >= 3) listing.photos = updates.photos;
    if (updates.pricing) {
      listing.pricing = withPaisePricing(
        updates.pricing.hourlyRate,
        updates.pricing.dailyRate,
        updates.pricing.monthlyRate
      );
    }

    if (updates.submitForReview) {
      listing.status = 'PENDING_REVIEW';
      listing.submittedAt = nowIso;
      listing.reviewReason = undefined;
      this.createAuditLog({
        actorId: providerId,
        actorName: listing.providerName,
        actorRole: 'PROVIDER',
        action: 'SUBMIT_LISTING',
        targetType: 'LISTING',
        targetId: listing.id,
        details: `Submitted updated listing "${listing.title}" for review.`,
      });
    }

    listing.updatedAt = nowIso;
    this.persist();
    return { success: true, listing };
  }

  public reconfirmAvailability(listingId: string, providerId: string): { success: boolean; listing?: Listing; error?: string } {
    const listing = this.getListingById(listingId);
    if (!listing) return { success: false, error: 'Listing not found.' };
    if (listing.providerId !== providerId) return { success: false, error: 'Forbidden: you do not own this listing.' };

    const nowIso = new Date().toISOString();
    listing.lastConfirmedAt = nowIso;
    listing.isStale = false;
    listing.availabilityConfidence = 'PROVIDER_MANAGED';
    listing.updatedAt = nowIso;

    this.createAuditLog({
      actorId: providerId,
      actorName: listing.providerName,
      actorRole: 'PROVIDER',
      action: 'RECONFIRM_AVAILABILITY',
      targetType: 'LISTING',
      targetId: listingId,
      details: 'Provider reconfirmed availability and weekly operating schedule.',
    });

    this.persist();
    return { success: true, listing };
  }

  // --- Admin Verification & Moderation (PRD 7.3) ---
  public adminUpdateListingStatus(
    adminId: string,
    listingId: string,
    newStatus: ListingStatus,
    reason?: string
  ): { success: boolean; listing?: Listing; error?: string } {
    const admin = this.getUserById(adminId);
    if (!admin || !admin.roles.includes('ADMIN')) {
      return { success: false, error: 'Forbidden: Admin capability required.' };
    }

    const listing = this.getListingById(listingId);
    if (!listing) return { success: false, error: 'Listing not found.' };

    if ((newStatus === 'REJECTED' || newStatus === 'NEEDS_INFO') && (!reason || !reason.trim())) {
      return { success: false, error: `A clear reason is required when marking a listing as ${newStatus}.` };
    }

    const nowIso = new Date().toISOString();
    listing.status = newStatus;
    listing.reviewReason = reason?.trim() || undefined;
    listing.updatedAt = nowIso;

    if (newStatus === 'VERIFIED') {
      listing.approvedAt = nowIso;
      listing.lastConfirmedAt = nowIso;
      listing.isBookable = listing.category !== 'PUBLIC';
      if (listing.documents) {
        for (const doc of listing.documents) {
          doc.status = 'VERIFIED';
          doc.verifiedAt = nowIso;
          doc.verifiedBy = admin.id;
        }
      }
    } else if (newStatus === 'REJECTED' && listing.documents) {
      for (const doc of listing.documents) {
        doc.status = 'REJECTED';
        doc.rejectionReason = reason;
      }
    }

    this.state.listingVerifications.push({
      id: `ver_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      listingId: listing.id,
      status: newStatus,
      reviewerId: admin.id,
      reason: listing.reviewReason,
      reviewedAt: nowIso,
      evidenceDocIds: (listing.documents || []).map((d) => d.id),
    });

    const action: AuditLog['action'] =
      newStatus === 'VERIFIED'
        ? 'APPROVE_LISTING'
        : newStatus === 'SUSPENDED'
        ? 'SUSPEND_LISTING'
        : newStatus === 'NEEDS_INFO'
        ? 'REQUEST_LISTING_INFO'
        : 'REJECT_LISTING';

    this.createAuditLog({
      actorId: admin.id,
      actorName: admin.name,
      actorRole: 'ADMIN',
      action,
      targetType: 'LISTING',
      targetId: listingId,
      details: `Listing status updated to ${newStatus}.${listing.reviewReason ? ' Reason: ' + listing.reviewReason : ''}`,
    });

    this.persist();
    return { success: true, listing };
  }

  public getPrivateDocumentForActor(
    docId: string,
    actorId: string
  ): { allowed: boolean; status: number; doc?: ProviderDocument; listingTitle?: string; error?: string } {
    const actor = this.getUserById(actorId);
    if (!actor) return { allowed: false, status: 401, error: 'Authentication required.' };

    for (const listing of this.state.listings) {
      const doc = (listing.documents || []).find((d) => d.id === docId);
      if (doc) {
        const isAdmin = actor.roles.includes('ADMIN');
        const isOwner = doc.providerId === actor.id || listing.providerId === actor.id;
        if (!isAdmin && !isOwner) {
          return { allowed: false, status: 403, error: 'Forbidden: restricted verification document.' };
        }

        this.createAuditLog({
          actorId: actor.id,
          actorName: actor.name || actor.phone,
          actorRole: isAdmin ? 'ADMIN' : 'PROVIDER',
          action: 'VIEW_VERIFICATION_DOC',
          targetType: 'DOCUMENT',
          targetId: doc.id,
          details: `Accessed restricted right-to-rent proof "${doc.fileName}" for listing "${listing.title}".`,
        });

        return { allowed: true, status: 200, doc, listingTitle: listing.title };
      }
    }

    return { allowed: false, status: 404, error: 'Verification document not found.' };
  }

  // --- Disputes & Support ---
  public createDispute(data: {
    bookingId: string;
    raisedByUserId: string;
    category: Dispute['category'];
    description: string;
    evidencePhotos?: string[];
  }): { success: boolean; dispute?: Dispute; error?: string } {
    const booking = this.state.bookings.find((b) => b.id === data.bookingId);
    if (!booking) return { success: false, error: 'Booking not found.' };

    const user = this.getUserById(data.raisedByUserId);
    const raisedByRole = user?.activeRole === 'PROVIDER' ? 'PROVIDER' : 'DRIVER';
    const againstUserId = raisedByRole === 'DRIVER' ? booking.providerId : booking.driverId;

    const slaDeadline = new Date(Date.now() + APP_CONFIG.disputeSlaHours * 60 * 60 * 1000).toISOString();

    const newDispute: Dispute = {
      id: `disp_${Date.now()}`,
      bookingId: booking.id,
      bookingReference: booking.referenceNumber,
      raisedByUserId: data.raisedByUserId,
      raisedByRole,
      againstUserId,
      category: data.category,
      description: data.description,
      evidencePhotos: data.evidencePhotos || [],
      status: 'OPEN',
      slaDeadline,
      createdAt: new Date().toISOString(),
    };

    booking.isDisputed = true;
    booking.disputeId = newDispute.id;
    booking.status = 'DISPUTED';

    this.state.disputes.push(newDispute);
    this.persist();
    return { success: true, dispute: newDispute };
  }

  public resolveDispute(
    adminId: string,
    disputeId: string,
    notes: string,
    refundAmount: number = 0
  ): { success: boolean; dispute?: Dispute; error?: string } {
    const admin = this.getUserById(adminId);
    if (!admin || !admin.roles.includes('ADMIN')) {
      return { success: false, error: 'Forbidden: Admin capability required.' };
    }

    const dispute = this.state.disputes.find((d) => d.id === disputeId);
    if (!dispute) return { success: false, error: 'Dispute not found.' };

    dispute.status = 'RESOLVED';
    dispute.adminResolutionNotes = notes;
    dispute.refundGranted = refundAmount;
    dispute.resolvedAt = new Date().toISOString();
    dispute.resolvedByAdminId = admin.id;

    const booking = this.state.bookings.find((b) => b.id === dispute.bookingId);
    if (booking && refundAmount > 0) {
      booking.refundAmount = refundAmount;
      booking.refundAmountPaise = toPaise(refundAmount);
    }

    this.createAuditLog({
      actorId: admin.id,
      actorName: admin.name,
      actorRole: 'ADMIN',
      action: 'RESOLVE_DISPUTE',
      targetType: 'DISPUTE',
      targetId: disputeId,
      details: `Dispute resolved. Refund granted: ₹${refundAmount}. Notes: ${notes}`,
    });

    this.persist();
    return { success: true, dispute };
  }

  // --- Audit Logs ---
  public createAuditLog(data: Omit<AuditLog, 'id' | 'timestamp'>): AuditLog {
    const log: AuditLog = {
      ...data,
      id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    this.state.auditLogs.unshift(log);
    this.persist();
    return log;
  }

  public getAuditLogs(): AuditLog[] {
    return this.state.auditLogs;
  }

  public getDisputes(): Dispute[] {
    return this.state.disputes;
  }

  public getBookings(): Booking[] {
    return this.state.bookings;
  }

  public getPayments(): Payment[] {
    return this.state.payments;
  }

  public getPayouts(): Payout[] {
    return this.state.payouts;
  }

  public getMonthlyPasses(): MonthlyPass[] {
    return this.state.monthlyPasses;
  }

  public createMonthlyPass(data: {
    listingId: string;
    driverId: string;
    driverName: string;
    vehiclePlateNumber: string;
    vehicleType: User['vehicles'][0]['type'];
    month: string;
    price: number;
  }): MonthlyPass {
    const startDate = `${data.month}-01`;
    const endDate = `${data.month}-28`;

    const pass: MonthlyPass = {
      id: `pass_${Date.now()}`,
      listingId: data.listingId,
      listingTitle: this.getListingById(data.listingId)?.title || 'Reserved Slot',
      driverId: data.driverId,
      driverName: data.driverName,
      vehiclePlateNumber: data.vehiclePlateNumber,
      vehicleType: data.vehicleType,
      month: data.month,
      startDate,
      endDate,
      price: data.price,
      pricePaise: toPaise(data.price),
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    };

    this.state.monthlyPasses.push(pass);
    this.persist();
    return pass;
  }
}

// Global Singleton
const globalForDb = globalThis as unknown as { vparkDb: Database };
export const db = globalForDb.vparkDb || new Database();
if (process.env.NODE_ENV !== 'production') globalForDb.vparkDb = db;
