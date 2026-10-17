import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lastLaunch, matches, mergeLaunches, nextLaunch, scopes } from '../src/launches.js';
import { parseLaunches } from '../src/ll2.js';
import { formatNet } from '../src/time.js';
import { fixture } from './helpers/world.js';

const upcoming = parseLaunches(fixture('upcoming-2026-10-17'));
const previous = parseLaunches(fixture('previous-2026-10-17'));
const names = (list) => list.map((launch) => launch.name.split(' | ')[0]);

test('filters match providers, rockets, sites, aliases and country codes', () => {
  const pick = (slug) => names(upcoming.filter((launch) => matches(launch, slug)));
  assert.ok(pick('spacex').every((name) => /Falcon|Starship/.test(name)));
  assert.ok(pick('spacex').length > 5);
  assert.ok(pick('spx').length === pick('spacex').length, 'provider abbreviation');
  assert.ok(
    pick('kourou').every((name) => /Ariane|Vega/.test(name)),
    'alias of Guiana Space Centre',
  );
  assert.ok(pick('kourou').length > 0);
  assert.deepEqual(pick('floride'), pick('florida'));
  assert.ok(pick('florida').length > 0);
  assert.ok(
    pick('jp').every((name) => /H3|H-II|Epsilon/.test(name)),
    'country code',
  );
  assert.ok(pick('chine').length > 0);
  assert.deepEqual(pick('zzz'), []);
  // A short code matches whole, never inside a word.
  assert.deepEqual(pick('us').length, upcoming.filter((l) => l.country === 'US').length);
});

test('the next launch of a scope skips launched and stale ones', () => {
  const [all] = scopes({ filters: '' });
  const now = Date.parse('2026-10-17T15:00:00Z');
  assert.equal(
    nextLaunch(upcoming, all, now).name.split(' | ')[1],
    'Bandwagon 5 (Dedicated Mid-Inclination Rideshare)',
  );
  const flying = upcoming.map((launch, i) =>
    i === 0 ? { ...launch, status: 'in_flight' } : launch,
  );
  assert.match(nextLaunch(flying, all, now).name, /^H3-24/);
  // Still "Go" 7 hours after its date: a stale record.
  assert.match(nextLaunch(upcoming, all, Date.parse('2026-10-19T17:31:00Z')).name, /^H3-24/);
  assert.match(lastLaunch(mergeLaunches(upcoming, previous), all).name, /USSF-481/);
});

test('mergeLaunches keeps the record updated last', () => {
  const old = { id: 'a', net: 1, updated: 1, status: 'go' };
  const fresh = { id: 'a', net: 1, updated: 2, status: 'success' };
  assert.equal(mergeLaunches([fresh], [old])[0].status, 'success');
  assert.equal(mergeLaunches([old], [fresh])[0].status, 'success');
});

test('dates are shown as precisely as they are known, in the Gladys time zone', () => {
  const net = Date.parse('2026-10-19T10:30:00Z');
  const show = (precision, language = 'fr') =>
    formatNet({ net, precision }, language, 'Europe/Paris');
  assert.equal(show('SEC'), 'lun. 19 oct. · 12:30');
  assert.equal(show('MIN', 'en'), 'Mon, Oct 19 · 12:30');
  assert.equal(show('HR'), 'lun. 19 oct. · ~12:30');
  assert.equal(show('DAY'), 'lun. 19 oct.');
  assert.equal(show('W'), '~lun. 19 oct.');
  assert.equal(show('M'), 'octobre 2026');
  assert.equal(show('M', 'de'), 'Oktober 2026');
  assert.equal(show('Q4'), 'T4 2026');
  assert.equal(show('Q4', 'en'), 'Q4 2026');
  assert.equal(show('H2', 'es'), 'S2 2026');
  assert.equal(show('Y'), '2026');
  // A month starts at 00:00 UTC: still that month west of Greenwich.
  const month = { net: Date.parse('2026-11-01T00:00:00Z'), precision: 'M' };
  assert.equal(formatNet(month, 'en', 'America/Los_Angeles'), 'November 2026');
});
