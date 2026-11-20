// Shared description of every persisted VPark collection.
//
// Used by the PostgreSQL store (table + typed, constrained columns), the local
// JSON development store (field filters) and the migration CLI. Each entity is
// stored whole as JSONB; the listed columns are extracted copies used for
// lookups, constraints, foreign keys and locking.

/** @typedef {{ column: string, type?: 'text' | 'timestamptz', lower?: boolean }} ColumnSpec */

const text = (column, extra = {}) => ({ column, type: 'text', ...extra });
const ts = (column) => ({ column, type: 'timestamptz' });

export const COLLECTIONS = Object.freeze({
  users: { table: 'vp_users', key: (e) => e.id, columns: { email: text('email', { lower: true }), firebaseUid: text('firebase_uid'), phone: text('phone') } },
  userRoles: { table: 'vp_user_roles', key: (e) => `${e.userId}:${e.roleName}`, columns: { userId: text('user_id'), roleName: text('role_name') } },
  providerProfiles: { table: 'vp_provider_profiles', key: (e) => e.userId, columns: {} },
  driverProfiles: { table: 'vp_driver_profiles', key: (e) => e.userId, columns: {} },
  consents: { table: 'vp_consents', key: (e) => e.id, columns: { userId: text('user_id') } },
  otpChallenges: { table: 'vp_otp_challenges', key: (e) => e.id, columns: {} },
  listings: { table: 'vp_listings', key: (e) => e.id, columns: { providerId: text('provider_id'), status: text('status'), category: text('category') } },
  listingVerifications: { table: 'vp_listing_verifications', key: (e) => e.id, columns: { listingId: text('listing_id') } },
  holds: { table: 'vp_holds', key: (e) => e.id, columns: { listingId: text('listing_id'), userId: text('user_id'), expiresAt: ts('expires_at') } },
  bookings: {
    table: 'vp_bookings',
    key: (e) => e.id,
    columns: {
      listingId: text('listing_id'),
      driverId: text('driver_id'),
      providerId: text('provider_id'),
      referenceNumber: text('reference_number'),
      status: text('status'),
    },
  },
  payments: { table: 'vp_payments', key: (e) => e.id, columns: { bookingId: text('booking_id') } },
  payouts: { table: 'vp_payouts', key: (e) => e.id, columns: { providerId: text('provider_id') } },
  disputes: { table: 'vp_disputes', key: (e) => e.id, columns: { bookingId: text('booking_id'), raisedByUserId: text('raised_by_user_id'), againstUserId: text('against_user_id') } },
  // Newest first, matching the original in-memory store (audit logs were unshifted).
  auditLogs: { table: 'vp_audit_logs', key: (e) => e.id, columns: { actorId: text('actor_id') }, newestFirst: true },
  reviews: { table: 'vp_reviews', key: (e) => e.id, columns: { listingId: text('listing_id') } },
  monthlyPasses: { table: 'vp_monthly_passes', key: (e) => e.id, columns: { listingId: text('listing_id'), driverId: text('driver_id') } },
  contactMessages: { table: 'vp_contact_messages', key: (e) => e.id, columns: {} },
  // Keyed by the HMAC of the session token; the raw token is never stored.
  sessions: {
    table: 'vp_sessions',
    key: (e) => e.tokenHash,
    columns: { userId: text('user_id'), expiresAt: ts('expires_at'), lastSeenAt: ts('last_seen_at') },
  },
});

export const COLLECTION_NAMES = Object.freeze(Object.keys(COLLECTIONS));

/** Value stored in an indexed column for an entity field. */
export function columnValue(spec, value) {
  if (value === undefined || value === null || value === '') return null;
  const s = String(value);
  return spec.lower ? s.trim().toLowerCase() : s;
}
