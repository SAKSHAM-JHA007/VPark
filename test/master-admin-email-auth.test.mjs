import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const USER_DB = path.join(process.cwd(), '.data', 'user.db');

describe('Master Admin & Email-Based Authentication', () => {
  it('master admin account is configured with email jhasaksham.7453k@gmail.com and ADMIN role', () => {
    const db = new DatabaseSync(USER_DB);
    const row = db.prepare('SELECT id, full_name, email, active_role FROM users WHERE email = ?').get('jhasaksham.7453k@gmail.com');
    assert.ok(row, 'Master admin must be present in user.db');
    assert.equal(row.email, 'jhasaksham.7453k@gmail.com');
    assert.equal(row.active_role, 'ADMIN');

    const roleRows = db.prepare('SELECT role FROM user_roles WHERE user_id = ?').all(row.id);
    const roles = roleRows.map((r) => r.role);
    assert.ok(roles.includes('ADMIN'), 'Master admin must have ADMIN role granted');
    db.close();
  });

  it('auth OTP route implements master password verification for Aduomi@1428', () => {
    const routeCode = fs.readFileSync('src/app/api/auth/otp/route.ts', 'utf-8');
    assert.ok(routeCode.includes('MASTER_LOGIN'), 'Route must support MASTER_LOGIN action');
    assert.ok(routeCode.includes('verifyMasterAdmin'), 'Route must invoke verifyMasterAdmin');
    assert.ok(routeCode.includes('jhasaksham.7453k@gmail.com'), 'Route must recognize master email');
  });

  it('login UI uses email ID as primary credential and hides master password for admin email', () => {
    const authModalCode = fs.readFileSync('src/components/AuthModal.tsx', 'utf-8');
    assert.ok(authModalCode.includes('Primary Email ID'), 'Login form must label primary email ID');
    assert.ok(!authModalCode.includes('Primary Mobile Number (+91 E.164)'), 'Mobile number must not be on initial login');
    assert.ok(authModalCode.includes('jhasaksham.7453k@gmail.com'), 'Must recognize master admin email');
    assert.ok(authModalCode.includes('master_password'), 'Must have master password state');
    assert.ok(authModalCode.includes('Mobile Number (User Contact Details)'), 'Phone number must be collected strictly in onboarding user details');
  });
});
