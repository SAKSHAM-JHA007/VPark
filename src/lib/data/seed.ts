import type {
  AuditLog,
  Booking,
  ConsentRecord,
  Listing,
  ListingVerification,
  MonthlyPass,
  Payment,
  Payout,
  Review,
  DriverProfile,
  ProviderProfile,
  RoleDefinition,
  User,
  UserRoleGrant,
} from '@/types';
import { APP_CONFIG, toPaise } from '../constants';
import type { DatabaseState } from './json-store';

// Demo seed data (PRD v2.2 Section 9). Used for fresh local development stores and
// explicit test/dev seeding only; never loaded into a production database.
export function withPaisePricing(hourlyInr: number, dailyInr: number, monthlyInr?: number) {
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
export function getSeedData(): DatabaseState {
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
    // The master administrator is no longer seeded. Admin access is granted only to
    // Google identities whose Firebase UID is listed in VPARK_ADMIN_FIREBASE_UIDS.
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

  const listings: Listing[] = [];
  const listingVerifications: ListingVerification[] = [];
  const bookings: Booking[] = [];
  const payments: Payment[] = [];
  const payouts: Payout[] = [];
  const auditLogs: AuditLog[] = [];
  const reviews: Review[] = [];
  const monthlyPasses: MonthlyPass[] = [];

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
    sessions: [],
    contactMessages: [],
  };
}
