// Local-development SQLite mirror of users (src/lib/sqlite-user-db.ts).
//
// Self-contained: every test opens its own temporary directory with deterministic fixtures.
// Nothing here reads or writes the developer's real .data/ directory; the last test
// verifies that. (An earlier version asserted on, and inserted rows into, .data/user.db and
// expected a .data/user_schema.sql file that was never part of the repository.)
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import './support/register-ts.mjs';

// The module loads node:sqlite with `require` (it runs as CommonJS inside Next.js). Under the
// ESM test loader `require` is not defined, which would silently turn the class into a no-op,
// so provide one before importing it.
globalThis.require ??= createRequire(import.meta.url);
const { SqliteUserDatabase } = await import('../src/lib/sqlite-user-db.ts');

const REAL_USER_DB = path.join(process.cwd(), '.data', 'user.db');
const fingerprint = (file) =>
  fs.existsSync(file) ? crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') : null;
const realDbBefore = fingerprint(REAL_USER_DB);

const CREATED = '2026-11-01T09:00:00.000Z';
const user = (overrides) => ({
  isPhoneVerified: true,
  accountStatus: 'ACTIVE',
  createdAt: CREATED,
  deletedAt: null,
  vehicles: [],
  roles: ['DRIVER'],
  activeRole: 'DRIVER',
  ...overrides,
});

/** Deterministic fixtures: five active users, one deleted user, two vehicles. */
const FIXTURES = [
  user({
    id: 'usr_driver_1',
    name: 'Rajesh Kumar',
    email: 'rajesh.kumar@example.com',
    phone: '+919876543210',
    roles: ['DRIVER', 'PROVIDER'],
    vehicles: [
      { id: 'veh_city', type: 'SEDAN', makeModel: 'Honda City ZX', plateNumber: 'KA-04-MB-1234', isEv: false, isDefault: true },
      { id: 'veh_nexon', type: 'EV', makeModel: 'Tata Nexon EV Max', plateNumber: 'KA-51-EV-9021', isEv: true, isDefault: false },
    ],
  }),
  user({ id: 'usr_driver_2', name: 'Priya Rao', phone: '+919845012345' }),
  user({ id: 'usr_owner_1', name: 'Suresh Sharma', phone: '+919811122233', roles: ['PROVIDER'], activeRole: 'PROVIDER', providerType: 'OWNER' }),
  user({ id: 'usr_owner_2', name: 'Anita Desai', phone: '+919822233344', roles: ['DRIVER', 'PROVIDER'], activeRole: 'PROVIDER', providerType: 'OPERATOR' }),
  user({ id: 'usr_admin_1', name: 'Ops Admin', email: 'ops-admin@example.com', phone: '+919900000001', roles: ['ADMIN'], activeRole: 'ADMIN' }),
  user({ id: 'usr_deleted', name: 'Deleted Person', phone: '+919700000000', deletedAt: '2026-11-10T00:00:00.000Z', accountStatus: 'DELETION_PENDING' }),
];

const tempDirs = [];
function freshStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vpark-user-db-'));
  tempDirs.push(dir);
  const store = new SqliteUserDatabase(dir);
  return { dir, file: path.join(dir, 'user.db'), store };
}

after(() => {
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

describe('SQLite user mirror (isolated temporary databases)', () => {
  let dir;
  let file;
  let store;

  before(() => {
    ({ dir, file, store } = freshStore());
    store.syncAll(FIXTURES);
  });

  after(() => store.close());

  it('creates a valid SQLite 3 database with the expected schema', () => {
    assert.ok(fs.existsSync(file), 'user.db is created in the store directory');
    const header = Buffer.alloc(16);
    const fd = fs.openSync(file, 'r');
    fs.readSync(fd, header, 0, 16, 0);
    fs.closeSync(fd);
    assert.ok(header.toString('utf-8').startsWith('SQLite format 3'), 'standard SQLite 3 magic header');

    const db = new DatabaseSync(file);
    const objects = db.prepare("SELECT type, name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'").all();
    db.close();
    const tables = objects.filter((o) => o.type === 'table').map((o) => o.name).sort();
    const indexes = objects.filter((o) => o.type === 'index').map((o) => o.name).sort();
    assert.deepEqual(tables, ['consents', 'otp_challenges', 'roles', 'user_roles', 'users', 'vehicles']);
    assert.deepEqual(indexes, ['idx_users_email', 'idx_users_phone', 'idx_vehicles_user_id']);
  });

  it('stores active users with E.164 phone numbers and their active roles', () => {
    const db = new DatabaseSync(file);
    const users = db.prepare('SELECT id, full_name, phone, active_role FROM users WHERE deleted_at IS NULL').all();
    db.close();
    assert.equal(users.length, 5, 'five active fixtures (the deleted one is excluded)');
    for (const u of users) assert.match(u.phone, /^\+91[6-9]\d{9}$/, `${u.id} phone is E.164`);

    const driver = users.find((u) => u.phone === '+919876543210');
    assert.ok(driver, 'driver Rajesh Kumar is stored');
    assert.equal(driver.full_name, 'Rajesh Kumar');
    assert.ok(['DRIVER', 'PROVIDER'].includes(driver.active_role));

    const admin = users.find((u) => u.phone === '+919900000001');
    assert.ok(admin, 'admin user is stored');
    assert.equal(admin.active_role, 'ADMIN');
  });

  it('links vehicles to their user with plate numbers and the EV flag', () => {
    const db = new DatabaseSync(file);
    const vehicles = db.prepare('SELECT id, user_id, make_model, plate_number, is_ev FROM vehicles').all();
    db.close();
    assert.equal(vehicles.length, 2);

    const city = vehicles.find((v) => v.plate_number === 'KA-04-MB-1234');
    assert.ok(city, 'Honda City ZX is linked to the driver');
    assert.equal(city.user_id, 'usr_driver_1');
    assert.equal(city.is_ev, 0);

    const nexon = vehicles.find((v) => v.plate_number === 'KA-51-EV-9021');
    assert.ok(nexon, 'Tata Nexon EV Max is linked');
    assert.equal(nexon.is_ev, 1);
  });

  it('reads users back through the module API, including roles and vehicles', () => {
    const rajesh = store.getUserByPhone('+919876543210');
    assert.equal(rajesh.name, 'Rajesh Kumar');
    assert.deepEqual([...rajesh.roles].sort(), ['DRIVER', 'PROVIDER']);
    assert.deepEqual(rajesh.vehicles.map((v) => v.plateNumber).sort(), ['KA-04-MB-1234', 'KA-51-EV-9021']);
    assert.equal(store.getUserByEmail('OPS-ADMIN@example.com').activeRole, 'ADMIN');
    assert.equal(store.getUserById('usr_deleted'), undefined, 'soft-deleted users are hidden');
    assert.equal(store.getAllUsers().length, 5);
  });

  it('re-syncing is idempotent and applies updates', () => {
    store.syncAll(FIXTURES);
    store.saveUser({ ...FIXTURES[1], name: 'Priya R. Rao', activeRole: 'PROVIDER' });
    const db = new DatabaseSync(file);
    const count = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
    const vehicles = db.prepare('SELECT COUNT(*) AS n FROM vehicles').get().n;
    db.close();
    assert.equal(count, FIXTURES.length, 'no duplicate users');
    assert.equal(vehicles, 2, 'no duplicate vehicles');
    const priya = store.getUserById('usr_driver_2');
    assert.equal(priya.name, 'Priya R. Rao');
    assert.equal(priya.activeRole, 'PROVIDER');
  });

  it('performs relational transactions with foreign-key cascade', () => {
    const db = new DatabaseSync(file);
    db.exec('PRAGMA foreign_keys = ON;');
    db.prepare(
      `INSERT INTO users (id, full_name, phone, is_phone_verified, active_role, account_status, created_at, updated_at)
       VALUES (?, ?, ?, 1, 'DRIVER', 'ACTIVE', ?, ?)`
    ).run('usr_tx', 'Integration Test User', '+919999912345', CREATED, CREATED);
    db.prepare(
      `INSERT INTO vehicles (id, user_id, type, make_model, plate_number, is_ev, is_default, created_at)
       VALUES (?, ?, 'SEDAN', 'Maruti Dzire', 'KA-01-AB-9999', 0, 1, ?)`
    ).run('veh_tx', 'usr_tx', CREATED);

    assert.equal(db.prepare('SELECT full_name FROM users WHERE id = ?').get('usr_tx').full_name, 'Integration Test User');
    assert.equal(db.prepare('SELECT plate_number FROM vehicles WHERE user_id = ?').get('usr_tx').plate_number, 'KA-01-AB-9999');

    assert.throws(
      () => db.prepare(`INSERT INTO vehicles (id, user_id, type, make_model, plate_number, created_at) VALUES ('veh_orphan', 'no_such_user', 'SUV', 'X', 'KA-01-ZZ-0001', ?)`).run(CREATED),
      /FOREIGN KEY/,
      'vehicles cannot reference a missing user'
    );

    db.prepare('DELETE FROM users WHERE id = ?').run('usr_tx');
    assert.equal(db.prepare('SELECT * FROM vehicles WHERE user_id = ?').get('usr_tx'), undefined, 'cascade removes the vehicle');
    db.close();
  });

  it('replaces a corrupt (non-SQLite) user.db instead of failing', () => {
    const corruptDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vpark-user-db-corrupt-'));
    tempDirs.push(corruptDir);
    fs.writeFileSync(path.join(corruptDir, 'user.db'), 'create database user;');
    const recovered = new SqliteUserDatabase(corruptDir);
    recovered.saveUser(FIXTURES[0]);
    assert.equal(recovered.getUserByPhone('+919876543210')?.name, 'Rajesh Kumar');
    recovered.close();
  });

  it('never touches the developer’s real .data/user.db', () => {
    assert.ok(!tempDirs.some((d) => path.resolve(d).startsWith(path.resolve(process.cwd(), '.data'))));
    assert.equal(fingerprint(REAL_USER_DB), realDbBefore, '.data/user.db is byte-for-byte unchanged');
  });
});
