// -----------------------------------------------------------------------------
// Small JSON files in /data, the only writable place of the container: the
// Launch Library 2 answers (the cache) and what the scene triggers already
// announced. Best effort: a read or write failure is logged, never thrown.
//
// Locally, LL2_DATA_DIR points the store at any folder (the `.gitignore`
// keeps a root `data/` folder out of the repository).
// -----------------------------------------------------------------------------

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createLogger } from '@gladysassistant/integration-sdk';
import { createFailureLog } from './failures.js';

const logger = createLogger({ name: 'll2-store' });

export function defaultDataDir() {
  return process.env.LL2_DATA_DIR || '/data';
}

export function createStore(dir = defaultDataDir()) {
  // The cache is written after every refresh: an unwritable /data warns once.
  const failures = createFailureLog(logger);
  return {
    dir,
    load(name) {
      try {
        const value = JSON.parse(readFileSync(path.join(dir, name), 'utf8'));
        failures.succeeded(`read:${name}`, `${name} read again`);
        return value;
      } catch (err) {
        if (err.code !== 'ENOENT') {
          failures.failed(`read:${name}`, `Could not read ${name}: ${err.message}`);
        }
        return null;
      }
    },
    save(name, value) {
      try {
        mkdirSync(dir, { recursive: true });
        // Write then rename: a crash mid-write never leaves half a file.
        const file = path.join(dir, name);
        writeFileSync(`${file}.tmp`, JSON.stringify(value));
        renameSync(`${file}.tmp`, file);
        failures.succeeded(`write:${name}`, `${name} written again`);
      } catch (err) {
        failures.failed(`write:${name}`, `Could not write ${name}: ${err.message}`);
      }
    },
  };
}
