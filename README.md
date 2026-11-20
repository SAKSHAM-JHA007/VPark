# VPark — Bengaluru Smart Parking & Reservation Platform

> Implementation of the [Product Requirements Document](docs/PRD.md) for the **Yelahanka Pilot Micro-Market, Bengaluru, India**. Built with Next.js 14, React 18, TypeScript, Tailwind CSS, and PostgreSQL for durable, shared application data (with a local JSON store for development).

---

## 🎯 PRD Traceability & Features Implemented

### 1. Pilot Micro-Market Wedge (PRD Section 6 & 14)
- **Location:** Yelahanka, Bengaluru (Lat: 13.1007° N, Lng: 77.5963° E).
- **5 Demand Anchors:**
  - *Mother Dairy Circle & New Town 4th Phase* (Retail & Dining District)
  - *Rail Wheel Factory (RWF) Main Gate* (Heavy Commuter & Technical Visitors)
  - *Aster CMI Hospital & Hebbal Corridor* (Critical Patient/Doctor High Turnover)
  - *RMZ Galleria Mall & Old Town Hub* (Weekend Retail & Dining Peak)
  - *Yelahanka Junction Railway Station* (Suburban Rail Commuters)
- **Pilot Supply Target:** Pre-seeded with **25+ realistic spaces** across Private (driveways, gated societies with RWA NOC), Commercial (mall decks, plaza parking), and Public (surveyed on-street parking with survey date).

### 2. Search & Discovery (PRD Section 8.2 & 8.3)
- **SRCH-1 Destination Search & GPS:** Address search with destination autocomplete for Yelahanka anchors and HTML5 "Use Current Location".
- **SRCH-2 Inspectable Ranking Formula:**
  $$\text{Score} = 0.35 \cdot \text{DistanceScore} + 0.25 \cdot \text{PriceScore} + 0.20 \cdot \text{VerificationScore} + 0.10 \cdot \text{ConfidenceScore} + 0.10 \cdot \text{RatingScore} - \text{StalePenalty}$$
  - Drivers and team can click **"Inspect Ranking Formula"** on any listing to inspect the exact mathematical breakdown!
- **SRCH-3 Interactive Vector Map & Category Colors:**
  - Private: Purple (`#7C3AED`)
  - Commercial: Blue (`#2563EB`)
  - Public: Emerald (`#059669`)
  - External deep links to Google Maps navigation (`https://www.google.com/maps/dir/?api=1&destination=lat,lng`).
- **SRCH-4 Filters:** Category multi-select, vehicle type (2W, Hatchback, Sedan, SUV, EV), price slider, covered/basement toggle, EV charging socket filter, instant-bookable only. One-action "Clear Filters".
- **SRCH-5 Radius Expansion Empty State:** When 0 spaces match within the selected radius, the app suggests expanding radius (+2 km).
- **SRCH-6 Arrival & Departure Filtering:** Temporal availability filtering against booked sessions and active holds.

### 3. Categories, Freshness & Trust (PRD Section 8.3 & 8.6)
- **Private:** Provider-submitted, admin-verified right-to-rent documents. Bookable.
- **Commercial:** Operator-submitted or partner agreement. Bookable.
- **Public (Discovery Only):** Surveyed on-street parking. Explicitly marked: *Discovery-only context. VPark does not control or take reservations for public spaces.* Not bookable.
- **Freshness Indicator:** Listings confirmed within 30 days = **Fresh**. Listings $>30$ days without reconfirmation = **Stale** (flagged and penalised by $-0.25$ in search ranking).
- **Provider Reconfirmation:** Providers have a 1-click **"Reconfirm Availability"** button in their dashboard to reset freshness and boost search ranking.

### 4. Booking Engine & Overbooking Prevention (PRD Section 8.8, 8.9, 8.10, 12)
- **BOOK-1 Pricing Snapshot:**
  - Base Parking Fee + 12% VPark Platform Fee + GST (9% CGST + 9% SGST on fee) = Total Amount Payable (INR ₹).
- **BOOK-2 10-Minute Reservation Hold:**
  - Locking a slot creates an atomic `SlotHold` with a 10-minute visual countdown timer.
  - Active holds decrement available capacity to eliminate double bookings.
- **BOOK-3 & BOOK-4 Atomic Overbooking Prevention:**
  - Database capacity checks ensure available slots $> 0$ before booking confirmation.
- **BOOK-5 Digital QR Parking Pass:**
  - Access pass with unique reference (e.g. `VPK-BLR-849201`), QR code, host privacy-masked phone relay, and instructions.
- **BOOK-6 Extension Requests:**
  - Drivers can extend active parking by +1 hour or +2 hours with live capacity check.
- **Check-in & Evidence (8.10):**
  - Drivers tap "Check In Now", optionally capture vehicle odometer/slot photo, and mark session active.
- **Cancellation Policy & Refunds (8.9):**
  - Cancel 2+ hours before start: **100% refund of parking fee**.
  - Cancel under 2 hours before start: **50% partial refund**.
  - Provider cancels: **100% full refund + credits**.
  - No-show: **0% refund**.

### 5. Payments, Payouts & Invoicing (PRD Section 8.11 & Appendix A)
- **Razorpay Integration:** Razorpay test mode simulated checkout with UPI (GPay, PhonePe, Paytm, BHIM), Cards (RuPay, Visa, Mastercard), and Netbanking.
- **Split Settlement Architecture:** 12% platform take-rate with provider payout tracking and daily reconciliation monitor.
- **GST Tax Invoices:** Compliant tax invoice view with CGST/SGST breakdown.

### 6. Provider Hub & Onboarding Wizard (PRD Section 8.5 & 8.12)
- **PROV-1 to PROV-4 Wizard:**
  - Step 1: Basic details & location pin (Yelahanka anchor).
  - Step 2: Capacity & vehicle types (2W, hatchback, sedan, suv, EV charging).
  - Step 3: Hourly, daily, and monthly pricing.
  - Step 4: Photos & access instructions.
  - Step 5: Right-to-rent proof upload (Sale deed, tax receipt, society NOC, trade license).
  - New listings start in `PENDING_REVIEW` and stay hidden from public search until admin approval.

### 7. Admin & Trust Console (PRD Section 8.6, 8.13, 8.14)
- **Verification Queue:** Review pending listings, inspect proof of right-to-rent documents, and 1-click Approve / Reject with reason / Suspend.
- **Dispute Queue:** Complaint management with strict $<4$ hour SLA tracker, evidence inspection, and resolution with refund trigger.
- **Payment Reconciliation:** Gateway transactions vs booked sessions audit log.
- **Audit Trail:** Chronological log of every admin action with admin ID, action type, target ID, details, and timestamp.

### 8. Monthly Commuter Passes (PRD Section 13 & Appendix A)
- Monthly pass subscriptions (₹2,400 to ₹3,500/month) for regular commuters at Rail Wheel Factory, Aster CMI, and Yelahanka Station with high unit-economics value.

### 9. India DPDP Act 2023 Compliance (PRD Section 10)
- Purpose limitation, download personal data archive (JSON export of profile, vehicles, bookings, and payments), and statutory account deletion request.

---

## 🚀 Running the Project

### 1. Install Dependencies
```bash
npm install
```

### 2. Choose a data store
- **Local development (default):** with no `DATABASE_URL`, data lives in `.data/vpark_database.json`. It is single-process and is never used in production.
- **PostgreSQL (required in production):** set `DATABASE_URL` in `.env.local`, then apply the schema:
  ```bash
  npm run db:migrate
  ```
  `npm run db:status` shows the schema version. A fresh database starts empty: accounts are created at Google sign-in, and `.data` is never imported automatically.

In production a missing or unmigrated database makes every data request return `503`. The app never falls back to local files.

### 3. Run Tests
The verification test suite covers the pricing and ranking engine, location privacy, sessions, Google sign-in, admin access, and the data layer:
```bash
npm test
```
Data-layer tests come in three tiers, labelled in each file:
- **Mocks:** `data-store-failures`.
- **Embedded PostgreSQL engine:** `data-store-pglite`, using PGlite. It always runs.
- **Real PostgreSQL server:** `data-store-postgres-server`. It is skipped unless a disposable database is configured. To run it:
```bash
VPARK_TEST_DATABASE_URL="postgres://user:pass@localhost:5432/vpark_test" npm run test:postgres
```

### 4. Build for Production
```bash
npm run build
```

### 5. Start Server
```bash
npm start
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔐 Sign-In & Security Configuration
Sign-in is **Google only**, verified on the server from a Firebase ID token. The old demo OTP, email/password and master-password logins have been removed, and so has the demo persona switcher.

Before running the app, copy `.env.example` to `.env.local` and set at least:
- `NEXT_PUBLIC_FIREBASE_*` and `FIREBASE_PROJECT_ID`: your Firebase project (public values, not secrets).
- `SESSION_SECRET`: 32+ random characters (required in production).
- `DATABASE_URL`: PostgreSQL for all application data and sessions (required in production; see above).
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (optional): store sessions in Redis instead of PostgreSQL.
- `VPARK_ADMIN_FIREBASE_UIDS`: Firebase UIDs that get admin access.

Without `FIREBASE_PROJECT_ID`, Google sign-in returns `503` (fails closed). See [docs/SECURITY.md](docs/SECURITY.md) for the security architecture, deployment steps and known limitations.

The seeded demo records (Rajesh Kumar, Suresh Sharma, Vikram Rao) are still in a fresh *local development* store for fixtures, but nobody can sign in as them. They are never seeded into PostgreSQL in production.

