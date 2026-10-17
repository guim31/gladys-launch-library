// -----------------------------------------------------------------------------
// Registers every SDK handler on a GladysIntegration (or the SDK's fake Gladys
// in the tests) and returns the service, so index.js stays a few lines and the
// tests drive the very same wiring.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { normalizeConfig } from './config.js';
import { CHECK_TEXT, INIT_FAILED, SENTENCES } from './i18n.js';
import { scopes, shortName, upcomingOf } from './launches.js';
import { MAX_PER_HOUR, createLL2 } from './ll2.js';
import { SCENE_ACTIONS, launchWords } from './scenes.js';
import { LaunchService } from './service.js';
import { createStore } from './store.js';
import { WIDGETS } from './widgets.js';

const logger = createLogger({ name: 'launches-app' });

export const CHECK_ACTION = 'check';

/**
 * @param {object} gladys GladysIntegration instance
 * @param {object} [options] test seams: store, api, fetch, now, timeZone, timers
 */
export function registerHandlers(gladys, options = {}) {
  const service = new LaunchService({
    gladys,
    store: options.store ?? createStore(),
    api: options.api ?? createLL2({ fetch: options.fetch, now: options.now }),
    now: options.now,
    timeZone: options.timeZone,
    timers: options.timers ?? true,
  });

  // Resolved once the service has started; every handler waits for it.
  let resolveReady;
  const ready = new Promise((resolve) => {
    resolveReady = resolve;
  });
  let started = false;
  const whenReady =
    (fn) =>
    async (...args) => {
      await ready;
      return fn(...args);
    };

  gladys.on('connected', async () => {
    try {
      const config = normalizeConfig(await gladys.getConfig());
      if (started) {
        await service.resync(config);
        return;
      }
      started = true;
      await service.start(config);
    } catch (err) {
      logger.error('Initialization failed', err);
      // The handlers keep answering, with the defaults if need be.
      service.config ??= normalizeConfig({});
      await gladys.setConnectionStatus(false, INIT_FAILED).catch(() => {});
      // The next status report replaces this one.
      service.statusKey = undefined;
    } finally {
      resolveReady();
    }
  });

  gladys.onScanRequest(whenReady(() => service.publishDevices()));

  gladys.onDeviceCreated(whenReady(() => service.deviceCreated()));

  gladys.onConfigUpdated(whenReady((config) => service.reconfigure(normalizeConfig(config))));

  gladys.onAction(
    CHECK_ACTION,
    whenReady(async () => {
      logger.info('Action "check": reading Launch Library 2 again');
      await service.check();
      return checkMessage(service);
    }),
  );

  for (const [key, handler] of Object.entries(SCENE_ACTIONS)) {
    gladys.onSceneAction(
      key,
      whenReady((fields) => handler(service, { fields })),
    );
  }

  for (const [key, widget] of Object.entries(WIDGETS)) {
    gladys.onWidgetGet(
      key,
      whenReady((request) => widget.get(service, request)),
    );
  }

  return { service, ready, stop: () => service.stop() };
}

/** The report of "Check", one text per language. */
export function checkMessage(service) {
  return Object.fromEntries(
    Object.entries(CHECK_TEXT).map(([language, text]) => [
      language,
      checkReport(service, text, language),
    ]),
  );
}

function checkReport(service, text, language) {
  const launches = service.launches();
  const now = service.now();
  const lines = [];
  if (launches) {
    const [all, ...filters] = scopes(service.config);
    const upcoming = upcomingOf(launches, all, now);
    lines.push(text.read(upcoming.length));
    lines.push(
      upcoming[0]
        ? text.next(SENTENCES[language].next(launchWords(upcoming[0], language, service.timeZone)))
        : SENTENCES[language].none,
    );
    for (const filter of filters) {
      const matching = upcomingOf(launches, filter, now);
      lines.push(text.filter(filter.label, matching.length, matching[0] && shortName(matching[0])));
    }
  }
  if (typeof service.api.remaining === 'function') {
    lines.push(text.quota(Math.max(0, service.api.remaining()), MAX_PER_HOUR));
  }
  lines.push('', service.apiError ? text.stale(service.apiError) : text.fresh);
  return lines.join('\n');
}
