// Session-enforcement and privilege-escalation tests, run once per session backend
// (local development store and the durable Redis REST store).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { read } from './harness.mjs';
import { createSessionManager } from '../../src/lib/security/session.mjs';

const DAY = 24 * 60 * 60 * 1000;

/**
 * @param {string} label
 * @param {Awaited<ReturnType<import('./harness.mjs').setupApp>>} app
 * @param {() => import('../../src/lib/security/session.mjs').SessionStore} makeStore
 *   a second handle on the same backing store the app uses (to fabricate old sessions)
 */
export async function defineSessionEnforcementTests(label, app, makeStore) {
  const { db, request, sessionFor } = app;
  const me = await import('../../src/app/api/auth/me/route.ts');
  const logout = await import('../../src/app/api/auth/logout/route.ts');
  const role = await import('../../src/app/api/auth/role/route.ts');
  const userExport = await import('../../src/app/api/user/export/route.ts');
  const userDelete = await import('../../src/app/api/user/delete/route.ts');
  const adminListings = await import('../../src/app/api/admin/listings/route.ts');
  const providerListings = await import('../../src/app/api/provider/listings/route.ts');
  const bookings = await import('../../src/app/api/bookings/route.ts');

  const whoAmI = async (opts) => (await read(await me.GET(request('GET', '/api/auth/me', opts)))).json.user;
  const exportStatus = async (opts) => (await userExport.GET(request('GET', '/api/user/export', opts))).status;

  /** A session created by a manager whose clock is `ageMs` in the past. */
  async function sessionCreatedAgo(userId, ageMs) {
    const past = createSessionManager({ store: makeStore(), secret: process.env.SESSION_SECRET, now: () => Date.now() - ageMs });
    return (await past.createSession({ userId })).token;
  }

  describe(`Session enforcement on API routes [${label}]`, () => {
    it('a raw database user ID cannot authenticate (legacy or new cookie name)', async () => {
      assert.equal(await whoAmI({ cookie: 'vpark_user_id=usr_driver_1' }), null);
      assert.equal(await whoAmI({ token: 'usr_driver_1' }), null);
      assert.equal(await whoAmI({ token: 'usr_admin_1' }), null);
      assert.equal(await exportStatus({ cookie: 'vpark_user_id=usr_driver_1' }), 401);
    });

    it('a missing session cannot authenticate', async () => {
      assert.equal(await whoAmI({}), null);
      assert.equal(await exportStatus({}), 401);
    });

    it('a valid session can access permitted resources and never exposes server-only fields', async () => {
      const token = await sessionFor('usr_driver_1');
      const user = await whoAmI({ token });
      assert.equal(user.id, 'usr_driver_1');
      assert.equal(user.passwordHash, undefined);
      assert.equal(user.firebaseUid, undefined);
      assert.equal(await exportStatus({ token }), 200);
    });

    it('a tampered session token cannot authenticate', async () => {
      const token = await sessionFor('usr_driver_1');
      const flipped = token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A');
      assert.equal(await whoAmI({ token: flipped }), null);
      assert.equal(await whoAmI({ token: `${token}x` }), null);
      assert.equal(await exportStatus({ token: flipped }), 401);
    });

    it('an expired session cannot authenticate', async () => {
      const token = await sessionCreatedAgo('usr_driver_1', 8 * DAY); // absolute lifetime is 7 days
      assert.equal(await whoAmI({ token }), null);
      assert.equal(await exportStatus({ token }), 401);
    });

    it('an idle session cannot authenticate', async () => {
      const token = await sessionCreatedAgo('usr_driver_1', 4 * DAY); // idle timeout is 3 days
      assert.equal(await whoAmI({ token }), null);
    });

    it('logout revokes the session server-side (a copied cookie stops working)', async () => {
      const token = await sessionFor('usr_driver_1');
      assert.ok(await whoAmI({ token }));
      const res = await logout.POST(request('POST', '/api/auth/logout', { token }));
      assert.equal(res.status, 200);
      assert.equal(res.cookies.get('vpark_session')?.value, '');
      assert.equal(await whoAmI({ token }), null);
    });

    it('account deletion revokes every session of that account', async () => {
      const victim = (await db.upsertVerifiedGoogleUser({ uid: `delete-me-${label}`, email: `delete.me.${label}@example.com`, grantAdmin: false })).user;
      const a = await sessionFor(victim.id);
      const b = await sessionFor(victim.id);
      const res = await userDelete.POST(request('POST', '/api/user/delete', { token: a }));
      assert.equal(res.status, 200);
      assert.equal(await whoAmI({ token: a }), null);
      assert.equal(await whoAmI({ token: b }), null);
    });

    it('rejects state-changing requests from another origin', async () => {
      const token = await sessionFor('usr_driver_1');
      const res = await role.POST(
        request('POST', '/api/auth/role', { token, origin: 'https://evil.example', body: { action: 'SWITCH_MODE', role: 'DRIVER' } })
      );
      assert.equal(res.status, 403);
    });
  });

  describe(`Privilege escalation through client requests [${label}]`, () => {
    it('a driver cannot reach admin or provider routes', async () => {
      assert.equal((await adminListings.GET(request('GET', '/api/admin/listings', { token: await sessionFor('usr_driver_1') }))).status, 403);
      assert.equal((await providerListings.GET(request('GET', '/api/provider/listings', { token: await sessionFor('usr_driver_1') }))).status, 403);
    });

    it('a driver cannot self-grant ADMIN or switch into a mode it does not hold', async () => {
      const token = await sessionFor('usr_driver_1');
      const add = await role.POST(request('POST', '/api/auth/role', { token, body: { action: 'ADD_CAPABILITY', role: 'ADMIN' } }));
      assert.equal(add.status, 403);
      const sw = await role.POST(request('POST', '/api/auth/role', { token, body: { action: 'SWITCH_MODE', role: 'ADMIN' } }));
      assert.equal(sw.status, 403);
      assert.ok(!(await db.getUserById('usr_driver_1')).roles.includes('ADMIN'));
    });

    it('the removed demo-persona switch cannot be used to become another user', async () => {
      const res = await role.POST(
        request('POST', '/api/auth/role', { body: { action: 'SWITCH_DEMO_PERSONA', role: 'ADMIN', switchDemoUser: true } })
      );
      assert.equal(res.status, 401);
      assert.equal(res.cookies.get('vpark_session'), undefined);
    });

    it('asking for ?role=ADMIN does not widen a driver booking list', async () => {
      const res = await read(await bookings.GET(request('GET', '/api/bookings?role=ADMIN', { token: await sessionFor('usr_driver_1') })));
      assert.equal(res.status, 200);
      assert.ok(res.json.data.every((b) => b.driverId === 'usr_driver_1'));
    });

    it('a stored ADMIN role is not honoured unless the account UID is allowlisted', async () => {
      const legacyAdmin = await sessionFor('usr_admin_1');
      assert.equal((await adminListings.GET(request('GET', '/api/admin/listings', { token: legacyAdmin }))).status, 403);
      const user = await whoAmI({ token: legacyAdmin });
      assert.ok(!user.roles.includes('ADMIN'));
      assert.notEqual(user.activeRole, 'ADMIN');
    });

    it('adding a capability rotates the session token', async () => {
      const token = await sessionFor('usr_owner_2');
      const res = await role.POST(request('POST', '/api/auth/role', { token, body: { action: 'ADD_CAPABILITY', role: 'DRIVER' } }));
      assert.equal(res.status, 200);
      const fresh = res.cookies.get('vpark_session')?.value;
      assert.ok(fresh && fresh !== token);
      assert.equal(await whoAmI({ token }), null);
      assert.equal((await whoAmI({ token: fresh })).id, 'usr_owner_2');
    });
  });
}
