// -----------------------------------------------------------------------------
// A running integration against the SDK's fake Gladys, with a clock the test
// moves, Launch Library 2 served from answers recorded on 2026-10-17
// (test/fixtures/ll2, trimmed to the fields the integration reads) and /data
// kept in memory. No network.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../../src/app.js';
import { createLL2 } from '../../src/ll2.js';

/** A recorded answer of Launch Library 2. */
export function fixture(name) {
  return JSON.parse(readFileSync(new URL(`../fixtures/ll2/${name}.json`, import.meta.url), 'utf8'));
}

/**
 * A fetch serving the recorded lists, counting the calls. The test edits
 * `api.upcoming` / `api.previous` (raw LL2 launches) to make things happen;
 * `fail` makes every request fail like a network error, `status` answers that
 * HTTP status instead (a 429 says "Expected available in 600 seconds").
 */
export function fakeLL2({ fail = false, status = 200 } = {}) {
  const api = {
    calls: [],
    upcoming: fixture('upcoming-2026-10-17').results,
    previous: fixture('previous-2026-10-17').results,
    fail,
    status,
    /** The raw launch whose name starts with `prefix`. */
    launch(prefix) {
      return [...api.upcoming, ...api.previous].find((launch) => launch.name.startsWith(prefix));
    },
    fetch: async (url) => {
      const { pathname } = new URL(url);
      api.calls.push(pathname);
      if (api.fail) {
        throw new Error('getaddrinfo ENOTFOUND ll.thespacedevs.com');
      }
      const kind = /\/launches\/(upcoming|previous)\/$/.exec(pathname)?.[1];
      if (!kind) {
        return { ok: false, status: 404, headers: new Headers(), json: async () => ({}) };
      }
      const body =
        api.status === 429
          ? { detail: 'Request was throttled. Expected available in 600 seconds.' }
          : { count: api[kind].length, results: structuredClone(api[kind]) };
      return {
        ok: api.status === 200,
        status: api.status,
        headers: new Headers(),
        json: async () => body,
      };
    },
  };
  return api;
}

export function createMemoryStore(files = {}) {
  const content = new Map(Object.entries(files));
  return {
    files: content,
    load: (name) => (content.has(name) ? structuredClone(content.get(name)) : null),
    save: (name, value) => content.set(name, structuredClone(value)),
  };
}

/** A clock the test sets and moves. */
export function createClock(iso) {
  const clock = {
    ms: Date.parse(iso),
    now: () => clock.ms,
    advance: (ms) => {
      clock.ms += ms;
    },
  };
  return clock;
}

/**
 * @param {object} [options]
 * @param {object} [options.config] the configuration saved in Gladys
 * @param {string} [options.at] the instant of the start (ISO)
 * @param {string} [options.timeZone] Gladys' time zone
 * @param {object} [options.api] fakeLL2()
 * @param {object} [options.store] createMemoryStore()
 * @param {boolean} [options.connect] false: handlers registered, not started
 * @param {boolean} [options.timers] true: the real clock of the service runs,
 *   on Date.now and setTimeout (to mock with t.mock.timers)
 */
export async function createWorld({
  config = {},
  at = '2026-10-17T15:00:00Z',
  timeZone = 'Europe/Paris',
  api = fakeLL2(),
  store = createMemoryStore(),
  connect = true,
  timers = false,
} = {}) {
  const clock = createClock(at);
  const now = timers ? () => Date.now() : clock.now;
  const gladys = createFakeGladys({ config });
  const app = registerHandlers(gladys, {
    store,
    api: createLL2({ fetch: api.fetch, now, base: 'https://ll.thespacedevs.com/2.3.0' }),
    now,
    timeZone,
    timers,
  });
  if (connect) {
    await gladys.connect();
  }
  const { service } = app;
  return {
    gladys,
    app,
    service,
    clock,
    api,
    store,
    /** The device published for a scope key ('next', 'filter-spacex'). */
    device(scopeKey = 'next') {
      return gladys.fake.discoveredDevices.find((device) =>
        device.external_id.endsWith(`:launches:${scopeKey}`),
      );
    },
    /** The last value Gladys received for a feature key of a device. */
    state(key, scopeKey = 'next') {
      return gladys.fake.lastState(`${this.device(scopeKey).external_id}:${key}`);
    },
    /** Moves the clock minute by minute up to an instant, ticking each minute. */
    async runUntil(iso) {
      const target = Date.parse(iso);
      while (clock.ms < target) {
        clock.advance(Math.min(60_000, target - clock.ms));
        await service.tick();
      }
    },
  };
}
