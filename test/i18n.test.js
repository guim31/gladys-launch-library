// -----------------------------------------------------------------------------
// Every text Gladys shows exists in the four languages of its interface
// (English, French, German, Spanish): the manifest, the message tables of the
// code and the four documentation files. German says "du", never the polite
// "Sie"; Spanish says "usted".
// -----------------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { LANGUAGES } from '../src/config.js';
import {
  CHECK_TEXT,
  INIT_FAILED,
  LEAD_TEXT,
  NAMES,
  PROBLEM_TEXT,
  SENTENCES,
  STATE_TEXT,
  STATUS_NAMES,
  WIDGET_TEXT,
} from '../src/i18n.js';
import { STATUSES } from '../src/ll2.js';
import { LEAD_MINUTES } from '../src/service.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);

const LANGS = ['en', 'fr', 'de', 'es'];
const POLITE_GERMAN = /(?<!\p{L})(Sie|Ihr|Ihre|Ihren|Ihrem|Ihrer|Ihres)(?!\p{L})/u;

// Upper bounds, in characters: what the Gladys interface shows without cutting.
const MAX = {
  catalog: 100,
  widgetLabel: 30,
  label: 60,
  placeholder: 60,
  description: 300,
  message: 200,
  featureName: 40,
  tileValue: 12,
  tileLabel: 24,
  badge: 16,
  caption: 80,
  body: 300,
  detail: 2000,
};

const sorted = (keys) => [...keys].sort();

/** Checks one multi-language object; returns its problems. */
function problems(value, path, max) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [`${path} must be a multi-language object`];
  }
  const found = [];
  if (JSON.stringify(sorted(Object.keys(value))) !== JSON.stringify(sorted(LANGS))) {
    found.push(`${path} has [${Object.keys(value)}], expected exactly [${LANGS}]`);
  }
  for (const [lang, text] of Object.entries(value)) {
    found.push(...textProblems(text, `${path}.${lang}`, lang, max));
  }
  return found;
}

function textProblems(text, path, lang, max) {
  if (typeof text !== 'string' || text.trim() === '') {
    return [`${path} is empty`];
  }
  const found = [];
  if (text.length > max) {
    found.push(`${path} has ${text.length} characters (${max} at most)`);
  }
  if (lang === 'de' && POLITE_GERMAN.test(text)) {
    found.push(`${path} uses the polite form: "${text}"`);
  }
  return found;
}

/** Every multi-language object of the manifest, with its length limit. */
function manifestTexts(root) {
  const texts = [];
  const walk = (value, path, key) => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, `${path}[${index}]`, key));
      return;
    }
    if (!value || typeof value !== 'object') {
      return;
    }
    const isText =
      ['label', 'description', 'placeholder'].includes(key) ||
      Object.keys(value).some((child) => LANGS.includes(child));
    if (isText) {
      const max =
        path === 'manifest.description' || /^manifest\.widgets\[\d+\]\.description$/.test(path)
          ? MAX.catalog
          : /^manifest\.widgets\[\d+\]\.label$/.test(path)
            ? MAX.widgetLabel
            : (MAX[key] ?? MAX.label);
      texts.push({ path, value, max });
      return;
    }
    for (const [child, item] of Object.entries(value)) {
      walk(item, `${path}.${child}`, child);
    }
  };
  walk(root, 'manifest', null);
  return texts;
}

// Tables written one language at a time: same keys everywhere, no empty text.
function tableProblems(table, name, maxOf, render = (value) => value) {
  const found = [];
  if (JSON.stringify(sorted(Object.keys(table))) !== JSON.stringify(sorted(LANGS))) {
    found.push(`${name} has [${Object.keys(table)}], expected exactly [${LANGS}]`);
  }
  for (const lang of LANGS) {
    const entries = table[lang] ?? {};
    if (
      JSON.stringify(sorted(Object.keys(entries))) !== JSON.stringify(sorted(Object.keys(table.en)))
    ) {
      found.push(`${name}.${lang} does not have the keys of ${name}.en`);
    }
    for (const [key, value] of Object.entries(entries)) {
      found.push(...textProblems(render(value, key), `${name}.${lang}.${key}`, lang, maxOf(key)));
    }
  }
  return found;
}

test('the configuration offers the four languages', () => {
  assert.deepEqual(LANGUAGES, LANGS);
});

test('every text of the manifest is in English, French, German and Spanish', () => {
  const texts = manifestTexts(manifest);
  assert.ok(texts.length >= 60, `only ${texts.length} texts found in the manifest`);
  const found = texts.flatMap(({ path, value, max }) => problems(value, path, max));
  assert.deepEqual(found, []);
});

test('the catalog description holds 10 characters at least in every language', () => {
  for (const lang of LANGS) {
    assert.ok(manifest.description[lang].length >= 10, `description.${lang} is too short`);
  }
});

test('the feature names, statuses and device texts exist in every language', () => {
  assert.deepEqual(
    tableProblems(NAMES, 'NAMES', () => MAX.featureName),
    [],
  );
  assert.deepEqual(
    tableProblems(STATUS_NAMES, 'STATUS_NAMES', () => MAX.badge),
    [],
  );
  assert.deepEqual(Object.keys(STATUS_NAMES.en).sort(), [...STATUSES].sort());
  assert.deepEqual(
    tableProblems(STATE_TEXT, 'STATE_TEXT', () => MAX.featureName),
    [],
  );
  // A filter device is named "<device> · <filter of 40 characters at most>".
  for (const lang of LANGS) {
    assert.ok(NAMES[lang].device.length + 3 + 40 <= 80, lang);
  }
});

test('the widget texts exist in every language, tile values within 12 characters', () => {
  const widgetMax = (key) =>
    ({
      title: 30,
      nextIn: MAX.tileLabel,
      within7: MAX.tileLabel,
      daysHours: MAX.tileValue,
      hoursMinutes: MAX.tileValue,
      now: MAX.tileValue,
      none: MAX.body,
      noData: MAX.body,
    })[key];
  const render = (value, key) => {
    if (typeof value !== 'function') {
      return value;
    }
    return key === 'daysHours' ? value(366, 23) : value(23, 59);
  };
  assert.deepEqual(tableProblems(WIDGET_TEXT, 'WIDGET_TEXT', widgetMax, render), []);
});

test('the sentences, the check report and the problems exist in every language', () => {
  const launch = {
    name: 'Falcon 9 Block 5 | Starlink Group 15-15',
    provider: 'SpaceX',
    location: 'Vandenberg SFB, CA, USA',
    date: 'mer. 21 oct. · 00:14',
    status: 'Go',
  };
  const render = (value, key) => {
    if (typeof value !== 'function') {
      return value;
    }
    if (key === 'soon') {
      return value(1440, launch);
    }
    return key === 'upcoming' ? value([launch, launch, launch]) : value(launch);
  };
  assert.deepEqual(
    tableProblems(SENTENCES, 'SENTENCES', () => MAX.message * 2, render),
    [],
  );
  const renderCheck = (value) => (typeof value === 'function' ? value('SpaceX', 3, 'X') : value);
  assert.deepEqual(
    tableProblems(CHECK_TEXT, 'CHECK_TEXT', () => 2000, renderCheck),
    [],
  );
  const renderProblem = (value) => value();
  assert.deepEqual(
    tableProblems(PROBLEM_TEXT, 'PROBLEM_TEXT', () => MAX.message, renderProblem),
    [],
  );
  assert.deepEqual(problems(INIT_FAILED, 'INIT_FAILED', MAX.message), []);
  assert.deepEqual(
    LANGS.map((lang) => LEAD_MINUTES.map(LEAD_TEXT[lang]).join(', ')),
    [
      '5 minutes, 15 minutes, 30 minutes, 1 hour, 2 hours, 24 hours',
      '5 minutes, 15 minutes, 30 minutes, 1 heure, 2 heures, 24 heures',
      '5 Minuten, 15 Minuten, 30 Minuten, 1 Stunde, 2 Stunden, 24 Stunden',
      '5 minutos, 15 minutos, 30 minutos, 1 hora, 2 horas, 24 horas',
    ],
  );
});

test('the four documentation files exist, with the same sections', async () => {
  const docs = {};
  for (const lang of LANGS) {
    docs[lang] = await readFile(new URL(`../docs/${lang}.md`, import.meta.url), 'utf8');
    assert.ok(docs[lang].length >= 300, `docs/${lang}.md is too short`);
  }
  const outline = (text) =>
    text
      .split('\n')
      .filter((line) => /^#{1,4} /.test(line))
      .map((line) => line.match(/^#+/)[0]);
  for (const lang of LANGS) {
    assert.deepEqual(outline(docs[lang]), outline(docs.en), `docs/${lang}.md sections`);
  }
  assert.ok(outline(docs.en).length >= 8);
  assert.doesNotMatch(docs.de, POLITE_GERMAN, 'docs/de.md uses the polite form');
});

test('the guard catches a missing language, an empty text and the polite German form', () => {
  assert.equal(problems({ en: 'Light', fr: 'Éclairage', de: 'Licht' }, 'x', 60).length, 1);
  assert.equal(problems({ en: 'Light', fr: 'Éclairage', de: '', es: 'Luz' }, 'x', 60).length, 1);
  assert.equal(problems({ en: 'a', fr: 'a', de: 'a', es: 'a', it: 'a' }, 'x', 60).length, 1);
  assert.equal(problems({ en: 'a', fr: 'a', de: 'a'.repeat(61), es: 'a' }, 'x', 60).length, 1);
  for (const polite of [
    'Wählen Sie',
    'Ihr Gerät',
    'Ihre Zone',
    'mit Ihrem',
    'Ihren',
    'Ihrer',
    'Ihres',
  ]) {
    assert.equal(problems({ en: 'a', fr: 'a', de: polite, es: 'a' }, 'x', 60).length, 1, polite);
  }
  assert.deepEqual(
    problems({ en: 'a', fr: 'a', de: 'Siebenschläfer, ihre', es: 'a' }, 'x', 60),
    [],
  );
  const forgotten = structuredClone(manifest);
  delete forgotten.scene_actions[1].fields[1].label.de;
  const found = manifestTexts(forgotten).flatMap(({ path, value, max }) =>
    problems(value, path, max),
  );
  assert.deepEqual(found, [
    'manifest.scene_actions[1].fields[1].label has [en,fr,es], expected exactly [en,fr,de,es]',
  ]);
});
