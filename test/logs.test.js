// -----------------------------------------------------------------------------
// The integration runs on its own clock (Gladys never polls the devices),
// and its logs stay quiet: nothing at info on a normal day, launches
// included; a repeated failure logged once, its end logged once.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, fakeLL2 } from './helpers/world.js';

/** Captures the lines of the SDK logger (console.log / console.error). */
function captureLogs(t) {
  const previous = process.env.LOG_LEVEL;
  delete process.env.LOG_LEVEL; // the default level: info
  t.after(() => {
    if (previous !== undefined) {
      process.env.LOG_LEVEL = previous;
    }
  });
  const lines = [];
  const keep = (prefix, ...args) => lines.push([prefix, ...args].map(String).join(' '));
  t.mock.method(console, 'log', keep);
  t.mock.method(console, 'error', keep);
  return {
    lines,
    at: (level) => lines.filter((line) => line.includes(`[${level}]`)),
    clear: () => lines.splice(0),
  };
}

const flush = async () => {
  for (let i = 0; i < 20; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
};

test('the devices are never polled: their own timer reads and fires the triggers', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: Date.parse('2026-10-19T10:13:10Z') });
  const world = await createWorld({ timers: true });
  t.after(() => world.app.stop());
  const [device] = world.gladys.fake.discoveredDevices;
  assert.equal(device.should_poll, false, 'Gladys 5.2.0 polls only should_poll devices');
  assert.equal(device.poll_frequency, undefined);
  world.api.calls.length = 0;
  for (let minute = 0; minute < 18; minute += 1) {
    t.mock.timers.tick(60_000);
    await flush();
  }
  // A fresh install catches nothing up; the timer fires T-15 and T-5.
  assert.deepEqual(
    world.gladys.fake.sceneEvents.map((event) => event.data.minutes_before),
    [15, 5],
  );
  assert.ok(world.api.calls.length >= 1, 'read again around the launch');
});

test('a launch day writes nothing at info: ticks, readings, triggers', async (t) => {
  const logs = captureLogs(t);
  const world = await createWorld({ at: '2026-10-19T00:00:00Z', config: { filters: 'SpaceX' } });
  t.after(() => world.app.stop());
  logs.clear();
  await world.runUntil('2026-10-19T10:35:00Z');
  const bandwagon = world.api.launch('Falcon 9 Block 5 | Bandwagon 5');
  bandwagon.status = { id: 3 };
  bandwagon.last_updated = '2026-10-19T10:40:00Z';
  await world.runUntil('2026-10-19T22:00:00Z');
  assert.ok(world.gladys.fake.sceneEvents.length > 10);
  assert.ok(world.gladys.fake.sceneEvents.some((event) => event.key === 'launch_result'));
  assert.deepEqual(logs.lines, []);
});

test('repeated failures are logged once, their end once', async (t) => {
  const logs = captureLogs(t);
  const api = fakeLL2();
  const world = await createWorld({ api, at: '2026-10-19T08:00:00Z' });
  t.after(() => world.app.stop());
  // Launch Library 2 rate-limits us, and Gladys refuses states, statuses and
  // scene events, for hours.
  api.status = 429;
  const down = async () => {
    throw new Error('Gladys is restarting');
  };
  const mocks = ['publishChangedStates', 'setConnectionStatus', 'publishSceneEvent'].map((name) =>
    t.mock.method(world.gladys, name, down),
  );
  await world.runUntil('2026-10-19T10:31:00Z');
  const warnings = logs.at('WARN');
  assert.equal(warnings.length, 4, warnings.join('\n'));
  for (const pattern of [
    /Could not read Launch Library 2: Launch Library 2 answered HTTP 429 \(rate limited\)/,
    /Could not report the status/,
    /Could not publish the states/,
    /Could not fire launch_soon/,
  ]) {
    assert.equal(warnings.filter((line) => pattern.test(line)).length, 1, String(pattern));
  }
  assert.deepEqual(logs.at('INFO'), []);

  // Everything is back: one line per recovery, then silence.
  for (const mock of mocks) {
    mock.mock.restore();
  }
  api.status = 200;
  logs.clear();
  await world.runUntil('2026-10-19T11:00:00Z');
  const recoveries = logs.at('INFO');
  for (const pattern of [/Launch Library 2 read again/, /States published again/]) {
    assert.equal(recoveries.filter((line) => pattern.test(line)).length, 1, String(pattern));
  }
  assert.equal(world.gladys.fake.connectionStatus.connected, true);
  logs.clear();
  await world.runUntil('2026-10-19T14:00:00Z');
  assert.deepEqual(logs.lines, []);
});
