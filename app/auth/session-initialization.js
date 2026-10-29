export function shouldHandleAuthLogin({ initializationStarted, initializationComplete, handlingIdentityToken, tokenObserved, authModalOpen }) {
  return handlingIdentityToken || !initializationStarted || tokenObserved ||
    (initializationComplete && authModalOpen);
}

export function shouldValidateAuthLogin({ initializationComplete, handlingIdentityToken }) {
  return initializationComplete && !handlingIdentityToken;
}

export function createSessionValidatedLoginHandler({
  auth,
  onAuthenticated = () => {},
  onUnauthenticated = () => {},
  onValidationError = () => {},
}) {
  let loginGeneration = 0;
  return async function handleSessionValidatedLogin(eventUser) {
    const generation = ++loginGeneration;
    try {
      const user = await auth.getCurrentUser();
      if (generation !== loginGeneration) return { status: 'superseded' };
      if (!user) {
        await onUnauthenticated();
        return { status: 'unauthenticated', user: null };
      }

      await onAuthenticated(user, eventUser);
      return { status: 'authenticated', user };
    } catch (error) {
      if (generation !== loginGeneration) return { status: 'superseded' };
      await onValidationError(error, eventUser);
      return { status: 'validation-error', error };
    }
  };
}

export async function initializeAuthSession(auth, config) {
  let providerReady = false;
  try {
    await auth.init(config);
    providerReady = true;
  } catch (error) {
    return {
      status: 'provider-error',
      providerReady: false,
      error,
    };
  }

  try {
    const user = await auth.getCurrentUser();
    return {
      status: user ? 'authenticated' : 'unauthenticated',
      providerReady,
      user,
    };
  } catch (error) {
    return {
      status: 'validation-error',
      providerReady,
      error,
    };
  }
}
