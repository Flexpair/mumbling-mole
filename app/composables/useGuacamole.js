const GUACAMOLE_APP_SELECTOR = '[ng-app="index"]';
const GUACAMOLE_AUTH_TOKEN_KEY = 'GUAC_AUTH_TOKEN';
const GUACAMOLE_ERROR_SELECTOR = [
  '.login-ui.error',
  '.automatic-login-rejected-modal',
  '.fatal-page-error-modal',
  '.logged-out-modal',
].join(', ');

function createGuacamoleError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function isVisibleError(element, contentWindow) {
  if (!element || element.hidden || element.getAttribute?.('aria-hidden') === 'true') {
    return false;
  }

  const style = contentWindow?.getComputedStyle?.(element);
  return !style || (style.display !== 'none' && style.visibility !== 'hidden');
}

/**
 * Remove Guacamole's persisted authentication token so it cannot be reused
 * across Flexpair authentication sessions.
 *
 * @param {Storage} [storage]
 */
export function clearGuacamoleSession(storage) {
  try {
    const sessionStorage = storage ?? globalThis.localStorage;
    sessionStorage?.removeItem(GUACAMOLE_AUTH_TOKEN_KEY);
  } catch (error) {
    console.warn('[Guacamole] Could not clear stored session:', error);
  }
}

/**
 * Build a Guacamole URL without allowing credential values to alter fragment
 * parameters.
 *
 * @param {string} username
 * @param {string} password
 * @param {string} session
 * @returns {string}
 */
export function buildGuacamoleSource(username, password, session) {
  return '/guacamole/?flexpairSession=' + encodeURIComponent(session) +
    '#/?username=' + encodeURIComponent(username || '') +
    '&password=' + encodeURIComponent(password || '');
}

/**
 * Wait until the same-origin Guacamole application has authenticated and
 * rendered its usable content area.
 *
 * @param {HTMLIFrameElement} iframe
 * @param {Object} [options]
 * @param {number} [options.timeoutMs=30000]
 * @param {number} [options.pollIntervalMs=50]
 * @param {string} [options.expectedSession]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<void>}
 */
export function waitForGuacamoleReady(
  iframe,
  { timeoutMs = 30000, pollIntervalMs = 50, expectedSession, signal } = {}
) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let pollTimer;
    let timeoutTimer;
    let navigationStartDocument;

    const cleanup = () => {
      clearInterval(pollTimer);
      clearTimeout(timeoutTimer);
      iframe.removeEventListener('load', inspect);
      signal?.removeEventListener('abort', handleAbort);
    };

    const settle = (callback, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback(value);
    };

    const fail = (message, code) => {
      settle(reject, createGuacamoleError(message, code));
    };

    const handleAbort = () => {
      fail('Remote desktop startup was cancelled', 'GUACAMOLE_START_CANCELLED');
    };

    if (expectedSession) {
      try {
        navigationStartDocument = iframe.contentDocument;
      } catch {
        fail('Remote desktop failed to load', 'GUACAMOLE_LOAD_FAILED');
        return;
      }
    }

    function inspect() {
      if (settled) return;

      let document;
      let href;
      try {
        document = iframe.contentDocument;
        href = iframe.contentWindow?.location?.href;
      } catch {
        fail('Remote desktop failed to load', 'GUACAMOLE_LOAD_FAILED');
        return;
      }

      if (!document) return;

      if (expectedSession) {
        let loadedSession;
        try {
          loadedSession = new URL(href).searchParams.get('flexpairSession');
        } catch {
          return;
        }
        if (loadedSession !== String(expectedSession)) return;
        // The new URL can be visible before the iframe swaps out its old document.
        if (document === navigationStartDocument) return;
      }

      const isGuacamole = document.documentElement?.matches?.(GUACAMOLE_APP_SELECTOR) === true;
      let authenticationService;
      try {
        authenticationService = iframe.contentWindow?.angular
          ?.element(document.documentElement)
          ?.injector?.()
          ?.get('authenticationService');
      } catch {
        return;
      }

      // Ignore the uncompiled Guacamole HTML. Its templates contain both
      // success and error elements before Angular has selected active views.
      if (isGuacamole && !authenticationService) return;

      const errorElement = document.querySelector(GUACAMOLE_ERROR_SELECTOR);
      if (isVisibleError(errorElement, iframe.contentWindow)) {
        fail('Remote desktop authentication failed', 'GUACAMOLE_AUTH_FAILED');
        return;
      }

      const isAuthenticated = Boolean(authenticationService?.getCurrentToken?.());
      if (isGuacamole && isAuthenticated && document.querySelector('#content')) {
        settle(resolve);
        return;
      }

      if (document.readyState === 'complete' && href && href !== 'about:blank' && !isGuacamole) {
        fail('Remote desktop failed to load', 'GUACAMOLE_LOAD_FAILED');
      }
    }

    if (signal?.aborted) {
      handleAbort();
      return;
    }

    iframe.addEventListener('load', inspect);
    signal?.addEventListener('abort', handleAbort, { once: true });
    pollTimer = setInterval(inspect, pollIntervalMs);
    timeoutTimer = setTimeout(
      () => fail('Remote desktop timed out', 'GUACAMOLE_START_TIMEOUT'),
      timeoutMs
    );
    inspect();
  });
}

/**
 * Start the Guacamole remote-desktop frame for an authorized user and wait
 * until Guacamole confirms that authenticated content is usable.
 * @param {string} guac_login
 * @param {string} password
 * @param {Object} uiStore
 * @returns {Promise<void>}
 */
export async function startGuacamoleFrame(guac_login, password, uiStore) {
  if (!uiStore.guacamoleFrame) {
    throw new Error('Remote desktop is not ready');
  }

  const ready = uiStore.guacamoleFrame.start(guac_login, password);
  uiStore.guacamoleFrame.show();
  await ready;
}
