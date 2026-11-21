import { jest } from '@jest/globals';

const mockClearCredentials = jest.fn();
const mockInvalidateConnectionAttempt = jest.fn();

jest.unstable_mockModule('../../app/auth/credentials-service.js', () => ({
  clearCredentials: mockClearCredentials,
}));

jest.unstable_mockModule('../../app/composables/connectionAttempt.js', () => ({
  invalidateConnectionAttempt: mockInvalidateConnectionAttempt,
}));

const {
  logoutForReauthentication,
  logoutSession,
  shouldHandleProviderLogout,
} = await import('../../app/composables/useAuthLogout.js');
const { default: NetlifyIdentityAdapter } = await import('../../app/auth/NetlifyIdentityAdapter.js');

describe('useAuthLogout', () => {
  test('tears down local resources from the connect-dialog logout path', async () => {
    const dependencies = {
      auth: { logout: jest.fn().mockResolvedValue(undefined) },
      uiStore: { guacamoleFrame: { stop: jest.fn() }, reset: jest.fn() },
      audioStore: { stopBeep: jest.fn() },
      voiceStore: { reset: jest.fn() },
      connectionStore: { disconnect: jest.fn() },
      userStore: { reset: jest.fn() },
      dialogStore: { resetConnectDialog: jest.fn() },
    };
    const reload = jest.fn();
    await logoutSession(dependencies, reload);

    expect(mockClearCredentials).toHaveBeenCalledTimes(1);
    expect(mockInvalidateConnectionAttempt).toHaveBeenCalledTimes(1);
    expect(dependencies.uiStore.guacamoleFrame.stop).toHaveBeenCalledTimes(1);
    expect(dependencies.audioStore.stopBeep).toHaveBeenCalledTimes(1);
    expect(dependencies.voiceStore.reset).toHaveBeenCalledTimes(1);
    expect(dependencies.connectionStore.disconnect).toHaveBeenCalledTimes(1);
    expect(dependencies.userStore.reset).toHaveBeenCalledTimes(1);
    expect(dependencies.dialogStore.resetConnectDialog).toHaveBeenCalledTimes(1);
    expect(dependencies.auth.logout).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  test('reloads when provider logout never settles', async () => {
    jest.useFakeTimers();
    const dependencies = {
      auth: {
        logout: jest.fn(() => new Promise(() => {})),
        clearLocalSession: jest.fn().mockResolvedValue(true),
      },
      uiStore: { guacamoleFrame: null, reset: jest.fn() },
      audioStore: { stopBeep: jest.fn() },
      voiceStore: { reset: jest.fn() },
      connectionStore: { disconnect: jest.fn() },
      userStore: { reset: jest.fn() },
    };
    const reload = jest.fn();
    const logout = logoutSession(dependencies, reload);
    await Promise.resolve();
    jest.advanceTimersByTime(1500);
    await logout;

    expect(reload).toHaveBeenCalledTimes(1);

    jest.useRealTimers();
  });

  test.each(['failure', 'timeout'])(
    'clears the Netlify session before reload after provider logout %s',
    async (outcome) => {
      jest.useFakeTimers();
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      const auth = new NetlifyIdentityAdapter();
      auth.netlifyIdentity = {
        store: { user: { id: '123' } },
        on: jest.fn(),
        off: jest.fn(),
        logout: outcome === 'failure'
          ? jest.fn().mockRejectedValue(new Error('logout failed'))
          : jest.fn(() => new Promise(() => {})),
      };
      localStorage.setItem('gotrue.user', 'saved session');
      const dependencies = {
        auth,
        uiStore: { guacamoleFrame: null, reset: jest.fn() },
        audioStore: { stopBeep: jest.fn() },
        voiceStore: { reset: jest.fn() },
        connectionStore: { disconnect: jest.fn() },
        userStore: { reset: jest.fn() },
      };
      const reload = jest.fn(() => {
        expect(localStorage.getItem('gotrue.user')).toBeNull();
        expect(auth.netlifyIdentity.store.user).toBeNull();
      });

      try {
        const logout = logoutSession(dependencies, reload);
        await Promise.resolve();
        if (outcome === 'timeout') jest.advanceTimersByTime(1500);
        await logout;

        expect(reload).toHaveBeenCalledTimes(1);
        expect(mockClearCredentials).toHaveBeenCalledTimes(1);
        expect(dependencies.uiStore.reset).toHaveBeenCalledTimes(1);
      } finally {
        localStorage.removeItem('gotrue.user');
        consoleError.mockRestore();
        jest.useRealTimers();
      }
    },
  );

  test('does not force local cleanup after successful provider logout', async () => {
    const auth = {
      logout: jest.fn().mockResolvedValue(undefined),
      clearLocalSession: jest.fn(),
    };
    const dependencies = {
      auth,
      uiStore: { guacamoleFrame: null, reset: jest.fn() },
      audioStore: { stopBeep: jest.fn() },
      voiceStore: { reset: jest.fn() },
      connectionStore: { disconnect: jest.fn() },
      userStore: { reset: jest.fn() },
    };
    const reload = jest.fn();

    await logoutSession(dependencies, reload);

    expect(auth.clearLocalSession).not.toHaveBeenCalled();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  test.each([
    ['failure', 'false'],
    ['failure', 'throw'],
    ['timeout', 'false'],
    ['timeout', 'throw'],
    ['failure', 'missing'],
  ])('does not reload after logout %s and local cleanup %s', async (outcome, cleanup) => {
    jest.useFakeTimers();
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const alert = jest.spyOn(globalThis, 'alert').mockImplementation(() => {});
    const auth = {
      logout: outcome === 'failure'
        ? jest.fn().mockRejectedValue(new Error('logout failed'))
        : jest.fn(() => new Promise(() => {})),
    };
    if (cleanup !== 'missing') {
      auth.clearLocalSession = cleanup === 'throw'
        ? jest.fn().mockRejectedValue(new Error('cleanup failed'))
        : jest.fn().mockResolvedValue(false);
    }
    const dependencies = {
      auth,
      uiStore: { guacamoleFrame: null, reset: jest.fn() },
      audioStore: { stopBeep: jest.fn() },
      voiceStore: { reset: jest.fn() },
      connectionStore: { disconnect: jest.fn() },
      userStore: { reset: jest.fn() },
    };
    const reload = jest.fn();

    try {
      const logout = logoutSession(dependencies, reload);
      await Promise.resolve();
      if (outcome === 'timeout') jest.advanceTimersByTime(1500);
      await expect(logout).resolves.toBe(false);

      if (auth.clearLocalSession) expect(auth.clearLocalSession).toHaveBeenCalledTimes(1);
      expect(reload).not.toHaveBeenCalled();
      expect(consoleError).toHaveBeenCalled();
      expect(alert).toHaveBeenCalled();
    } finally {
      alert.mockRestore();
      consoleError.mockRestore();
      jest.useRealTimers();
    }
  });

  test('ignores the delayed provider event from reauthentication logout once', async () => {
    const auth = { logout: jest.fn().mockResolvedValue(undefined) };

    await logoutForReauthentication(auth);

    expect(shouldHandleProviderLogout()).toBe(false);
    expect(shouldHandleProviderLogout()).toBe(true);
  });

  test('explicit logout cancels stale reauthentication suppression', async () => {
    const auth = { logout: jest.fn().mockResolvedValue(undefined) };
    const dependencies = {
      auth,
      uiStore: { guacamoleFrame: null, reset: jest.fn() },
      audioStore: { stopBeep: jest.fn() },
      voiceStore: { reset: jest.fn() },
      connectionStore: { disconnect: jest.fn() },
      userStore: { reset: jest.fn() },
    };

    await logoutForReauthentication(auth);
    await logoutSession(dependencies, jest.fn());

    expect(shouldHandleProviderLogout()).toBe(true);
  });

  test('handles the next provider logout when reauthentication logout times out', async () => {
    jest.useFakeTimers();
    const auth = {
      logout: jest.fn(() => new Promise(() => {})),
      clearLocalSession: jest.fn().mockResolvedValue(true),
    };
    const reload = jest.fn();

    const logout = logoutForReauthentication(auth, reload);
    await Promise.resolve();
    jest.advanceTimersByTime(1500);
    await expect(logout).resolves.toBe(false);

    expect(auth.logout).toHaveBeenCalledWith({
      suppressProviderEvent: false,
      signal: expect.any(AbortSignal),
    });
    expect(auth.clearLocalSession).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(shouldHandleProviderLogout()).toBe(true);
    jest.useRealTimers();
  });

  test.each(['false', 'throw', 'missing'])(
    'does not reload on reauthentication timeout when cleanup is %s',
    async (cleanup) => {
      jest.useFakeTimers();
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      const alert = jest.spyOn(globalThis, 'alert').mockImplementation(() => {});
      const auth = { logout: jest.fn(() => new Promise(() => {})) };
      if (cleanup !== 'missing') {
        auth.clearLocalSession = cleanup === 'throw'
          ? jest.fn().mockRejectedValue(new Error('cleanup failed'))
          : jest.fn().mockResolvedValue(false);
      }
      const reload = jest.fn();

      try {
        const logout = logoutForReauthentication(auth, reload);
        await Promise.resolve();
        jest.advanceTimersByTime(1500);
        await expect(logout).resolves.toBe(false);

        if (auth.clearLocalSession) expect(auth.clearLocalSession).toHaveBeenCalledTimes(1);
        expect(reload).not.toHaveBeenCalled();
        expect(consoleError).toHaveBeenCalled();
        expect(alert).toHaveBeenCalled();
      } finally {
        alert.mockRestore();
        consoleError.mockRestore();
        jest.useRealTimers();
      }
    },
  );

  test('uses provider-scoped suppression when the auth adapter supports it', async () => {
    const auth = {
      supportsLogoutEventSuppression: true,
      logout: jest.fn().mockResolvedValue(undefined),
    };

    await logoutForReauthentication(auth);

    expect(auth.logout).toHaveBeenCalledWith({
      suppressProviderEvent: true,
      signal: expect.any(AbortSignal),
    });
    expect(shouldHandleProviderLogout()).toBe(true);
  });

  test.each(['event', 'resolve', 'reject'])(
    'keeps a late reauthentication logout %s from affecting the next session',
    async (completion) => {
      jest.useFakeTimers();
      const callbacks = new Map();
      const emit = (event, ...args) => {
        for (const callback of callbacks.get(event) ?? []) callback(...args);
      };
      const identity = {
        store: { user: { id: 'old-session' } },
        currentUser: jest.fn(() => identity.store.user),
        on: jest.fn((event, callback) => {
          const handlers = callbacks.get(event) ?? [];
          handlers.push(callback);
          callbacks.set(event, handlers);
        }),
        off: jest.fn((event, callback) => {
          callbacks.set(event, (callbacks.get(event) ?? []).filter(handler => handler !== callback));
        }),
        logout: jest.fn(),
      };
      const auth = new NetlifyIdentityAdapter();
      auth.netlifyIdentity = identity;
      const appLogout = jest.fn(() => { applicationSession = null; });
      let applicationSession = identity.store.user;
      auth.on('logout', appLogout);
      auth.on('login', user => { applicationSession = user; });

      let completeProviderLogout;
      let startNextLogout;
      const nextLogoutStarted = new Promise(resolve => { startNextLogout = resolve; });
      identity.logout
        .mockImplementationOnce(() => {
          if (completion === 'event') return undefined;
          return new Promise((resolve, reject) => {
            completeProviderLogout = completion === 'resolve' ? resolve : reject;
          });
        })
        .mockImplementationOnce(() => {
          startNextLogout();
          return undefined;
        });

      localStorage.setItem('gotrue.user', 'old session');
      const reload = jest.fn();
      try {
        const reauthentication = logoutForReauthentication(auth, reload);
        await Promise.resolve();
        jest.advanceTimersByTime(1500);
        await expect(reauthentication).resolves.toBe(false);
        expect(reload).toHaveBeenCalledTimes(1);
        expect(identity.store.user).toBeNull();
        expect(localStorage.getItem('gotrue.user')).toBeNull();

        const newSession = { id: 'new-session' };
        identity.store.user = newSession;
        emit('login', newSession);
        const explicitLogout = auth.logout();
        await Promise.resolve();
        expect(identity.logout).toHaveBeenCalledTimes(1);

        if (completion === 'event') {
          emit('logout');
        } else {
          completeProviderLogout(completion === 'reject' ? new Error('logout failed') : undefined);
        }
        await nextLogoutStarted;

        expect(applicationSession).toBe(newSession);
        expect(appLogout).not.toHaveBeenCalled();

        identity.store.user = null;
        emit('logout');
        await explicitLogout;
        expect(applicationSession).toBeNull();
        expect(appLogout).toHaveBeenCalledTimes(1);
      } finally {
        localStorage.removeItem('gotrue.user');
        jest.useRealTimers();
      }
    },
  );

  test('handles the next provider logout when reauthentication logout fails', async () => {
    const auth = {
      logout: jest.fn().mockRejectedValue(new Error('logout failed')),
      clearLocalSession: jest.fn().mockResolvedValue(true),
    };
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await logoutForReauthentication(auth);

    expect(auth.clearLocalSession).toHaveBeenCalledTimes(1);
    expect(shouldHandleProviderLogout()).toBe(true);
    consoleError.mockRestore();
  });
});
