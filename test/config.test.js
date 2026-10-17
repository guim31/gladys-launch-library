import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, foldName, normalizeConfig, parseFilters } from '../src/config.js';

test('normalizeConfig fills the defaults and drops invalid values', () => {
  assert.deepEqual(normalizeConfig(), DEFAULT_CONFIG);
  assert.deepEqual(normalizeConfig(null), DEFAULT_CONFIG);
  assert.deepEqual(normalizeConfig({ language: 'it', filters: 42 }), DEFAULT_CONFIG);
  assert.deepEqual(normalizeConfig({ language: 'de', filters: '  SpaceX ' }), {
    language: 'de',
    filters: 'SpaceX',
  });
});

test('filters: split on commas, semicolons and lines, deduplicated, five at most', () => {
  assert.deepEqual(parseFilters('SpaceX, Kourou;\nAriane 6, spacex, Space X, ,'), [
    { label: 'SpaceX', slug: 'spacex' },
    { label: 'Kourou', slug: 'kourou' },
    { label: 'Ariane 6', slug: 'ariane6' },
  ]);
  assert.equal(parseFilters('a,b,c,d,e,f,g').length, 5);
  assert.deepEqual(parseFilters(''), []);
  assert.equal(foldName('Baïkonour'), 'baikonour');
});
