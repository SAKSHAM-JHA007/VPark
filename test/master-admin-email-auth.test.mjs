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

  it('login UI uses Google Sign-In as primary authentication with Remember Sign-In ID', () => {
    const authModalCode = fs.readFileSync('src/components/AuthModal.tsx', 'utf-8');
    assert.ok(authModalCode.includes('Continue with Google'), 'Login UI must include Google Sign-In as primary method');
    assert.ok(authModalCode.includes('Remember sign-in ID on this device'), 'Must have remember sign-in ID option');
    assert.ok(authModalCode.includes('vpark_remembered_email'), 'Must store remembered sign-in ID');
    assert.ok(authModalCode.includes('jhasaksham.7453k@gmail.com'), 'Must recognize master admin email');
    assert.ok(authModalCode.includes('master_password'), 'Must have master password state');
    assert.ok(authModalCode.includes('Mobile Number (User Contact Details)'), 'Phone number must be collected strictly in onboarding user details');
  });

  it('firebase client and google auth endpoint support Google identity & master admin', () => {
    const firebaseCode = fs.readFileSync('src/lib/firebase.ts', 'utf-8');
    assert.ok(firebaseCode.includes('googleProvider'), 'Firebase client must export googleProvider');
    assert.ok(firebaseCode.includes('signInWithGooglePopup'), 'Firebase client must export signInWithGooglePopup');
    assert.ok(!firebaseCode.includes('AIzaSy'), 'Firebase client must never contain hardcoded API keys');

    const googleRouteCode = fs.readFileSync('src/app/api/auth/google/route.ts', 'utf-8');
    assert.ok(googleRouteCode.includes('upsertGoogleUser'), 'Google route must call upsertGoogleUser');
    assert.ok(googleRouteCode.includes('jhasaksham.7453k@gmail.com'), 'Google route must check for master admin email');
  });

  it('removes demo persona buttons and other manual login forms in favor of Google Sign-In', () => {
    const authModalCode = fs.readFileSync('src/components/AuthModal.tsx', 'utf-8');
    assert.ok(!authModalCode.includes('Pilot Quick-Access Personas'), 'Demo quick-access personas must be removed');
    assert.ok(!authModalCode.includes('handleDemoLogin'), 'Demo login handler must be removed');
    assert.ok(!authModalCode.includes('Step 1: Set Password'), 'Manual password inputs must be removed in favor of Google');

    const headerCode = fs.readFileSync('src/components/Header.tsx', 'utf-8');
    assert.ok(!headerCode.includes('Demo Personas'), 'Demo personas must be removed from Header menu');
  });
});
