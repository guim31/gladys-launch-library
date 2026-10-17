// -----------------------------------------------------------------------------
// The heart of the integration: the launches read from Launch Library 2 and
// kept in a cache in /data, and the clock that turns them into device states
// and scene events.
//
// The clock ticks every minute (Gladys never polls the devices, should_poll
// is false):
// - it reads the upcoming launches every 30 minutes, and every 10 minutes from
//   an hour before a launch until its outcome is known; the last launches
//   every 2 hours. That is 2 to 7 requests an hour, under the 15 allowed;
// - after a reading, it compares each launch with what it knew: liftoff,
//   outcome and postponement fire their scene triggers, once;
// - it fires "launch soon" at each lead time the scene filter offers, from
//   the date of the launch (only when it is known to the minute);
// - it publishes the states that changed, and every state twice a day
//   (Gladys flags a value older than 48 hours as "no recent value").
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { buildDevices, buildStates, deviceIds } from './device.js';
import { createFailureLog } from './failures.js';
import { PROBLEM_TEXT, SENTENCES, STATUS_NAMES, inEveryLanguage } from './i18n.js';
import {
  EXACT,
  LAUNCHED,
  RESULTS,
  TIMED,
  mergeLaunches,
  nextLaunch,
  scopes,
  shortName,
} from './launches.js';
import { PATHS, parseLaunches } from './ll2.js';
import { formatNet, processTimeZone } from './time.js';

const logger = createLogger({ name: 'launches' });

export const WIDGET_KEY = 'upcoming_launches';

// Trigger keys are forever: scenes store them.
export const TRIGGERS = {
  LAUNCH_SOON: 'launch_soon',
  LIFTOFF: 'liftoff',
  LAUNCH_RESULT: 'launch_result',
  LAUNCH_POSTPONED: 'launch_postponed',
};

// The lead times the "launch soon" filter offers, in minutes.
export const LEAD_MINUTES = [5, 15, 30, 60, 120, 1440];
export const POSTPONE_REASONS = ['delayed', 'hold'];

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const EVERY = { upcoming: 30 * MINUTE, previous: 2 * HOUR };
const BURST_EVERY = 10 * MINUTE;
const BURST_BEFORE = HOUR;
const BURST_AFTER = 30 * MINUTE;
// A launch in flight is watched this long after its date for its outcome.
const OUTCOME_WATCH = 3 * HOUR;
const RETRY_AFTER = 10 * MINUTE;
const HEARTBEAT = 12 * HOUR;
// After a restart, the triggers of the last minutes are still fired.
const CATCH_UP = 10 * MINUTE;
// A postponement counts when a launch due within 48 hours moves 15 minutes or more.
const POSTPONE_HORIZON = 48 * HOUR;
const POSTPONE_MIN = 15 * MINUTE;
// No "liftoff" nor outcome for a launch seen too late (the integration was stopped).
const LIFTOFF_WITHIN = 3 * HOUR;
const RESULT_WITHIN = 48 * HOUR;
const FORGET_AFTER = 3 * 24 * HOUR;

const CACHE_FILE = 'cache.json';
const TRIGGERS_FILE = 'triggers.json';

export class LaunchService {
  /**
   * @param {object} options
   * @param {object} options.gladys the SDK client
   * @param {object} options.store JSON files in /data (src/store.js)
   * @param {object} options.api the Launch Library 2 client (src/ll2.js)
   * @param {Function} [options.now] the clock (tests)
   * @param {string} [options.timeZone] Gladys' time zone (default: TZ)
   * @param {boolean} [options.timers] false in the tests: they call tick()
   */
  constructor({ gladys, store, api, now = Date.now, timeZone, timers = true }) {
    this.gladys = gladys;
    this.store = store;
    this.api = api;
    this.now = now;
    this.timeZone = timeZone ?? processTimeZone();
    this.timers = timers;
    this.config = null;
    this.data = { upcoming: null, previous: null };
    this.fetchedAt = {};
    this.apiError = null;
    this.rateLimited = false;
    this.retryAt = 0;
    this.known = null;
    this.lastCheck = 0;
    this.lastForce = 0;
    // undefined: nothing reported yet (null is "no problem").
    this.statusKey = undefined;
    this.widgetKey = null;
    this.timer = null;
    this.queue = Promise.resolve();
    // A failure repeated every minute is logged once (src/failures.js).
    this.failures = createFailureLog(logger);
  }

  // One operation at a time: a tick never interleaves with a reconfiguration.
  serial(fn) {
    const run = this.queue.then(fn);
    this.queue = run.catch(() => {});
    return run;
  }

  start(config) {
    return this.serial(async () => {
      this.config = config;
      this.loadCache();
      const saved = this.store.load(TRIGGERS_FILE);
      const now = this.now();
      // A fresh install fires nothing for what happened before it.
      this.known = saved?.known ?? null;
      this.lastCheck = saved ? Math.max(saved.lastCheck ?? 0, now - CATCH_UP) : now;
      if (this.known === null && this.launches()) {
        this.remember(this.launches(), now);
      }
      // The clock runs whatever happens below: a failure at start-up must not
      // stop the readings and the triggers until the next restart.
      this.schedule();
      await this.refresh();
      await this.publishDevices();
      await this.publishStates({ force: true });
      await this.updateStatus();
      this.refreshWidget();
      await this.fireSoonTriggers();
    });
  }

  /** The configuration changed (language, filters): maybe new devices. */
  reconfigure(config) {
    return this.serial(async () => {
      this.config = config;
      await this.publishDevices();
      await this.publishStates({ force: true });
      await this.updateStatus({ force: true });
      this.refreshWidget();
    });
  }

  /** Gladys came back (restart): it may have lost what was sent meanwhile. */
  resync(config) {
    return this.reconfigure(config);
  }

  /** The user added a device: its states were dropped until now. */
  deviceCreated() {
    return this.serial(async () => {
      await this.publishStates({ force: true });
      this.refreshWidget();
    });
  }

  /** "Check" on the Configuration screen: both lists read again now. */
  check() {
    return this.serial(async () => {
      await this.refresh({ force: true });
      await this.publishStates();
      await this.updateStatus();
      this.refreshWidget();
    });
  }

  stop() {
    clearTimeout(this.timer);
    this.timer = null;
    return this.queue;
  }

  schedule() {
    if (!this.timers) {
      return;
    }
    clearTimeout(this.timer);
    // Just after the next minute: a launch at :00 is seen at :00.
    const delay = MINUTE - (this.now() % MINUTE) + 500;
    this.timer = setTimeout(() => {
      this.tick()
        .then(() => this.failures.succeeded('tick', 'The clock works again'))
        .catch((err) => this.failures.failed('tick', 'Clock tick failed', err))
        .finally(() => this.schedule());
    }, delay);
    this.timer.unref?.();
  }

  /** One step of the clock. */
  tick() {
    return this.serial(async () => {
      if (await this.refresh()) {
        await this.updateStatus();
      }
      await this.publishStates({ force: this.now() - this.lastForce >= HEARTBEAT });
      await this.fireSoonTriggers();
      // The countdown of the widget follows the clock.
      if (this.widgetSignature() !== this.widgetKey) {
        this.refreshWidget();
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Launch Library 2 and its cache
  // ---------------------------------------------------------------------------

  /** Every launch known, merged and sorted; null before the first reading. */
  launches() {
    if (!this.data.upcoming && !this.data.previous) {
      return null;
    }
    return mergeLaunches(this.data.upcoming ?? [], this.data.previous ?? []);
  }

  loadCache() {
    const cache = this.store.load(CACHE_FILE);
    if (cache?.version !== 1) {
      return;
    }
    for (const key of Object.keys(PATHS)) {
      if (Array.isArray(cache.lists?.[key]?.launches)) {
        this.data[key] = cache.lists[key].launches;
        this.fetchedAt[key] = cache.lists[key].fetched_at;
      }
    }
  }

  saveCache() {
    const lists = {};
    for (const key of Object.keys(PATHS)) {
      if (this.fetchedAt[key]) {
        lists[key] = { fetched_at: this.fetchedAt[key], launches: this.data[key] };
      }
    }
    this.store.save(CACHE_FILE, { version: 1, lists });
  }

  /** Is a launch close enough to watch every 10 minutes? */
  inBurst(now) {
    return (this.data.upcoming ?? []).some((launch) => {
      if (RESULTS.includes(launch.status)) {
        return false;
      }
      if (LAUNCHED.has(launch.status)) {
        return now < launch.net + OUTCOME_WATCH;
      }
      return (
        TIMED.has(launch.precision) &&
        now >= launch.net - BURST_BEFORE &&
        now <= launch.net + BURST_AFTER
      );
    });
  }

  isDue(key, now) {
    const fetched = this.fetchedAt[key];
    if (!fetched) {
      return true;
    }
    const age = now - fetched;
    return age >= EVERY[key] || (key === 'upcoming' && age >= BURST_EVERY && this.inBurst(now));
  }

  /**
   * Reads the lists that are due (both with `force`).
   * @returns {Promise<boolean>} true when something was read or failed: the
   *   connection status may have changed
   */
  async refresh({ force = false } = {}) {
    const now = this.now();
    if (!force && now < this.retryAt) {
      return false;
    }
    const due = Object.keys(PATHS).filter((key) => force || this.isDue(key, now));
    if (due.length === 0) {
      return false;
    }
    let read = 0;
    try {
      for (const key of due) {
        this.data[key] = parseLaunches(await this.api.get(PATHS[key]));
        this.fetchedAt[key] = now;
        read += 1;
      }
      this.apiError = null;
      this.rateLimited = false;
      this.retryAt = 0;
      this.failures.succeeded('api', 'Launch Library 2 read again');
    } catch (err) {
      this.retryAt = err.retryAt ?? now + RETRY_AFTER;
      if (err.limited && !err.status) {
        // Our own margin under the hourly limit: not a problem, just later.
        logger.debug(`Reading postponed: ${err.message}`);
      } else {
        this.apiError = err.message;
        this.rateLimited = err.status === 429;
        this.failures.failed('api', `Could not read Launch Library 2: ${err.message}`);
      }
    }
    if (read > 0) {
      this.saveCache();
      logger.debug(`Read ${due.slice(0, read).join(', ')} from Launch Library 2`);
      await this.detectChanges(now);
    }
    return true;
  }

  // ---------------------------------------------------------------------------
  // Scene triggers
  // ---------------------------------------------------------------------------

  /** Remembers the status and date of every launch, for the next comparison. */
  remember(launches, now) {
    const known = {};
    for (const launch of launches) {
      known[launch.id] = { status: launch.status, net: launch.net };
    }
    // A launch that left both lists is kept a few days (it may come back).
    for (const [id, entry] of Object.entries(this.known ?? {})) {
      if (!known[id] && entry.net > now - FORGET_AFTER) {
        known[id] = entry;
      }
    }
    this.known = known;
    this.saveTriggers();
  }

  /** Liftoff, outcome, postponement: what changed since the last reading. */
  async detectChanges(now) {
    const launches = this.launches();
    if (this.known === null) {
      this.remember(launches, now);
      return;
    }
    const events = [];
    for (const launch of launches) {
      const before = this.known[launch.id];
      if (!before) {
        continue;
      }
      if (
        !LAUNCHED.has(before.status) &&
        LAUNCHED.has(launch.status) &&
        now - launch.net < LIFTOFF_WITHIN
      ) {
        events.push([TRIGGERS.LIFTOFF, launch, {}]);
      }
      if (
        !RESULTS.includes(before.status) &&
        RESULTS.includes(launch.status) &&
        now - launch.net < RESULT_WITHIN
      ) {
        events.push([TRIGGERS.LAUNCH_RESULT, launch, {}]);
      }
      if (LAUNCHED.has(launch.status)) {
        continue;
      }
      if (launch.status === 'hold' && before.status !== 'hold') {
        events.push([TRIGGERS.LAUNCH_POSTPONED, launch, { reason: 'hold', before }]);
      } else if (
        launch.net - before.net >= POSTPONE_MIN &&
        before.net > now - BURST_AFTER &&
        before.net < now + POSTPONE_HORIZON
      ) {
        events.push([TRIGGERS.LAUNCH_POSTPONED, launch, { reason: 'delayed', before }]);
      }
    }
    // Remembered first: a refused event is never fired twice.
    this.remember(launches, now);
    for (const [key, launch, extra] of events) {
      await this.fireForScopes(key, launch, this.eventData(key, launch, extra));
    }
  }

  /** The variables of an event, in the language of the configuration. */
  eventData(key, launch, { lead, reason, before } = {}) {
    const language = this.config.language;
    const statusNames = STATUS_NAMES[language];
    const date = formatNet(launch, language, this.timeZone);
    const words = {
      name: shortName(launch),
      provider: launch.provider,
      location: launch.location,
      date,
      status: statusNames[launch.status],
    };
    const sentences = SENTENCES[language];
    const data = {
      launch_name: words.name,
      mission: launch.mission,
      rocket: launch.rocket,
      provider: launch.provider,
      location: launch.location,
      launch_date: date,
      status: launch.status,
      status_name: words.status,
      webcast_live: launch.webcastLive,
    };
    if (key === TRIGGERS.LAUNCH_SOON) {
      return { ...data, minutes_before: lead, sentence: sentences.soon(lead, words) };
    }
    if (key === TRIGGERS.LIFTOFF) {
      return { ...data, sentence: sentences.liftoff(words) };
    }
    if (key === TRIGGERS.LAUNCH_RESULT) {
      return {
        ...data,
        result: launch.status,
        result_name: words.status,
        fail_reason: launch.failReason,
        sentence: sentences[launch.status](words),
      };
    }
    return {
      ...data,
      reason,
      previous_date: formatNet(
        { net: before.net, precision: launch.precision },
        language,
        this.timeZone,
      ),
      delay_minutes: Math.max(0, Math.round((launch.net - before.net) / MINUTE)),
      sentence: sentences[reason](words),
    };
  }

  /**
   * One event per device whose scope holds the launch: a scene picks its
   * device (the filter is required), so a launch never runs a scene twice.
   * @returns {Promise<boolean>} false when Gladys refused an event
   */
  async fireForScopes(key, launch, data) {
    let ok = true;
    for (const scope of scopes(this.config)) {
      if (scope.match(launch)) {
        const device = deviceIds(this.gladys, scope.key).device;
        ok = (await this.fireEvent(key, { device, ...data })) && ok;
      }
    }
    return ok;
  }

  async fireEvent(key, data) {
    try {
      await this.gladys.publishSceneEvent(key, data);
      this.failures.succeeded('scene-event', 'Scene triggers fired again');
      return true;
    } catch (err) {
      this.failures.failed('scene-event', `Could not fire ${key}: ${err.message}`);
      return false;
    }
  }

  /** "Launch soon": every (launch, lead time) reached since the last check. */
  async fireSoonTriggers() {
    const now = this.now();
    const from = this.lastCheck;
    if (now <= from) {
      return; // the clock stepped back: this interval was already checked
    }
    this.lastCheck = now;
    const events = [];
    for (const launch of this.data.upcoming ?? []) {
      if (!EXACT.has(launch.precision) || !['go', 'tbc'].includes(launch.status)) {
        continue;
      }
      for (const lead of LEAD_MINUTES) {
        const at = launch.net - lead * MINUTE;
        if (at > from && at <= now) {
          events.push({ at, launch, lead });
        }
      }
    }
    events.sort((a, b) => a.at - b.at);
    for (const { at, launch, lead } of events) {
      const data = this.eventData(TRIGGERS.LAUNCH_SOON, launch, { lead });
      if (!(await this.fireForScopes(TRIGGERS.LAUNCH_SOON, launch, data))) {
        // Gladys is unavailable: try again from this event at the next tick,
        // for 10 minutes at most.
        this.lastCheck = Math.max(at - 1, now - CATCH_UP);
        break;
      }
    }
    this.saveTriggers();
  }

  saveTriggers() {
    this.store.save(TRIGGERS_FILE, { lastCheck: this.lastCheck, known: this.known });
  }

  // ---------------------------------------------------------------------------
  // Gladys side
  // ---------------------------------------------------------------------------

  async publishDevices() {
    try {
      await this.gladys.publishDiscoveredDevices(buildDevices(this.gladys, this.config));
      this.failures.succeeded('device', 'Devices published again');
    } catch (err) {
      this.failures.failed('device', `Could not publish the devices: ${err.message}`);
    }
  }

  /**
   * Publishes the states that changed, or all of them (`force`). A failure is
   * logged: the next publication sends again what Gladys did not accept.
   */
  async publishStates({ force = false } = {}) {
    if (force) {
      this.gladys.forgetPublishedStates();
      this.lastForce = this.now();
    }
    const states = buildStates(this.gladys, this.config, this.launches(), {
      now: this.now(),
      timeZone: this.timeZone,
    });
    try {
      await this.gladys.publishChangedStates(states);
      this.failures.succeeded('states', 'States published again');
    } catch (err) {
      this.failures.failed('states', `Could not publish the states: ${err.message}`);
    }
  }

  /** The problem shown in the connection status, or null. */
  problem() {
    if (!this.apiError) {
      return null;
    }
    return this.rateLimited ? 'limited' : 'unreachable';
  }

  /** Reports the status when it changed (or always, with `force`). */
  async updateStatus({ force = false } = {}) {
    const problem = this.problem();
    if (!force && problem === this.statusKey) {
      return;
    }
    const message = problem ? inEveryLanguage(PROBLEM_TEXT, (text) => text[problem]()) : undefined;
    try {
      await this.gladys.setConnectionStatus(problem === null, message);
      this.statusKey = problem;
      this.failures.succeeded('status', 'Status reported again');
    } catch (err) {
      this.failures.failed('status', `Could not report the status: ${err.message}`);
    }
  }

  widgetSignature() {
    const now = this.now();
    const launches = this.launches() ?? [];
    const next = nextLaunch(launches, scopes(this.config)[0], now);
    const left = next ? next.net - now : 0;
    return [
      next?.id,
      next?.status,
      // The widget TTL (5 minutes) refreshes the countdown; a nudge every
      // hour, every minute in the last hour.
      Math.floor(left / (left < HOUR ? MINUTE : HOUR)),
      ...Object.values(this.fetchedAt),
    ].join('|');
  }

  refreshWidget() {
    this.widgetKey = this.widgetSignature();
    try {
      // Fire-and-forget, rate-limited by the core: never awaited.
      Promise.resolve(this.gladys.requestWidgetRefresh(WIDGET_KEY)).catch(() => {});
    } catch {
      // Disconnected: the widget refetches on its own TTL.
    }
  }
}
