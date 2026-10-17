import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { countdown, TOP } from '../src/widgets.js';
import { WIDGET_TEXT } from '../src/i18n.js';
import { createWorld, fakeLL2 } from './helpers/world.js';

const content = async (world, options = {}) => {
  const ack = await world.gladys.fake.widgetGet('upcoming_launches', options);
  assert.equal(ack.success, true, ack.error);
  return ack.data.content;
};

/** The core budget: 8 components, 2 texts at most, one focal. */
function assertBudget(widget) {
  assert.deepEqual(validateWidgetContent(widget).errors ?? [], []);
  assert.ok(widget.components.length <= 8);
  assert.ok(widget.components.filter((component) => component.type === 'text').length <= 2);
}

test('the widget shows the countdown and the five next launches, in the viewer language', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const widget = await content(world, { language: 'en' });
  assertBudget(widget);
  const [heading, next, week, list] = widget.components;
  assert.equal(heading.text, 'Rocket launches');
  assert.deepEqual([next.label, next.value, next.color], ['Next launch in', '1 d 19 h', 'success']);
  assert.equal(week.value, 9);
  assert.equal(list.items.length, TOP);
  assert.deepEqual(list.items[0].badge, { text: 'Go', color: 'success' });
  assert.equal(list.items[0].subtitle, 'Mon, Oct 19 · 12:30 · SpaceX');
  assert.ok(list.items.every((item) => item.title.length <= 60 && item.subtitle.length <= 60));
  assert.match(list.items[0].description, /rideshare flight[\s\S]*Space Launch Complex 40/);
});

test('the device setting keeps to a filter; unknown device: every launch', async (t) => {
  const world = await createWorld({ config: { filters: 'Kourou' } });
  t.after(() => world.app.stop());
  const kourou = world.device('filter-kourou').external_id;
  const widget = await content(world, { language: 'fr', settings: { device: kourou } });
  assertBudget(widget);
  assert.equal(widget.components[0].text, 'Lancements spatiaux · Kourou');
  assert.ok(widget.components[3].items.every((item) => item.subtitle.endsWith('Arianespace')));
  const all = await content(world, { language: 'fr', settings: { device: 'ext:gone' } });
  assert.equal(all.components[0].text, 'Lancements spatiaux');
});

test('before any reading, and when a filter matches nothing, the widget says so', async (t) => {
  const down = await createWorld({ api: fakeLL2({ fail: true }) });
  t.after(() => down.app.stop());
  const empty = await content(down, { language: 'de' });
  assertBudget(empty);
  assert.equal(empty.components[1].text, 'Der Startkalender wurde noch nicht gelesen.');

  const world = await createWorld({ config: { filters: 'Zzz' } });
  t.after(() => world.app.stop());
  const none = await content(world, {
    language: 'es',
    settings: { device: world.device('filter-zzz').external_id },
  });
  assert.equal(none.components[1].text, 'Ningún lanzamiento previsto.');
});

test('the countdown: days and hours, then hours and minutes, then imminent', () => {
  const text = WIDGET_TEXT.fr;
  const at = (ms) => countdown({ net: ms }, 0, text);
  assert.equal(at(2 * 86_400_000 + 3 * 3_600_000), '2 j 3 h');
  assert.equal(at(3 * 3_600_000 + 12 * 60_000), '3 h 12 min');
  assert.equal(at(0), 'Imminent');
});
