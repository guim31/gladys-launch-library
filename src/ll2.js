// -----------------------------------------------------------------------------
// Launch Library 2 (https://thespacedevs.com/llapi), the open database of The
// Space Devs: no account, no key, but 15 requests per hour for anonymous use.
// The client keeps a margin under that limit on its own (it refuses a request
// beyond MAX_PER_HOUR in the last hour) and honours the "Expected available
// in N seconds" of a 429. The service (src/service.js) decides what to read.
//
// The parser turns an answer into small plain launches: the rest of the
// integration never reads the API shapes.
// -----------------------------------------------------------------------------

export const API_BASE = 'https://ll.thespacedevs.com/2.3.0';

// The two lists the integration reads. "upcoming" also holds the launches of
// the last 24 hours, so a liftoff and its outcome are seen there.
export const PATHS = {
  upcoming: '/launches/upcoming/?limit=40&mode=normal',
  previous: '/launches/previous/?limit=10&mode=normal',
};

export const MAX_PER_HOUR = 12;
const HOUR = 3_600_000;
const REQUEST_TIMEOUT_MS = 20_000;
const DEFAULT_RETRY_MS = 15 * 60_000;
const USER_AGENT = 'gladys-launch-library (+https://github.com/guim31/gladys-launch-library)';

export class LL2Error extends Error {
  /**
   * @param {string} message
   * @param {object} [details] { status, retryAt, limited }
   */
  constructor(message, { status, retryAt, limited = false } = {}) {
    super(message);
    this.name = 'LL2Error';
    this.status = status;
    this.retryAt = retryAt;
    // True when the request was not sent or refused for the rate limit.
    this.limited = limited;
  }
}

/** The wait a 429 announces: header Retry-After, or "Expected available in 845 seconds." */
export function retryDelay(headers, body) {
  const header = Number(headers?.get?.('retry-after'));
  if (Number.isFinite(header) && header > 0) {
    return header * 1000;
  }
  const match = /available in (\d+) second/i.exec(String(body?.detail ?? ''));
  return match ? Number(match[1]) * 1000 : DEFAULT_RETRY_MS;
}

/**
 * @param {object} [options]
 * @param {Function} [options.fetch] the global fetch by default (tests inject one)
 * @param {Function} [options.now] the clock (tests)
 * @param {string} [options.base] another instance (lldev.thespacedevs.com for tests by hand)
 */
export function createLL2({
  fetch = globalThis.fetch,
  now = Date.now,
  base = process.env.LL2_API_BASE || API_BASE,
} = {}) {
  const sent = [];
  let blockedUntil = 0;
  return {
    /** Requests still allowed in the current hour. */
    remaining() {
      const from = now() - HOUR;
      while (sent.length > 0 && sent[0] <= from) {
        sent.shift();
      }
      return now() < blockedUntil ? 0 : MAX_PER_HOUR - sent.length;
    },
    blockedUntil: () => blockedUntil,
    /** GET a path of the API (one of PATHS), the parsed JSON. */
    async get(path) {
      if (this.remaining() <= 0) {
        const retryAt = Math.max(blockedUntil, (sent[0] ?? now()) + HOUR);
        throw new LL2Error('Launch Library 2 request limit reached, waiting', {
          retryAt,
          limited: true,
        });
      }
      sent.push(now());
      let response;
      try {
        response = await fetch(`${base}${path}`, {
          headers: { accept: 'application/json', 'user-agent': USER_AGENT },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      } catch (err) {
        throw new LL2Error(`Launch Library 2 unreachable: ${err.message}`);
      }
      if (response.status === 429) {
        const body = await response.json().catch(() => null);
        blockedUntil = now() + retryDelay(response.headers, body);
        throw new LL2Error('Launch Library 2 answered HTTP 429 (rate limited)', {
          status: 429,
          retryAt: blockedUntil,
          limited: true,
        });
      }
      if (!response.ok) {
        throw new LL2Error(`Launch Library 2 answered HTTP ${response.status}`, {
          status: response.status,
        });
      }
      try {
        return await response.json();
      } catch {
        throw new LL2Error('Launch Library 2 sent something that is not JSON');
      }
    },
  };
}

// -----------------------------------------------------------------------------
// Parser
// -----------------------------------------------------------------------------

// LL2 status id → status key of the integration (frozen: scene filters and
// variables carry it).
export const STATUS_BY_ID = {
  1: 'go',
  2: 'tbd',
  3: 'success',
  4: 'failure',
  5: 'hold',
  6: 'in_flight',
  7: 'partial_failure',
  8: 'tbc',
  9: 'deployed',
};

export const STATUSES = [
  'go',
  'tbc',
  'tbd',
  'hold',
  'in_flight',
  'deployed',
  'success',
  'failure',
  'partial_failure',
];

const text = (value) => (typeof value === 'string' ? value.replace(/\r/g, '').trim() : '');
const instant = (value) => {
  const ms = Date.parse(value ?? '');
  return Number.isFinite(ms) ? ms : null;
};

/** One launch of an answer, null when it lacks an id or a date. */
export function parseLaunch(raw) {
  const net = instant(raw?.net);
  if (!raw?.id || net === null) {
    return null;
  }
  const config = raw.rocket?.configuration ?? {};
  const pad = raw.pad ?? {};
  return {
    id: String(raw.id),
    name: text(raw.name),
    mission: text(raw.mission?.name),
    description: text(raw.mission?.description),
    orbit: text(raw.mission?.orbit?.name),
    rocket: text(config.full_name) || text(config.name),
    families: (config.families ?? []).map((family) => text(family?.name)).filter(Boolean),
    provider: text(raw.launch_service_provider?.name),
    providerAbbrev: text(raw.launch_service_provider?.abbrev),
    pad: text(pad.name),
    location: text(pad.location?.name),
    country: text(pad.country?.alpha_2_code) || text(pad.location?.country?.alpha_2_code),
    countryName: text(pad.country?.name),
    net,
    windowStart: instant(raw.window_start),
    windowEnd: instant(raw.window_end),
    // SEC, MIN, HR, DAY, W, M, Q1…Q4, H1, H2, Y… (absent: treat as a month)
    precision: text(raw.net_precision?.abbrev) || 'M',
    status: STATUS_BY_ID[raw.status?.id] ?? 'tbd',
    failReason: text(raw.failreason),
    webcastLive: raw.webcast_live === true,
    updated: instant(raw.last_updated) ?? 0,
  };
}

/** A list answer: its launches sorted by date. */
export function parseLaunches(json) {
  if (!json || !Array.isArray(json.results)) {
    throw new LL2Error('Unexpected Launch Library 2 answer: no results');
  }
  return json.results
    .map(parseLaunch)
    .filter(Boolean)
    .sort((a, b) => a.net - b.net);
}
