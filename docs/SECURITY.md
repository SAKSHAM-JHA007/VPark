# VPark Security Architecture

This document covers the security fixes made on the `fix/security-hardening` branch: what the code now enforces, what has to be configured, and what is still outstanding. Passing tests do not mean the app is secure. The section "What is and is not verified" lists what has actually been checked.

---

## 1. Issues fixed

| # | Issue | Severity | Fix |
|---|-------|----------|-----|
| A | `/api/search` spread the stored `Listing` into the response. Exact coordinates, street address, landmark, provider ID, provider situation and description reached anonymous users. Distances, radius filtering and ranking used the exact pin, which allowed triangulation. | High (privacy) | Explicit public DTO; approximate location for non-PUBLIC listings; every location-derived value computed from the approximate point. |
| A2 | `GET /api/bookings/[id]` returned the full listing to the driver, including verification-document metadata. Cancelled or unpaid bookings still exposed the exact address. | Medium | Viewer-scoped booking and listing views. Exact location only while the booking qualifies. |
| B | The session cookie `vpark_user_id` held the raw database user ID. Editing the cookie impersonated any user. | Critical | Opaque random session tokens in a server-side store, HMAC-hashed with `SESSION_SECRET`. |
| C | `/api/auth/google` trusted the `uid` / `email` sent by the browser. Anyone could sign in as any email. | Critical | Firebase ID token verified on the server with the Firebase Admin SDK. Identity comes only from the verified token. |
| D | A master-admin password was hard-coded in the public repository (the `MASTER_LOGIN` action of `/api/auth/otp`). The Google route also granted ADMIN to anyone presenting the administrator's email. | Critical | Password path removed. ADMIN only for Firebase UIDs on a server-side allowlist. |
| E | The email OTP was always the fixed demo code, in every environment. Anyone could sign in as any email, including the seeded admin. | Critical | OTP sign-in removed (no frontend caller). |
| F | Email/password sign-up set a password on any existing account that had none, such as a Google account: account takeover. | Critical | Email/password routes removed (no frontend caller). |
| G | `POST /api/auth/role` with `SWITCH_DEMO_PERSONA` gave any unauthenticated caller an ADMIN session when `NODE_ENV` was not `production`. | High | Removed. The endpoint now requires a session. |
| H | Any signed-in user could release another user's slot hold and open a dispute on any booking. | Medium | Ownership checks. |
| I | Booking actions were not role-scoped: a provider could extend or check in a driver's booking, and a booking could be cancelled twice or after completion. | Medium | Per-action role and status rules. |
| J | Monthly pass price was taken from the request body. | Medium | Price comes from the listing's monthly rate. |
| K | Users could set any email as "verified" through `/api/user/profile` and onboarding. | Medium | Contact emails are stored unverified and must be unique. |
| L | Every user object sent to the browser included `passwordHash`. | Low | `toPublicUser()` strips server-only fields. |
| M | Providers could submit a client-chosen `storageKey` (another provider's file) and the `PUBLIC` category (exact-location treatment) for their own space. | Medium | `storageKey` ignored; category limited to PRIVATE / COMMERCIAL / OTHER. |

---

## 2. Architecture

### Application data (`src/lib/db.ts`, `src/lib/data/`)
- **Production: PostgreSQL**, connected with `pg` (node-postgres) through `DATABASE_URL` or `POSTGRES_URL`. Every application record is stored there: users, roles, profiles, consents, listings, verifications, slot holds, bookings, payments, payouts, disputes, reviews, monthly passes, audit logs, contact messages and (unless Redis is configured) sessions. All serverless instances share one source of truth.
- **Schema** (`src/lib/data/migrations.mjs`): one table per collection.
  - Lookup, integrity and locking fields are typed columns with constraints: primary keys, foreign keys (for example booking → listing/driver/provider, payment → booking), unique keys (booking reference, one account per Firebase UID, one role grant per user and role), and CHECK constraints on listing/booking status and category.
  - The full domain object is stored alongside in `jsonb`, so API responses are unchanged.
  - `seq` preserves insertion order.
  - The existing `prisma/schema.prisma` was **not** used. It has no tables for bookings, payments, payouts, holds, disputes, passes, reviews or documents; its UUID primary keys do not match the app's IDs; its unique `users.phone` breaks Google sign-ups (empty phone); it lacks most listing fields; and it requires PostGIS and Prisma, which is not installed. It remains in the repository as the PRD's long-term relational target.
- **Migrations are explicit.** `npm run db:migrate` applies them under an advisory lock, each in a transaction. The app never migrates by itself. At runtime it checks the schema version and **fails closed (503) if migrations are pending**.
- **Transactions:** every data-layer method runs as one transaction (all-or-nothing, rolled back on any error), retried automatically on deadlock or serialization failure. Critical sections are serialized across instances with row locks (`SELECT … FOR UPDATE`) or transaction-scoped advisory locks:
  - slot holds, bookings and extensions lock the **listing** row, so capacity is checked and consumed atomically and the last slot cannot be sold twice;
  - booking state changes (check-in, check-out, cancel, extend), disputes and dispute resolution lock the **booking** or **dispute** row, and re-check the allowed current status inside the lock, so a double cancel cannot refund twice;
  - first Google sign-in takes advisory locks on the Firebase UID and the email, and a partial unique index guarantees one account per UID;
  - contact-email changes take an advisory lock on the email.
  - Booking creation also writes the payment record in the same transaction, and only consumes the requesting driver's own hold.
- **Fail closed:** in production, a missing or invalid `DATABASE_URL`, an unreachable database, or an unmigrated schema makes every data request return `503` and log the reason. It never falls back to local JSON or SQLite. Remote production connections always use TLS with certificate verification; `sslmode=disable` is refused.
- **Local development** without `DATABASE_URL` keeps the JSON store in `.data/vpark_database.json` behind the same transactional interface. Transactions are serialized in-process and rolled back on error. It is single-process only and is never selected in production. Developers can also point `DATABASE_URL` at a local PostgreSQL.
- **Existing `.data` is never migrated or modified automatically.** A fresh production database starts empty: no demo users are seeded, and accounts are created at Google sign-in.

### Sessions (`src/lib/security/session.mjs`, `src/lib/security/redis-session-store.mjs`, `src/lib/auth.ts`)
- **Token:** `v1.` followed by 32 random bytes in base64url (256 bits). It is opaque and holds no user data.
- **Storage:** only `HMAC-SHA256(SESSION_SECRET, token)` is stored, never the token. A leaked store does not reveal usable tokens, and tokens cannot be minted without the secret.
- **Durable, shared backends:** the **application PostgreSQL database** (table `vp_sessions`), or **Redis** through the Upstash REST API over HTTPS with plain `fetch` (no client library), which is Vercel's Marketplace Upstash Redis / KV integration. Redis takes precedence when configured.
  - Every serverless instance uses the same store, so sessions survive cold starts, restarts and redeploys, and logout or revocation takes effect on every instance.
  - Each session key carries a TTL of whichever comes first: the idle timeout, or the time left until absolute expiry. Redis deletes expired and idle sessions itself, so pruning is durable with no sweep job.
  - Revocation deletes the key, and `touch` uses `SET … XX`, so a revoked session cannot be brought back by a concurrent request on another instance.
  - A per-user index (`<prefix>u:<userId>`) makes "sign out everywhere" (account deletion) possible.
- **Backend selection** (`resolveSessionBackend`):
  - Redis REST credentials set → Redis.
  - No Redis and PostgreSQL configured → sessions are stored in PostgreSQL. Revocation deletes the row; `touch` locks the row and never recreates a deleted session; expired and idle sessions are pruned with `DELETE` statements.
  - **Production with neither → fail closed.** Sessions are disabled, sign-in returns `503`, existing cookies are refused, and a clear configuration error is logged. It never falls back to local files or process memory.
  - Development or test with neither → the local JSON development store. Every write, including pruning, is persisted to disk immediately.
- **Store unavailable:** if Redis cannot be reached or rejects the credentials, requests are treated as signed out and sign-in returns `503`. A logout that cannot be recorded returns `503` instead of claiming success.
- **Cookie:** `__Host-vpark_session` in production (`vpark_session` in development). HttpOnly, `Secure` in production, `SameSite=Lax`, `Path=/`.
- **Lifetime:** 7-day absolute expiry and 3-day idle timeout. `lastSeenAt` is refreshed at most every 15 minutes.
- **Rotation:** a new token is issued on every sign-in and every capability change, and the token sent with that request is revoked (this prevents session fixation).
- **Revocation:** logout revokes the session server-side. Account deletion revokes every session for the account.
- **Revalidation:** on every request the token is checked (format, HMAC lookup, expiry, idle time, revocation). The account must still exist and be `ACTIVE`, and ADMIN is re-derived from the allowlist.
- **Fail closed:** if `SESSION_SECRET` is missing in production, or shorter than 32 characters anywhere, or the durable store is missing or misconfigured in production, no session can be created or accepted, and sign-in returns `503`.
- **CSRF:** state-changing requests must come from the same Origin, and requests with `Sec-Fetch-Site: cross-site` are rejected. This is in addition to `SameSite=Lax`.
- **Legacy cookie:** `vpark_user_id` is never read. It is cleared on sign-in and sign-out.

### Google sign-in (`src/lib/security/firebase-identity.mjs`, `src/lib/auth-google.ts`)
1. The browser signs in with the Firebase popup and sends `{ idToken, intent }`. Nothing else in the body is read.
2. The server rejects missing or malformed tokens before any processing.
3. `firebase-admin` `verifyIdToken` checks the RS256 signature against Google's published keys, plus `aud`, `iss`, `exp`, `iat`, `auth_time` and `sub`. This needs only the project ID; **no service-account credential is used**.
4. VPark's own policy then re-checks `aud` and `iss`, requires `firebase.sign_in_provider === "google.com"` and `email_verified === true`, and requires the sign-in to be less than 10 minutes old.
5. Only then is an account looked up or created, in this order: linked Firebase UID, then the legacy `usr_<uid>` account, then an unlinked account with the same verified email. An account already linked to a different UID is never taken over.
6. `FIREBASE_AUTH_EMULATOR_HOST` makes the Admin SDK skip signature checks, so sign-in is refused in production while it is set.

### Administrator access (`src/lib/security/access-policy.mjs`)
- ADMIN is effective only while the account's verified `firebaseUid` is listed in `VPARK_ADMIN_FIREBASE_UIDS`. This is checked on every request.
- A stored `ADMIN` role without an allowlisted UID (for example the seeded demo admin, or the old master-admin record in an existing `.data` store) gives no admin access.
- Removing a UID from the allowlist revokes admin access on the next request.
- Email addresses never grant privileges, and nothing in a request body can grant ADMIN.

### Location privacy (`src/lib/security/listing-privacy.mjs`)
- **Public search** returns `PublicListingSummary`, built field by field. It never spreads the stored listing.
- **PRIVATE / COMMERCIAL / OTHER listings, before booking:**
  - Coordinates are the centre of a ~550 m grid cell plus an offset derived only from the listing ID. The result is stable, and every real point in the cell maps to the same output.
  - Distance (to 0.1 km), the radius filter, distance ranking and nearest-first sorting all use this approximate point, so repeated queries cannot narrow down the real pin.
  - Address, landmark, real access instructions, provider ID, provider situation, description and documents are omitted. Individual hosts' names are shortened to first name plus last initial.
- **PUBLIC listings** are surveyed public on-street parking: discovery-only, never bookable, and published with their exact location for navigation. Providers cannot create PUBLIC listings.
- **Exact location and access instructions** are returned through `toBookingView()`:
  - the booking driver gets them while the booking is `CONFIRMED`, `CHECKED_IN`, `COMPLETED`, `OVERSTAY` or `DISPUTED`; a cancelled, expired or unpaid booking does not include them;
  - the listing's provider always gets them;
  - an allowlisted admin always gets them;
  - anyone else gets `403`.

---

## 3. Required configuration

| Variable | Where | Required | Notes |
|----------|-------|----------|-------|
| `SESSION_SECRET` | Server | **Yes (production)** | 32+ random characters. Changing it signs everyone out. |
| `FIREBASE_PROJECT_ID` | Server | **Yes** for sign-in | Same value as `NEXT_PUBLIC_FIREBASE_PROJECT_ID`. Falls back to the `NEXT_PUBLIC_` value. There is no hard-coded fallback on the server. |
| `VPARK_ADMIN_FIREBASE_UIDS` | Server | For admin access | Comma-separated Firebase UIDs. |
| `NEXT_PUBLIC_FIREBASE_*` | Client | Recommended | Public web config. The client still has built-in defaults; make sure they match `FIREBASE_PROJECT_ID`. |
| `DATABASE_URL` (or `POSTGRES_URL`) | Server | **Yes (production)** | PostgreSQL for all application data and, by default, sessions. Use the provider's pooled TLS connection string. **It contains a password: secret.** Missing or invalid in production → `503` everywhere. |
| `VPARK_DATABASE_POOL_MAX` | Server | No | Connections per instance (default 5). Keep it small on serverless. |
| `VPARK_DATA_STORE` | Server | No | Set to `postgres` outside production to require `DATABASE_URL` instead of the local JSON store. |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Server | Optional | Durable shared session store. Must be `https://`. `KV_REST_API_URL` / `KV_REST_API_TOKEN` (Vercel KV names) are also accepted. The read-only token is never used. **The REST token is a secret.** |
| `VPARK_SESSION_KEY_PREFIX` | Server | No | Default `vpark:session:`. Use a different prefix (or separate Redis databases) for Production and Preview. |
| `VPARK_SESSION_STORE` | Server | No | Set to `redis` in a non-production environment to require Redis instead of falling back to the local development store. |
| `FIREBASE_AUTH_EMULATOR_HOST` | Never in production | No | Disables signature checks in the Admin SDK. |

No Firebase service-account key is needed. Do not add one to the repository, to `NEXT_PUBLIC_*` variables, or to client code.

---

## 4. Manual steps for the project owner

1. **Treat the old master password as compromised.** It is in the public Git history permanently. If that password (or a variant) is used for any other account, such as Google, email or hosting, change it there now. The VPark code no longer accepts it.
2. **Treat the previously hard-coded administrator email as public.** Expect phishing aimed at it, and enable 2-step verification on that Google account.
3. **Optional: rewrite Git history.** Rewriting (e.g. `git filter-repo`) and force-pushing removes the strings from future clones, but not from existing clones, forks or caches. It was **not** done here, because it is destructive and needs coordination.
4. **Find your Firebase UID:** sign in once with Google, then copy your UID from Firebase Console › Authentication › Users.
5. **Create the PostgreSQL database.** In Vercel, open Storage (or the Marketplace) and add a Postgres provider (e.g. Neon or Supabase). Connect it to the project so it sets `DATABASE_URL` / `POSTGRES_URL`. Use separate databases for Production and Preview. Then run the migrations against each database before (or as part of) deploying:
   ```bash
   DATABASE_URL="<connection string>" npm run db:migrate
   ```
   For example, set the Vercel build command to `npm run db:migrate && next build`. **Without a migrated database, production returns 503 by design.** Enable the provider's automated backups and point-in-time recovery.
   Optional: add **Upstash Redis** for sessions. Without it, sessions live in PostgreSQL. If you use Redis, give Production and Preview separate databases or `VPARK_SESSION_KEY_PREFIX` values, and different `SESSION_SECRET` values.
6. **Set environment variables on Vercel** (Project › Settings › Environment Variables, for Production and Preview): `SESSION_SECRET`, `DATABASE_URL`, optionally the Redis REST URL and token, `FIREBASE_PROJECT_ID`, `VPARK_ADMIN_FIREBASE_UIDS`, and `NEXT_PUBLIC_FIREBASE_*`. Redeploy afterwards.
7. **In the Firebase Console:**
   - make sure the Google sign-in provider is enabled;
   - make sure only your real domains (and `localhost` for development) are in Authentication › Settings › Authorized domains;
   - restrict the browser API key in Google Cloud to your domains.
8. **Expect everyone to be signed out once.** Old `vpark_user_id` cookies are ignored, so users must sign in again.
9. **Check existing data.** Old accounts with an `ADMIN` role (including the old master-admin record in an existing `.data` store) no longer have admin access unless their UID is allowlisted. Review accounts whose email was set through the old "verified" profile flow (finding K). Such an account can still be linked to the Google identity that verifies the same email.

---

## 5. What is and is not verified

**Verified by automated tests** (`npm test`, files `test/security-*.test.mjs`). These call the real route handlers against an isolated temporary data directory:
- Anonymous search never returns exact private coordinates, address, landmark, access code, provider identity or document data, at any nesting depth.
- Approximate locations are stable, and radius or distance queries cannot recover the real pin.
- The booking driver, the listing provider and the allowlisted admin get exact details; unrelated users get `401` or `403`; a stored-but-unallowlisted ADMIN gets `403`; cancelled bookings lose the exact location.
- Raw user IDs, tampered tokens, expired or idle sessions, missing sessions, and sessions after logout or account deletion do not authenticate. The same suite runs against both the local development store and the Redis store.
- **Application data. Three clearly separated tiers:**
  - *Mocks* (`test/data-store-failures.test.mjs`): fake connection pools prove the handling of these failures:
    - unreachable database, unmigrated schema and mid-transaction failure each give 503 (rollback, connection discarded);
    - deadlock retry;
    - a constraint violation surfaces as an error, not as 503;
    - configuration rules: production without `DATABASE_URL` fails closed, remote production connections require TLS.
    - An in-process app in production mode with no database returns `503` on search, contact and sign-in, logs the configuration error, and writes nothing locally (the real `.data` is checked untouched).
  - *Embedded PostgreSQL engine* (`test/data-store-pglite.test.mjs`, PGlite, always runs): real SQL, migrations, `jsonb`, FK/unique/CHECK constraints, rollback, restart persistence (file-backed database closed and reopened), and the unmigrated-schema refusal. It has **one connection**, so it cannot prove cross-connection locking.
  - *Real PostgreSQL server* (`test/data-store-postgres-server.test.mjs`): runs only when `VPARK_TEST_DATABASE_URL` is set, otherwise reported as skipped.
    - It applies the schema with the real CLI.
    - It runs the shared suite with every instance on its own connection pool.
    - It races six separate OS processes for the last parking slot: exactly one wins.
    - It serves an authenticated API request through `DATABASE_URL` with sessions in PostgreSQL and no local writes.
    - In this session it was run against a throwaway local PostgreSQL 18.7 server (from the `embedded-postgres` npm package, installed outside the project) and passed.
  - The same behavioural suite also runs on the local JSON development store:
    - persistence of every collection;
    - booking + payment atomicity;
    - last-slot booking and hold races;
    - double cancel;
    - concurrent first sign-in;
    - ownership of holds, disputes, listings and documents;
    - expired-hold clean-up;
    - session durability.
- **Durable sessions (Redis):** these tests use a local fake of the Upstash REST API.
  - A session created by one app process is valid in other processes that each have their own empty data directory, and after a process restart.
  - Logout in one process revokes it in all of them.
  - No process writes a session to its local disk.
  - Redis TTLs remove expired and idle sessions.
  - A concurrent touch cannot resurrect a revoked session.
  - Wrong credentials or an unreachable Redis fail closed.
  - Production with no durable store refuses sign-in (`503`), refuses existing cookies, logs the configuration error, and writes nothing locally.
  - Pruning in the local development store is written to disk.
- Drivers cannot reach admin or provider routes, self-grant ADMIN, or switch into roles they do not hold. The demo-persona switch is gone.
- Google sign-in with a missing, malformed, invalid, expired, wrong-project, unverified-email, non-Google or stale token is rejected, and no account is created.
- Client-supplied uid, email, role and admin flags are ignored.
- A non-allowlisted identity never becomes admin; the allowlisted UID does; removing it from the allowlist revokes access.
- The real Firebase Admin SDK rejects wrong-audience, `alg: none` and garbage tokens offline.
- Mutation check: reintroducing each original bug makes the corresponding tests fail. The bugs checked are: raw-listing spread, raw user-ID cookie, client-supplied email, trusting the stored ADMIN role, ignoring Redis, a production fallback to local storage, a non-atomic touch, and unpersisted pruning. On the real PostgreSQL server, removing any of the following makes a concurrency test fail: the listing row lock (bookings and holds), the sign-in advisory locks, or the in-transaction booking-status check. On PGlite the missing listing lock goes undetected, which confirms that its single connection cannot prove locking.

**Not verified here:**
- A real end-to-end Google sign-in against the production Firebase project. This needs the owner's project configuration and browser sign-in. The Admin SDK's signature and expiry checks against Google's live keys were not exercised; only its offline rejections were.
- Deployment on Vercel: environment variables, `__Host-` cookie behaviour over HTTPS, and the proxy-provided client IP.
- A hosted production PostgreSQL (Neon/Supabase/Vercel Postgres) with its pooler and TLS; the tests used a local server without TLS. Behaviour under real network latency, failover and connection limits was not measured.
- A real hosted Upstash/Vercel Redis instance. The store follows Upstash's documented REST protocol, but it was only exercised against the local fake.
- An external penetration test or code review.

---

## 6. Remaining risks and limitations

- **Not imported:** existing `.data` content was deliberately not imported into PostgreSQL. A production database starts empty. If pilot data must be kept, it needs a reviewed, one-off import.
- **Payload validation:** most domain fields live in `jsonb` and are validated by the application, not by column types. Only the key, relationship and status columns are enforced by the database. Moving more fields into typed columns (towards the Prisma design) is future work.
- **Capacity under load:** capacity checks serialize per listing, which is correct but limits throughput for a single very busy listing. Pool sizing must respect the provider's connection limits (use a pooled connection string).
- **Private uploads:** private document files are still only readable from the local development store (`.data/private_uploads`). There is no durable object storage for uploads yet, and `/api/uploads` does not exist.
- **Local JSON store:** it is single-process. Two dev servers on the same `.data` do not coordinate.
- **Database / Redis availability:** while the session store or database is unreachable, everyone is treated as signed out and requests return `503`. This is fail-closed by design. Use a provider with high availability and backups.
- **Rate limiting** is in memory per instance. `getClientIp` trusts the first `X-Forwarded-For` value, which is reliable on Vercel but not behind arbitrary proxies.
- **Provider free text and photos:** listing title, house rules, dimension notes and photos are written by providers and shown before booking. A provider can still put their address in them, and photos may carry EXIF GPS data. There is no server-side upload pipeline (`/api/uploads` does not exist), so EXIF is not stripped.
- **Approximation granularity:** private spaces are located to roughly a 550 m cell. Several listings by the same host, or a host's other public information, may narrow that down.
- **Firebase revocation:** a Firebase ID token that is revoked but not yet expired (lifetime ≤ 1 h) is not detected, because `checkRevoked` needs a service account. The fresh-sign-in window (10 min) limits replay.
- **Legacy account linking:** before this fix, account IDs and emails came from the browser. An unlinked legacy account, either a `usr_<uid>` record or one whose email was marked verified by the old profile flow, may contain data planted by whoever created it. It is linked to the Google identity that verifies that UID or email. The creator cannot sign back in afterwards, because every other sign-in path is gone.
- **Payment is simulated.** Bookings are confirmed without a real payment gateway, so "qualifying booking" currently means "simulated payment succeeded".
- **Dependencies:** `npm audit` reports existing advisories in `next@14` (fixed in a later major), `firebase` / `@grpc/grpc-js` and `postcss`. None come from `firebase-admin`. Upgrading Next.js is a separate task.
- **The existing `test/user-db.test.mjs`** reads and writes the developer's real `.data/user.db`, and two of its checks depend on local data, so they currently fail. It was left unchanged.
