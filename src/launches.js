// -----------------------------------------------------------------------------
// What the integration knows about launches, whatever reads it (device,
// widget, scenes): the scopes (every launch, or one filter of the user), the
// next launch of a scope, and the vocabulary of statuses and precisions.
// -----------------------------------------------------------------------------

import { foldName, parseFilters } from './config.js';

const HOUR = 3_600_000;

// Liftoff happened: the outcome may still be unknown (in flight, deployed).
export const LAUNCHED = new Set(['in_flight', 'deployed', 'success', 'failure', 'partial_failure']);
export const RESULTS = ['success', 'failure', 'partial_failure'];

// Precisions that give a time of day; "launch soon" fires only on the first two.
export const TIMED = new Set(['SEC', 'MIN', 'HR']);
export const EXACT = new Set(['SEC', 'MIN']);
const DAILY = new Set(['SEC', 'MIN', 'HR', 'DAY', 'AM', 'PM']);

// A launch still "Go" this long after its date is a stale record, not the next one.
const STALE_AFTER = 6 * HOUR;

/**
 * Names people use that the database does not: a launch matches the alias
 * when one of its fields contains the folded value.
 */
const ALIASES = {
  kourou: ['guianaspacecentre', 'frenchguiana'],
  guyane: ['frenchguiana'],
  floride: ['flusa'],
  florida: ['flusa'],
  californie: ['causa'],
  california: ['causa'],
  baikonour: ['baikonur'],
  chine: ['china'],
  inde: ['india'],
  japon: ['japan'],
  europe: ['arianespace', 'europeanspaceagency', 'avio'],
};

function fields(launch) {
  return [
    launch.name,
    launch.mission,
    launch.rocket,
    ...launch.families,
    launch.provider,
    launch.pad,
    launch.location,
    launch.countryName,
  ];
}

/** The whole words of a launch ("H3-24" gives "h3" and "24"), folded. */
function words(launch) {
  return fields(launch)
    .flatMap((field) => field.split(/[^\p{L}\p{N}]+/u))
    .map(foldName)
    .filter(Boolean);
}

/** Does a launch match a filter typed by the user? */
export function matches(launch, slug) {
  // Short codes match whole: "US", "GF", "H3", "ULA", "SpX".
  if (slug.length <= 3) {
    return (
      slug === foldName(launch.country) ||
      slug === foldName(launch.providerAbbrev) ||
      words(launch).includes(slug)
    );
  }
  const folded = fields(launch).map(foldName);
  const wanted = [slug, ...(ALIASES[slug] ?? [])];
  return (
    wanted.some((term) => folded.some((field) => field.includes(term))) ||
    slug === foldName(launch.providerAbbrev)
  );
}

/**
 * The scopes of a configuration: "every launch" first, then one per filter.
 * `key` is the stable part of the device id.
 */
export function scopes(config) {
  return [
    { key: 'next', label: null, match: () => true },
    ...parseFilters(config.filters).map(({ label, slug }) => ({
      key: `filter-${slug}`,
      label,
      match: (launch) => matches(launch, slug),
    })),
  ];
}

/** Launches still ahead (or about to go) of a scope, in date order. */
export function upcomingOf(launches, scope, now) {
  return launches.filter(
    (launch) =>
      scope.match(launch) && !LAUNCHED.has(launch.status) && launch.net >= now - STALE_AFTER,
  );
}

/**
 * The next launch: the first one whose day is known. Month and quarter
 * estimates are dated at the end of their period and would come first with
 * a misleading countdown; one of them is the next launch only when nothing
 * else is planned.
 */
export function nextLaunch(launches, scope, now) {
  const upcoming = upcomingOf(launches, scope, now);
  return upcoming.find(isDated) ?? upcoming[0] ?? null;
}

/** The most recent launch that left the ground, in a scope. */
export function lastLaunch(launches, scope) {
  let last = null;
  for (const launch of launches) {
    if (scope.match(launch) && LAUNCHED.has(launch.status) && (!last || launch.net > last.net)) {
      last = launch;
    }
  }
  return last;
}

/** Is the launch on this local calendar day (only when its day is known)? */
export function isOnDay(launch, today, localDate, timeZone) {
  if (!DAILY.has(launch.precision)) {
    return false;
  }
  // A day-only date is a UTC calendar day (00:00 UTC), a timed one a local instant.
  return localDate(launch.net, TIMED.has(launch.precision) ? timeZone : 'UTC') === today;
}

/** Is the day of the launch known (not a month, quarter or year estimate)? */
export function isDated(launch) {
  return DAILY.has(launch.precision);
}

/** Whole hours before the date (No Earlier Than), 0 once it is reached. */
export function hoursUntil(launch, now) {
  return Math.max(0, Math.floor((launch.net - now) / HOUR));
}

/** "Falcon 9 Block 5 | Starlink Group 15-15" is the LL2 name: rocket | mission. */
export function shortName(launch) {
  return launch.name || [launch.rocket, launch.mission].filter(Boolean).join(' | ');
}

/**
 * Merges the two lists by id: the record updated last wins (a launch of the
 * last 24 hours is in both).
 */
export function mergeLaunches(...lists) {
  const byId = new Map();
  for (const launch of lists.flat()) {
    const held = byId.get(launch.id);
    if (!held || launch.updated >= held.updated) {
      byId.set(launch.id, launch);
    }
  }
  return [...byId.values()].sort((a, b) => a.net - b.net);
}
