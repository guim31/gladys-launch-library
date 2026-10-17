// -----------------------------------------------------------------------------
// Repeated failures, logged once. A failure that comes back every minute (the
// clock) or every hour (scene events, /data) would fill the logs of Gladys:
// the first one is a warning, the next ones are debug, and the first success
// after them is one info line.
// -----------------------------------------------------------------------------

/**
 * @param {object} logger an SDK logger (createLogger)
 * @returns {{ failed: Function, succeeded: Function, isFailing: Function }}
 */
export function createFailureLog(logger) {
  const failing = new Set();
  return {
    /** A failure of `key`: a warning the first time, debug while it lasts. */
    failed(key, message, ...details) {
      if (failing.has(key)) {
        logger.debug(message, ...details);
        return;
      }
      failing.add(key);
      logger.warn(message, ...details);
    },
    /** A success of `key`: one info line when it ends a series of failures. */
    succeeded(key, message) {
      if (failing.delete(key) && message) {
        logger.info(message);
      }
    },
    isFailing(key) {
      return failing.has(key);
    },
  };
}
