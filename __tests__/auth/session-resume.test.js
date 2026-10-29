import { jest } from '@jest/globals';
import { createSessionResumeHandler } from '../../app/auth/session-resume.js';

describe('revalidateSessionOnResume', () => {
  test('only checks the session once when multiple resume events overlap', async () => {
    let resolveSession;
    const session = new Promise(resolve => {
      resolveSession = resolve;
    });
    const auth = { getCurrentUser: jest.fn(() => session) };
    const handler = createSessionResumeHandler({ auth });

    const firstCheck = handler();
    const secondCheck = handler();
    resolveSession({ id: 'current-user' });

    await expect(Promise.all([firstCheck, secondCheck])).resolves.toEqual([
      { id: 'current-user' },
      { id: 'current-user' },
    ]);
    expect(auth.getCurrentUser).toHaveBeenCalledTimes(1);
  });

  test('awaits asynchronous validation-start work before querying the session', async () => {
    let finishStart;
    const onValidationStart = jest.fn(() => new Promise(resolve => { finishStart = resolve; }));
    const auth = { getCurrentUser: jest.fn().mockResolvedValue(null) };
    const handler = createSessionResumeHandler({ auth, onValidationStart });
    const result = handler();
    expect(onValidationStart).toHaveBeenCalledTimes(1);
    expect(auth.getCurrentUser).not.toHaveBeenCalled();
    finishStart();
    await result;
    expect(auth.getCurrentUser).toHaveBeenCalledTimes(1);
  });

  test.each(['resolve', 'reject'])('ignores %s from a superseded resume validation', async (outcome) => {
    let settle;
    let generation = 0;
    const pending = new Promise((resolve, reject) => {
      settle = () => outcome === 'resolve' ? resolve(null) : reject(new Error('old session'));
    });
    const onAuthenticated = jest.fn();
    const onUnauthenticated = jest.fn();
    const onValidationError = jest.fn();
    const handler = createSessionResumeHandler({
      auth: { getCurrentUser: () => pending },
      getSessionGeneration: () => generation,
      onAuthenticated,
      onUnauthenticated,
      onValidationError,
    });
    const result = handler();
    await Promise.resolve();
    generation += 1;
    settle();
    await result;
    expect(onAuthenticated).not.toHaveBeenCalled();
    expect(onUnauthenticated).not.toHaveBeenCalled();
    expect(onValidationError).not.toHaveBeenCalled();
  });

  test('starts a new validation after the session changes while the previous check hangs', async () => {
    let generation = 0;
    let finishOld;
    const old = new Promise(resolve => { finishOld = resolve; });
    const auth = { getCurrentUser: jest.fn().mockReturnValueOnce(old).mockResolvedValueOnce({ id: 'new' }) };
    const onAuthenticated = jest.fn();
    const handler = createSessionResumeHandler({ auth, getSessionGeneration: () => generation, onAuthenticated });
    const first = handler();
    await Promise.resolve();
    generation += 1;
    await expect(handler()).resolves.toEqual({ id: 'new' });
    expect(onAuthenticated).toHaveBeenCalledTimes(1);
    finishOld(null);
    await first;
    expect(onAuthenticated).toHaveBeenCalledTimes(1);
  });

  test('requests login when resume validation finds no active session', async () => {
    const auth = { getCurrentUser: jest.fn().mockResolvedValue(null) };
    const onUnauthenticated = jest.fn();
    const connectDialog = { visible: true };
    const handler = createSessionResumeHandler({
      auth,
      isConnectDialogVisible: () => connectDialog.visible,
      onValidationStart: () => { connectDialog.visible = false; },
      onUnauthenticated: () => {
        connectDialog.visible = false;
        onUnauthenticated();
      },
    });

    await expect(handler()).resolves.toBeNull();

    expect(onUnauthenticated).toHaveBeenCalledTimes(1);
    expect(connectDialog.visible).toBe(false);
  });

  test('restores Connect after a transient session-validation failure', async () => {
    const validationError = new TypeError('Failed to fetch');
    const auth = { getCurrentUser: jest.fn().mockRejectedValue(validationError) };
    const onValidationError = jest.fn();
    const connectDialog = { visible: true };
    const handler = createSessionResumeHandler({
      auth,
      isConnectDialogVisible: () => connectDialog.visible,
      onValidationStart: () => { connectDialog.visible = false; },
      onValidationError: (error, context) => {
        onValidationError(error, context);
        if (context.restoreConnectDialog) connectDialog.visible = true;
      },
    });

    await expect(handler()).resolves.toBeUndefined();

    expect(onValidationError).toHaveBeenCalledWith(validationError, {
      restoreConnectDialog: true,
    });
    expect(connectDialog.visible).toBe(true);
  });

  test('restores Connect when a later resume retry validates the session', async () => {
    const validationError = new TypeError('Failed to fetch');
    const user = { id: 'current-user' };
    const auth = {
      getCurrentUser: jest.fn()
        .mockRejectedValueOnce(validationError)
        .mockResolvedValueOnce(user),
    };
    const connectDialog = { visible: true };
    const onAuthenticated = jest.fn((_user, context) => {
      if (context.restoreConnectDialog) connectDialog.visible = true;
    });
    const handler = createSessionResumeHandler({
      auth,
      isConnectDialogVisible: () => connectDialog.visible,
      onValidationStart: () => { connectDialog.visible = false; },
      onValidationError: jest.fn(),
      onAuthenticated,
    });

    await handler();
    expect(connectDialog.visible).toBe(false);

    await handler();

    expect(onAuthenticated).toHaveBeenCalledWith(user, { restoreConnectDialog: true });
    expect(connectDialog.visible).toBe(true);
  });

  test('restores Connect after a startup validation failure is retried successfully', async () => {
    const user = { id: 'current-user' };
    const auth = { getCurrentUser: jest.fn().mockResolvedValue(user) };
    const connectDialog = { visible: false };
    const onAuthenticated = jest.fn((_user, { restoreConnectDialog }) => {
      if (restoreConnectDialog) connectDialog.visible = true;
    });
    const handler = createSessionResumeHandler({
      auth,
      isConnectDialogVisible: () => connectDialog.visible,
      onAuthenticated,
    });

    await handler();

    expect(onAuthenticated).toHaveBeenCalledWith(user, { restoreConnectDialog: false });
    expect(connectDialog.visible).toBe(false);
  });

  test('passes the connect-dialog state to the transient failure handler', async () => {
    const validationError = new TypeError('Failed to fetch');
    const auth = { getCurrentUser: jest.fn().mockRejectedValue(validationError) };
    const onValidationError = jest.fn();
    const handler = createSessionResumeHandler({
      auth,
      isConnectDialogVisible: () => true,
      onValidationError,
    });

    await handler();

    expect(onValidationError).toHaveBeenCalledWith(validationError, {
      restoreConnectDialog: true,
    });
  });

  test('does not replace an open identity login modal', async () => {
    const auth = { getCurrentUser: jest.fn().mockResolvedValue(null) };
    const onUnauthenticated = jest.fn();
    const handler = createSessionResumeHandler({
      auth,
      isAuthModalOpen: () => true,
      onUnauthenticated,
    });

    await expect(handler()).resolves.toBeNull();

    expect(auth.getCurrentUser).not.toHaveBeenCalled();
    expect(onUnauthenticated).not.toHaveBeenCalled();
  });

  test('does not request login while startup validation is still pending', async () => {
    const auth = { getCurrentUser: jest.fn().mockResolvedValue(null) };
    const onUnauthenticated = jest.fn();
    const handler = createSessionResumeHandler({
      auth,
      isReady: () => false,
      onUnauthenticated,
    });

    await expect(handler()).resolves.toBeNull();

    expect(auth.getCurrentUser).not.toHaveBeenCalled();
    expect(onUnauthenticated).not.toHaveBeenCalled();
  });
});
