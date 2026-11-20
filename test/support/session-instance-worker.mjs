// One short-lived "app instance" for the multi-instance session tests. Each run is a
// separate Node process with its own data directory (its own local disk, like a
// serverless instance) that shares only the Redis REST session store.
//
// Usage: node session-instance-worker.mjs <command> [arg]
//   create <userId>   -> { token }
//   whoami <token>    -> { userId | null, status }
//   logout <token>    -> { status }
// Env: WORKER_REDIS_URL, WORKER_REDIS_TOKEN, WORKER_SESSION_SECRET, WORKER_DATA_DIR
import { setupApp, read } from './harness.mjs';

const [command, arg] = process.argv.slice(2);
const app = await setupApp({
  redis: { url: process.env.WORKER_REDIS_URL, token: process.env.WORKER_REDIS_TOKEN },
  sessionSecret: process.env.WORKER_SESSION_SECRET,
  dataDir: process.env.WORKER_DATA_DIR,
});

let out;
if (command === 'create') {
  out = { token: await app.sessionFor(arg) };
} else if (command === 'whoami') {
  const me = await import('../../src/app/api/auth/me/route.ts');
  const res = await read(await me.GET(app.request('GET', '/api/auth/me', { token: arg })));
  out = { status: res.status, userId: res.json?.user?.id ?? null };
} else if (command === 'logout') {
  const logout = await import('../../src/app/api/auth/logout/route.ts');
  const res = await logout.POST(app.request('POST', '/api/auth/logout', { token: arg }));
  out = { status: res.status };
} else {
  throw new Error(`unknown command ${command}`);
}
process.stdout.write(`${JSON.stringify(out)}\n`);
