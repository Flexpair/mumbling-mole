import { jest } from '@jest/globals';
import {
  createSessionValidatedLoginHandler,
  initializeAuthSession,
  shouldValidateAuthLogin,
  shouldHandleAuthLogin,
} from '../../app/auth/session-initialization.js';

describe('createSessionValidatedLoginHandler', () => {
  test('does not accept a stale login event when the server has no session', async () => {
    const auth = { getCurrentUser: jest.fn().mockResolvedValue(null) };
    const onAuthenticated = jest.fn();
    const onUnauthenticated = jest.fn();
    const handler = createSessionValidatedLoginHandler({
      auth,
      onAuthenticated,
      onUnauthenticated,
    });

    await expect(handler({ id: 'stale-cached-user' })).resolves.toEqual({
      status: 'unauthenticated',
      user: null,
    });

    expect(auth.getCurrentUser).toHaveBeenCalledTimes(1);
    expect(onAuthenticated).not.toHaveBeenCalled();
    expect(onUnauthenticated).toHaveBeenCalledTimes(1);
  });

  test('accepts a login event only after the provider validates a current user', async () => {
    const user = { id: 'validated-user' };
    const auth = { getCurrentUser: jest.fn().mockResolvedValue(user) };
    const onAuthenticated = jest.fn();
    const handler = createSessionValidatedLoginHandler({ auth, onAuthenticated });

    await expect(handler({ id: 'event-user' })).resolves.toEqual({
      status: 'authenticated',
      user,
    });

    expect(onAuthenticated).toHaveBeenCalledWith(user, { id: 'event-user' });
  });

  test('does not turn transient validation errors into unauthenticated events', async () => {
    const validationError = new TypeError('Failed to fetch');
    const auth = { getCurrentUser: jest.fn().mockRejectedValue(validationError) };
    const onAuthenticated = jest.fn();
    const onUnauthenticated = jest.fn();
    const onValidationError = jest.fn();
    const handler = createSessionValidatedLoginHandler({
      auth,
      onAuthenticated,
      onUnauthenticated,
      onValidationError,
    });

    await expect(handler({ id: 'event-user' })).resolves.toEqual({
      status: 'validation-error',
      error: validationError,
    });

    expect(onAuthenticated).not.toHaveBeenCalled();
    expect(onUnauthenticated).not.toHaveBeenCalled();
    expect(onValidationError).toHaveBeenCalledWith(validationError, { id: 'event-user' });
  });

  test('ignores a stale login failure after a newer login is validated', async () => {
    let rejectOld;
    const oldValidation = new Promise((_, reject) => { rejectOld = reject; });
    const newUser = { id: 'new-user' };
    const auth = { getCurrentUser: jest.fn().mockReturnValueOnce(oldValidation).mockResolvedValueOnce(newUser) };
    const onAuthenticated = jest.fn();
    const onValidationError = jest.fn();
    const handler = createSessionValidatedLoginHandler({ auth, onAuthenticated, onValidationError });

    const oldLogin = handler({ id: 'old-user' });
    await handler(newUser);
    rejectOld(new Error('Identity session changed during validation'));
    await oldLogin;

    expect(onAuthenticated).toHaveBeenCalledWith(newUser, newUser);
    expect(onValidationError).not.toHaveBeenCalled();
  });

  test('ignores a pending login after an external session change', async () => {
    let finish;
    let sessionGeneration = 1;
    const validation = new Promise(resolve => { finish = resolve; });
    const onAuthenticated = jest.fn();
    const handler = createSessionValidatedLoginHandler({
      auth: { getCurrentUser: () => validation },
      getSessionGeneration: () => sessionGeneration,
      onAuthenticated,
    });
    const login = handler({ id: 'old-user' });
    sessionGeneration += 1;
    finish({ id: 'old-user' });
    await expect(login).resolves.toEqual({ status: 'superseded' });
    expect(onAuthenticated).not.toHaveBeenCalled();
  });

  test('ignores a pending login failure after an external session change', async () => {
    let rejectValidation;
    let sessionGeneration = 1;
    const validation = new Promise((_, reject) => { rejectValidation = reject; });
    const onValidationError = jest.fn();
    const handler = createSessionValidatedLoginHandler({
      auth: { getCurrentUser: () => validation },
      getSessionGeneration: () => sessionGeneration,
      onValidationError,
    });
    const login = handler({ id: 'old-user' });
    sessionGeneration += 1;
    rejectValidation(new Error('Old session failed'));
    await expect(login).resolves.toEqual({ status: 'superseded' });
    expect(onValidationError).not.toHaveBeenCalled();
  });

  test('waits for an asynchronous unauthenticated callback', async () => {
    let finish;
    let callbackDone = false;
    const callback = jest.fn(() => new Promise(resolve => {
      finish = () => { callbackDone = true; resolve(); };
    }));
    const handler = createSessionValidatedLoginHandler({
      auth: { getCurrentUser: jest.fn().mockResolvedValue(null) },
      onUnauthenticated: callback,
    });
    const result = handler({ id: 'user' });
    await Promise.resolve();
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callbackDone).toBe(false);
    finish();
    await expect(result).resolves.toEqual({ status: 'unauthenticated', user: null });
    expect(callbackDone).toBe(true);
  });
});

describe('shouldValidateAuthLogin', () => {
  test('validates post-initialization login events even while the auth modal is open', () => {
    expect(shouldValidateAuthLogin({
      initializationComplete: true,
      handlingIdentityToken: false,
      authModalOpen: true,
    })).toBe(true);
  });

  test('does not revalidate an Identity callback already owned by the widget', () => {
    expect(shouldValidateAuthLogin({
      initializationComplete: true,
      handlingIdentityToken: true,
      authModalOpen: false,
    })).toBe(false);
  });
});

describe('initializeAuthSession', () => {
  test('returns an authenticated result only after validating the current user', async () => {
    const config = { provider: 'netlify' };
    const user = { id: 'current-user' };
    const auth = {
      init: jest.fn().mockResolvedValue(undefined),
      getCurrentUser: jest.fn().mockResolvedValue(user),
    };

    await expect(initializeAuthSession(auth, config)).resolves.toEqual({
      status: 'authenticated', providerReady: true, user,
    });
    expect(auth.init).toHaveBeenCalledWith(config);
    expect(auth.getCurrentUser).toHaveBeenCalledTimes(1);
  });

  test('returns unauthenticated only when validation succeeds and finds no session', async () => {
    const auth = {
      init: jest.fn().mockResolvedValue(undefined),
      getCurrentUser: jest.fn().mockResolvedValue(null),
    };

    await expect(initializeAuthSession(auth, {})).resolves.toEqual({
      status: 'unauthenticated', providerReady: true, user: null,
    });
  });

  test('distinguishes provider initialization failure from a missing session', async () => {
    const providerError = new Error('Identity widget unavailable');
    const auth = {
      init: jest.fn().mockRejectedValue(providerError),
      getCurrentUser: jest.fn(),
    };

    await expect(initializeAuthSession(auth, {})).resolves.toEqual({
      status: 'provider-error', providerReady: false, error: providerError,
    });
    expect(auth.getCurrentUser).not.toHaveBeenCalled();
  });

  test('distinguishes session validation failure from a missing session', async () => {
    const validationError = new TypeError('Failed to fetch');
    const auth = {
      init: jest.fn().mockResolvedValue(undefined),
      getCurrentUser: jest.fn().mockRejectedValue(validationError),
    };

    await expect(initializeAuthSession(auth, {})).resolves.toEqual({
      status: 'validation-error', providerReady: true, error: validationError,
    });
  });

  test('handles the login event produced by an Identity token during startup', () => {
    expect(shouldHandleAuthLogin({
      initializationStarted: true,
      initializationComplete: false,
      handlingIdentityToken: true,
      tokenObserved: false,
    })).toBe(true);
  });

  test('does not treat a cached-session login event during startup as authenticated', () => {
    expect(shouldHandleAuthLogin({
      initializationStarted: true,
      initializationComplete: false,
      handlingIdentityToken: false,
      tokenObserved: false,
      authModalOpen: false,
    })).toBe(false);
  });

  test('handles a login event during startup only when an auth token was observed', () => {
    expect(shouldHandleAuthLogin({
      initializationStarted: true,
      initializationComplete: false,
      handlingIdentityToken: false,
      tokenObserved: true,
      authModalOpen: false,
    })).toBe(true);
  });

  test('handles a user login event while the app opened the auth modal', () => {
    expect(shouldHandleAuthLogin({
      initializationStarted: true,
      initializationComplete: true,
      handlingIdentityToken: false,
      tokenObserved: false,
      authModalOpen: true,
    })).toBe(true);
  });

  test('ignores a late cached-session login event after startup validation failed', () => {
    expect(shouldHandleAuthLogin({
      initializationStarted: true,
      initializationComplete: true,
      handlingIdentityToken: false,
      tokenObserved: false,
      authModalOpen: false,
    })).toBe(false);
  });
});
