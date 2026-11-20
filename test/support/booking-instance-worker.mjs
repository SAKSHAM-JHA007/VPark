// One "serverless instance" for the multi-process concurrency test: a separate Node
// process that loads the real app data layer, connects to PostgreSQL through
// DATABASE_URL (its own connection pool) and attempts one booking at a shared start time.
//
// Usage: node booking-instance-worker.mjs <listingId> <driverId> <startIso> <endIso> <goAtEpochMs>
import './register-ts.mjs';

const [listingId, driverId, startTime, endTime, goAt] = process.argv.slice(2);
const { db } = await import('../../src/lib/db.ts');
await db.getUserById(driverId); // warm up: connect and check the schema before the race

const wait = Number(goAt) - Date.now();
if (wait > 0) await new Promise((r) => setTimeout(r, wait));

const result = await db.createBooking({
  listingId,
  driverId,
  vehicleType: 'SEDAN',
  vehiclePlateNumber: 'KA-04-MB-1234',
  startTime,
  endTime,
  paymentMethod: 'UPI',
});
process.stdout.write(`${JSON.stringify({ success: result.success, error: result.error ?? null, backend: await db.backendKind() })}\n`);
process.exit(0);
