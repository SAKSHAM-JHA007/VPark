// Regression tests: the hard-coded master-admin credential path is gone, and ADMIN
// comes only from a verified Google identity on the server-side UID allowlist.
import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ADMIN_UID, TEST_PROJECT_ID, read, setupApp } from './support/harness.mjs';
import { parseFirebaseUidAllowlist, toEffectiveUser } from '../src/lib/security/access-policy.mjs';

const app = await setupApp();
const { db, request, sessionFor } = app;
const { createGoogleSignInHandler } = await import('../src/lib/auth-google.ts');
const adminListings = await import('../src/app/api/admin/listings/route.ts');
const auditLogs = await import('../src/app/api/admin/audit-logs/route.ts');

after(() => app.cleanup());

function listSourceFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listSourceFiles(full));
    else if (/\.(ts|tsx|mjs|js)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function tokenFor(uid, email) {
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: `https://securetoken.google.com/${TEST_PROJECT_ID}`,
    aud: TEST_PROJECT_ID,
    sub: uid,
    iat: now,
    exp: now + 3600,
    auth_time: now,
    email,
    email_verified: true,
    firebase: { sign_in_provider: 'google.com' },
  };
  return { token: `${b64({ alg: 'RS256' })}.${b64(claims)}.${b64(`sig-${uid}`)}`, claims };
}
const issued = new Map();
const handler = createGoogleSignInHandler({
  verifier: async (t) => {
    if (!issued.has(t)) throw new Error('invalid');
    return issued.get(t);
  },
});
async function googleSignIn(uid, email, extraBody = {}) {
  const { token, claims } = tokenFor(uid, email);
  issued.set(token, claims);
  const res = await handler(request('POST', '/api/auth/google', { body: { idToken: token, ...extraBody } }));
  return { ...(await read(res)), session: res.cookies.get('vpark_session')?.value };
}

describe('Legacy master-password authentication is removed', () => {
  it('the master-password and email/password/OTP sign-in routes no longer exist', () => {
    assert.equal(fs.existsSync('src/app/api/auth/otp/route.ts'), false);
    assert.equal(fs.existsSync('src/app/api/auth/email/route.ts'), false);
  });

  it('no master-password code path remains in the server or UI', () => {
    for (const file of listSourceFiles('src')) {
      const code = fs.readFileSync(file, 'utf-8');
      for (const marker of ['MASTER_LOGIN', 'verifyMasterAdmin', 'master_password', 'MASTER_ADMIN_EMAIL', 'demoOtp']) {
        assert.ok(!code.includes(marker), `${file} still references ${marker}`);
      }
    }
    assert.equal(typeof db.verifyMasterAdmin, 'undefined');
    assert.equal(typeof db.loginWithEmailPassword, 'undefined');
    assert.equal(typeof db.verifyOtpAndSignIn, 'undefined');
  });

  it('public login screens have no password field or prefilled administrator email', () => {
    for (const file of ['src/app/admin/login/page.tsx', 'src/components/AuthModal.tsx']) {
      const code = fs.readFileSync(file, 'utf-8');
      assert.ok(!/type="password"/.test(code), `${file} still renders a password input`);
      assert.ok(!/@gmail\.com/.test(code), `${file} still contains a personal email address`);
    }
  });

  it('client-supplied master-admin flags on the Google endpoint are ignored', async () => {
    const res = await googleSignIn('plain-user-uid', 'plain.user@example.com', {
      action: 'MASTER_LOGIN',
      password: 'anything',
      isMasterAdmin: true,
      uid: ADMIN_UID,
    });
    assert.equal(res.status, 200);
    assert.equal(res.json.isMasterAdmin, false);
    assert.equal((await adminListings.GET(request('GET', '/api/admin/listings', { token: res.session }))).status, 403);
  });
});

describe('Allowlist-based administrator access', () => {
  it('an unapproved Firebase identity cannot acquire ADMIN', async () => {
    const res = await googleSignIn('unapproved-uid', 'someone@example.com');
    assert.equal(res.status, 200);
    assert.ok(!res.json.user.roles.includes('ADMIN'));
    const stored = db.getUsers().find((u) => u.firebaseUid === 'unapproved-uid');
    assert.ok(!stored.roles.includes('ADMIN'));
    assert.equal((await auditLogs.GET(request('GET', '/api/admin/audit-logs', { token: res.session }))).status, 403);
  });

  it('the configured master-admin identity retains administrator access', async () => {
    const res = await googleSignIn(ADMIN_UID, 'owner-admin@example.com');
    assert.equal(res.status, 200);
    assert.equal(res.json.isMasterAdmin, true);
    assert.ok(res.json.user.roles.includes('ADMIN'));
    assert.equal(res.json.user.activeRole, 'ADMIN');
    assert.equal((await adminListings.GET(request('GET', '/api/admin/listings', { token: res.session }))).status, 200);
    assert.equal((await auditLogs.GET(request('GET', '/api/admin/audit-logs', { token: res.session }))).status, 200);
  });

  it('removing a UID from the allowlist revokes admin access on the next request', async () => {
    const admin = db.getUsers().find((u) => u.firebaseUid === ADMIN_UID);
    const token = await sessionFor(admin.id);
    assert.equal((await adminListings.GET(request('GET', '/api/admin/listings', { token }))).status, 200);
    const saved = process.env.VPARK_ADMIN_FIREBASE_UIDS;
    process.env.VPARK_ADMIN_FIREBASE_UIDS = '';
    try {
      assert.equal((await adminListings.GET(request('GET', '/api/admin/listings', { token }))).status, 403);
    } finally {
      process.env.VPARK_ADMIN_FIREBASE_UIDS = saved;
    }
  });

  it('allowlist parsing ignores malformed entries and effective roles drop unbacked ADMIN', () => {
    const set = parseFirebaseUidAllowlist(' uidA ,, bad uid ,uid-B,<script>');
    assert.deepEqual([...set].sort(), ['uid-B', 'uidA']);
    const user = { id: 'x', roles: ['ADMIN', 'DRIVER'], activeRole: 'ADMIN', firebaseUid: 'not-listed' };
    const eff = toEffectiveUser(user, set);
    assert.deepEqual(eff.roles, ['DRIVER']);
    assert.equal(eff.activeRole, 'DRIVER');
    assert.deepEqual(user.roles, ['ADMIN', 'DRIVER'], 'stored record is not mutated');
  });
});
