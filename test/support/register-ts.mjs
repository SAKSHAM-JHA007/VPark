// Test-only module hooks so `node --test` can load the app's TypeScript server
// modules (route handlers, db, auth) directly. Node >= 22.18 strips TypeScript
// types natively; these hooks add the `@/` path alias, extensionless relative
// imports and the CommonJS `next/server` entry point.
import { registerHooks } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = path.join(ROOT, 'src');
const CANDIDATE_SUFFIXES = ['', '.ts', '.tsx', '.mjs', '.js', `${path.sep}index.ts`];

function resolveFile(basePath) {
  for (const suffix of CANDIDATE_SUFFIXES) {
    const candidate = basePath + suffix;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'next/server') return nextResolve('next/server.js', context);
    if (specifier.startsWith('@/')) {
      const file = resolveFile(path.join(SRC, specifier.slice(2)));
      if (file) return { url: pathToFileURL(file).href, shortCircuit: true };
    }
    if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL?.startsWith('file:')) {
      const parentDir = path.dirname(fileURLToPath(context.parentURL));
      const file = resolveFile(path.resolve(parentDir, specifier));
      if (file) return { url: pathToFileURL(file).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    // The package has no "type" field; tell Node the app's .ts sources are ES modules.
    if (url.startsWith('file:') && url.endsWith('.ts') && fileURLToPath(url).startsWith(SRC)) {
      return nextLoad(url, { ...context, format: 'module-typescript' });
    }
    return nextLoad(url, context);
  },
});
