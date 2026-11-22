import { describe, expect, it, jest } from '@jest/globals';
import {
  buildGuacamoleSource,
  clearGuacamoleSession,
  revokeGuacamoleSession,
  startGuacamoleFrame,
} from '../../app/composables/useGuacamole.js';

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

describe('revokeGuacamoleSession', () => {
  it('revokes the stored token through Guacamole', async () => {
    const storage = { getItem: jest.fn(() => 'session-token') };
    const fetcher = jest.fn().mockResolvedValue({ ok: true, status: 204 });

    await revokeGuacamoleSession(storage, fetcher);

    expect(fetcher).toHaveBeenCalledWith('/guacamole/api/session', {
      method: 'DELETE',
      headers: { 'Guacamole-Token': 'session-token' },
      keepalive: true,
    });
  });

  it('skips missing tokens and tolerates revocation failures', async () => {
    const fetcher = jest.fn();
    const storage = { getItem: jest.fn(() => null) };

    await revokeGuacamoleSession(storage, fetcher);
    expect(fetcher).not.toHaveBeenCalled();

    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await revokeGuacamoleSession(
      { getItem: jest.fn(() => 'session-token') },
      jest.fn().mockRejectedValue(new Error('Unavailable')),
    );
    expect(warn).toHaveBeenCalledWith(
      '[Guacamole] Could not revoke server session:',
      expect.any(Error),
    );
    warn.mockRestore();
  });
});

describe('buildGuacamoleSource', () => {
  it('encodes every credential-derived fragment value', () => {
    const source = buildGuacamoleSource('watch&password=attacker', 'p#ss&word');

    expect(source).toBe(
      '/guacamole/#/?username=watch%26password%3Dattacker&password=p%23ss%26word'
    );
  });
});

describe('startGuacamoleFrame', () => {
  it('starts and shows the registered frame without waiting for its state', () => {
    const frame = {
      start: jest.fn(),
      show: jest.fn(),
    };

    const started = startGuacamoleFrame('watcher', 'password', { guacamoleFrame: frame });

    expect(frame.start).toHaveBeenCalledWith('watcher', 'password');
    expect(frame.show).toHaveBeenCalled();
    expect(started).toBe(true);
  });

  it('does not fail the caller when the frame is not registered', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    expect(startGuacamoleFrame('watcher', 'password', { guacamoleFrame: null })).toBe(false);
    expect(warn).toHaveBeenCalledWith('[Guacamole] Frame is not registered');

    warn.mockRestore();
  });
});
