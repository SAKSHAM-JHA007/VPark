// Minimal Upstash-compatible Redis REST server for tests.
//
// Implements the documented REST protocol the session store uses:
//   POST /            body: ["CMD", ...args]          -> { result } | { error }
//   POST /pipeline    body: [["CMD", ...], ...]       -> [{ result } | { error }, ...]
//   POST /multi-exec  body: [["CMD", ...], ...]       -> same, applied atomically
// with Bearer-token auth and real millisecond key expiry. State lives in this
// server process, so independent app instances (and restarted ones) share it,
// exactly like a hosted Redis.
import http from 'node:http';

export async function startFakeUpstash({ token = 'test-redis-token' } = {}) {
  const strings = new Map(); // key -> value
  const sets = new Map(); // key -> Set
  const expiry = new Map(); // key -> epoch ms
  const stats = { requests: 0, commands: [] };

  const alive = (key) => {
    const at = expiry.get(key);
    if (at !== undefined && at <= Date.now()) {
      strings.delete(key);
      sets.delete(key);
      expiry.delete(key);
    }
    return strings.has(key) || sets.has(key);
  };

  function run(cmd) {
    if (!Array.isArray(cmd) || cmd.length === 0) throw new Error('ERR empty command');
    const [rawName, ...args] = cmd.map(String);
    const name = rawName.toUpperCase();
    stats.commands.push(name);
    switch (name) {
      case 'PING':
        return 'PONG';
      case 'GET':
        return alive(args[0]) && strings.has(args[0]) ? strings.get(args[0]) : null;
      case 'SET': {
        const [key, value, ...opts] = args;
        let px;
        let nx = false;
        let xx = false;
        for (let i = 0; i < opts.length; i++) {
          const o = opts[i].toUpperCase();
          if (o === 'PX') px = Number(opts[++i]);
          else if (o === 'EX') px = Number(opts[++i]) * 1000;
          else if (o === 'NX') nx = true;
          else if (o === 'XX') xx = true;
          else throw new Error(`ERR unsupported SET option ${o}`);
        }
        const exists = alive(key);
        if ((nx && exists) || (xx && !exists)) return null;
        sets.delete(key);
        strings.set(key, value);
        if (px !== undefined) expiry.set(key, Date.now() + px);
        else expiry.delete(key);
        return 'OK';
      }
      case 'DEL': {
        let n = 0;
        for (const key of args) {
          if (alive(key)) n += 1;
          strings.delete(key);
          sets.delete(key);
          expiry.delete(key);
        }
        return n;
      }
      case 'SADD': {
        const [key, ...members] = args;
        alive(key);
        if (!sets.has(key)) sets.set(key, new Set());
        const s = sets.get(key);
        let n = 0;
        for (const m of members) if (!s.has(m)) (s.add(m), n++);
        return n;
      }
      case 'SREM': {
        const [key, ...members] = args;
        if (!alive(key) || !sets.has(key)) return 0;
        const s = sets.get(key);
        let n = 0;
        for (const m of members) if (s.delete(m)) n++;
        if (s.size === 0) (sets.delete(key), expiry.delete(key));
        return n;
      }
      case 'SMEMBERS':
        return alive(args[0]) && sets.has(args[0]) ? [...sets.get(args[0])] : [];
      case 'PEXPIRE':
        if (!alive(args[0])) return 0;
        expiry.set(args[0], Date.now() + Number(args[1]));
        return 1;
      case 'PTTL': {
        if (!alive(args[0])) return -2;
        const at = expiry.get(args[0]);
        return at === undefined ? -1 : at - Date.now();
      }
      default:
        throw new Error(`ERR unknown command ${name}`);
    }
  }

  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      stats.requests += 1;
      const send = (status, payload) => {
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(JSON.stringify(payload));
      };
      if (req.headers.authorization !== `Bearer ${token}`) return send(401, { error: 'Unauthorized' });
      let parsed;
      try {
        parsed = JSON.parse(body);
      } catch {
        return send(400, { error: 'ERR invalid JSON' });
      }
      const path = new URL(req.url, 'http://x').pathname;
      if (path === '/pipeline' || path === '/multi-exec') {
        if (!Array.isArray(parsed)) return send(400, { error: 'ERR expected array of commands' });
        const out = parsed.map((cmd) => {
          try {
            return { result: run(cmd) };
          } catch (e) {
            return { error: e.message };
          }
        });
        return send(200, out);
      }
      try {
        return send(200, { result: run(parsed) });
      } catch (e) {
        return send(400, { error: e.message });
      }
    });
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}`,
    token,
    stats,
    keys: () => [...new Set([...strings.keys(), ...sets.keys()])].filter((k) => alive(k)),
    ttl: (key) => run(['PTTL', key]),
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
