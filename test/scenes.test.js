import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, fakeLL2 } from './helpers/world.js';

test('read the next launch: worldwide or for a filter, in the configured language', async (t) => {
  const world = await createWorld({ config: { language: 'es', filters: 'Japan' } });
  t.after(() => world.app.stop());
  const all = await world.gladys.fake.sceneAction('read_next_launch', {});
  assert.equal(
    all.data.outputs.sentence,
    'Próximo lanzamiento: Falcon 9 Block 5 | Bandwagon 5 (Dedicated Mid-Inclination Rideshare) (SpaceX), desde Cape Canaveral SFS, FL, USA, lun, 19 oct · 12:30. Estado: Go.',
  );
  assert.equal(all.data.outputs.hours_until, 43);
  const japan = await world.gladys.fake.sceneAction('read_next_launch', {
    device: world.device('filter-japan').external_id,
  });
  assert.match(japan.data.outputs.launch_name, /^H3-24/);
  assert.equal(japan.data.outputs.provider, 'Mitsubishi Heavy Industries');
});

test('read the next launches: 1 to 5, a clear sentence without data', async (t) => {
  const world = await createWorld({ config: { language: 'en' } });
  t.after(() => world.app.stop());
  const five = await world.gladys.fake.sceneAction('read_upcoming_launches', { count: 50 });
  assert.equal(five.data.outputs.count, 5);
  assert.match(five.data.outputs.sentence, /^Next launches: 1\. Falcon 9 .*; 5\. /);
  const one = await world.gladys.fake.sceneAction('read_upcoming_launches', { count: 1 });
  assert.equal(one.data.outputs.count, 1);

  const down = await createWorld({ api: fakeLL2({ fail: true }), config: { language: 'en' } });
  t.after(() => down.app.stop());
  const nothing = await down.gladys.fake.sceneAction('read_next_launch', {});
  assert.equal(nothing.data.outputs.sentence, 'The launch schedule has not been read yet.');
  assert.equal(nothing.data.outputs.hours_until, -1);
});
