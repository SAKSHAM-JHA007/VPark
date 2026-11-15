import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const USER_DB = path.join(process.cwd(), '.data', 'user.db');
const SCHEMA_FILE = path.join(process.cwd(), '.data', 'user_schema.sql');

test('SQLite User Database (.data/user.db)', async (t) => {
  await t.test('user.db file exists and is a valid SQLite 3 database', () => {
    assert.ok(fs.existsSync(USER_DB), 'user.db must exist in .data');
    assert.ok(fs.existsSync(SCHEMA_FILE), 'user_schema.sql must exist');

    const header = Buffer.alloc(16);
    const fd = fs.openSync(USER_DB, 'r');
    fs.readSync(fd, header, 0, 16, 0);
    fs.closeSync(fd);
    assert.ok(
      header.toString('utf-8').startsWith('SQLite format 3'),
      'File must start with standard SQLite format 3 magic header'
    );
  });

  await t.test('users table has seeded records with E.164 phone numbers and active roles', () => {
    const db = new DatabaseSync(USER_DB);
    const users = db.prepare('SELECT id, full_name, phone, active_role FROM users WHERE deleted_at IS NULL').all();
    assert.ok(users.length >= 5, `Expected at least 5 active seeded users, found ${users.length}`);

    const driver = users.find((u) => u.phone === '+919876543210');
    assert.ok(driver, 'Driver Rajesh Kumar should be in user.db');
    assert.equal(driver.full_name, 'Rajesh Kumar');
    assert.equal(driver.active_role, 'DRIVER');

    const admin = users.find((u) => u.phone === '+919900000001');
    assert.ok(admin, 'Admin user should be in user.db');
    assert.equal(admin.active_role, 'ADMIN');

    db.close();
  });

  await t.test('vehicles table has records linked to users with plate numbers', () => {
    const db = new DatabaseSync(USER_DB);
    const vehicles = db.prepare('SELECT id, user_id, make_model, plate_number, is_ev FROM vehicles').all();
    assert.ok(vehicles.length >= 2, `Expected vehicles, found ${vehicles.length}`);

    const city = vehicles.find((v) => v.plate_number === 'KA-04-MB-1234');
    assert.ok(city, 'Honda City ZX must be linked to driver');
    assert.equal(city.is_ev, 0);

    const nexon = vehicles.find((v) => v.plate_number === 'KA-51-EV-9021');
    assert.ok(nexon, 'Tata Nexon EV Max must be linked');
    assert.equal(nexon.is_ev, 1);

    db.close();
  });

  await t.test('can perform relational transactions and foreign-key integrity', () => {
    const db = new DatabaseSync(USER_DB);
    const testUserId = `usr_test_${Date.now()}`;
    const testPhone = `+9199999${Math.floor(10000 + Math.random() * 90000)}`;

    // Insert user
    db.prepare(`
      INSERT INTO users (id, full_name, phone, is_phone_verified, active_role, account_status, created_at, updated_at)
      VALUES (?, ?, ?, 1, 'DRIVER', 'ACTIVE', datetime('now'), datetime('now'))
    `).run(testUserId, 'Integration Test User', testPhone);

    // Insert vehicle
    db.prepare(`
      INSERT INTO vehicles (id, user_id, type, make_model, plate_number, is_ev, is_default, created_at)
      VALUES (?, ?, 'SEDAN', 'Maruti Dzire', 'KA-01-AB-9999', 0, 1, datetime('now'))
    `).run(`veh_${testUserId}`, testUserId);

    // Query user with vehicle
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(testUserId);
    assert.ok(user);
    assert.equal(user.full_name, 'Integration Test User');

    const veh = db.prepare('SELECT * FROM vehicles WHERE user_id = ?').get(testUserId);
    assert.ok(veh);
    assert.equal(veh.plate_number, 'KA-01-AB-9999');

    // Clean up test user
    db.prepare('DELETE FROM users WHERE id = ?').run(testUserId);
    const deletedVeh = db.prepare('SELECT * FROM vehicles WHERE user_id = ?').get(testUserId);
    assert.equal(deletedVeh, undefined, 'Cascade delete should remove vehicle');

    db.close();
  });
});
