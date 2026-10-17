// The clock of the integration on recorded data: what it reads and when,
// what it publishes, and the scene events of a launch day (Falcon 9
// Bandwagon 5, Cape Canaveral, 2026-10-19 10:30 UTC).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryStore, createWorld, fakeLL2 } from './helpers/world.js';

const BANDWAGON = 'Falcon 9 Block 5 | Bandwagon 5';
const MMX = 'H3-24 | Martian Moons';

const events = (world, key) =>
  world.gladys.fake.sceneEvents.filter((event) => !key || event.key === key);

/** Moves a recorded launch: new status (LL2 id) and/or date, freshly updated. */
function edit(api, prefix, { status, net, webcast } = {}) {
  const launch = api.launch(prefix);
  if (status !== undefined) {
    launch.status = { id: status };
  }
  if (net !== undefined) {
    launch.net = net;
  }
  if (webcast !== undefined) {
    launch.webcast_live = webcast;
  }
  launch.last_updated = new Date(Date.parse(launch.last_updated) + 3_600_000).toISOString();
}

test('the devices show the next launch, in French by default', async (t) => {
  const world = await createWorld({ config: { filters: 'Kourou' } });
  t.after(() => world.app.stop());
  assert.deepEqual(
    world.gladys.fake.discoveredDevices.map((device) => device.name),
    ['Prochain lancement', 'Prochain lancement · Kourou'],
  );
  assert.equal(world.state('next_date'), 'lun. 19 oct. · 12:30');
  assert.equal(world.state('next_countdown'), 43);
  assert.equal(world.state('next_status'), 'Go');
  assert.equal(world.state('last_result'), 'Réussi');
  assert.equal(world.state('next_provider', 'filter-kourou'), 'Arianespace');
  assert.equal(world.gladys.fake.connectionStatus.connected, true);
});

test('readings: every 30 minutes, every 10 around a launch, the last ones every 2 hours', async (t) => {
  const world = await createWorld({ at: '2026-10-19T06:00:00Z' });
  t.after(() => world.app.stop());
  world.api.calls.length = 0;
  await world.runUntil('2026-10-19T09:00:00Z');
  const count = (kind) => world.api.calls.filter((path) => path.includes(kind)).length;
  assert.equal(count('upcoming'), 6, 'every 30 minutes');
  assert.equal(count('previous'), 1, 'every 2 hours');
  world.api.calls.length = 0;
  // From an hour before to 30 minutes after the launch: every 10 minutes.
  await world.runUntil('2026-10-19T11:00:00Z');
  assert.equal(count('upcoming'), 10, '09:30 to 11:00');
  world.api.calls.length = 0;
  await world.runUntil('2026-10-19T12:00:00Z');
  assert.equal(count('upcoming'), 2);
});

test('a launch day: soon, liftoff, success, one event per matching device', async (t) => {
  const world = await createWorld({
    at: '2026-10-19T08:00:00Z',
    config: { filters: 'SpaceX, Japan' },
  });
  t.after(() => world.app.stop());
  await world.runUntil('2026-10-19T10:30:00Z');
  const soon = events(world, 'launch_soon').filter((event) =>
    event.data.launch_name.startsWith(BANDWAGON),
  );
  assert.deepEqual(
    soon.map((event) => [event.data.minutes_before, event.data.device.split(':').at(-1)]),
    [120, 60, 30, 15, 5].flatMap((lead) => [
      [lead, 'next'],
      [lead, 'filter-spacex'],
    ]),
  );
  assert.equal(
    soon.at(-1).data.sentence,
    'Lancement dans 5 minutes : Falcon 9 Block 5 | Bandwagon 5 (Dedicated Mid-Inclination Rideshare) (SpaceX), depuis Cape Canaveral SFS, FL, USA.',
  );
  assert.equal(soon.at(-1).data.launch_date, 'lun. 19 oct. · 12:30');
  assert.equal(soon.at(-1).data.status, 'go');

  edit(world.api, BANDWAGON, { status: 6, webcast: true });
  await world.runUntil('2026-10-19T10:42:00Z');
  const liftoff = events(world, 'liftoff');
  assert.equal(liftoff.length, 2);
  assert.match(liftoff[0].data.sentence, /^Décollage ! Falcon 9/);
  assert.equal(liftoff[0].data.status_name, 'En vol');
  assert.equal(liftoff[0].data.webcast_live, true);
  // The device moves on to the next launch.
  assert.match(world.state('next_name'), /^H3-24/);
  assert.equal(world.state('last_result'), 'En vol');

  edit(world.api, BANDWAGON, { status: 3 });
  await world.runUntil('2026-10-19T11:00:00Z');
  const results = events(world, 'launch_result');
  assert.equal(results.length, 2);
  assert.equal(results[0].data.result, 'success');
  assert.equal(results[0].data.result_name, 'Réussi');
  assert.match(results[0].data.sentence, /^Lancement réussi : Falcon 9/);
  assert.equal(events(world, 'liftoff').length, 2, 'liftoff fired once per device');
  assert.equal(world.state('last_result'), 'Réussi');
});

test('a failure seen straight away fires liftoff then the result', async (t) => {
  const world = await createWorld({ at: '2026-10-19T19:00:00Z', config: { language: 'en' } });
  t.after(() => world.app.stop());
  edit(world.api, MMX, { status: 4 });
  world.api.launch(MMX).failreason = 'Second stage anomaly.';
  await world.runUntil('2026-10-19T19:55:00Z');
  const fired = events(world).filter((event) => event.data.launch_name.startsWith(MMX));
  assert.deepEqual(
    fired.map((event) => event.key).filter((key) => key !== 'launch_soon'),
    ['liftoff', 'launch_result'],
  );
  const result = fired.at(-1).data;
  assert.equal(result.result, 'failure');
  assert.equal(result.fail_reason, 'Second stage anomaly.');
  assert.match(result.sentence, /^Launch failure: H3-24/);
});

test('postponed: a new date within 48 hours, or on hold; never for a far launch', async (t) => {
  const world = await createWorld({ at: '2026-10-18T12:00:00Z' });
  t.after(() => world.app.stop());
  edit(world.api, BANDWAGON, { net: '2026-10-20T10:30:00Z' });
  edit(world.api, MMX, { status: 5 });
  // Ariane 64 in November moves by a month: not a postponement worth a scene.
  edit(world.api, 'Ariane 64', { net: '2026-12-23T00:00:00Z' });
  await world.runUntil('2026-10-18T12:31:00Z');
  const postponed = events(world, 'launch_postponed');
  assert.deepEqual(
    postponed.map((event) => [event.data.launch_name.split(' | ')[0], event.data.reason]),
    [
      ['H3-24', 'hold'],
      ['Falcon 9 Block 5', 'delayed'],
    ],
  );
  const [hold, delayed] = postponed;
  assert.equal(delayed.data.delay_minutes, 1440);
  assert.equal(delayed.data.previous_date, 'lun. 19 oct. · 12:30');
  assert.match(
    delayed.data.sentence,
    /^Lancement reporté : .*, désormais mar\. 20 oct\. · 12:30\.$/,
  );
  assert.match(hold.data.sentence, /^Lancement suspendu : H3-24/);
  // "Launch soon" follows the new date, not the old one.
  await world.runUntil('2026-10-19T11:00:00Z');
  assert.ok(
    !events(world, 'launch_soon').some(
      (event) => event.data.launch_name.startsWith(BANDWAGON) && event.data.minutes_before < 1440,
    ),
  );
  assert.equal(events(world, 'launch_postponed').length, 2, 'once');
});

test('a fresh install fires nothing for what happened before it', async (t) => {
  const api = fakeLL2();
  edit(api, BANDWAGON, { status: 3 });
  const world = await createWorld({ at: '2026-10-19T10:45:00Z', api });
  t.after(() => world.app.stop());
  await world.runUntil('2026-10-19T11:30:00Z');
  assert.deepEqual(
    events(world).map((event) => event.key),
    [],
  );
});

test('a restart reads the cache instead of the API, and remembers the launches', async (t) => {
  const store = createMemoryStore();
  const api = fakeLL2();
  const first = await createWorld({ at: '2026-10-19T10:00:00Z', store, api });
  await first.app.stop();
  api.calls.length = 0;
  edit(api, BANDWAGON, { status: 6 });
  const second = await createWorld({ at: '2026-10-19T10:05:00Z', store, api });
  t.after(() => second.app.stop());
  assert.deepEqual(api.calls, [], 'the cache is 5 minutes old');
  await second.runUntil('2026-10-19T10:41:00Z');
  assert.equal(events(second, 'liftoff').length, 1, 'the transition is seen across the restart');
});

test('a 429 waits for the announced time and is shown in the status', async (t) => {
  const api = fakeLL2({ status: 429 });
  const world = await createWorld({ api });
  t.after(() => world.app.stop());
  assert.equal(world.gladys.fake.connectionStatus.connected, false);
  assert.match(world.gladys.fake.connectionStatus.message.fr, /Limite de requêtes/);
  assert.equal(world.state('next_name') ?? null, null, 'nothing published before any reading');
  api.calls.length = 0;
  await world.runUntil('2026-10-17T15:09:00Z');
  assert.deepEqual(api.calls, [], 'nothing sent during the 10 minutes announced');
  api.status = 200;
  await world.runUntil('2026-10-17T15:11:00Z');
  assert.equal(api.calls.length, 2);
  assert.equal(world.gladys.fake.connectionStatus.connected, true);
  assert.equal(world.state('next_status'), 'Go');
});

test('"Check" never exceeds the hourly margin', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  for (let i = 0; i < 8; i += 1) {
    await world.gladys.fake.action('check', {});
  }
  assert.equal(world.api.calls.length, 12);
  const ack = await world.gladys.fake.action('check', {});
  assert.match(ack.data.message.en, /Requests left this hour: 0 of 12\./);
  assert.equal(world.gladys.fake.connectionStatus.connected, true, 'our own margin is no problem');
});

// Regressions found in review.

test('a day-only date that gets its time is not a postponement', async (t) => {
  const world = await createWorld({ at: '2026-10-28T12:00:00Z' });
  t.after(() => world.app.stop());
  const vulcan = world.api.launch('Vulcan VC6L');
  vulcan.net_precision = { id: 1, abbrev: 'MIN', name: 'Minute' };
  edit(world.api, 'Vulcan VC6L', { net: '2026-10-29T14:30:00Z' });
  // An hour-precise date refined by 20 minutes is no postponement either.
  edit(world.api, 'Ceres-1S', { net: '2026-10-21T03:55:00Z' });
  await world.runUntil('2026-10-28T12:31:00Z');
  assert.deepEqual(events(world, 'launch_postponed'), []);
});

test('a date that slips by seconds never fires the same alert twice', async (t) => {
  const world = await createWorld({ at: '2026-10-19T19:30:00Z' });
  t.after(() => world.app.stop());
  await world.runUntil('2026-10-19T19:37:00Z');
  edit(world.api, MMX, { net: '2026-10-19T19:41:50Z' });
  await world.service.check();
  await world.runUntil('2026-10-19T19:40:00Z');
  const soon = events(world, 'launch_soon').filter((event) =>
    event.data.launch_name.startsWith(MMX),
  );
  assert.deepEqual(
    soon.map((event) => event.data.minutes_before),
    [5],
  );
});

test('a refused alert is sent again to the devices that missed it only', async (t) => {
  const world = await createWorld({ at: '2026-10-19T10:20:00Z', config: { filters: 'SpaceX' } });
  t.after(() => world.app.stop());
  const publish = world.gladys.publishSceneEvent.bind(world.gladys);
  let refused = 0;
  t.mock.method(world.gladys, 'publishSceneEvent', async (key, data) => {
    if (data.device.endsWith('filter-spacex') && refused === 0) {
      refused += 1;
      throw new Error('Gladys is restarting');
    }
    return publish(key, data);
  });
  await world.runUntil('2026-10-19T10:27:00Z');
  const five = events(world, 'launch_soon').filter(
    (event) => event.data.launch_name.startsWith(BANDWAGON) && event.data.minutes_before === 5,
  );
  assert.deepEqual(five.map((event) => event.data.device.split(':').at(-1)).sort(), [
    'filter-spacex',
    'next',
  ]);
});

test('a scrub recorded an hour after T-0 is still a postponement', async (t) => {
  const world = await createWorld({ at: '2026-10-19T10:00:00Z' });
  t.after(() => world.app.stop());
  await world.runUntil('2026-10-19T11:20:00Z');
  edit(world.api, BANDWAGON, { net: '2026-10-20T10:30:00Z' });
  await world.runUntil('2026-10-19T11:51:00Z');
  assert.deepEqual(
    events(world, 'launch_postponed').map((event) => event.data.reason),
    ['delayed'],
  );
});

test('month and quarter estimates are not counted within 7 days, nor taken as next', async (t) => {
  const world = await createWorld({ at: '2026-10-25T12:00:00Z', config: { language: 'en' } });
  t.after(() => world.app.stop());
  // "NET October" launches are dated 31 Oct 00:00 UTC in the recorded answer.
  assert.equal(world.state('launches_7_days'), 1);
  assert.match(world.state('next_name'), /^Vulcan VC6L/);
  assert.equal(world.state('next_date'), 'Thu, Oct 29');
});

test('a day-only launch is shown on its UTC day west of Greenwich', async (t) => {
  const world = await createWorld({ at: '2026-10-29T03:00:00Z', timeZone: 'America/Cayenne' });
  t.after(() => world.app.stop());
  assert.match(world.state('next_name'), /^Vulcan VC6L/);
  assert.equal(world.state('next_date'), 'jeu. 29 oct.');
  assert.equal(world.state('launch_today'), 1);
});
