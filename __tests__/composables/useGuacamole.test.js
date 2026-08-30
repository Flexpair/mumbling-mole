import { afterEach, describe, expect, it, jest } from '@jest/globals';
import {
  buildGuacamoleSource,
  clearGuacamoleSession,
  startGuacamoleFrame,
  waitForGuacamoleReady,
} from '../../app/composables/useGuacamole.js';

function createIframe({
  contentDocument,
  href = 'https://example.test/guacamole/#/',
  token = 'guacamole-token',
  injector = true,
  getComputedStyle = jest.fn(() => ({ display: 'block', visibility: 'visible' })),
}) {
  const listeners = new Map();
  const authenticationService = {
    getCurrentToken: jest.fn(() => token),
  };
  return {
    contentDocument,
    contentWindow: {
      location: { href },
      getComputedStyle,
      angular: injector ? {
        element: jest.fn(() => ({
          injector: jest.fn(() => ({
            get: jest.fn(() => authenticationService),
          })),
        })),
      } : undefined,
    },
    addEventListener: jest.fn((event, handler) => listeners.set(event, handler)),
    removeEventListener: jest.fn((event) => listeners.delete(event)),
    dispatch(event) {
      listeners.get(event)?.();
    },
  };
}

afterEach(() => {
  jest.useRealTimers();
});

describe('clearGuacamoleSession', () => {
  it('removes the persisted Guacamole authentication token', () => {
    const storage = { removeItem: jest.fn() };

    clearGuacamoleSession(storage);

    expect(storage.removeItem).toHaveBeenCalledWith('GUAC_AUTH_TOKEN');
  });

  it('does not fail when storage is unavailable', () => {
    const storage = {
      removeItem: jest.fn(() => { throw new Error('Storage unavailable'); }),
    };

    expect(() => clearGuacamoleSession(storage)).not.toThrow();
  });
});

describe('buildGuacamoleSource', () => {
  it('encodes every credential-derived fragment value', () => {
    const source = buildGuacamoleSource('watch&password=attacker', 'p#ss&word', '7');

    expect(source).toBe(
      '/guacamole/?flexpairSession=7#/?username=watch%26password%3Dattacker&password=p%23ss%26word'
    );
  });
});

describe('startGuacamoleFrame', () => {
  it('waits for the registered frame to become ready', async () => {
    let markReady;
    const ready = new Promise(resolve => { markReady = resolve; });
    const frame = {
      start: jest.fn(() => ready),
      show: jest.fn(),
    };

    const start = startGuacamoleFrame('watcher', 'password', { guacamoleFrame: frame });

    expect(frame.start).toHaveBeenCalledWith('watcher', 'password');
    expect(frame.show).toHaveBeenCalled();
    let settled = false;
    start.finally(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);

    markReady();
    await expect(start).resolves.toBeUndefined();
  });

  it('fails when the frame is not registered', async () => {
    await expect(startGuacamoleFrame('watcher', 'password', { guacamoleFrame: null }))
      .rejects.toThrow('Remote desktop is not ready');
  });
});

describe('waitForGuacamoleReady', () => {
  it('resolves only when Guacamole renders authenticated content', async () => {
    const content = {};
    const documentElement = { matches: jest.fn(() => true) };
    const contentDocument = {
      readyState: 'complete',
      documentElement,
      querySelector: jest.fn(selector => selector === '#content' ? content : null),
      querySelectorAll: jest.fn(() => []),
    };
    const iframe = createIframe({ contentDocument });

    await expect(waitForGuacamoleReady(iframe)).resolves.toBeUndefined();
  });

  it('does not accept raw Guacamole content before authentication completes', async () => {
    jest.useFakeTimers();
    const contentDocument = {
      readyState: 'complete',
      documentElement: { matches: jest.fn(() => true) },
      querySelector: jest.fn(selector => selector === '#content' ? {} : null),
      querySelectorAll: jest.fn(() => []),
    };
    const iframe = createIframe({ contentDocument, token: null });
    const ready = waitForGuacamoleReady(iframe, { timeoutMs: 100 });
    const result = expect(ready).rejects.toThrow('Remote desktop timed out');

    await jest.advanceTimersByTimeAsync(100);
    await result;
  });

  it('ignores a previously ready iframe until the requested session loads', async () => {
    jest.useFakeTimers();
    const contentDocument = {
      readyState: 'complete',
      documentElement: { matches: jest.fn(() => true) },
      querySelector: jest.fn(selector => selector === '#content' ? {} : null),
      querySelectorAll: jest.fn(() => []),
    };
    const iframe = createIframe({
      contentDocument,
      href: 'https://example.test/guacamole/?flexpairSession=1#/',
    });
    const ready = waitForGuacamoleReady(iframe, {
      expectedSession: '2',
      timeoutMs: 100,
    });
    let settled = false;
    ready.then(() => { settled = true; });

    await jest.advanceTimersByTimeAsync(50);
    expect(settled).toBe(false);

    iframe.contentWindow.location.href =
      'https://example.test/guacamole/?flexpairSession=2#/';
    iframe.contentDocument = { ...contentDocument };
    iframe.dispatch('load');
    await expect(ready).resolves.toBeUndefined();
  });

  it('ignores the previous document while the requested navigation is pending', async () => {
    const previousDocument = {
      readyState: 'complete',
      documentElement: { matches: jest.fn(() => true) },
      querySelector: jest.fn(selector => selector === '#content' ? {} : null),
      querySelectorAll: jest.fn(() => []),
    };
    const requestedDocument = {
      readyState: 'complete',
      documentElement: { matches: jest.fn(() => true) },
      querySelector: jest.fn(selector => selector === '#content' ? {} : null),
      querySelectorAll: jest.fn(() => []),
    };
    const iframe = createIframe({
      contentDocument: previousDocument,
      href: 'https://example.test/guacamole/?flexpairSession=2#/',
    });
    const ready = waitForGuacamoleReady(iframe, { expectedSession: '2' });
    let settled = false;
    ready.then(() => { settled = true; });

    await Promise.resolve();
    expect(settled).toBe(false);

    iframe.dispatch('load');
    await Promise.resolve();
    expect(settled).toBe(false);

    iframe.contentDocument = requestedDocument;
    iframe.dispatch('load');
    await expect(ready).resolves.toBeUndefined();
  });

  it('rejects an explicit Guacamole login error', async () => {
    const errorElement = {};
    const contentDocument = {
      readyState: 'complete',
      documentElement: { matches: jest.fn(() => true) },
      querySelector: jest.fn(selector => selector.includes('.login-ui.error') ? errorElement : null),
      querySelectorAll: jest.fn(() => [errorElement]),
    };
    const iframe = createIframe({ contentDocument });

    await expect(waitForGuacamoleReady(iframe))
      .rejects.toThrow('Remote desktop authentication failed');
  });

  it('ignores inactive Guacamole error markup', async () => {
    const content = {};
    const hiddenError = {};
    const contentDocument = {
      readyState: 'complete',
      documentElement: { matches: jest.fn(() => true) },
      querySelector: jest.fn(selector => {
        if (selector === '#content') return content;
        if (selector.includes('.login-ui.error')) return hiddenError;
        return null;
      }),
      querySelectorAll: jest.fn(() => [hiddenError]),
    };
    const iframe = createIframe({
      contentDocument,
      getComputedStyle: jest.fn(element => element === hiddenError
        ? { display: 'none', visibility: 'visible' }
        : { display: 'block', visibility: 'visible' }),
    });

    await expect(waitForGuacamoleReady(iframe)).resolves.toBeUndefined();
  });

  it('rejects when a later Guacamole error element is visible', async () => {
    const content = {};
    const hiddenError = {};
    const visibleError = {};
    const contentDocument = {
      readyState: 'complete',
      documentElement: { matches: jest.fn(() => true) },
      querySelector: jest.fn(selector => selector === '#content' ? content : null),
      querySelectorAll: jest.fn(() => [hiddenError, visibleError]),
    };
    const iframe = createIframe({
      contentDocument,
      getComputedStyle: jest.fn(element => element === hiddenError
        ? { display: 'none', visibility: 'visible' }
        : { display: 'block', visibility: 'visible' }),
    });

    await expect(waitForGuacamoleReady(iframe))
      .rejects.toThrow('Remote desktop authentication failed');
  });

  it('rejects a non-Guacamole response', async () => {
    const contentDocument = {
      readyState: 'complete',
      documentElement: { matches: jest.fn(() => false) },
      querySelector: jest.fn(() => null),
      querySelectorAll: jest.fn(() => []),
    };
    const iframe = createIframe({ contentDocument });

    await expect(waitForGuacamoleReady(iframe))
      .rejects.toThrow('Remote desktop failed to load');
  });

  it('rejects when the iframe cannot be inspected as same-origin', async () => {
    const iframe = createIframe({ contentDocument: null });
    Object.defineProperty(iframe, 'contentDocument', {
      get() { throw new DOMException('Blocked', 'SecurityError'); },
    });

    await expect(waitForGuacamoleReady(iframe))
      .rejects.toThrow('Remote desktop failed to load');
  });

  it('rejects when startup is aborted', async () => {
    const controller = new AbortController();
    const contentDocument = {
      readyState: 'loading',
      documentElement: { matches: jest.fn(() => true) },
      querySelector: jest.fn(() => null),
      querySelectorAll: jest.fn(() => []),
    };
    const iframe = createIframe({ contentDocument, href: 'about:blank' });
    const ready = waitForGuacamoleReady(iframe, { signal: controller.signal });
    const result = expect(ready).rejects.toMatchObject({
      code: 'GUACAMOLE_START_CANCELLED',
    });

    controller.abort();
    await result;
    expect(iframe.removeEventListener).toHaveBeenCalledWith('load', expect.any(Function));
  });

  it('times out while Guacamole remains unready', async () => {
    jest.useFakeTimers();
    const contentDocument = {
      readyState: 'loading',
      documentElement: { matches: jest.fn(() => true) },
      querySelector: jest.fn(() => null),
      querySelectorAll: jest.fn(() => []),
    };
    const iframe = createIframe({ contentDocument, href: 'about:blank' });
    const ready = waitForGuacamoleReady(iframe, { timeoutMs: 100 });
    const result = expect(ready).rejects.toThrow('Remote desktop timed out');

    await jest.advanceTimersByTimeAsync(100);
    await result;
  });
});
