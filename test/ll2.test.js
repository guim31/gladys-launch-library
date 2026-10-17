// The Launch Library 2 client and parser, on answers recorded on 2026-10-17
// (production) and on the development instance (lldev.thespacedevs.com).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_PER_HOUR,
  PATHS,
  createLL2,
  parseLaunch,
  parseLaunches,
  retryDelay,
} from '../src/ll2.js';
import { fixture } from './helpers/world.js';

test('the upcoming list parses into sorted plain launches', () => {
  const launches = parseLaunches(fixture('upcoming-2026-10-17'));
  assert.equal(launches.length, 40);
  assert.ok(launches.every((launch, i) => i === 0 || launches[i - 1].net <= launch.net));
  assert.deepEqual(
    {
      ...launches[0],
      description: launches[0].description.slice(0, 20),
    },
    {
      id: '3b430f81-0ff1-4d85-8a1a-cef0de326198',
      name: 'Falcon 9 Block 5 | Bandwagon 5 (Dedicated Mid-Inclination Rideshare)',
      mission: 'Bandwagon 5 (Dedicated Mid-Inclination Rideshare)',
      description: 'Dedicated rideshare ',
      orbit: 'Low Earth Orbit',
      rocket: 'Falcon 9 Block 5',
      families: ['Falcon', 'Falcon 9'],
      provider: 'SpaceX',
      providerAbbrev: 'SpX',
      pad: 'Space Launch Complex 40',
      location: 'Cape Canaveral SFS, FL, USA',
      country: 'US',
      countryName: 'United States of America',
      net: Date.parse('2026-10-19T10:30:00Z'),
      windowStart: Date.parse('2026-10-19T10:30:00Z'),
      windowEnd: Date.parse('2026-10-19T11:30:00Z'),
      precision: 'MIN',
      status: 'go',
      failReason: '',
      webcastLive: false,
      updated: launches[0].updated,
    },
  );
  const precisions = new Set(launches.map((launch) => launch.precision));
  assert.deepEqual([...precisions].sort(), ['DAY', 'HR', 'M', 'MIN', 'Q4', 'SEC']);
  assert.ok(launches.some((launch) => launch.status === 'tbd'));
  assert.ok(launches.some((launch) => launch.status === 'tbc'));
  // Carriage returns of the descriptions are dropped.
  assert.ok(launches.every((launch) => !launch.description.includes('\r')));
});

test('results and failure reasons are read', () => {
  const previous = parseLaunches(fixture('previous-2026-10-17'));
  assert.ok(previous.every((launch) => launch.status === 'success'));
  const failures = parseLaunches(fixture('previous-failures-lldev'));
  assert.deepEqual(
    failures.map((launch) => launch.status),
    ['failure', 'failure', 'failure'],
  );
  assert.match(failures.at(-1).failReason, /Max-Q/);
});

test('a launch without id or date is skipped, an unknown status is "tbd"', () => {
  assert.equal(parseLaunch({ id: 'x' }), null);
  assert.equal(parseLaunch({ net: '2026-10-19T10:30:00Z' }), null);
  const bare = parseLaunch({ id: 'x', net: '2026-10-19T10:30:00Z', status: { id: 99 } });
  assert.equal(bare.status, 'tbd');
  assert.equal(bare.precision, 'M');
  assert.throws(() => parseLaunches({ detail: 'nope' }), /no results/);
});

test('the wait of a 429 is read from Retry-After or from the message', () => {
  assert.equal(retryDelay(new Headers({ 'retry-after': '120' }), null), 120_000);
  assert.equal(
    retryDelay(new Headers(), {
      detail: 'Request was throttled. Expected available in 845 seconds.',
    }),
    845_000,
  );
  assert.equal(retryDelay(new Headers(), null), 15 * 60_000);
});

function fakeFetch(status = 200) {
  const calls = [];
  return {
    calls,
    fetch: async (url) => {
      calls.push(url);
      return {
        ok: status === 200,
        status,
        headers: new Headers(),
        json: async () =>
          status === 429 ? { detail: 'Expected available in 600 seconds.' } : { results: [] },
      };
    },
  };
}

test('the client keeps under the hourly limit by itself', async () => {
  let now = 0;
  const api = fakeFetch();
  const client = createLL2({ fetch: api.fetch, now: () => now, base: 'https://example.test' });
  for (let i = 0; i < MAX_PER_HOUR; i += 1) {
    await client.get(PATHS.upcoming);
  }
  assert.equal(client.remaining(), 0);
  await assert.rejects(client.get(PATHS.upcoming), (err) => err.limited && !err.status);
  assert.equal(api.calls.length, MAX_PER_HOUR, 'the 13th request is never sent');
  now += 3_600_001;
  assert.equal(client.remaining(), MAX_PER_HOUR);
  assert.equal(api.calls[0], `https://example.test${PATHS.upcoming}`);
});

test('a 429 blocks the client for the announced time', async () => {
  let now = 0;
  const api = fakeFetch(429);
  const client = createLL2({ fetch: api.fetch, now: () => now, base: 'https://example.test' });
  await assert.rejects(client.get(PATHS.upcoming), (err) => {
    assert.equal(err.status, 429);
    assert.equal(err.retryAt, 600_000);
    return true;
  });
  await assert.rejects(client.get(PATHS.upcoming), /limit reached/);
  assert.equal(api.calls.length, 1);
  now = 600_000;
  assert.ok(client.remaining() > 0);
});

test('network errors, HTTP errors and non-JSON answers are LL2 errors', async () => {
  const down = createLL2({
    fetch: async () => {
      throw new Error('ENOTFOUND');
    },
  });
  await assert.rejects(down.get(PATHS.upcoming), /unreachable: ENOTFOUND/);
  const broken = createLL2({ fetch: fakeFetch(503).fetch });
  await assert.rejects(broken.get(PATHS.upcoming), /HTTP 503/);
  const html = createLL2({
    fetch: async () => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => JSON.parse('<'),
    }),
  });
  await assert.rejects(html.get(PATHS.upcoming), /not JSON/);
});
