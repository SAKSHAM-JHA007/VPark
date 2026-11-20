// Behavioural tests for the application data layer, run against every backend:
// the local JSON development store, PGlite (embedded PostgreSQL engine) and, when
// configured, a real PostgreSQL server.
import { before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { seedVerifiedListing } from './harness.mjs';

const HOUR = 3600_000;

/**
 * @param {object} o
 * @param {string} o.label
 * @param {() => Promise<import('../../src/lib/data/store').DataStore>} o.newStore
 *   returns a NEW store handle on the SAME underlying data (another "instance")
 * @param {boolean} o.postgres          backend enforces SQL constraints
 * @param {string} o.concurrencyNote    what the concurrency tests prove on this backend
 */
export async function defineDataStoreSuite({ label, newStore, postgres, concurrencyNote }) {
  const { Database } = await import('../../src/lib/db.ts');
  const newDb = async () => new Database(await newStore());
  /** N independent instances, already connected (so racing calls truly overlap). */
  const warmInstances = async (n) => {
    const list = await Promise.all(Array.from({ length: n }, () => newDb()));
    await Promise.all(list.map((inst) => inst.getUserById('usr_driver_1')));
    return list;
  };
  let db;

  const window = (startInHours = 3, lengthHours = 2) => {
    const start = new Date(Date.now() + startInHours * HOUR);
    return { startTime: start.toISOString(), endTime: new Date(start.getTime() + lengthHours * HOUR).toISOString() };
  };
  const bookingInput = (listingId, driverId, extra = {}) => ({
    listingId,
    driverId,
    vehicleType: 'SEDAN',
    vehiclePlateNumber: 'KA-04-MB-1234',
    paymentMethod: 'UPI',
    ...window(),
    ...extra,
  });

  describe(`Data store [${label}]`, () => {
    before(async () => {
      db = await newDb();
      await db.seedDemoData();
    });

    it('persists every kind of application state and reads it back from a new instance', async () => {
      const signIn = await db.upsertVerifiedGoogleUser({ uid: `persist-${label}`, email: `persist.${label}@example.com`, name: 'Persist Tester', grantAdmin: false });
      assert.equal(signIn.success, true);
      const userId = signIn.user.id;
      await db.completeOnboarding({ userId, fullName: 'Persist Tester', phone: '9876500001', acceptTerms: true, ipAddress: '127.0.0.1', userAgent: 'test' });
      await db.addVehicle(userId, { type: 'SEDAN', makeModel: 'Test Car', plateNumber: 'KA-01-AB-1234', isEv: false, isDefault: true });
      const listing = await seedVerifiedListing(db, { totalCapacity: 3 });
      const hold = await db.createSlotHold({ listingId: listing.id, userId, vehicleType: 'SEDAN', ...window(30) });
      const booking = await db.createBooking(bookingInput(listing.id, userId));
      assert.equal(booking.success, true, booking.error);
      const dispute = await db.createDispute({ bookingId: booking.booking.id, raisedByUserId: userId, category: 'SPACE_OCCUPIED', description: 'Occupied on arrival' });
      assert.equal(dispute.success, true);
      const pass = await db.createMonthlyPass({ listingId: listing.id, driverId: userId, driverName: 'Persist Tester', vehiclePlateNumber: 'KA-01-AB-1234', vehicleType: 'SEDAN', month: '2026-12', price: 2500 });
      const message = await db.createContactMessage({ name: 'A', email: 'a@example.com', subject: 'Hello', message: 'Persistence check message', ip: '127.0.0.1', userAgent: 'test' });
      await db.getSessionStore().insert(
        { id: 'ses_p', tokenHash: `hash-${label}`, userId, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + HOUR).toISOString(), lastSeenAt: new Date().toISOString(), revokedAt: null },
        HOUR
      );

      const other = await newDb();
      const user = await other.getUserById(userId);
      assert.equal(user.name, 'Persist Tester');
      assert.equal(user.phone, '+919876500001');
      assert.equal(user.vehicles.length, 1);
      assert.equal((await other.getUserConsents(userId)).length >= 2, true);
      assert.equal((await other.getListingById(listing.id)).status, 'VERIFIED');
      const stored = await other.getBookingByIdOrReference(booking.booking.referenceNumber);
      assert.equal(stored.id, booking.booking.id);
      assert.equal(stored.status, 'DISPUTED');
      assert.equal((await other.getPaymentsForBookings([booking.booking.id])).length, 1);
      assert.equal((await other.getDisputeById(dispute.dispute.id)).bookingId, booking.booking.id);
      assert.ok((await other.getMonthlyPassesForDriver(userId)).some((p) => p.id === pass.id));
      assert.ok((await other.getAuditLogs()).some((a) => a.action === 'APPROVE_LISTING' && a.targetId === listing.id));
      assert.ok((await other.getSessionStore().findByTokenHash(`hash-${label}`)));
      assert.equal(hold.success, true);
      const store = await newStore();
      assert.equal((await store.transaction((tx) => tx.get('contactMessages', message.id))).subject, 'Hello');
    });

    it('rolls back every write of a failed transaction', async () => {
      const store = await newStore();
      const id = `msg_rollback_${label}`;
      await assert.rejects(
        store.transaction(async (tx) => {
          await tx.put('contactMessages', { id, name: 'x', email: 'x@example.com', subject: 's', message: 'm', ip: '', userAgent: '', createdAt: new Date().toISOString(), status: 'UNREAD' });
          throw new Error('boom');
        }),
        /boom/
      );
      assert.equal(await (await newStore()).transaction((tx) => tx.get('contactMessages', id)), undefined);
    });

    it('records a booking and its payment together, consuming only the driver’s own hold', async () => {
      const listing = await seedVerifiedListing(db, { totalCapacity: 1 });
      const w = window(5);
      const hold = await db.createSlotHold({ listingId: listing.id, userId: 'usr_owner_1', vehicleType: 'SEDAN', ...w });
      assert.equal(hold.success, true);
      // Another driver passing someone else's hold ID neither books nor deletes that hold.
      const stolen = await db.createBooking(bookingInput(listing.id, 'usr_driver_1', { ...w, holdId: hold.hold.id }));
      assert.equal(stolen.success, false);
      const own = await db.createBooking(bookingInput(listing.id, 'usr_owner_1', { ...w, holdId: hold.hold.id }));
      assert.equal(own.success, true, own.error);
      const payments = await db.getPaymentsForBookings([own.booking.id]);
      assert.equal(payments.length, 1);
      assert.equal(payments[0].amountPaise, own.booking.pricingSnapshot.totalAmountPaise);
    });

    it(`allows exactly one booking for the last slot under concurrent requests (${concurrencyNote})`, async () => {
      const listing = await seedVerifiedListing(db, { totalCapacity: 1 });
      const w = window(8);
      const drivers = ['usr_driver_1', 'usr_owner_1', 'usr_admin_1', 'usr_driver_1', 'usr_owner_1', 'usr_admin_1', 'usr_driver_1', 'usr_owner_1'];
      const instances = await warmInstances(drivers.length);
      const results = await Promise.all(drivers.map((d, i) => instances[i].createBooking(bookingInput(listing.id, d, w))));
      assert.equal(results.filter((r) => r.success).length, 1, JSON.stringify(results.map((r) => r.error)));
      const live = (await db.getBookings()).filter((b) => b.listingId === listing.id && b.status === 'CONFIRMED');
      assert.equal(live.length, 1);
    });

    it(`allows exactly one slot hold for the last slot under concurrent requests (${concurrencyNote})`, async () => {
      const listing = await seedVerifiedListing(db, { totalCapacity: 1 });
      const w = window(12);
      const instances = await warmInstances(6);
      const results = await Promise.all(instances.map((inst) => inst.createSlotHold({ listingId: listing.id, userId: 'usr_driver_1', vehicleType: 'SEDAN', ...w })));
      assert.equal(results.filter((r) => r.success).length, 1);
    });

    it(`applies a cancellation (and its refund) only once under concurrent requests (${concurrencyNote})`, async () => {
      const listing = await seedVerifiedListing(db, { totalCapacity: 2 });
      const created = await db.createBooking(bookingInput(listing.id, 'usr_driver_1', window(48)));
      const instances = await warmInstances(5);
      const results = await Promise.all(
        instances.map((inst) =>
          inst.updateBookingStatus(created.booking.id, 'CANCELLED_BY_DRIVER', { cancelledBy: 'DRIVER' }, { allowedFrom: ['PENDING_PAYMENT', 'CONFIRMED'] })
        )
      );
      assert.equal(results.filter((r) => r.success).length, 1);
      assert.ok(results.filter((r) => !r.success).every((r) => r.conflict));
    });

    it(`resolves concurrent first sign-ins of one Google identity to a single account (${concurrencyNote})`, async () => {
      const uid = `concurrent-uid-${label}`;
      const instances = await warmInstances(5);
      const results = await Promise.all(
        instances.map((inst) => inst.upsertVerifiedGoogleUser({ uid, email: `${uid}@example.com`, grantAdmin: false }))
      );
      const ids = new Set(results.map((r) => r.user.id));
      assert.equal(ids.size, 1);
      assert.equal((await db.getUsers()).filter((u) => u.firebaseUid === uid).length, 1);
    });

    it('enforces ownership for holds, disputes, listings and private documents', async () => {
      const listing = await seedVerifiedListing(db, { totalCapacity: 2 });
      const hold = await db.createSlotHold({ listingId: listing.id, userId: 'usr_driver_1', vehicleType: 'SEDAN', ...window(20) });
      assert.equal((await db.releaseSlotHoldForUser(hold.hold.id, 'usr_owner_2', false)).status, 403);
      assert.equal((await db.releaseSlotHoldForUser(hold.hold.id, 'usr_driver_1', false)).status, 200);

      const booking = await db.createBooking(bookingInput(listing.id, 'usr_driver_1', window(22)));
      const outsider = await db.createDispute({ bookingId: booking.booking.id, raisedByUserId: 'usr_owner_2', category: 'PAYMENT_ISSUE', description: 'not mine' });
      assert.equal(outsider.success, false);
      assert.match(outsider.error, /Forbidden/);

      assert.match((await db.reconfirmAvailability(listing.id, 'usr_owner_2')).error, /Forbidden/);
      const draft = await db.createListing({ ...listing, id: undefined, providerId: 'usr_owner_1', initialStatus: 'DRAFT', documents: [] });
      assert.match((await db.updateProviderListing(draft.id, 'usr_owner_2', { title: 'Hijacked' })).error, /Forbidden/);
      assert.equal((await db.getListingById(draft.id)).title, listing.title);

      const docId = listing.documents[0].id;
      const driver = await db.getUserById('usr_driver_1');
      assert.equal((await db.getPrivateDocumentForActor(docId, driver)).status, 403);
      const owner = await db.getUserById('usr_owner_1');
      assert.equal((await db.getPrivateDocumentForActor(docId, owner)).status, 200);
    });

    it('durably removes expired holds so they stop blocking capacity', async () => {
      const listing = await seedVerifiedListing(db, { totalCapacity: 1 });
      const store = await newStore();
      const w = window(26);
      await store.transaction((tx) =>
        tx.put('holds', { id: `hld_expired_${label}`, listingId: listing.id, userId: 'usr_driver_1', vehicleType: 'SEDAN', ...w, expiresAt: new Date(Date.now() - 1000).toISOString(), createdAt: new Date().toISOString() })
      );
      const booking = await db.createBooking(bookingInput(listing.id, 'usr_owner_1', w));
      assert.equal(booking.success, true, booking.error);
      assert.equal(await (await newStore()).transaction((tx) => tx.get('holds', `hld_expired_${label}`)), undefined);
    });

    it('stores sessions durably: touch never revives a removed session and pruning persists', async () => {
      const sessions = db.getSessionStore();
      const rec = (hash, { expiresIn = HOUR, lastSeenAgo = 0 } = {}) => ({
        id: `ses_${hash}`,
        tokenHash: hash,
        userId: 'usr_driver_1',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + expiresIn).toISOString(),
        lastSeenAt: new Date(Date.now() - lastSeenAgo).toISOString(),
        revokedAt: null,
      });
      await sessions.insert(rec(`live-${label}`), HOUR);
      await sessions.remove(`live-${label}`);
      assert.equal(await sessions.touch(`live-${label}`, new Date().toISOString(), HOUR), false);
      assert.equal(await sessions.findByTokenHash(`live-${label}`), undefined);

      await sessions.insert(rec(`expired-${label}`, { expiresIn: -1000 }), 1);
      await sessions.insert(rec(`idle-${label}`, { lastSeenAgo: 5 * 24 * HOUR }), 1);
      await sessions.prune(new Date().toISOString(), new Date(Date.now() - 3 * 24 * HOUR).toISOString());
      const fresh = (await newDb()).getSessionStore();
      assert.equal(await fresh.findByTokenHash(`expired-${label}`), undefined);
      assert.equal(await fresh.findByTokenHash(`idle-${label}`), undefined);
    });

    if (postgres) {
      it('enforces relational constraints in PostgreSQL (and rolls the whole transaction back)', async () => {
        const store = await newStore();
        const marker = `msg_constraint_${label}`;
        await assert.rejects(
          store.transaction(async (tx) => {
            await tx.put('contactMessages', { id: marker, name: 'x', email: 'x@example.com', subject: 's', message: 'm', ip: '', userAgent: '', createdAt: new Date().toISOString(), status: 'UNREAD' });
            // Foreign key: a payment must reference an existing booking.
            await tx.put('payments', { id: `pay_orphan_${label}`, bookingId: 'bkg_does_not_exist' });
          }),
          (err) => err.code === '23503'
        );
        assert.equal(await (await newStore()).transaction((tx) => tx.get('contactMessages', marker)), undefined);

        // Unique: one account per Firebase UID.
        const a = await db.getUserById('usr_driver_1');
        const b = await db.getUserById('usr_owner_2');
        await store.transaction((tx) => tx.put('users', { ...a, firebaseUid: `uid-unique-${label}` }));
        await assert.rejects(
          store.transaction((tx) => tx.put('users', { ...b, firebaseUid: `uid-unique-${label}` })),
          (err) => err.code === '23505'
        );
        await store.transaction((tx) => tx.put('users', { ...a, firebaseUid: undefined }));

        // Check constraint: unknown booking status.
        const booking = (await db.getBookings())[0];
        await assert.rejects(
          store.transaction((tx) => tx.put('bookings', { ...booking, status: 'TELEPORTED' })),
          (err) => err.code === '23514'
        );
      });
    }
  });
}
