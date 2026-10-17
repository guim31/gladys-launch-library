// -----------------------------------------------------------------------------
// Dashboard widget "Rocket launches" (key "upcoming_launches"): the countdown
// to the next launch and the five next ones, every launch or those of one
// filter (setting "device"). Produced from the cached launches, not from the
// devices: it works before they are added. Localized from the language of
// the person looking at it.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { LANGUAGES } from './config.js';
import { STATUS_NAMES, WIDGET_TEXT } from './i18n.js';
import { shortName, upcomingOf } from './launches.js';
import { scopeOf } from './scenes.js';
import { WIDGET_KEY } from './service.js';
import { formatNet } from './time.js';

export const TOP = 5;
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

export const STATUS_COLORS = {
  go: WIDGET_COLORS.SUCCESS,
  tbc: WIDGET_COLORS.INFO,
  tbd: WIDGET_COLORS.NEUTRAL,
  hold: WIDGET_COLORS.WARNING,
};

export function countdown(launch, now, text) {
  const left = launch.net - now;
  if (left <= 0) {
    return text.now;
  }
  if (left >= DAY) {
    return text.daysHours(Math.floor(left / DAY), Math.floor((left % DAY) / HOUR));
  }
  return text.hoursMinutes(Math.floor(left / HOUR), Math.floor((left % HOUR) / MINUTE));
}

/** Cut at `max` characters, with an ellipsis. */
export function clip(text, max) {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function details(launch) {
  return [
    launch.description,
    [launch.rocket, launch.pad, launch.location].filter(Boolean).join(' · '),
  ]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 2000);
}

/**
 * The widget content.
 * @param {object} service the LaunchService
 * @param {{ settings?: object, language?: string }} request
 */
export function buildContent(service, { settings = {}, language } = {}) {
  const lang = LANGUAGES.includes(language) ? language : service.config.language;
  const text = WIDGET_TEXT[lang];
  const now = service.now();
  const scope = scopeOf(service, settings.device);
  const title = scope.label ? `${text.title} · ${scope.label}` : text.title;
  const components = [{ type: 'text', variant: 'heading', text: clip(title, 60) }];
  const launches = service.launches();
  if (!launches) {
    components.push({ type: 'text', variant: 'body', text: text.noData });
    return { ttl_seconds: 300, components };
  }
  const upcoming = upcomingOf(launches, scope, now);
  if (upcoming.length === 0) {
    components.push({ type: 'text', variant: 'body', text: text.none });
    return { ttl_seconds: 900, components };
  }
  const [next] = upcoming;
  components.push({
    type: 'value',
    label: text.nextIn,
    value: countdown(next, now, text),
    icon: 'clock',
    color: STATUS_COLORS[next.status] ?? WIDGET_COLORS.NEUTRAL,
  });
  components.push({
    type: 'value',
    label: text.within7,
    value: upcoming.filter((launch) => launch.net < now + WEEK).length,
    icon: 'calendar',
  });
  components.push({
    type: 'card-list',
    display: 'list',
    items: upcoming.slice(0, TOP).map((launch) => ({
      title: clip(shortName(launch), 60),
      subtitle: [formatNet(launch, lang, service.timeZone), launch.provider]
        .filter(Boolean)
        .join(' · ')
        .slice(0, 60),
      badge: {
        text: STATUS_NAMES[lang][launch.status],
        color: STATUS_COLORS[launch.status] ?? WIDGET_COLORS.NEUTRAL,
      },
      ...(details(launch) ? { description: details(launch) } : {}),
    })),
  });
  // The clock asks for a refresh when the next launch or its countdown changes.
  return { ttl_seconds: 300, components };
}

export const WIDGETS = {
  [WIDGET_KEY]: {
    get: (service, request) => buildContent(service, request),
  },
};
