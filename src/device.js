// -----------------------------------------------------------------------------
// The devices: "Next launch" (every launch in the world) and one per filter of
// the user ("Next launch · SpaceX"), with the same features. Read in the
// dashboard and in scene conditions ("only continue if there is a launch
// today"). Every feature shares its type with another one: Gladys shows the
// generic label of the type instead of the feature name when a feature is
// alone of its type.
// -----------------------------------------------------------------------------

import { NAMES, STATE_TEXT, STATUS_NAMES } from './i18n.js';
import {
  hoursUntil,
  isDated,
  isOnDay,
  lastLaunch,
  nextLaunch,
  scopes,
  shortName,
  upcomingOf,
} from './launches.js';
import { formatNet, localDate } from './time.js';

const TEXT = { category: 'text', type: 'text', min: 0, max: 0 };
const BINARY = { category: 'input', type: 'binary', min: 0, max: 1 };
const WEEK = 7 * 24 * 3_600_000;

// Feature keys are forever (Gladys keys history and scenes on them).
export const FEATURES = [
  { key: 'next_name', ...TEXT },
  { key: 'next_date', ...TEXT },
  {
    key: 'next_countdown',
    category: 'duration',
    type: 'integer',
    unit: 'hours',
    min: 0,
    max: 8784,
  },
  { key: 'launches_7_days', category: 'counter-sensor', type: 'integer', min: 0, max: 100 },
  { key: 'next_status', ...TEXT },
  { key: 'next_provider', ...TEXT },
  { key: 'next_rocket', ...TEXT },
  { key: 'next_location', ...TEXT },
  { key: 'webcast_live', ...BINARY },
  { key: 'launch_today', ...BINARY },
  { key: 'last_launch', ...TEXT },
  { key: 'last_result', ...TEXT },
];

/** The ids of the device of a scope ('next', 'filter-spacex'). */
export function deviceIds(gladys, scopeKey) {
  return gladys.externalIds('launches', scopeKey);
}

export function deviceName(names, scope) {
  return scope.label ? `${names.device} · ${scope.label}` : names.device;
}

export function buildDevices(gladys, config) {
  const names = NAMES[config.language];
  return scopes(config).map((scope) => {
    const ids = deviceIds(gladys, scope.key);
    return {
      name: deviceName(names, scope),
      external_id: ids.device,
      should_poll: false,
      params: [
        { name: 'source', value: 'Launch Library 2' },
        ...(scope.label ? [{ name: 'filter', value: scope.label }] : []),
      ],
      features: FEATURES.map(({ key, category, type, unit, min, max }) => ({
        name: names[key],
        external_id: ids.feature(key),
        category,
        type,
        ...(unit ? { unit } : {}),
        min,
        max,
        read_only: true,
        has_feedback: false,
      })),
    };
  });
}

/**
 * The states of every device at an instant. Nothing is published before the
 * first reading: a value the integration does not know is left out.
 * @param {object} gladys the SDK client
 * @param {object} config a normalized configuration
 * @param {object[]|null} launches the merged launches, null before any reading
 * @param {{ now: number, timeZone: string }} at
 */
export function buildStates(gladys, config, launches, { now, timeZone }) {
  if (!launches) {
    return [];
  }
  const language = config.language;
  const status = STATUS_NAMES[language];
  const none = STATE_TEXT[language].none;
  const today = localDate(now, timeZone);
  const states = [];
  for (const scope of scopes(config)) {
    const ids = deviceIds(gladys, scope.key);
    const number = (key, value) =>
      states.push({ device_feature_external_id: ids.feature(key), state: value });
    const string = (key, value) =>
      states.push({ device_feature_external_id: ids.feature(key), text: String(value || none) });

    const next = nextLaunch(launches, scope, now);
    string('next_name', next && shortName(next));
    string('next_date', next && formatNet(next, language, timeZone));
    string('next_status', next && status[next.status]);
    string('next_provider', next?.provider);
    string('next_rocket', next?.rocket);
    string('next_location', next?.location);
    if (next) {
      number('next_countdown', Math.min(8784, hoursUntil(next, now)));
    }
    number(
      'launches_7_days',
      Math.min(
        100,
        upcomingOf(launches, scope, now).filter(
          (launch) => isDated(launch) && launch.net < now + WEEK,
        ).length,
      ),
    );
    number('webcast_live', Number(Boolean(next?.webcastLive)));
    number('launch_today', Number(Boolean(next && isOnDay(next, today, localDate, timeZone))));
    const last = lastLaunch(launches, scope);
    if (last) {
      string('last_launch', `${shortName(last)} · ${formatNet(last, language, timeZone)}`);
      string('last_result', status[last.status]);
    }
  }
  return states;
}
