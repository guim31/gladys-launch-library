// -----------------------------------------------------------------------------
// Scene actions (manifest `scene_actions`): sentences ready to send in a
// message or to say aloud ({{<column>.<row>.sentence}}), in the language of
// the configuration (a scene action does not get the user's language), and a
// few values for conditions. The optional "device" field picks a filter.
// -----------------------------------------------------------------------------

import { deviceIds } from './device.js';
import { SENTENCES, STATUS_NAMES } from './i18n.js';
import { hoursUntil, scopes, shortName, upcomingOf } from './launches.js';
import { formatNet } from './time.js';

export const DEFAULT_COUNT = 3;
export const MAX_COUNT = 5;

/** The scope of a device external id; every launch when none or unknown. */
export function scopeOf(service, externalId) {
  const all = scopes(service.config);
  return all.find((scope) => deviceIds(service.gladys, scope.key).device === externalId) ?? all[0];
}

/** The words of a launch for the sentences. */
export function launchWords(launch, language, timeZone) {
  return {
    name: shortName(launch),
    provider: launch.provider,
    location: launch.location,
    date: formatNet(launch, language, timeZone),
    status: STATUS_NAMES[language][launch.status],
  };
}

function clampCount(value) {
  const count = Math.trunc(Number(value ?? DEFAULT_COUNT));
  return Number.isFinite(count) && count > 0 ? Math.min(count, MAX_COUNT) : DEFAULT_COUNT;
}

/** The next launches of a scope as words. */
export function upcomingSummary(service, scope, count, language = service.config.language) {
  const sentences = SENTENCES[language];
  const launches = service.launches();
  if (!launches) {
    return { sentence: sentences.noData, list: [] };
  }
  const list = upcomingOf(launches, scope, service.now()).slice(0, count);
  return { sentence: list.length === 0 ? sentences.none : null, list };
}

export const SCENE_ACTIONS = {
  read_next_launch: async (service, { fields = {} }) => {
    const language = service.config.language;
    const summary = upcomingSummary(service, scopeOf(service, fields.device), 1);
    const [launch] = summary.list;
    if (!launch) {
      return {
        sentence: summary.sentence,
        launch_name: '',
        provider: '',
        location: '',
        launch_date: '',
        hours_until: -1,
        status: '',
      };
    }
    const words = launchWords(launch, language, service.timeZone);
    return {
      sentence: SENTENCES[language].next(words),
      launch_name: words.name,
      provider: launch.provider,
      location: launch.location,
      launch_date: words.date,
      hours_until: hoursUntil(launch, service.now()),
      status: launch.status,
    };
  },
  read_upcoming_launches: async (service, { fields = {} }) => {
    const language = service.config.language;
    const summary = upcomingSummary(
      service,
      scopeOf(service, fields.device),
      clampCount(fields.count),
    );
    return {
      sentence:
        summary.sentence ??
        SENTENCES[language].upcoming(
          summary.list.map((launch) => launchWords(launch, language, service.timeZone)),
        ),
      count: summary.list.length,
    };
  },
};
