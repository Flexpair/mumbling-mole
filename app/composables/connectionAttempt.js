let activeAttempt = null;

/**
 * Begin a new application-wide connection attempt.
 * Starting an attempt invalidates every earlier async handoff.
 *
 * @returns {symbol} Opaque attempt identifier
 */
export function beginConnectionAttempt() {
  const id = Symbol('connection-attempt');
  activeAttempt = id;
  return id;
}

/**
 * Check whether an async continuation still belongs to the active attempt.
 *
 * @param {symbol} attempt
 * @returns {boolean}
 */
export function isConnectionAttemptCurrent(attempt) {
  return activeAttempt === attempt;
}

/**
 * Invalidate one attempt, or the active attempt when no identifier is supplied.
 *
 * @param {symbol} [attempt]
 */
export function invalidateConnectionAttempt(attempt) {
  if (attempt === undefined || isConnectionAttemptCurrent(attempt)) {
    activeAttempt = null;
  }
}
