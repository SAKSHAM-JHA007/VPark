import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type {
  AuditLog,
  Booking,
  BookingStatus,
  ConsentRecord,
  Dispute,
  Listing,
  ListingStatus,
  MonthlyPass,
  Payment,
  Payout,
  PriceBreakdown,
  ProviderDocument,
  ProviderType,
  RankingBreakdown,
  SearchFilters,
  SearchResultItem,
  SessionRecord,
  SlotHold,
  User,
  UserRole,
} from '@/types';
import type { SessionStore } from './security/session.mjs';
import { APP_CONFIG, toPaise, fromPaise } from './constants';
import { validatePlateNumber, formatPlateNumber } from './validation';
import {
  normalizeIndianPhone,
  calculatePricingPaise,
  calculateCancellationRefundPaise,
  isListingStale,
  calculateRankingScore,
} from './engine.mjs';
import { discoveryDistanceKm, toPublicListingSummary } from './security/listing-privacy.mjs';
import { resolveDataBackend } from './data/config.mjs';
import type { ContactMessage } from './data/collections.mjs';
import { DataStoreUnavailableError, type DataStore, type Tx } from './data/store';
import { withPaisePricing, getSeedData } from './data/seed';

export { DataStoreUnavailableError, isDataStoreUnavailable } from './data/store';
export type { DataStore } from './data/store';
export type { ContactMessage } from './data/collections.mjs';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LIVE_BOOKING_STATUSES: BookingStatus[] = ['CONFIRMED', 'CHECKED_IN'];

function localDataDir(): string {
  // VPARK_DATA_DIR lets automated tests run against an isolated temporary directory.
  return process.env.VPARK_DATA_DIR ? path.resolve(process.env.VPARK_DATA_DIR) : path.join(process.cwd(), '.data');
}

/** Collision-resistant IDs: many serverless instances may create records in the same millisecond. */
function newId(prefix: string): string {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`;
}

function isActiveUser(u: User | undefined): u is User {
  return Boolean(u) && !u!.deletedAt && u!.accountStatus !== 'DELETION_PENDING';
}

function overlaps(startA: string, endA: string, startB: string, endB: string): boolean {
  return startA < endB && endA > startB;
}

let reportedConfigError = '';
const globalForStores = globalThis as unknown as { vparkPgStores?: Map<string, Promise<DataStore>> };

/** Build the store selected by the environment. Production without PostgreSQL fails closed. */
async function createStoreFromEnv(): Promise<DataStore> {
  const backend = resolveDataBackend(process.env);
  if (!backend.kind) {
    if (reportedConfigError !== backend.error) {
      reportedConfigError = backend.error;
      console.error(`[db] Data store disabled (fail closed): ${backend.error}`);
    }
    throw new DataStoreUnavailableError(backend.error);
  }
  if (backend.kind === 'postgres') {
    // Reuse pools across hot reloads in development so connections are not leaked.
    const cache = (globalForStores.vparkPgStores ??= new Map());
    let pending = cache.get(backend.connectionString);
    if (!pending) {
      pending = (async () => {
        const { createPgPool, createPostgresStore } = await import('./data/postgres-store');
        return createPostgresStore(await createPgPool(backend));
      })();
      cache.set(backend.connectionString, pending);
      pending.catch(() => cache.delete(backend.connectionString));
    }
    return pending;
  }
  const { createJsonStore } = await import('./data/json-store');
  return createJsonStore({ dataDir: localDataDir() });
}

/**
 * VPark application data access. Every public method runs in exactly one store
 * transaction, so each operation is atomic, and critical sections (capacity checks,
 * booking state changes, account linking) hold row or advisory locks that serialize
 * concurrent requests across all serverless instances.
 */
export class Database {
  private storePromise: Promise<DataStore> | null = null;
  private injectedStore: DataStore | null;

  constructor(store?: DataStore) {
    this.injectedStore = store ?? null;
  }

  /** Test-only: route this instance to a specific store (refused outside NODE_ENV=test). */
  public useStoreForTesting(store: DataStore | null) {
    if (process.env.NODE_ENV !== 'test') throw new Error('useStoreForTesting is only available in tests.');
    this.injectedStore = store;
  }

  private async store(): Promise<DataStore> {
    if (this.injectedStore) return this.injectedStore;
    if (!this.storePromise) {
      const pending = createStoreFromEnv();
      this.storePromise = pending;
      pending.catch(() => {
        if (this.storePromise === pending) this.storePromise = null;
      });
    }
    return this.storePromise;
  }

  private async tx<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    return (await this.store()).transaction(fn);
  }

  public async backendKind(): Promise<DataStore['kind']> {
    return (await this.store()).kind;
  }

  /** Local private uploads directory (JSON development store only); null for PostgreSQL. */
  public async getPrivateUploadsDir(): Promise<string | null> {
    if ((await this.backendKind()) !== 'json') return null;
    const dir = path.join(localDataDir(), 'private_uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  /**
   * Insert the demo seed users if the store has no users yet. Never runs in
   * production; intended for tests and local PostgreSQL development.
   */
  public async seedDemoData(): Promise<boolean> {
    if (process.env.NODE_ENV === 'production') throw new Error('Refusing to seed demo data in production.');
    const seed = getSeedData();
    return this.tx(async (tx) => {
      if ((await tx.all('users')).length > 0) return false;
      for (const u of seed.users) await tx.put('users', u);
      for (const r of seed.userRoles) await tx.put('userRoles', r);
      for (const p of seed.providerProfiles) await tx.put('providerProfiles', p);
      for (const d of seed.driverProfiles) await tx.put('driverProfiles', d);
      for (const c of seed.consents) await tx.put('consents', c);
      return true;
    });
  }

  // --- Internal helpers (always called inside a transaction) -------------------------

  private async audit(tx: Tx, data: Omit<AuditLog, 'id' | 'timestamp'>): Promise<AuditLog> {
    const log: AuditLog = { ...data, id: newId('aud'), timestamp: new Date().toISOString() };
    await tx.put('auditLogs', log);
    return log;
  }

  private async cleanExpiredHolds(tx: Tx) {
    await tx.deleteWhere('holds', { expiresAt: { lte: new Date().toISOString() } });
  }

  private async activeUser(tx: Tx, id: string, forUpdate = false): Promise<User | undefined> {
    const user = await tx.get('users', id, { forUpdate });
    return isActiveUser(user) ? user : undefined;
  }

  private async emailInUseByOther(tx: Tx, email: string, userId: string): Promise<boolean> {
    const clean = (email || '').trim().toLowerCase();
    if (!clean) return false;
    const matches = await tx.find('users', { email: clean });
    return matches.some((u) => u.id !== userId && isActiveUser(u));
  }

  private async availability(tx: Tx, listing: Listing, startTime: string, endTime: string) {
    const nowIso = new Date().toISOString();
    const bookings = await tx.find('bookings', { listingId: listing.id, status: LIVE_BOOKING_STATUSES });
    const holds = await tx.find('holds', { listingId: listing.id, expiresAt: { gt: nowIso } });
    const bookedCount = bookings.filter((b) => overlaps(startTime, endTime, b.startTime, b.endTime)).length;
    const activeHoldsCount = holds.filter((h) => overlaps(startTime, endTime, h.startTime, h.endTime)).length;
    return {
      totalCapacity: listing.totalCapacity,
      bookedCount,
      activeHoldsCount,
      availableCapacity: Math.max(0, listing.totalCapacity - bookedCount - activeHoldsCount),
    };
  }

  private async grantCapabilityInternal(tx: Tx, user: User, role: UserRole, grantedBy: string) {
    if (!user.roles.includes(role)) user.roles.push(role);
    const grantKey = `${user.id}:${role}`;
    if (!(await tx.get('userRoles', grantKey))) {
      await tx.put('userRoles', {
        userId: user.id,
        roleId: `role_${role.toLowerCase()}`,
        roleName: role,
        grantedAt: new Date().toISOString(),
        grantedBy,
      });
    }
    if (role === 'PROVIDER') {
      if (!user.providerType) user.providerType = 'OWNER';
      if (!(await tx.get('providerProfiles', user.id))) {
        await tx.put('providerProfiles', { userId: user.id, providerType: user.providerType, displayName: user.name || user.phone });
      }
    } else if (role === 'DRIVER') {
      if (!(await tx.get('driverProfiles', user.id))) {
        await tx.put('driverProfiles', { userId: user.id, preferences: {} });
      }
    }
  }

  private async withListingCoordinates(tx: Tx, bookings: Booking[]): Promise<Booking[]> {
    const cache = new Map<string, Listing | undefined>();
    const out: Booking[] = [];
    for (const b of bookings) {
      if ((b.listingLatitude === undefined || b.listingLongitude === undefined) && b.listingId) {
        if (!cache.has(b.listingId)) cache.set(b.listingId, await tx.get('listings', b.listingId));
        const listing = cache.get(b.listingId);
        if (listing && !listing.deletedAt) {
          out.push({ ...b, listingLatitude: listing.latitude, listingLongitude: listing.longitude });
          continue;
        }
      }
      out.push(b);
    }
    return out;
  }

  // --- Users, accounts & consents (PRD Section 6 & 9) -------------------------------

  public async getUsers(): Promise<User[]> {
    return this.tx((tx) => tx.all('users'));
  }

  public async getUserById(id: string): Promise<User | undefined> {
    return this.tx((tx) => this.activeUser(tx, id));
  }

  public async isEmailInUseByOtherUser(rawEmail: string, userId: string): Promise<boolean> {
    return this.tx((tx) => this.emailInUseByOther(tx, rawEmail, userId));
  }

  /**
   * Create or update the account for a Google identity whose Firebase ID token has
   * already been verified server-side. Every argument must come from the verified
   * token (or from server configuration, for grantAdmin), never from the request body.
   *
   * Account resolution order:
   *   1. the account already linked to this Firebase UID;
   *   2. a legacy account created by the previous Google flow (`usr_<uid>`) that has
   *      not been linked yet;
   *   3. a not-yet-linked account whose verified email matches the token's verified email;
   *   4. otherwise a new account.
   * An account linked to a different Firebase UID is never taken over. Advisory locks on
   * the UID and email make concurrent first sign-ins resolve to a single account.
   */
  public async upsertVerifiedGoogleUser(identity: {
    uid: string;
    email: string;
    name?: string;
    photoUrl?: string;
    intent?: 'driver' | 'provider';
    grantAdmin: boolean;
  }): Promise<{ success: true; user: User; created: boolean } | { success: false; status: number; error: string }> {
    const uid = identity.uid;
    const cleanEmail = identity.email.trim().toLowerCase();
    return this.tx(async (tx) => {
      await tx.lock(`google-uid:${uid}`);
      await tx.lock(`email:${cleanEmail}`);
      const nowIso = new Date().toISOString();

      let user = (await tx.find('users', { firebaseUid: uid }, { forUpdate: true })).find(isActiveUser);
      if (!user) {
        const legacy = await tx.get('users', `usr_${uid}`, { forUpdate: true });
        if (isActiveUser(legacy) && !legacy.firebaseUid) user = legacy;
      }
      if (!user) {
        user = (await tx.find('users', { email: cleanEmail }, { forUpdate: true })).find(
          (u) => isActiveUser(u) && !u.firebaseUid && Boolean(u.emailVerifiedAt)
        );
      }

      if (user && user.accountStatus === 'SUSPENDED') {
        return { success: false as const, status: 403, error: 'This account is suspended. Contact support@vpark.in.' };
      }

      let created = false;
      if (!user) {
        created = true;
        const baseRoles: UserRole[] = identity.intent === 'provider' ? ['DRIVER', 'PROVIDER'] : ['DRIVER'];
        user = {
          id: `usr_${crypto.randomBytes(9).toString('hex')}`,
          firebaseUid: uid,
          name: identity.name || cleanEmail.split('@')[0],
          email: cleanEmail,
          phone: '',
          photoUrl: identity.photoUrl,
          avatarUrl: identity.photoUrl,
          roles: baseRoles,
          activeRole: identity.intent === 'provider' ? 'PROVIDER' : 'DRIVER',
          accountStatus: 'ACTIVE',
          isPhoneVerified: false,
          emailVerifiedAt: nowIso,
          lastLoginAt: nowIso,
          createdAt: nowIso,
          updatedAt: nowIso,
          deletedAt: null,
          vehicles: [],
        };
        // The user row must exist before rows that reference it.
        await tx.put('users', user);
        for (const r of baseRoles) {
          await tx.put('userRoles', { userId: user.id, roleId: `role_${r.toLowerCase()}`, roleName: r, grantedAt: nowIso, grantedBy: 'GOOGLE_AUTH' });
        }
      } else {
        user.firebaseUid = uid;
        user.lastLoginAt = nowIso;
        user.updatedAt = nowIso;
        if (!user.email) user.email = cleanEmail;
        if ((user.email || '').trim().toLowerCase() === cleanEmail) user.emailVerifiedAt = user.emailVerifiedAt || nowIso;
        if (identity.name && (!user.name || user.name.startsWith('+91'))) user.name = identity.name;
        if (identity.photoUrl) {
          user.photoUrl = identity.photoUrl;
          user.avatarUrl = identity.photoUrl;
        }
        if (identity.intent === 'provider' && !user.roles.includes('PROVIDER')) {
          await this.grantCapabilityInternal(tx, user, 'PROVIDER', 'USER_INTENT');
        }
      }

      if (identity.grantAdmin) {
        // Only reachable when the verified UID is on the server-side admin allowlist.
        await this.grantCapabilityInternal(tx, user, 'ADMIN', 'ADMIN_ALLOWLIST');
        await this.grantCapabilityInternal(tx, user, 'DRIVER', 'ADMIN_ALLOWLIST');
        await this.grantCapabilityInternal(tx, user, 'PROVIDER', 'ADMIN_ALLOWLIST');
        user.activeRole = 'ADMIN';
      }
      await tx.put('users', user);

      await this.audit(tx, {
        actorId: user.id,
        actorName: user.name || user.email || user.id,
        actorRole: user.activeRole,
        action: 'LOGIN_OTP',
        targetType: 'USER',
        targetId: user.id,
        details: identity.grantAdmin
          ? 'Allowlisted administrator signed in with a verified Google identity.'
          : `User signed in with a verified Google identity (${created ? 'new account' : 'existing account'}).`,
      });
      return { success: true as const, user, created };
    });
  }

  public async completeOnboarding(params: {
    userId: string;
    fullName: string;
    phone?: string;
    email?: string;
    providerType?: ProviderType;
    acceptTerms: boolean;
    ipAddress: string;
    userAgent: string;
  }): Promise<{ success: boolean; user?: User; consents?: ConsentRecord[]; error?: string }> {
    return this.tx(async (tx) => {
      const user = await this.activeUser(tx, params.userId, true);
      if (!user) return { success: false, error: 'User session not found.' };

      const cleanName = params.fullName.trim();
      if (!cleanName || cleanName.length < 2) return { success: false, error: 'Please enter your full name.' };
      if (!params.acceptTerms) return { success: false, error: 'Acceptance of Terms and Privacy Policy is required.' };

      const nowIso = new Date().toISOString();
      if (params.email && params.email.trim()) {
        const nextEmail = params.email.trim().toLowerCase();
        if (!EMAIL_PATTERN.test(nextEmail) || nextEmail.length > 254) return { success: false, error: 'Enter a valid email address.' };
        if (nextEmail !== (user.email || '').trim().toLowerCase()) {
          await tx.lock(`email:${nextEmail}`);
          if (await this.emailInUseByOther(tx, nextEmail, user.id)) {
            return { success: false, error: 'This email address is already linked to another account.' };
          }
          // A self-declared contact email is not verified and is never used to link identities.
          user.email = nextEmail;
          user.emailVerifiedAt = null;
        }
      }
      user.name = cleanName;
      if (params.phone && params.phone.trim()) {
        const norm = normalizeIndianPhone(params.phone.trim());
        if (!norm) return { success: false, error: 'Please enter a valid 10-digit mobile number starting with 6-9.' };
        user.phone = norm;
        user.isPhoneVerified = true;
        user.phoneVerifiedAt = nowIso;
      }
      if (params.providerType) {
        user.providerType = params.providerType;
        const profile = await tx.get('providerProfiles', user.id);
        await tx.put(
          'providerProfiles',
          profile ? { ...profile, providerType: params.providerType, displayName: cleanName } : { userId: user.id, providerType: params.providerType, displayName: cleanName }
        );
      }
      user.updatedAt = nowIso;
      await tx.put('users', user);

      const consentBase = { userId: user.id, acceptedAt: nowIso, ipAddress: params.ipAddress, userAgent: params.userAgent };
      const newConsents: ConsentRecord[] = [
        { ...consentBase, id: newId('cons_tos'), documentType: 'TERMS_OF_SERVICE', documentVersion: APP_CONFIG.legalDocVersions.terms },
        { ...consentBase, id: newId('cons_priv'), documentType: 'PRIVACY_POLICY', documentVersion: APP_CONFIG.legalDocVersions.privacy },
      ];
      if (user.roles.includes('PROVIDER')) {
        newConsents.push({ ...consentBase, id: newId('cons_prov'), documentType: 'PROVIDER_TERMS', documentVersion: APP_CONFIG.legalDocVersions.providerTerms });
      }
      for (const c of newConsents) await tx.put('consents', c);

      await this.audit(tx, {
        actorId: user.id,
        actorName: user.name,
        actorRole: user.activeRole,
        action: 'CONSENT_ACCEPTED',
        targetType: 'CONSENT',
        targetId: newConsents[0].id,
        details: `User completed onboarding and accepted Terms (${APP_CONFIG.legalDocVersions.terms}) & Privacy Policy.`,
        metadata: { ipAddress: params.ipAddress, documentVersions: APP_CONFIG.legalDocVersions },
      });
      return { success: true, user, consents: newConsents };
    });
  }

  public async grantCapability(
    userId: string,
    role: 'DRIVER' | 'PROVIDER',
    providerType?: ProviderType
  ): Promise<{ success: boolean; user?: User; error?: string }> {
    return this.tx(async (tx) => {
      const user = await this.activeUser(tx, userId, true);
      if (!user) return { success: false, error: 'User not found.' };
      if (providerType) user.providerType = providerType;
      await this.grantCapabilityInternal(tx, user, role, 'SELF_ADD');
      user.activeRole = role;
      user.updatedAt = new Date().toISOString();
      await tx.put('users', user);
      await this.audit(tx, {
        actorId: user.id,
        actorName: user.name || user.phone,
        actorRole: role,
        action: 'GRANT_CAPABILITY',
        targetType: 'USER',
        targetId: user.id,
        details: `Added ${role} capability without re-entering account details.`,
      });
      return { success: true, user };
    });
  }

  public async switchActiveMode(userId: string, role: UserRole): Promise<{ success: boolean; user?: User; error?: string }> {
    return this.tx(async (tx) => {
      const user = await this.activeUser(tx, userId, true);
      if (!user) return { success: false, error: 'User not found.' };
      if (!user.roles.includes(role)) return { success: false, error: `Capability ${role} is not enabled on this account.` };
      user.activeRole = role;
      user.updatedAt = new Date().toISOString();
      await tx.put('users', user);
      return { success: true, user };
    });
  }

  public async updateUserEmail(userId: string, email: string): Promise<{ success: boolean; user?: User; error?: string }> {
    return this.tx(async (tx) => {
      const user = await this.activeUser(tx, userId, true);
      if (!user) return { success: false, error: 'User not found.' };
      const clean = email.trim().toLowerCase();
      if (!EMAIL_PATTERN.test(clean) || clean.length > 254) return { success: false, error: 'Enter a valid email address.' };
      if (clean !== (user.email || '').trim().toLowerCase()) {
        await tx.lock(`email:${clean}`);
        if (await this.emailInUseByOther(tx, clean, user.id)) {
          return { success: false, error: 'This email address is already linked to another account.' };
        }
        user.email = clean;
        // No verification step exists for contact emails, so never mark them verified.
        user.emailVerifiedAt = null;
      }
      user.updatedAt = new Date().toISOString();
      await tx.put('users', user);
      return { success: true, user };
    });
  }

  public async getUserConsents(userId: string): Promise<ConsentRecord[]> {
    return this.tx((tx) => tx.find('consents', { userId }));
  }

  public async softDeleteUser(userId: string): Promise<{ success: boolean; error?: string }> {
    return this.tx(async (tx) => {
      const user = await tx.get('users', userId, { forUpdate: true });
      if (!user) return { success: false, error: 'User not found.' };
      const nowIso = new Date().toISOString();
      user.accountStatus = 'DELETION_PENDING';
      user.deletedAt = nowIso;
      user.name = 'Deleted User';
      user.email = undefined;
      user.phone = `deleted_${user.id}`;
      user.vehicles = [];
      user.firebaseUid = undefined;
      user.updatedAt = nowIso;
      await tx.put('users', user);

      // Suspend the user's live listings
      for (const listing of await tx.find('listings', { providerId: userId }, { forUpdate: true })) {
        if (listing.status === 'VERIFIED') {
          await tx.put('listings', { ...listing, status: 'SUSPENDED', deletedAt: nowIso, updatedAt: nowIso });
        }
      }

      await this.audit(tx, {
        actorId: userId,
        actorName: 'DPDP Self-Service Request',
        actorRole: 'DRIVER',
        action: 'ACCOUNT_DELETION_REQUESTED',
        targetType: 'USER',
        targetId: userId,
        details: 'User initiated account soft-deletion and PII anonymisation under DPDP Act 2023.',
      });
      return { success: true };
    });
  }

  public async addVehicle(userId: string, vehicle: Omit<User['vehicles'][0], 'id' | 'userId'>): Promise<User | undefined> {
    return this.tx(async (tx) => {
      const user = await this.activeUser(tx, userId, true);
      if (!user) return undefined;
      if (!validatePlateNumber(vehicle.plateNumber)) return undefined;
      const formattedPlate = formatPlateNumber(vehicle.plateNumber) || vehicle.plateNumber.toUpperCase().trim();
      user.vehicles.push({ ...vehicle, plateNumber: formattedPlate, id: newId('veh'), userId, deletedAt: null });
      await tx.put('users', user);
      return user;
    });
  }

  // --- Search & Ranking (SRCH-1 to SRCH-6, PRD 8.2) ---------------------------------

  public async searchListings(filters: SearchFilters): Promise<SearchResultItem[]> {
    return this.tx(async (tx) => {
      await this.cleanExpiredHolds(tx);

      const targetLat = filters.latitude ?? APP_CONFIG.defaultCenter.lat;
      const targetLng = filters.longitude ?? APP_CONFIG.defaultCenter.lng;
      const maxRadius = filters.radiusKm ?? 5.0;

      const candidateListings = (await tx.find('listings', { status: 'VERIFIED' })).filter((listing) => {
        if (listing.deletedAt) return false;
        if (filters.category && filters.category.length > 0 && !filters.category.includes(listing.category)) return false;
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
        if (filters.maxHourlyRate !== undefined && listing.pricing.hourlyRate > filters.maxHourlyRate) return false;
        if (filters.isCovered !== undefined && listing.isCovered !== filters.isCovered) return false;
        if (filters.hasEvCharging && !listing.hasEvCharging) return false;
        if (filters.bookableNow && !listing.isBookable) return false;
        return true;
      });

      // One query each for live bookings and holds of all candidates (no N+1).
      const ids = candidateListings.map((l) => l.id);
      const nowMs = Date.now();
      const nowIso = new Date(nowMs).toISOString();
      const liveBookings = ids.length ? await tx.find('bookings', { listingId: ids, status: LIVE_BOOKING_STATUSES }) : [];
      const liveHolds = ids.length ? await tx.find('holds', { listingId: ids, expiresAt: { gt: nowIso } }) : [];

      const windowStart = filters.startTime ? new Date(filters.startTime).toISOString() : nowIso;
      const windowEnd = filters.endTime ? new Date(filters.endTime).toISOString() : new Date(nowMs + 2 * 60 * 60 * 1000).toISOString();

      const results: SearchResultItem[] = [];
      for (const rawListing of candidateListings) {
        // Location privacy: distance, the radius filter, distance ranking and sort order are
        // all derived from the listing's *discovery* point (deterministically approximate for
        // non-PUBLIC listings), so query results cannot be used to triangulate the real pin.
        const distance = discoveryDistanceKm(rawListing, targetLat, targetLng);
        if (!Number.isFinite(distance) || distance > maxRadius) continue;

        const bookedCount = liveBookings.filter((b) => b.listingId === rawListing.id && overlaps(windowStart, windowEnd, b.startTime, b.endTime)).length;
        const activeHoldsCount = liveHolds.filter((h) => h.listingId === rawListing.id && overlaps(windowStart, windowEnd, h.startTime, h.endTime)).length;
        const availableCapacity = Math.max(0, rawListing.totalCapacity - bookedCount - activeHoldsCount);

        const staleFlag = isListingStale(rawListing.lastConfirmedAt, APP_CONFIG.staleThresholdDays, nowMs);
        const distanceScore = Math.max(0, 1 - distance / 10);
        const priceScore = Math.max(0, 1 - rawListing.pricing.hourlyRate / 150);
        const verificationScore = rawListing.status === 'VERIFIED' ? 1.0 : 0.4;
        const confidenceScore =
          rawListing.availabilityConfidence === 'PROVIDER_MANAGED'
            ? 1.0
            : rawListing.availabilityConfidence === 'BOOKED_ON_VPARK' || rawListing.availabilityConfidence === 'BOOKED_ON_PARKORA'
            ? 0.8
            : 0.3;
        const ratingScore = rawListing.rating > 0 ? rawListing.rating / 5.0 : 0.7;
        const stalePenalty = staleFlag ? 0.25 : 0.0;

        const ranking: RankingBreakdown = {
          distanceKm: distance,
          distanceScore: Math.round(distanceScore * 100) / 100,
          priceScore: Math.round(priceScore * 100) / 100,
          verificationScore,
          confidenceScore,
          ratingScore: Math.round(ratingScore * 100) / 100,
          stalePenalty,
          totalScore: calculateRankingScore({
            distanceKm: distance,
            hourlyRate: rawListing.pricing.hourlyRate,
            isVerified: rawListing.status === 'VERIFIED',
            confidence: rawListing.availabilityConfidence,
            rating: rawListing.rating,
            isStale: staleFlag,
          }),
        };

        // PRD 7.2 & 7.3: only an explicit allow-listed projection leaves the server.
        results.push({
          listing: toPublicListingSummary(rawListing, { isStale: staleFlag }),
          distanceKm: distance,
          ranking,
          availableCapacity,
          activeHoldsCount,
        });
      }

      if (filters.sortBy === 'PRICE_LOW') results.sort((a, b) => a.listing.pricing.hourlyRate - b.listing.pricing.hourlyRate);
      else if (filters.sortBy === 'DISTANCE_NEAR') results.sort((a, b) => a.distanceKm - b.distanceKm);
      else if (filters.sortBy === 'RATING_HIGH') results.sort((a, b) => b.listing.rating - a.listing.rating);
      else results.sort((a, b) => b.ranking.totalScore - a.ranking.totalScore);
      return results;
    });
  }

  // --- Slot holds --------------------------------------------------------------------

  public async createSlotHold(data: {
    listingId: string;
    userId: string;
    vehicleType: User['vehicles'][0]['type'];
    startTime: string;
    endTime: string;
  }): Promise<{ success: boolean; hold?: SlotHold; error?: string }> {
    return this.tx(async (tx) => {
      await this.cleanExpiredHolds(tx);
      // Row lock on the listing serializes every capacity check for it, on every instance.
      const listing = await tx.get('listings', data.listingId, { forUpdate: true });
      if (!listing || listing.deletedAt || listing.status !== 'VERIFIED' || !listing.isBookable) {
        return { success: false, error: 'Listing is not available for reservation.' };
      }
      const availability = await this.availability(tx, listing, data.startTime, data.endTime);
      if (availability.availableCapacity <= 0) return { success: false, error: 'No slots available for the selected time window.' };

      const hold: SlotHold = {
        id: newId('hld'),
        listingId: data.listingId,
        userId: data.userId,
        vehicleType: data.vehicleType,
        startTime: data.startTime,
        endTime: data.endTime,
        expiresAt: new Date(Date.now() + APP_CONFIG.holdDurationMinutes * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
      };
      await tx.put('holds', hold);
      return { success: true, hold };
    });
  }

  /** Release a hold only if it belongs to the requesting user (or the requester is an admin). */
  public async releaseSlotHoldForUser(holdId: string, userId: string, isAdmin: boolean): Promise<{ success: boolean; status: number; error?: string }> {
    return this.tx(async (tx) => {
      const hold = await tx.get('holds', holdId, { forUpdate: true });
      if (!hold) return { success: false, status: 404, error: 'Hold not found.' };
      if (hold.userId !== userId && !isAdmin) return { success: false, status: 403, error: 'Forbidden: this hold belongs to another user.' };
      await tx.delete('holds', holdId);
      return { success: true, status: 200 };
    });
  }

  // --- Pricing (integer paise) ---------------------------------------------------------
  public calculatePricing(hourlyRate: number, startTime: string, endTime: string): PriceBreakdown {
    return calculatePricingPaise(toPaise(hourlyRate), startTime, endTime);
  }

  // --- Bookings ------------------------------------------------------------------------

  /**
   * Create a confirmed booking and its payment record atomically. The listing row is
   * locked for the whole transaction, so concurrent attempts for the last slot on
   * different instances cannot both succeed.
   */
  public async createBooking(data: {
    listingId: string;
    driverId: string;
    vehicleType: User['vehicles'][0]['type'];
    vehiclePlateNumber: string;
    startTime: string;
    endTime: string;
    paymentMethod: Payment['method'];
    holdId?: string;
  }): Promise<{ success: boolean; booking?: Booking; payment?: Payment; error?: string }> {
    return this.tx(async (tx) => {
      await this.cleanExpiredHolds(tx);
      const listing = await tx.get('listings', data.listingId, { forUpdate: true });
      if (!listing || listing.deletedAt || listing.status !== 'VERIFIED') return { success: false, error: 'Verified listing not found.' };
      if (!listing.isBookable) return { success: false, error: 'Public spaces are discovery-only and cannot be booked.' };

      // Only the driver's own, unexpired hold for this listing counts.
      const hold = data.holdId ? await tx.get('holds', data.holdId, { forUpdate: true }) : undefined;
      const userHold = hold && hold.userId === data.driverId && hold.listingId === listing.id ? hold : undefined;

      const availability = await this.availability(tx, listing, data.startTime, data.endTime);
      if (availability.availableCapacity <= 0 && !userHold) {
        return { success: false, error: 'This slot was just taken by another driver. Please choose another time or spot.' };
      }

      const driver = await this.activeUser(tx, data.driverId);
      if (!driver) return { success: false, error: 'Authenticated driver record not found.' };
      if (!validatePlateNumber(data.vehiclePlateNumber)) {
        return { success: false, error: 'Invalid vehicle registration plate. Must match Indian format (e.g. KA-04-MB-1234 or 22-BH-1234-AA).' };
      }
      const formattedPlate = formatPlateNumber(data.vehiclePlateNumber) || data.vehiclePlateNumber.toUpperCase().trim();

      const hourlyPaise = listing.pricing.hourlyRatePaise ?? toPaise(listing.pricing.hourlyRate);
      const pricing = calculatePricingPaise(hourlyPaise, data.startTime, data.endTime);

      let refNum = '';
      for (let i = 0; i < 10 && !refNum; i++) {
        const candidate = `VPK-BLR-${crypto.randomInt(100000, 1000000)}`;
        if ((await tx.find('bookings', { referenceNumber: candidate })).length === 0) refNum = candidate;
      }
      if (!refNum) throw new Error('Could not allocate a unique booking reference.');

      const nowIso = new Date().toISOString();
      const bookingId = newId('bkg');
      const paymentId = newId('pay');
      const newBooking: Booking = {
        id: bookingId,
        referenceNumber: refNum,
        listingId: listing.id,
        listingTitle: listing.title,
        listingAddress: listing.address,
        listingAccessInstructions: listing.accessInstructions,
        listingLatitude: listing.latitude,
        listingLongitude: listing.longitude,
        driverId: driver.id,
        driverName: driver.name || driver.phone,
        driverPhone: driver.phone,
        providerId: listing.providerId,
        providerName: listing.providerName,
        providerPhoneMasked: `+91 80 4XXX ${refNum.slice(-4)}`,
        vehicleType: data.vehicleType,
        vehiclePlateNumber: formattedPlate,
        startTime: data.startTime,
        endTime: data.endTime,
        status: 'CONFIRMED',
        pricingSnapshot: pricing,
        paymentId,
        paymentMethod: data.paymentMethod,
        paymentStatus: 'SUCCESS',
        createdAt: nowIso,
        updatedAt: nowIso,
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
        gatewayTransactionId: `rzp_live_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
        gatewaySignature: `sig_verified_${Date.now()}`,
        platformCommission: fromPaise(platformCommissionPaise),
        platformCommissionPaise,
        providerEarning: fromPaise(providerEarningPaise),
        providerEarningPaise,
        payoutStatus: 'SCHEDULED',
        reconciled: true,
        createdAt: nowIso,
      };

      if (userHold) await tx.delete('holds', userHold.id);
      await tx.put('bookings', newBooking);
      await tx.put('payments', newPayment);
      return { success: true, booking: newBooking, payment: newPayment };
    });
  }

  /**
   * Change a booking's status under a row lock. `allowedFrom` re-checks the current
   * status inside the transaction, so two concurrent requests (e.g. double cancel)
   * cannot both apply.
   */
  public async updateBookingStatus(
    bookingId: string,
    status: BookingStatus,
    metadata?: { photoUrl?: string; reason?: string; cancelledBy?: 'DRIVER' | 'PROVIDER' },
    options?: { allowedFrom?: BookingStatus[] }
  ): Promise<{ success: boolean; booking?: Booking; error?: string; conflict?: boolean }> {
    return this.tx(async (tx) => {
      const booking = await tx.get('bookings', bookingId, { forUpdate: true });
      if (!booking) return { success: false, error: 'Booking not found.' };
      if (options?.allowedFrom && !options.allowedFrom.includes(booking.status)) {
        return { success: false, conflict: true, error: `This booking cannot be updated from status ${booking.status}.` };
      }

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
        const hoursToStart = (new Date(booking.startTime).getTime() - Date.now()) / (1000 * 60 * 60);
        const refundPaise = calculateCancellationRefundPaise({
          hoursBeforeStart: hoursToStart,
          parkingFeePaise: booking.pricingSnapshot.parkingFeePaise ?? toPaise(booking.pricingSnapshot.parkingFee),
          totalAmountPaise: booking.pricingSnapshot.totalAmountPaise ?? toPaise(booking.pricingSnapshot.totalAmount),
          cancelledBy: booking.cancelledBy,
        });
        booking.refundAmountPaise = refundPaise;
        booking.refundAmount = fromPaise(refundPaise);
      } else {
        booking.status = status;
      }
      booking.updatedAt = nowIso;
      await tx.put('bookings', booking);
      return { success: true, booking };
    });
  }

  public async extendBooking(
    bookingId: string,
    additionalHours: number,
    options?: { allowedFrom?: BookingStatus[] }
  ): Promise<{ success: boolean; booking?: Booking; error?: string; conflict?: boolean }> {
    return this.tx(async (tx) => {
      const booking = await tx.get('bookings', bookingId, { forUpdate: true });
      if (!booking) return { success: false, error: 'Booking not found.' };
      if (options?.allowedFrom && !options.allowedFrom.includes(booking.status)) {
        return { success: false, conflict: true, error: `This booking cannot be updated from status ${booking.status}.` };
      }
      const listing = await tx.get('listings', booking.listingId, { forUpdate: true });
      if (!listing || listing.deletedAt) return { success: false, error: 'Listing not found.' };

      const newEndTime = new Date(new Date(booking.endTime).getTime() + additionalHours * 60 * 60 * 1000).toISOString();
      const availability = await this.availability(tx, listing, booking.endTime, newEndTime);
      if (availability.availableCapacity <= 0) {
        return { success: false, error: 'Cannot extend: slot is reserved by another driver right after your session.' };
      }

      const hourlyPaise = listing.pricing.hourlyRatePaise ?? toPaise(listing.pricing.hourlyRate);
      const extra = calculatePricingPaise(hourlyPaise, booking.endTime, newEndTime);
      const snap = booking.pricingSnapshot;
      booking.endTime = newEndTime;
      const parking = (snap.parkingFeePaise ?? toPaise(snap.parkingFee)) + (extra.parkingFeePaise ?? 0);
      const platform = (snap.platformFeePaise ?? toPaise(snap.platformFee)) + (extra.platformFeePaise ?? 0);
      const taxes = (snap.totalTaxesPaise ?? toPaise(snap.totalTaxes)) + (extra.totalTaxesPaise ?? 0);
      const total = (snap.totalAmountPaise ?? toPaise(snap.totalAmount)) + (extra.totalAmountPaise ?? 0);
      snap.durationHours += extra.durationHours;
      snap.parkingFeePaise = parking;
      snap.platformFeePaise = platform;
      snap.totalTaxesPaise = taxes;
      snap.totalAmountPaise = total;
      snap.parkingFee = fromPaise(parking);
      snap.platformFee = fromPaise(platform);
      snap.totalTaxes = fromPaise(taxes);
      snap.totalAmount = fromPaise(total);
      booking.updatedAt = new Date().toISOString();
      await tx.put('bookings', booking);
      return { success: true, booking };
    });
  }

  public async getBookings(): Promise<Booking[]> {
    return this.tx(async (tx) => this.withListingCoordinates(tx, await tx.all('bookings')));
  }

  public async getBookingsForDriver(driverId: string): Promise<Booking[]> {
    return this.tx(async (tx) => this.withListingCoordinates(tx, await tx.find('bookings', { driverId })));
  }

  public async getBookingsForProvider(providerId: string): Promise<Booking[]> {
    return this.tx(async (tx) => this.withListingCoordinates(tx, await tx.find('bookings', { providerId })));
  }

  /** Look up a booking by its ID or its public reference number. */
  public async getBookingByIdOrReference(idOrRef: string): Promise<Booking | undefined> {
    return this.tx(async (tx) => {
      const booking = (await tx.get('bookings', idOrRef)) ?? (await tx.find('bookings', { referenceNumber: idOrRef }))[0];
      return booking ? (await this.withListingCoordinates(tx, [booking]))[0] : undefined;
    });
  }

  public async getPayments(): Promise<Payment[]> {
    return this.tx((tx) => tx.all('payments'));
  }

  public async getPaymentsForBookings(bookingIds: string[]): Promise<Payment[]> {
    if (bookingIds.length === 0) return [];
    return this.tx((tx) => tx.find('payments', { bookingId: bookingIds }));
  }

  public async getPayouts(): Promise<Payout[]> {
    return this.tx((tx) => tx.all('payouts'));
  }

  // --- Listings management -------------------------------------------------------------

  public async getListings(): Promise<Listing[]> {
    return this.tx(async (tx) => (await tx.all('listings')).filter((l) => !l.deletedAt));
  }

  public async getAdminListings(): Promise<Listing[]> {
    const priority: Record<ListingStatus, number> = { PENDING_REVIEW: 0, NEEDS_INFO: 1, DRAFT: 2, SUSPENDED: 3, REJECTED: 4, VERIFIED: 5 };
    const listings = await this.getListings();
    return listings
      .map((l) => ({ ...l, isStale: isListingStale(l.lastConfirmedAt, APP_CONFIG.staleThresholdDays) }))
      .sort((a, b) => (priority[a.status] ?? 9) - (priority[b.status] ?? 9));
  }

  public async getListingById(id: string): Promise<Listing | undefined> {
    return this.tx(async (tx) => {
      const l = await tx.get('listings', id);
      return l && !l.deletedAt ? l : undefined;
    });
  }

  public async getListingsByProvider(providerId: string): Promise<Listing[]> {
    return this.tx(async (tx) =>
      (await tx.find('listings', { providerId }))
        .filter((l) => !l.deletedAt)
        .map((l) => ({ ...l, isStale: isListingStale(l.lastConfirmedAt, APP_CONFIG.staleThresholdDays) }))
    );
  }

  public async createListing(
    listingData: Omit<Listing, 'id' | 'status' | 'rating' | 'reviewCount' | 'createdAt' | 'updatedAt' | 'isStale'> & {
      initialStatus?: 'DRAFT' | 'PENDING_REVIEW';
    }
  ): Promise<Listing> {
    return this.tx(async (tx) => {
      const nowIso = new Date().toISOString();
      const listingId = newId('lst');
      const status: ListingStatus = listingData.initialStatus === 'DRAFT' ? 'DRAFT' : 'PENDING_REVIEW';
      const { initialStatus: _omit, ...rest } = listingData;
      const newListing: Listing = {
        ...rest,
        id: listingId,
        status,
        pricing: withPaisePricing(rest.pricing.hourlyRate, rest.pricing.dailyRate, rest.pricing.monthlyRate),
        documents: (rest.documents || []).map((doc) => ({ ...doc, listingId, fileUrl: `/api/private-docs/${doc.id}` })),
        submittedAt: status === 'PENDING_REVIEW' ? nowIso : undefined,
        rating: 0,
        reviewCount: 0,
        isStale: false,
        deletedAt: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      await tx.put('listings', newListing);
      if (status === 'PENDING_REVIEW') {
        await this.audit(tx, {
          actorId: newListing.providerId,
          actorName: newListing.providerName,
          actorRole: 'PROVIDER',
          action: 'SUBMIT_LISTING',
          targetType: 'LISTING',
          targetId: listingId,
          details: `Submitted parking space "${newListing.title}" for admin verification.`,
        });
      }
      return newListing;
    });
  }

  public async updateProviderListing(
    listingId: string,
    providerId: string,
    updates: Partial<Listing> & { submitForReview?: boolean }
  ): Promise<{ success: boolean; listing?: Listing; error?: string }> {
    return this.tx(async (tx) => {
      const listing = await tx.get('listings', listingId, { forUpdate: true });
      if (!listing || listing.deletedAt) return { success: false, error: 'Listing not found.' };
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
        listing.pricing = withPaisePricing(updates.pricing.hourlyRate, updates.pricing.dailyRate, updates.pricing.monthlyRate);
      }
      if (updates.submitForReview) {
        listing.status = 'PENDING_REVIEW';
        listing.submittedAt = nowIso;
        listing.reviewReason = undefined;
        await this.audit(tx, {
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
      await tx.put('listings', listing);
      return { success: true, listing };
    });
  }

  public async reconfirmAvailability(listingId: string, providerId: string): Promise<{ success: boolean; listing?: Listing; error?: string }> {
    return this.tx(async (tx) => {
      const listing = await tx.get('listings', listingId, { forUpdate: true });
      if (!listing || listing.deletedAt) return { success: false, error: 'Listing not found.' };
      if (listing.providerId !== providerId) return { success: false, error: 'Forbidden: you do not own this listing.' };
      const nowIso = new Date().toISOString();
      listing.lastConfirmedAt = nowIso;
      listing.isStale = false;
      listing.availabilityConfidence = 'PROVIDER_MANAGED';
      listing.updatedAt = nowIso;
      await tx.put('listings', listing);
      await this.audit(tx, {
        actorId: providerId,
        actorName: listing.providerName,
        actorRole: 'PROVIDER',
        action: 'RECONFIRM_AVAILABILITY',
        targetType: 'LISTING',
        targetId: listingId,
        details: 'Provider reconfirmed availability and weekly operating schedule.',
      });
      return { success: true, listing };
    });
  }

  // --- Admin verification & moderation (PRD 7.3) -------------------------------------

  public async adminUpdateListingStatus(
    adminId: string,
    listingId: string,
    newStatus: ListingStatus,
    reason?: string
  ): Promise<{ success: boolean; listing?: Listing; error?: string }> {
    return this.tx(async (tx) => {
      const admin = await this.activeUser(tx, adminId);
      if (!admin || !admin.roles.includes('ADMIN')) return { success: false, error: 'Forbidden: Admin capability required.' };
      const listing = await tx.get('listings', listingId, { forUpdate: true });
      if (!listing || listing.deletedAt) return { success: false, error: 'Listing not found.' };
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
        for (const doc of listing.documents || []) {
          doc.status = 'VERIFIED';
          doc.verifiedAt = nowIso;
          doc.verifiedBy = admin.id;
        }
      } else if (newStatus === 'REJECTED') {
        for (const doc of listing.documents || []) {
          doc.status = 'REJECTED';
          doc.rejectionReason = reason;
        }
      }
      await tx.put('listings', listing);
      await tx.put('listingVerifications', {
        id: newId('ver'),
        listingId: listing.id,
        status: newStatus,
        reviewerId: admin.id,
        reason: listing.reviewReason,
        reviewedAt: nowIso,
        evidenceDocIds: (listing.documents || []).map((d) => d.id),
      });

      const action: AuditLog['action'] =
        newStatus === 'VERIFIED' ? 'APPROVE_LISTING' : newStatus === 'SUSPENDED' ? 'SUSPEND_LISTING' : newStatus === 'NEEDS_INFO' ? 'REQUEST_LISTING_INFO' : 'REJECT_LISTING';
      await this.audit(tx, {
        actorId: admin.id,
        actorName: admin.name,
        actorRole: 'ADMIN',
        action,
        targetType: 'LISTING',
        targetId: listingId,
        details: `Listing status updated to ${newStatus}.${listing.reviewReason ? ' Reason: ' + listing.reviewReason : ''}`,
      });
      return { success: true, listing };
    });
  }

  /**
   * `actor` must be the request's *effective* user (admin status already checked
   * against the server-side allowlist), not a freshly loaded stored record.
   */
  public async getPrivateDocumentForActor(
    docId: string,
    actor: Pick<User, 'id' | 'name' | 'phone' | 'roles'>
  ): Promise<{ allowed: boolean; status: number; doc?: ProviderDocument; listingTitle?: string; error?: string }> {
    return this.tx(async (tx) => {
      if (!actor || !(await this.activeUser(tx, actor.id))) return { allowed: false, status: 401, error: 'Authentication required.' };
      for (const listing of await tx.all('listings')) {
        const doc = (listing.documents || []).find((d) => d.id === docId);
        if (!doc) continue;
        const isAdmin = actor.roles.includes('ADMIN');
        const isOwner = doc.providerId === actor.id || listing.providerId === actor.id;
        if (!isAdmin && !isOwner) return { allowed: false, status: 403, error: 'Forbidden: restricted verification document.' };
        await this.audit(tx, {
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
      return { allowed: false, status: 404, error: 'Verification document not found.' };
    });
  }

  // --- Disputes & support --------------------------------------------------------------

  public async createDispute(data: {
    bookingId: string;
    raisedByUserId: string;
    category: Dispute['category'];
    description: string;
    evidencePhotos?: string[];
  }): Promise<{ success: boolean; dispute?: Dispute; error?: string }> {
    return this.tx(async (tx) => {
      const booking = await tx.get('bookings', data.bookingId, { forUpdate: true });
      if (!booking) return { success: false, error: 'Booking not found.' };

      // Only the booking's own driver or provider may open a dispute on it; the side is
      // derived from the booking, not from the caller's selected mode.
      let raisedByRole: 'DRIVER' | 'PROVIDER';
      if (booking.driverId === data.raisedByUserId) raisedByRole = 'DRIVER';
      else if (booking.providerId === data.raisedByUserId) raisedByRole = 'PROVIDER';
      else return { success: false, error: 'Forbidden: you are not a participant in this booking.' };

      const newDispute: Dispute = {
        id: newId('disp'),
        bookingId: booking.id,
        bookingReference: booking.referenceNumber,
        raisedByUserId: data.raisedByUserId,
        raisedByRole,
        againstUserId: raisedByRole === 'DRIVER' ? booking.providerId : booking.driverId,
        category: data.category,
        description: data.description,
        evidencePhotos: data.evidencePhotos || [],
        status: 'OPEN',
        slaDeadline: new Date(Date.now() + APP_CONFIG.disputeSlaHours * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
      };
      booking.isDisputed = true;
      booking.disputeId = newDispute.id;
      booking.status = 'DISPUTED';
      booking.updatedAt = new Date().toISOString();
      await tx.put('disputes', newDispute);
      await tx.put('bookings', booking);
      return { success: true, dispute: newDispute };
    });
  }

  public async resolveDispute(
    adminId: string,
    disputeId: string,
    notes: string,
    refundAmount: number = 0
  ): Promise<{ success: boolean; dispute?: Dispute; error?: string }> {
    return this.tx(async (tx) => {
      const admin = await this.activeUser(tx, adminId);
      if (!admin || !admin.roles.includes('ADMIN')) return { success: false, error: 'Forbidden: Admin capability required.' };
      const dispute = await tx.get('disputes', disputeId, { forUpdate: true });
      if (!dispute) return { success: false, error: 'Dispute not found.' };

      dispute.status = 'RESOLVED';
      dispute.adminResolutionNotes = notes;
      dispute.refundGranted = refundAmount;
      dispute.resolvedAt = new Date().toISOString();
      dispute.resolvedByAdminId = admin.id;
      await tx.put('disputes', dispute);

      const booking = await tx.get('bookings', dispute.bookingId, { forUpdate: true });
      if (booking && refundAmount > 0) {
        booking.refundAmount = refundAmount;
        booking.refundAmountPaise = toPaise(refundAmount);
        booking.updatedAt = new Date().toISOString();
        await tx.put('bookings', booking);
      }
      await this.audit(tx, {
        actorId: admin.id,
        actorName: admin.name,
        actorRole: 'ADMIN',
        action: 'RESOLVE_DISPUTE',
        targetType: 'DISPUTE',
        targetId: disputeId,
        details: `Dispute resolved. Refund granted: ₹${refundAmount}. Notes: ${notes}`,
      });
      return { success: true, dispute };
    });
  }

  public async getDisputes(): Promise<Dispute[]> {
    return this.tx((tx) => tx.all('disputes'));
  }

  public async getDisputesForUser(userId: string): Promise<Dispute[]> {
    return this.tx(async (tx) => (await tx.all('disputes')).filter((d) => d.raisedByUserId === userId || d.againstUserId === userId));
  }

  public async getDisputeById(id: string): Promise<Dispute | undefined> {
    return this.tx((tx) => tx.get('disputes', id));
  }

  // --- Audit logs ----------------------------------------------------------------------

  public async createAuditLog(data: Omit<AuditLog, 'id' | 'timestamp'>): Promise<AuditLog> {
    return this.tx((tx) => this.audit(tx, data));
  }

  /** Newest first. */
  public async getAuditLogs(): Promise<AuditLog[]> {
    return this.tx((tx) => tx.all('auditLogs'));
  }

  // --- Monthly passes ------------------------------------------------------------------

  public async getMonthlyPasses(): Promise<MonthlyPass[]> {
    return this.tx((tx) => tx.all('monthlyPasses'));
  }

  public async getMonthlyPassesForDriver(driverId: string): Promise<MonthlyPass[]> {
    return this.tx((tx) => tx.find('monthlyPasses', { driverId }));
  }

  public async createMonthlyPass(data: {
    listingId: string;
    driverId: string;
    driverName: string;
    vehiclePlateNumber: string;
    vehicleType: User['vehicles'][0]['type'];
    month: string;
    price: number;
  }): Promise<MonthlyPass> {
    return this.tx(async (tx) => {
      const listing = await tx.get('listings', data.listingId, { forUpdate: true });
      const pass: MonthlyPass = {
        id: newId('pass'),
        listingId: data.listingId,
        listingTitle: listing?.title || 'Reserved Slot',
        driverId: data.driverId,
        driverName: data.driverName,
        vehiclePlateNumber: data.vehiclePlateNumber,
        vehicleType: data.vehicleType,
        month: data.month,
        startDate: `${data.month}-01`,
        endDate: `${data.month}-28`,
        price: data.price,
        pricePaise: toPaise(data.price),
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
      };
      await tx.put('monthlyPasses', pass);
      return pass;
    });
  }

  // --- Contact messages ----------------------------------------------------------------

  public async createContactMessage(message: Omit<ContactMessage, 'id' | 'createdAt' | 'status'>): Promise<ContactMessage> {
    return this.tx(async (tx) => {
      const record: ContactMessage = { ...message, id: newId('msg'), createdAt: new Date().toISOString(), status: 'UNREAD' };
      await tx.put('contactMessages', record);
      return record;
    });
  }

  // --- Sessions stored in the application database ----------------------------------
  // Used as the session backend when Redis is not configured: the local JSON store in
  // development, or PostgreSQL (durable and shared) when DATABASE_URL is set.
  // Only HMACs of session tokens are stored. Every mutation, including pruning, commits
  // immediately.
  public getSessionStore(): SessionStore & { kind: 'database' } {
    return {
      kind: 'database',
      insert: (record: SessionRecord) => this.tx((tx) => tx.put('sessions', { ...record, revokedAt: null })),
      findByTokenHash: (tokenHash: string) => this.tx((tx) => tx.get('sessions', tokenHash)),
      touch: (tokenHash: string, lastSeenAt: string) =>
        this.tx(async (tx) => {
          // FOR UPDATE + no upsert: a session deleted concurrently is never recreated.
          const session = await tx.get('sessions', tokenHash, { forUpdate: true });
          if (!session) return false;
          await tx.put('sessions', { ...session, lastSeenAt });
          return true;
        }),
      remove: async (tokenHash: string) => {
        await this.tx((tx) => tx.delete('sessions', tokenHash));
      },
      removeAllForUser: (userId: string) => this.tx((tx) => tx.deleteWhere('sessions', { userId })),
      prune: async (nowIso: string, idleCutoffIso: string) => {
        await this.tx(async (tx) => {
          await tx.deleteWhere('sessions', { expiresAt: { lte: nowIso } });
          await tx.deleteWhere('sessions', { lastSeenAt: { lte: idleCutoffIso } });
        });
      },
    };
  }
}

// Global singleton (the backing store is chosen lazily from the environment on first use).
const globalForDb = globalThis as unknown as { vparkDb?: Database };
export const db = globalForDb.vparkDb || new Database();
if (process.env.NODE_ENV !== 'production') globalForDb.vparkDb = db;
