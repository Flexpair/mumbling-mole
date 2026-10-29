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

export async function validateIdentitySession(identity, clearStoredSession = () => {}, clearWidgetUser = () => {
  identity.store.user = null;
}) {
  const user = identity.currentUser();
  if (!user) return null;
  if (typeof user.getUserData !== 'function') {
    throw new Error('Netlify Identity session validation is unavailable');
  }
  let savedSession = null;
  try {
    savedSession = globalThis.localStorage?.getItem('gotrue.user') ?? null;
  } catch {
    // Storage access can be disabled; session validation may still work.
  }
  const savedToken = user.token;

  try {
    await user.getUserData();
  } catch (error) {
    const sessionRejected = getIdentitySessionRejection(error) !== null ||
      [401, 403, 404].includes(error?.status);
    const currentUser = identity.currentUser();
    const widgetStillOwnsUser = identity.store?.user === user;
    if (currentUser && currentUser !== user) {
      throw new Error('Identity session changed during validation');
    }
    if (!sessionRejected) {
      // Older GoTrue clients clear a saved session on any refresh failure.
      // Restore it only when no newer session has appeared.
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
      throw error;
    }
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

  if (identity.currentUser() !== user) {
    throw new Error('Identity session changed during validation');
  }
  return user;
}
