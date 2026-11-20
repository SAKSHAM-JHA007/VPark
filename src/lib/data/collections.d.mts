import type {
  AuditLog,
  Booking,
  ConsentRecord,
  Dispute,
  DriverProfile,
  Listing,
  ListingVerification,
  MonthlyPass,
  OtpChallenge,
  Payment,
  Payout,
  ProviderProfile,
  Review,
  SessionRecord,
  SlotHold,
  User,
  UserRoleGrant,
} from '@/types';

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  ip: string;
  userAgent: string;
  createdAt: string;
  status: 'UNREAD' | 'READ';
}

export interface CollectionTypes {
  users: User;
  userRoles: UserRoleGrant;
  providerProfiles: ProviderProfile;
  driverProfiles: DriverProfile;
  consents: ConsentRecord;
  otpChallenges: OtpChallenge;
  listings: Listing;
  listingVerifications: ListingVerification;
  holds: SlotHold;
  bookings: Booking;
  payments: Payment;
  payouts: Payout;
  disputes: Dispute;
  auditLogs: AuditLog;
  reviews: Review;
  monthlyPasses: MonthlyPass;
  contactMessages: ContactMessage;
  sessions: SessionRecord;
}

export type CollectionName = keyof CollectionTypes;

export interface ColumnSpec {
  column: string;
  type?: 'text' | 'timestamptz';
  lower?: boolean;
}

export interface CollectionSpec<K extends CollectionName = CollectionName> {
  table: string;
  key: (entity: CollectionTypes[K]) => string;
  columns: Record<string, ColumnSpec>;
  newestFirst?: boolean;
}

export const COLLECTIONS: { readonly [K in CollectionName]: CollectionSpec<K> };
export const COLLECTION_NAMES: readonly CollectionName[];
export function columnValue(spec: ColumnSpec, value: unknown): string | null;
