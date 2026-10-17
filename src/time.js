// -----------------------------------------------------------------------------
// Instants shown in the time zone of Gladys (TZ, injected by the supervisor).
// The API gives every launch date in UTC, with its precision; the device, the
// widget and the scene texts show them as the user lives them: "Sun 25 Oct ·
// 22:00", "Sun 25 Oct", "October 2026" or "Q4 2026".
// -----------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The time zone of Gladys: TZ, set by the supervisor. Checked here rather
 * than trusted to the system (the Alpine image has no tzdata; Node's ICU
 * carries its own zones): an unusable value falls back to the process one.
 */
export function processTimeZone(env = process.env.TZ) {
  if (env) {
    try {
      return new Intl.DateTimeFormat('en', { timeZone: env }).resolvedOptions().timeZone;
    } catch {
      // Not an IANA name (':/etc/localtime'…): fall through.
    }
  }
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

const cache = new Map();

function formatter(key, make) {
  let value = cache.get(key);
  if (!value) {
    value = make();
    cache.set(key, value);
  }
  return value;
}

/** The calendar date ('YYYY-MM-DD') of an instant in a time zone. */
export function localDate(ms, timeZone) {
  return formatter(
    `date:${timeZone}`,
    () =>
      new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }),
  ).format(new Date(ms));
}

/** Whole calendar days from one date to another ('YYYY-MM-DD'). */
export function daysBetween(from, to) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/** "22:00" */
export function formatTime(ms, language, timeZone) {
  return formatter(
    `time:${language}:${timeZone}`,
    () =>
      new Intl.DateTimeFormat(language, {
        timeZone,
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }),
  ).format(new Date(ms));
}

/** "dim. 25 oct." ('short') or "dimanche 25 octobre" ('long'). */
export function formatDay(ms, language, timeZone, style = 'short') {
  return formatter(
    `day:${style}:${language}:${timeZone}`,
    () =>
      new Intl.DateTimeFormat(language, {
        timeZone,
        weekday: style,
        day: 'numeric',
        month: style,
      }),
  ).format(new Date(ms));
}

const QUARTER = { en: 'Q', fr: 'T', de: 'Q', es: 'T' };
const HALF = { en: 'H', fr: 'S', de: 'H', es: 'S' };

/** "octobre 2026", in UTC: a launch "NET October" is dated at 00:00 UTC (the last day, seen in 2026). */
function formatMonth(ms, language) {
  return formatter(
    `month:${language}`,
    () => new Intl.DateTimeFormat(language, { timeZone: 'UTC', month: 'long', year: 'numeric' }),
  ).format(new Date(ms));
}

/**
 * A launch date as precise as Launch Library 2 knows it: "lun. 19 oct. · 12:30"
 * (second, minute), "lun. 19 oct. · ~12:30" (hour), "lun. 19 oct." (day),
 * "octobre 2026" (month), "T4 2026" (quarter), "S2 2026" (half), "2026".
 */
export function formatNet({ net, precision }, language, timeZone) {
  const day = formatDay(net, language, timeZone, 'short');
  const year = new Date(net).getUTCFullYear();
  if (precision === 'SEC' || precision === 'MIN') {
    return `${day} · ${formatTime(net, language, timeZone)}`;
  }
  if (precision === 'HR') {
    return `${day} · ~${formatTime(net, language, timeZone)}`;
  }
  // A day-only date is 00:00 UTC: shown in the zone of Gladys it would be
  // the day before west of Greenwich.
  const utcDay = formatDay(net, language, 'UTC', 'short');
  if (['DAY', 'AM', 'PM'].includes(precision)) {
    return utcDay;
  }
  if (precision === 'W') {
    return `~${utcDay}`;
  }
  if (/^Q[1-4]$/.test(precision)) {
    return `${QUARTER[language]}${precision[1]} ${year}`;
  }
  if (/^H[12]$/.test(precision)) {
    return `${HALF[language]}${precision[1]} ${year}`;
  }
  if (precision === 'M') {
    return formatMonth(net, language);
  }
  return String(year);
}
