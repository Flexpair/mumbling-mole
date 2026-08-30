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
      auth: { logout: jest.fn(() => new Promise(() => {})) },
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
});
