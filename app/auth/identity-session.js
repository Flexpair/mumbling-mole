// Test only the canonical invalid-token response. GoTrue refresh errors
// intentionally omit their HTTP status but include error_description.
const INVALID_REFRESH_TOKEN_ERROR = /Invalid refresh token|refresh token expired|invalid access token/i;

export function getIdentitySessionRejection(error) {
  if ([401, 403, 404].includes(error?.status)) return null;
  const errorCode = String(error?.json?.error ?? error?.error ?? '').toLowerCase();
  const errorDescription = String(error?.json?.error_description ?? '').toLowerCase();
  const message = String(error?.message ?? '');
  if (errorCode === 'invalid_grant' || errorCode === 'invalid_token' ||
    INVALID_REFRESH_TOKEN_ERROR.test(`${errorDescription} ${message}`)) {
    return 'rejected-token';
  }
  return null;
}

function readSavedIdentitySession() {
  try {
    return globalThis.localStorage?.getItem('gotrue.user') ?? null;
  } catch {
    // Storage access can be disabled; session validation may still work.
    return null;
  }
}

function getCurrentUserOrThrowIfReplaced(identity, user, allowMissing = false) {
  const currentUser = identity.currentUser();
  if (!isExpectedCurrentUser(currentUser, user, allowMissing)) {
    throw new Error('Identity session changed during validation');
  }
  return currentUser;
}

function isExpectedCurrentUser(currentUser, user, allowMissing) {
  return currentUser === user || (allowMissing && !currentUser);
}

function restoreSessionAfterTransientFailure(user, currentUser, widgetStillOwnsUser, savedSession, savedToken) {
  if (!currentUser && widgetStillOwnsUser && savedSession && savedToken && !user.token) {
    try {
      if (!globalThis.localStorage?.getItem('gotrue.user')) {
        globalThis.localStorage?.setItem('gotrue.user', savedSession);
        user.token = savedToken;
      }
    } catch {
      // Propagate the original validation error if storage is unavailable.
    }
  }
}

async function clearRejectedIdentitySession(identity, user, clearStoredSession, clearWidgetUser, currentUser, widgetStillOwnsUser) {
  if (!currentUser && !widgetStillOwnsUser) {
    throw new Error('Identity session changed during validation');
  }

  try {
    if (typeof user.clearSession === 'function') {
      await user.clearSession();
    } else {
      clearStoredSession();
    }
  } catch (clearError) {
    console.warn('[Auth] Could not clear rejected identity session:', clearError);
  }

  if (identity.store?.user === user) {
    clearWidgetUser();
  }
  return null;
}

async function handleIdentitySessionValidationFailure(identity, user, error, clearStoredSession, clearWidgetUser, savedSession, savedToken) {
  const sessionRejected = getIdentitySessionRejection(error) !== null ||
    [401, 403, 404].includes(error?.status);
  const currentUser = getCurrentUserOrThrowIfReplaced(identity, user, true);
  const widgetStillOwnsUser = identity.store?.user === user;

  if (!sessionRejected) {
    restoreSessionAfterTransientFailure(user, currentUser, widgetStillOwnsUser, savedSession, savedToken);
    throw error;
  }

  return await clearRejectedIdentitySession(identity, user, clearStoredSession, clearWidgetUser, currentUser, widgetStillOwnsUser);
}

export async function validateIdentitySession(identity, clearStoredSession = () => {}, clearWidgetUser = () => {
  identity.store.user = null;
}) {
  const user = identity.currentUser();
  if (!user) return null;
  if (typeof user.getUserData !== 'function') {
    throw new TypeError('Netlify Identity session validation is unavailable');
  }
  const savedSession = readSavedIdentitySession();
  const savedToken = user.token;

  try {
    await user.getUserData();
  } catch (error) {
    return await handleIdentitySessionValidationFailure(identity, user, error, clearStoredSession, clearWidgetUser, savedSession, savedToken);
  }

  getCurrentUserOrThrowIfReplaced(identity, user);
  return user;
}
