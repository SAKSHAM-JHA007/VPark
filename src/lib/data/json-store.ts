import fs from 'fs';
import path from 'path';
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
  RoleDefinition,
  SessionRecord,
  SlotHold,
  User,
  UserRoleGrant,
} from '@/types';
import { toPaise } from '../constants';
import { normalizeIndianPhone } from '../engine.mjs';
import { COLLECTIONS, columnValue, type CollectionName, type ContactMessage } from './collections.mjs';
import { getSeedData } from './seed';
import { matchesFilter, type DataStore, type Filter, type Tx } from './store';

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
  sessions: SessionRecord[];
  contactMessages: ContactMessage[];
}

/**
 * Normalise a JSON database written by older versions (behaviour preserved from the
 * original in-memory store). Pure: does not touch the file.
 */
export function migrateLoadedState(parsed: Partial<DatabaseState>): DatabaseState {
  const seed = getSeedData();
  // Prune legacy seeded demo listings (lst_1 through lst_13) if present
  const loadedListings = Array.isArray(parsed.listings) ? parsed.listings.filter((l) => !/^lst_\d+$/.test(l.id)) : seed.listings;
  const validListingIds = new Set(loadedListings.map((l) => l.id));
  const nowIso = new Date().toISOString();

  const state: DatabaseState = {
    users: Array.isArray(parsed.users) ? parsed.users : seed.users,
    roles: Array.isArray(parsed.roles) && parsed.roles.length > 0 ? parsed.roles : seed.roles,
    userRoles: Array.isArray(parsed.userRoles) ? parsed.userRoles : seed.userRoles,
    providerProfiles: Array.isArray(parsed.providerProfiles) ? parsed.providerProfiles : seed.providerProfiles,
    driverProfiles: Array.isArray(parsed.driverProfiles) ? parsed.driverProfiles : seed.driverProfiles,
    consents: Array.isArray(parsed.consents) ? parsed.consents : seed.consents,
    otpChallenges: Array.isArray(parsed.otpChallenges) ? parsed.otpChallenges : [],
    listings: loadedListings,
    listingVerifications: (Array.isArray(parsed.listingVerifications) ? parsed.listingVerifications : seed.listingVerifications).filter(
      (v) => validListingIds.has(v.listingId)
    ),
    holds: Array.isArray(parsed.holds) ? parsed.holds.filter((h) => validListingIds.has(h.listingId)) : [],
    bookings: (Array.isArray(parsed.bookings) ? parsed.bookings : seed.bookings).filter((b) => validListingIds.has(b.listingId)),
    payments: Array.isArray(parsed.payments) ? parsed.payments : seed.payments,
    payouts: Array.isArray(parsed.payouts) ? parsed.payouts : seed.payouts,
    disputes: Array.isArray(parsed.disputes) ? parsed.disputes : [],
    auditLogs: (Array.isArray(parsed.auditLogs) ? parsed.auditLogs : seed.auditLogs).filter(
      (a) => a.targetType !== 'LISTING' || validListingIds.has(a.targetId)
    ),
    reviews: (Array.isArray(parsed.reviews) ? parsed.reviews : seed.reviews).filter((r) => validListingIds.has(r.listingId)),
    monthlyPasses: (Array.isArray(parsed.monthlyPasses) ? parsed.monthlyPasses : seed.monthlyPasses).filter((p) =>
      validListingIds.has(p.listingId)
    ),
    sessions: Array.isArray(parsed.sessions)
      ? parsed.sessions.filter(
          (s) => s && typeof s.tokenHash === 'string' && typeof s.userId === 'string' && typeof s.expiresAt === 'string' && !s.revokedAt && s.expiresAt > nowIso
        )
      : [],
    contactMessages: Array.isArray(parsed.contactMessages) ? parsed.contactMessages : [],
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
        state.userRoles.push({ userId: u.id, roleId: `role_${role.toLowerCase()}`, roleName: role, grantedAt: u.createdAt, grantedBy: 'MIGRATION' });
      }
    }
  }

  // Normalize listings: migrate Parkora string & backfill integer paise fields
  for (const l of state.listings) {
    if (l.availabilityConfidence === 'BOOKED_ON_PARKORA') l.availabilityConfidence = 'BOOKED_ON_VPARK';
    if (l.pricing.hourlyRatePaise === undefined) {
      l.pricing.hourlyRatePaise = toPaise(l.pricing.hourlyRate || 0);
      l.pricing.dailyRatePaise = toPaise(l.pricing.dailyRate || 0);
      if (l.pricing.monthlyRate !== undefined) l.pricing.monthlyRatePaise = toPaise(l.pricing.monthlyRate);
    }
    if (l.deletedAt === undefined) l.deletedAt = null;
    for (const doc of l.documents || []) {
      if (doc.fileUrl.startsWith('/docs/')) doc.fileUrl = `/api/private-docs/${doc.id}`;
    }
  }

  return state;
}

const clone = <T>(v: T): T => (v === undefined ? v : structuredClone(v));

/**
 * LOCAL DEVELOPMENT store: the whole dataset lives in one JSON file
 * (`<dataDir>/vpark_database.json`). Transactions are serialized in-process and are
 * all-or-nothing: on error the in-memory state is restored and nothing is written.
 *
 * This store is single-process only and is never selected in production
 * (see config.mjs: production without DATABASE_URL fails closed).
 */
export function createJsonStore({ dataDir, mirrorToSqlite = true }: { dataDir: string; mirrorToSqlite?: boolean }): DataStore {
  const dbFile = path.join(dataDir, 'vpark_database.json');
  let state: DatabaseState;
  let queue: Promise<unknown> = Promise.resolve();

  function save(s: DatabaseState) {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(dbFile, JSON.stringify(s, null, 2), 'utf-8');
  }

  function load(): DatabaseState {
    try {
      if (fs.existsSync(dbFile)) return migrateLoadedState(JSON.parse(fs.readFileSync(dbFile, 'utf-8')));
    } catch (err) {
      console.warn('Error reading db file, re-initializing with seed data:', err);
    }
    const initial = getSeedData();
    try {
      save(initial);
    } catch (err) {
      console.error('Failed to save database file:', err);
    }
    return initial;
  }

  async function persist() {
    save(state);
    if (!mirrorToSqlite) return;
    try {
      const { getSqliteUserDb } = await import('../sqlite-user-db');
      getSqliteUserDb(dataDir)?.syncAll(state.users, state.consents, state.otpChallenges);
    } catch (err) {
      console.error('[db] Error syncing to user.db:', err);
    }
  }

  const list = (kind: CollectionName) => state[kind] as unknown as Record<string, unknown>[];
  const keyOf = (kind: CollectionName, e: unknown) => COLLECTIONS[kind].key(e as never);
  const normalizer = (kind: CollectionName) => (field: string, value: unknown) => {
    const c = field === 'id' ? { column: 'id' } : COLLECTIONS[kind].columns[field];
    if (!c) throw new Error(`Field "${field}" is not an indexed column of ${kind}; add it to collections.mjs.`);
    return columnValue(c, value);
  };
  const matching = (kind: CollectionName, where: Filter) =>
    list(kind).filter((e) => matchesFilter(field(kind, e), where, normalizer(kind)));
  // `id` filters compare against the collection key.
  const field = (kind: CollectionName, e: Record<string, unknown>) => ({ ...e, id: keyOf(kind, e) });

  function createTx(markDirty: () => void): Tx {
    return {
      async get(kind, key) {
        return clone(list(kind).find((e) => keyOf(kind, e) === key)) as never;
      },
      async find(kind, where) {
        return clone(matching(kind, where)) as never;
      },
      async all(kind) {
        return clone(list(kind)) as never;
      },
      async put(kind, entity) {
        const arr = list(kind);
        const key = keyOf(kind, entity);
        if (typeof key !== 'string' || !key) throw new Error(`Cannot store ${kind} without a key.`);
        const idx = arr.findIndex((e) => keyOf(kind, e) === key);
        const copy = clone(entity) as unknown as Record<string, unknown>;
        if (idx >= 0) arr[idx] = copy;
        else if (COLLECTIONS[kind].newestFirst) arr.unshift(copy);
        else arr.push(copy);
        markDirty();
      },
      async delete(kind, key) {
        const arr = list(kind);
        const idx = arr.findIndex((e) => keyOf(kind, e) === key);
        if (idx < 0) return false;
        arr.splice(idx, 1);
        markDirty();
        return true;
      },
      async deleteWhere(kind, where) {
        const doomed = new Set(matching(kind, where));
        if (doomed.size === 0) return 0;
        (state as unknown as Record<string, unknown[]>)[kind] = list(kind).filter((e) => !doomed.has(e));
        markDirty();
        return doomed.size;
      },
      async lock() {
        // Transactions are already serialized in this single-process store.
      },
    };
  }

  return {
    kind: 'json',
    transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
      const run = async () => {
        if (!state) state = load();
        const snapshot = structuredClone(state);
        let dirty = false;
        try {
          const result = await fn(createTx(() => (dirty = true)));
          if (dirty) await persist();
          return result;
        } catch (err) {
          state = snapshot;
          throw err;
        }
      };
      const next = queue.then(run, run);
      queue = next.catch(() => undefined);
      return next;
    },
    async close() {
      await queue;
    },
  };
}
