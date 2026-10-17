// -----------------------------------------------------------------------------
// Consistency checks between `gladys-assistant-integration.json` and the code.
// The manifest is validated by the store indexer, but nothing there can know
// which handlers the code actually registers — these tests keep both in sync.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CHECK_ACTION } from '../src/app.js';
import { DEFAULT_CONFIG, LANGUAGES } from '../src/config.js';
import { RESULTS } from '../src/launches.js';
import { DEFAULT_COUNT, MAX_COUNT, SCENE_ACTIONS } from '../src/scenes.js';
import { LEAD_MINUTES, POSTPONE_REASONS, TRIGGERS, WIDGET_KEY } from '../src/service.js';
import { WIDGETS } from '../src/widgets.js';
import { createWorld } from './helpers/world.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

// Every list of form fields the manifest can declare (same field grammar).
const allFields = [
  ...(manifest.config_schema ?? []),
  ...[
    ...(manifest.actions ?? []),
    ...(manifest.scene_triggers ?? []),
    ...(manifest.scene_actions ?? []),
  ].flatMap((item) => item.fields ?? []),
  ...(manifest.widgets ?? []).flatMap((widget) => widget.settings ?? []),
];

// The handlers the integration actually registers on the SDK.
const registered = await createWorld({ connect: false });
const handlerKeys = (prefix) =>
  Object.keys(registered.gladys.handlers)
    .filter((key) => key.startsWith(prefix))
    .map((key) => key.slice(prefix.length));

const keysOf = (list) => (list ?? []).map((entry) => entry.key);
const values = (field) => field.options.map((option) => option.value);
const trigger = (key) => manifest.scene_triggers.find((entry) => entry.key === key);
const field = (item, key) => item.fields.find((entry) => entry.key === key);

test('identity: name, image, cover, transports, category', () => {
  assert.equal(manifest.name, 'Rocket Launches');
  assert.equal(manifest.type, 'device');
  assert.match(manifest.docker_image, /^ghcr\.io\/guim31\/gladys-launch-library:/);
  assert.equal(
    manifest.cover_image,
    'https://raw.githubusercontent.com/guim31/gladys-launch-library/main/cover.png',
  );
  // Everything comes from a public API on the Internet.
  assert.deepEqual(manifest.transports, ['cloud']);
  assert.deepEqual(manifest.categories, ['services']);
});

test('scene triggers, scene actions and widgets require Gladys >= 5.1.0', () => {
  assert.equal(manifest.gladys_version, '>=5.1.0');
});

test('every manifest action has a registered handler, and vice versa', () => {
  assert.deepEqual(keysOf(manifest.actions), [CHECK_ACTION]);
  assert.deepEqual(handlerKeys('action:'), [CHECK_ACTION]);
});

test('"Check" reports the launches and the filters in every language', async (t) => {
  const world = await createWorld({ config: { filters: 'Ariane, Zzz' } });
  t.after(() => world.app.stop());
  const ack = await world.gladys.fake.action(CHECK_ACTION, {});
  assert.equal(ack.success, true, ack.error);
  assert.deepEqual(Object.keys(ack.data.message).sort(), [...LANGUAGES].sort());
  const fr = ack.data.message.fr;
  assert.match(fr, /^Launch Library 2 : 40 lancements à venir connus\./);
  assert.match(fr, /Prochain lancement : Falcon 9 Block 5 \| Bandwagon 5/);
  assert.match(fr, /Filtre « Ariane » : 2 lancements, prochain : Ariane 64/);
  assert.match(fr, /Filtre « Zzz » : aucun lancement parmi les prochains\./);
  assert.match(fr, /Requêtes restantes cette heure : 8 sur 12\./);
  assert.match(fr, /Données lues à l'instant/);
});

test('every scene action has a handler, and returns the declared outputs', async (t) => {
  assert.deepEqual(keysOf(manifest.scene_actions), Object.keys(SCENE_ACTIONS));
  assert.deepEqual(handlerKeys('sceneAction:'), Object.keys(SCENE_ACTIONS));
  const world = await createWorld();
  t.after(() => world.app.stop());
  for (const action of manifest.scene_actions) {
    const ack = await world.gladys.fake.sceneAction(action.key, {});
    assert.equal(ack.success, true);
    assert.deepEqual(Object.keys(ack.data.outputs).sort(), keysOf(action.outputs).sort());
    for (const output of action.outputs) {
      assert.equal(typeof ack.data.outputs[output.key], output.type, output.key);
    }
  }
  const count = field(manifest.scene_actions[1], 'count');
  assert.equal(count.default, DEFAULT_COUNT);
  assert.equal(count.max, MAX_COUNT);
});

test('the scene triggers fired are the declared ones, with their filters and variables', async (t) => {
  assert.deepEqual(keysOf(manifest.scene_triggers).sort(), Object.values(TRIGGERS).sort());
  for (const declared of manifest.scene_triggers) {
    const device = field(declared, 'device');
    assert.equal(device.source, 'devices');
    assert.equal(
      device.required,
      true,
      `${declared.key}: one event per device, a wildcard fires twice`,
    );
  }
  const soon = trigger(TRIGGERS.LAUNCH_SOON);
  assert.deepEqual(values(field(soon, 'minutes_before')), LEAD_MINUTES.map(String));
  assert.equal(field(soon, 'minutes_before').required, true, 'an empty lead matches every lead');
  assert.deepEqual(values(field(trigger(TRIGGERS.LAUNCH_RESULT), 'result')), RESULTS);
  assert.deepEqual(values(field(trigger(TRIGGERS.LAUNCH_POSTPONED), 'reason')), POSTPONE_REASONS);

  const world = await createWorld({ at: '2026-10-19T08:00:00Z' });
  t.after(() => world.app.stop());
  const bandwagon = world.api.launch('Falcon 9 Block 5 | Bandwagon 5');
  const mmx = world.api.launch('H3-24');
  await world.runUntil('2026-10-19T10:31:00Z');
  bandwagon.status = { id: 3 };
  bandwagon.last_updated = '2026-10-19T10:35:00Z';
  mmx.status = { id: 5 };
  mmx.last_updated = '2026-10-19T10:35:00Z';
  await world.runUntil('2026-10-19T10:45:00Z');
  const fired = new Map(world.gladys.fake.sceneEvents.map((event) => [event.key, event.data]));
  assert.deepEqual([...fired.keys()].sort(), Object.values(TRIGGERS).sort());
  for (const declared of manifest.scene_triggers) {
    const data = fired.get(declared.key);
    for (const key of [...keysOf(declared.fields), ...keysOf(declared.variables)]) {
      assert.ok(key in data, `${declared.key}: "${key}" is in the event data`);
    }
    for (const variable of declared.variables) {
      assert.equal(typeof data[variable.key], variable.type, `${declared.key}.${variable.key}`);
    }
    // Filter values are those the manifest offers (select values are strings).
    for (const filter of declared.fields.filter((entry) => entry.options)) {
      assert.ok(values(filter).includes(String(data[filter.key])), `${declared.key}.${filter.key}`);
    }
  }
});

test('every widget has a handler, and its settings match the code', () => {
  assert.deepEqual(keysOf(manifest.widgets), [WIDGET_KEY]);
  assert.deepEqual(Object.keys(WIDGETS), [WIDGET_KEY]);
  assert.deepEqual(handlerKeys('widget:'), [WIDGET_KEY]);
  assert.deepEqual(keysOf(manifest.widgets[0].settings), ['device']);
});

test('config_schema defaults and options stay consistent with the code', () => {
  for (const entry of manifest.config_schema) {
    if (entry.default !== undefined) {
      assert.deepEqual(DEFAULT_CONFIG[entry.key], entry.default, `DEFAULT_CONFIG.${entry.key}`);
    }
  }
  assert.deepEqual(
    Object.keys(DEFAULT_CONFIG).sort(),
    manifest.config_schema
      .filter((entry) => entry.type !== 'section')
      .map((entry) => entry.key)
      .sort(),
  );
  const language = manifest.config_schema.find((entry) => entry.key === 'language');
  assert.deepEqual(values(language), LANGUAGES);
});

test('section fields are purely presentational', () => {
  const sections = manifest.config_schema.filter((entry) => entry.type === 'section');
  assert.ok(sections.length > 0);
  for (const section of sections) {
    assert.equal(section.required, undefined);
    assert.equal(section.default, undefined);
    for (const link of section.links ?? []) {
      assert.match(link.url, /^https:\/\//);
    }
  }
});

test('number fields have integer bounds and defaults (the form has no step)', () => {
  for (const entry of allFields.filter((f) => f.type === 'number')) {
    for (const key of ['min', 'max', 'default']) {
      if (entry[key] !== undefined) {
        assert.ok(Number.isInteger(entry[key]), `field "${entry.key}".${key}`);
      }
    }
  }
});

test('no secret field anywhere: nothing here is secret', () => {
  assert.ok(allFields.every((entry) => entry.type !== 'secret'));
});

test('the manifest version is the package version, and the image is tagged with it', () => {
  assert.equal(manifest.version, pkg.version);
  assert.ok(manifest.docker_image.endsWith(`:${manifest.version}`));
});

test('the catalog description holds 10 to 100 characters per language', () => {
  for (const [lang, text] of Object.entries(manifest.description)) {
    assert.ok(text.length >= 10 && text.length <= 100, `description.${lang}: ${text.length}`);
  }
});
