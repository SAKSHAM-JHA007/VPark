// Data-layer tests on the LOCAL JSON DEVELOPMENT STORE (no database; not a mock).
// Uses an isolated temporary directory; the developer's real .data is never touched.
import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import './support/register-ts.mjs';
import { defineDataStoreSuite } from './support/data-store-suite.mjs';

process.env.NODE_ENV = 'test';
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vpark-json-store-'));
process.env.VPARK_DATA_DIR = dataDir;
after(() => fs.rmSync(dataDir, { recursive: true, force: true }));

const { createJsonStore } = await import('../src/lib/data/json-store.ts');

// Every newStore() is an independent store that loads the file afresh, i.e. a restart.
// The JSON store is single-process: concurrent calls on ONE store are serialized, but
// separate store objects do not coordinate (which is why production requires PostgreSQL).
let shared;
await defineDataStoreSuite({
  label: 'local JSON development store',
  newStore: async () => (shared ??= createJsonStore({ dataDir, mirrorToSqlite: false })),
  postgres: false,
  concurrencyNote: 'serialized in one process',
});

describe('Local JSON development store specifics', () => {
  it('survives a restart: a new store object reads what the previous one wrote', async () => {
    const a = createJsonStore({ dataDir, mirrorToSqlite: false });
    await a.transaction((tx) => tx.put('contactMessages', { id: 'msg_restart', name: 'r', email: 'r@example.com', subject: 's', message: 'restart', ip: '', userAgent: '', createdAt: new Date().toISOString(), status: 'UNREAD' }));
    const b = createJsonStore({ dataDir, mirrorToSqlite: false });
    assert.equal((await b.transaction((tx) => tx.get('contactMessages', 'msg_restart'))).message, 'restart');
  });

  it('a failed transaction leaves the file on disk unchanged', async () => {
    const store = createJsonStore({ dataDir, mirrorToSqlite: false });
    await store.transaction((tx) => tx.all('users')); // ensure loaded
    const file = path.join(dataDir, 'vpark_database.json');
    const before = fs.readFileSync(file, 'utf-8');
    await assert.rejects(
      store.transaction(async (tx) => {
        await tx.put('contactMessages', { id: 'msg_never', name: 'n', email: 'n@example.com', subject: 's', message: 'm', ip: '', userAgent: '', createdAt: new Date().toISOString(), status: 'UNREAD' });
        throw new Error('abort');
      })
    );
    assert.equal(fs.readFileSync(file, 'utf-8'), before);
    assert.equal(await store.transaction((tx) => tx.get('contactMessages', 'msg_never')), undefined);
  });

  it('returns private copies: mutating a read object without put() changes nothing', async () => {
    const store = createJsonStore({ dataDir, mirrorToSqlite: false });
    const user = await store.transaction((tx) => tx.get('users', 'usr_driver_1'));
    user.name = 'Mutated Without Put';
    assert.notEqual((await store.transaction((tx) => tx.get('users', 'usr_driver_1'))).name, 'Mutated Without Put');
  });
});
