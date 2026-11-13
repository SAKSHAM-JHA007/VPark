# VPARK: Product Requirements Document (Foundation Release)

*Version 2.2 (revised from v2.1) · 11 November 2026 · Market: Bengaluru, India · Pilot: Yelahanka (to be confirmed) · Platform: Responsive web / PWA · Team: solo founder*

*Note: the v2.1 file I received ended mid-sentence at section 9.2 (Roles table). Everything after that point, including the rest of the schema, is proposed here rather than recovered. Items marked **\[Verify\]** need confirmation before build; **\[Decision\]** marks choices to lock in early.*

---

## 1. Overview

VPARK is a two-sided parking marketplace in Bengaluru: people with unused parking spaces list them, and drivers find and eventually reserve them.

The product keeps the two-door idea from v2.1 (**Rent your space** and **Get parking**) but changes how it is built underneath:

- **One account, one login, multiple roles.** The two doors are *entry points and experiences*, not separate identity systems.
- **Release 1 delivers real supply value**, not just empty dashboards: an owner can create a listing that an admin can verify.
- **Validation runs alongside the build**, because for a solo founder the biggest risk is building the wrong thing, not building it slowly.

**Product principle:** supply and trust first, technology second.

## 2. Goals and Non-Goals

### Release 1 goals

1. A person can sign up quickly with a verified phone number and choose to rent out a space, find parking, or both.
2. An owner can create a listing with photos and submit it for review.
3. An admin (the founder) can review, approve or reject listings.
4. A driver can see approved listings near a destination, even if only as a list.
5. Identity, roles, consent records and the data model are sound enough to build bookings and payments on without a rewrite.

### Non-goals for Release 1

- Online payments, payouts and refunds.
- Instant booking and availability calendars.
- Reviews, QR check-in, dynamic pricing, native apps.
- Real-time occupancy.
- Public or on-street parking data.

## 3. Release Plan

| Release | Scope | Gate to proceed |
| --- | --- | --- |
| **R0** (weeks 1 to 4, parallel) | Concierge validation: interview drivers and owners near chosen anchors, list 15 to 20 spaces by hand, take a few bookings by WhatsApp and UPI | Owners will list; at least some drivers will pay in advance |
| **R1** Foundation and supply intake | Landing page, auth, roles, owner and driver homes, listing creation, admin review | 20 verified listings |
| **R2** Discovery | Search by destination, map, listing detail pages, filters | Drivers find a relevant option within 1 km for a meaningful share of searches |
| **R3** Booking and payments | Availability, holds, request-to-book, then instant booking, Razorpay, payouts, cancellations | Legal, tax and payment-structure review complete |

A solo founder should assume each release takes longer than planned. Proposed sequencing: R1 in roughly 5 to 6 weeks, with R0 running at the same time. **\[Assumption\]** about 25 to 30 focused hours a week.

## 4. Users and Roles

**Persona A: Provider.** Residential owner with a spare slot, commercial property owner, parking lot operator, or an authorised manager.

**Persona B: Driver.** Daily commuter, student, office worker, business traveller, mall or hospital visitor, or someone needing temporary parking.

**Persona C: Admin.** The founder at first.

### Why one account with multiple roles

v2.1 required separate authentication journeys and said an OWNER must not automatically receive DRIVER permissions. That has two problems:

1. **A real person is often both.** Someone who rents out their home slot may also need to park near their office. With unique email and phone constraints, they could not create a second account with the same details.
2. **Two login systems double the security and support work** for a solo builder.

The revised model:

- One `users` record per person.
- Capabilities are granted per user: `PROVIDER`, `DRIVER`, `ADMIN`.
- Choosing **Rent your space** or **Get parking** during sign-up sets the *intent* and grants the matching capability. The same person can add the other later with one action, without re-entering personal details.
- Every protected backend request checks the required capability. Having one capability never implies another.
- The app has a simple mode switcher once a user holds both.

Providers include owners, operators and managers (v2.1 listed all three as target users but defined only an OWNER role). Provider type is a profile field, not a separate role.

## 5. Landing Page

Keep the minimal two-choice concept. Fix the following.

### Content

- **Header:** logo, a single *Log in* link (one login for everyone), and a *How it works* link.
- **Hero:** headline and subtitle below.
- **Two cards:** *Rent your space* and *Get parking*.
- **Below the fold (short):** three-step explanation for each side, a line on how listings are verified, and contact details.

**Copy.** v2.1 used two different taglines (“Find your spot. Own your time.” and “Your parking. Your choice.”). Pick one as the brand tagline and use the other, if at all, as secondary copy. **\[Decision\]**

| Card | Description | CTA |
| --- | --- | --- |
| Rent your space | Turn your unused parking space into income. | Get started |
| Get parking | Find convenient parking around your destination. | Find parking |

### Design specification (replacing adjectives with tokens)

“Apple-inspired” is a mood, not a specification. Define these in the first week and implement them as design tokens:

- **Colour:** off-white background, near-white surfaces, deep charcoal text, electric blue primary. Check every text and button colour pair against WCAG AA (4.5:1 for body text). A strong blue such as #0A5CFF is roughly 5:1 on white, but confirm in a contrast tool.
- **Type:** one family, two weights, a fixed size scale.
- **Shape and depth:** one corner radius for cards, one for buttons, one shadow style.
- **Spacing:** an 8-point scale.
- **States:** hover, focus (visible), pressed, disabled, loading, error and empty states for every component.
- **Layouts:** designed mobile-first, since most Indian users will arrive on phones.

### Open design question

Most visitors will be drivers. Consider a destination search box in the hero with *List your space* as a clear secondary action, instead of forcing every visitor to pick an identity first. Keep the two-card layout for R1 if the priority is supply recruitment, and revisit after R2.

### Also

- Confirm the brand name is available as a domain, social handle and trademark before investing in design **\[Verify\]**.
- Server-render the landing page, with a title, description and share image, so it can be found and shared.

## 6. Authentication and Accounts

### 6.1 Principles

- **Do not build authentication from scratch.** Use a maintained solution (for example Auth.js, Supabase Auth, Clerk or Firebase Auth) that supports phone OTP, email, Google sign-in and sessions. **\[Decision\]**
- **Phone OTP first.** It is the dominant pattern in India and removes the largest solo-founder burdens: password storage, reset flows, and credential-stuffing defence.
- **Passwords optional or omitted.** v2.1 required password and confirmation plus email verification plus phone OTP. That is a long path before the user sees any value.
- **Browse before sign-up.** Drivers should be able to search and view listings without an account. Require sign-in when they try to book or save.

### 6.2 Sign-up flow

1. User picks **Rent your space** or **Get parking** (or arrives from a deep link carrying `intent=provider|driver`).
2. User enters phone number (+91 by default; normalised to E.164) and receives an OTP.
3. User verifies the OTP. Account is created and signed in.
4. User enters name; email is optional at this point.
5. User accepts the Terms and Privacy Policy. Consent is recorded with document version, timestamp and IP address.
6. User lands on the matching home. A banner prompts adding and verifying an email, which becomes required before any payout (R3).

If the phone number already has an account, the flow signs the user in and offers to add the new capability. It does not create a second account.

### 6.3 Login and recovery

- One login page: `/login`. After sign-in, route by last-used mode or by intent.
- Methods: phone OTP, email magic link or Google (if enabled).
- Recovery is by OTP or email link. There is no separate password recovery unless passwords are enabled.
- Routes: `/owner/*` and `/driver/*` remain as experience areas behind capability checks. Consider `/host` instead of `/owner`, since operators and managers are also providers.

### 6.4 Security requirements

- OTPs: short expiry (for example 5 minutes), hashed at rest, attempt limits, resend cooldown, and per-phone and per-IP rate limits.
- Responses must not reveal whether a given phone or email is registered where avoidable.
- Session cookies: HttpOnly, Secure, SameSite; rotation on sign-in; server-side revocation.
- CSRF protection on state-changing requests; server-side validation on every input.
- Login and OTP endpoints monitored for abuse; failed-attempt alerts.
- If passwords are enabled: argon2id or bcrypt, a minimum length and breached-password check, and no password hints.
- Audit log for sign-ins, capability grants and every admin action.

### 6.5 India-specific delivery notes

- Transactional SMS in India requires registered sender IDs and approved templates under the telecom regulator’s rules (DLT). This takes lead time, so start early or choose a provider that handles it **\[Verify\]**.
- Budget SMS cost per OTP and add a fallback channel (for example WhatsApp or email) **\[Verify provider pricing\]**.
- Support +91 numbers first; make the country code extensible.

### 6.6 Acceptance criteria

- A new user can complete sign-up in under 2 minutes with an OTP.
- Re-registering with an existing phone signs in and does not duplicate the account.
- A user with only `DRIVER` receives 403 on provider routes, and vice versa.
- A user can add the second capability without re-entering personal data.
- Expired, reused or over-attempted OTPs are rejected.
- Consent versions and timestamps are stored for every accepted document.

## 7. Provider Experience (Rent Your Space)

### 7.1 Home (`/owner/dashboard`)

- **Welcome:** “Welcome, \[Name\]” with a subtitle and a primary button, *Add your parking space*.
- **Summary cards:** Total listings, Active listings, Bookings, Earnings. Bookings and Earnings show an honest empty state until R3 (for example “Bookings will appear here once reservations open”). Never show invented numbers.
- **Listings:** list with status chips: Draft, Submitted, Needs info, Approved, Rejected, Suspended.
- **Activity:** listing review updates and account notices.

v2.1 had an *Add your parking space* button that led nowhere in R1. In this version it works.

### 7.2 Create listing (R1)

| Field | Rule |
| --- | --- |
| Space type | Residential slot, commercial lot, other |
| Provider type | Owner, operator, manager |
| Address and map pin | Pin confirmed on a map; coordinates stored |
| Capacity | Whole number of vehicles |
| Vehicle types | Two-wheeler, car, SUV and others |
| Dimensions or notes | Optional, with clear guidance |
| Covered or open | Required |
| Price | Hourly and optional daily or monthly, in ₹ |
| Access instructions | Gate, guard, key or similar; shown only after confirmation in R3 |
| Photos | Minimum 3, with type, size and count limits and EXIF stripped |
| Proof of right to rent | Uploaded to private storage |

Listings are saved as drafts, submitted for review, and invisible to drivers until approved.

### 7.3 Verification (minimum standard for R1)

| Provider situation | Evidence to require **\[Verify with counsel\]** |
| --- | --- |
| Owner of a house or flat | Ownership proof or property tax receipt; photo of the actual space |
| Tenant | Landlord consent |
| Apartment resident | Written consent from the society or association where its rules require it |
| Business or operator | Trade licence or registration and signatory authority |
| Manager | Written authorisation from the owner |

For the first 20 listings, add a short video or in-person site check. Document access to verification files is restricted and logged.

## 8. Driver Experience (Get Parking)

### 8.1 Home (`/driver/home`)

- **Welcome:** “Welcome, \[Name\]” with the subtitle “Where would you like to park today?”
- **Search:** destination, date, start time, end time, and a *Search parking* button.
- **Results (R1 minimum):** approved listings shown as a list sorted by distance, with a price, a verified badge and the date last confirmed.
- **Map (R2):** interactive map with clustering.
- **Recent searches and bookings:** shown only when real data exists; otherwise a plain empty state.

v2.1 allowed “sample UI content” on this page while forbidding fabricated numbers on the owner page. Apply the same rule to both: no fake data in the product, only clearly empty states. Use demo data in a separate seeded environment.

### 8.2 Search rules (R2 preview)

- Destination autocomplete and optional current-location use.
- Results ranked by distance, price, verification and freshness; ranking logic written down.
- Filters: price, distance, vehicle type, covered or open, availability.
- A listing not reconfirmed by its provider within 30 days is labelled stale and ranked lower.
- **\[Verify\]** map-provider terms on storing and caching place data before building anything that stores third-party results.

## 9. Data Model (Release 1)

PostgreSQL with Prisma. Prisma Migrate generates and tracks the SQL migration files; do not hand-maintain a second set. Use a hosted PostgreSQL that supports PostGIS, and connection pooling suited to serverless hosting. v2.1’s clarification that the SQL files define structure and are not the live database is correct and stays.

### 9.1 Tables

**users**

- `id` UUID, primary key, default generated.
- `full_name` VARCHAR(150).
- `email` case-insensitive text, nullable, unique where present.
- `phone` text in E.164 form, unique, not null.
- `password_hash` TEXT, nullable (only if passwords are enabled).
- `email_verified_at`, `phone_verified_at` TIMESTAMPTZ, nullable. Timestamps replace the v2.1 booleans, because they also record *when*.
- `account_status` enum or check-constrained: ACTIVE, SUSPENDED, DELETION\_PENDING.
- `last_login_at`, `created_at`, `updated_at` TIMESTAMPTZ.

**roles**: `id`, `role_name` (PROVIDER, DRIVER, ADMIN), unique.

**user\_roles**: `user_id`, `role_id`, `granted_at`, `granted_by`; composite unique on user and role. This is the join table v2.1 implied but did not define.

**provider\_profiles**: `user_id` (primary key and foreign key), `provider_type` (OWNER, OPERATOR, MANAGER), `display_name`, `business_name` (optional), payout fields reserved for R3.

**driver\_profiles**: `user_id` (primary key and foreign key), preferences.

**vehicles**: `id`, `user_id`, `registration_number`, `vehicle_type`, `is_default`.

**consents**: `id`, `user_id`, `document_type`, `document_version`, `accepted_at`, `ip_address`, `user_agent`.

**otp\_challenges** (if not handled by the auth provider): `id`, `phone`, `code_hash`, `purpose`, `expires_at`, `attempts`, `consumed_at`.

**parking\_listings**: `id`, `provider_id`, `status`, `space_type`, `address`, `location` (PostGIS geography point), `capacity`, `vehicle_types`, `covered`, `price_hourly`, `price_daily`, `access_notes`, `last_confirmed_at`, `created_at`, `updated_at`.

**listing\_images**: `id`, `listing_id`, `url`, `sort_order`.

**listing\_verifications**: `id`, `listing_id`, `status`, `reviewer_id`, `reason`, `reviewed_at`, with a link to private evidence files.

**audit\_logs**: `id`, `actor_id`, `action`, `entity_type`, `entity_id`, `metadata`, `created_at`.

### 9.2 Data rules

- Store money as integer paise, never floating point.
- Soft-delete users and listings; define retention and a deletion process for personal data.
- Foreign keys everywhere; indexes on foreign keys and on listing location.
- Verification documents live in private, encrypted object storage, not in the database or a public bucket.
- R3 will add bookings, holds, payments, payouts and disputes. Overbooking must be prevented by database constraints and transactions, not only by application code.

## 10. Non-Functional Requirements

| Area | Target (proposed) |
| --- | --- |
| Performance | Largest contentful paint under 2.5 s on a mid-range phone over 4G; listing search p95 under 500 ms |
| Accessibility | WCAG 2.2 AA on landing, auth and listing flows; keyboard navigable; labelled forms |
| Security | OWASP Top 10 review before launch; secrets in environment config; dependency scanning; rate limiting |
| Reliability | Daily backups with a tested restore |
| Observability | Error tracking and structured logs from day one |
| Privacy | Collect only needed data; consent records; deletion on request **\[Verify DPDP Act 2023 obligations\]** |
| Localisation | English first; text kept out of code for later Kannada and Hindi |
| Environments | Separate development, staging and production |

## 11. Definition of Done for Release 1

- Landing, auth, both homes, listing creation and admin review work end to end on mobile and desktop.
- Every acceptance criterion in Section 6.6 passes in automated or documented manual tests.
- No placeholder or fabricated data appears anywhere in production.
- Accessibility and security checklists are completed.
- Terms, Privacy Policy and provider terms are published and versioned **\[Verify with counsel\]**.
- 20 listings are verified through the real process.
- The founder can handle verification, support and incident response with a written runbook.

## 12. Solo-Founder Build Plan (R1, proposed)

| Week | Focus |
| --- | --- |
| 1 | Brand decisions, design tokens, wireframes, auth provider and SMS setup (start DLT early), data model |
| 2 | Landing page, sign-up and login, roles, consent records |
| 3 | Provider home, listing creation, image upload to private storage |
| 4 | Admin review queue, audit log, listing status flow |
| 5 | Driver home with simple search over approved listings, empty states |
| 6 | Security and accessibility pass, legal pages, staging test, soft launch to pilot group |

R0 (interviews, concierge listings, manual bookings) runs in parallel throughout. If time slips, cut driver search before cutting verification quality.

## 13. Risks

| Risk | Mitigation |
| --- | --- |
| Building features nobody wants | R0 validation and release gates |
| No supply at launch | In-person onboarding; concierge listings; owner-first R1 |
| Fake or unauthorised listings | Evidence requirements; site checks; audit logs |
| Safety incidents at residential spaces | Masked contact details, vehicle capture and incident flow in R3; clear terms |
| SMS cost and delivery problems | Early provider selection; fallback channel; rate limits |
| Solo burnout and slipping scope | Fixed release gates; cut scope, not quality |
| Legal, tax and payment compliance | Review before R3; split-settlement payout structure **\[Verify\]** |
| Brand or name conflict | Trademark and domain check now |

## 14. Open Questions

1. Final brand name and tagline.
2. Which demand anchors define the Yelahanka pilot, and what daily demand does each represent?
3. Which auth provider and SMS vendor fit cost and DLT requirements?
4. Will passwords be offered at all, or only OTP and magic link?
5. What proof of right to rent will apartment societies accept?
6. Is the first paying customer an individual driver or a commuter on a monthly pass?
7. Who bears liability for damage or theft, and is insurance needed?

## Appendix: Changes From v2.1

- One account with multiple capabilities replaces two separate identity journeys.
- Phone-OTP-first sign-up replaces seven-field registration with passwords and dual verification.
- R1 now includes working listing creation and admin review, so “Add your parking space” is no longer a dead end.
- Added release gates, concierge validation and a solo build plan.
- Replaced adjectives in the design brief with tokens and accessibility checks.
- Resolved the tagline conflict and the owner-only role versus operator and manager target users.
- Aligned the “no fake data” rule across both homes.
- Completed and hardened the data model: join table, profiles, consents, OTP, listings, verifications, audit logs, timestamps instead of booleans, money as paise.
- Added security, OTP, India SMS and privacy requirements, acceptance criteria and a definition of done.
