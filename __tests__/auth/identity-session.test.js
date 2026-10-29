import { jest } from '@jest/globals';
import { validateIdentitySession } from '../../app/auth/identity-session.js';

describe('validateIdentitySession', () => {
  test('returns null when there is no cached user', async () => {
    const identity = { currentUser: jest.fn().mockReturnValue(null) };

    await expect(validateIdentitySession(identity)).resolves.toBeNull();
    expect(identity.currentUser).toHaveBeenCalledTimes(1);
  });

  test('returns only the user whose current Identity session validates', async () => {
    const user = { id: 'current-user', getUserData: jest.fn().mockResolvedValue(undefined) };
    const identity = { currentUser: jest.fn().mockReturnValue(user) };

    await expect(validateIdentitySession(identity)).resolves.toBe(user);
    expect(user.getUserData).toHaveBeenCalledTimes(1);
    expect(identity.currentUser).toHaveBeenCalledTimes(2);
  });

  test('does not return an unvalidated replacement user after a pending check', async () => {
    let finishValidation;
    const first = { getUserData: jest.fn(() => new Promise(resolve => { finishValidation = resolve; })) };
    const replacement = { getUserData: jest.fn() };
    let current = first;
    const identity = { currentUser: () => current };

    const checking = validateIdentitySession(identity);
    current = replacement;
    finishValidation();

    await expect(checking).rejects.toThrow('Identity session changed during validation');
    expect(replacement.getUserData).not.toHaveBeenCalled();
  });

  test('does not clear a replacement session when the old validation is rejected', async () => {
    let rejectValidation;
    const first = {
      getUserData: jest.fn(() => new Promise((_, reject) => { rejectValidation = reject; })),
      clearSession: jest.fn(),
    };
    const replacement = { id: 'replacement' };
    let current = first;
    const identity = { currentUser: () => current, store: { user: replacement } };
    const checking = validateIdentitySession(identity);
    current = replacement;
    rejectValidation(Object.assign(new Error('Unauthorized'), { status: 401 }));

    await expect(checking).rejects.toThrow('Identity session changed during validation');
    expect(first.clearSession).not.toHaveBeenCalled();
    expect(identity.store.user).toBe(replacement);
  });

  test('clears an expired refresh-token session before reporting no user', async () => {
    const user = {
      id: 'stale-user',
      getUserData: jest.fn().mockRejectedValue({
        message: 'Request failed',
        json: { error: 'access_denied', error_description: 'Invalid refresh token' },
      }),
      clearSession: jest.fn(),
    };
    const identity = {
      currentUser: jest.fn().mockReturnValue(user),
      store: { user },
    };

    await expect(validateIdentitySession(identity)).resolves.toBeNull();
    expect(user.clearSession).toHaveBeenCalledTimes(1);
    expect(identity.store.user).toBeNull();
  });

  test('clears an unauthorized Identity session and synchronizes widget state', async () => {
    const unauthorizedError = Object.assign(new Error('Unauthorized'), { status: 401 });
    const user = {
      id: 'stale-user',
      getUserData: jest.fn().mockRejectedValue(unauthorizedError),
      clearSession: jest.fn(),
    };
    const identity = { currentUser: jest.fn().mockReturnValue(user), store: { user } };

    await expect(validateIdentitySession(identity)).resolves.toBeNull();
    expect(user.clearSession).toHaveBeenCalledTimes(1);
    expect(identity.store.user).toBeNull();
  });

  test('preserves the session and propagates a transient validation failure', async () => {
    const networkError = new TypeError('Failed to fetch');
    const user = { getUserData: jest.fn().mockRejectedValue(networkError) };
    const identity = { currentUser: jest.fn().mockReturnValue(user) };

    await expect(validateIdentitySession(identity)).rejects.toBe(networkError);
    expect(user.clearSession).toBeUndefined();
  });

  test('does not restore a session if another login replaced it during a refresh error', async () => {
    const error = new TypeError('Failed to fetch');
    const first = { token: { access_token: 'first' } };
    const replacement = { token: { access_token: 'new' } };
    let rejectValidation;
    first.getUserData = jest.fn(() => new Promise((_, reject) => { rejectValidation = reject; }));
    const identity = { currentUser: () => null, store: { user: first } };
    localStorage.setItem('gotrue.user', 'old session');
    identity.currentUser = jest.fn().mockReturnValueOnce(first).mockReturnValue(null);
    const checking = validateIdentitySession(identity);
    first.token = null;
    identity.store.user = replacement;
    localStorage.setItem('gotrue.user', 'new session');
    rejectValidation(error);

    await expect(checking).rejects.toBe(error);
    expect(localStorage.getItem('gotrue.user')).toBe('new session');
    expect(first.token).toBeNull();
    localStorage.removeItem('gotrue.user');
  });

  test('propagates unrelated JSON HTTP errors without clearing the session', async () => {
    const serverError = Object.assign(new Error('Internal Server Error'), {
      status: 500,
      json: { error: 'server_error' },
    });
    const user = {
      getUserData: jest.fn().mockRejectedValue(serverError),
      clearSession: jest.fn(),
    };
    const identity = { currentUser: jest.fn().mockReturnValue(user) };

    await expect(validateIdentitySession(identity)).rejects.toBe(serverError);
    expect(user.clearSession).not.toHaveBeenCalled();
  });
});
