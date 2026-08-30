import { clearCredentials } from '../auth/credentials-service.js';
import { invalidateConnectionAttempt } from './connectionAttempt.js';

const LOGOUT_TIMEOUT_MS = 1500;
let suppressNextProviderLogout = false;

export function shouldHandleProviderLogout() {
  if (!suppressNextProviderLogout) return true;
  suppressNextProviderLogout = false;
  return false;
}

export function resetSessionState({
  uiStore,
  audioStore,
  voiceStore,
  connectionStore,
  userStore,
  dialogStore,
}) {
  invalidateConnectionAttempt();
  uiStore.guacamoleFrame?.stop?.();
  audioStore.stopBeep();
  voiceStore.reset();
  connectionStore.disconnect();
  userStore.reset();
  dialogStore?.resetConnectDialog?.();
  uiStore.reset();
}

export async function logoutSession(dependencies, reload = () => globalThis.location.reload()) {
  suppressNextProviderLogout = false;
  clearCredentials();
  resetSessionState(dependencies);

  let timeoutId;
  try {
    await Promise.race([
      Promise.resolve().then(() => dependencies.auth.logout()),
      new Promise(resolve => {
        timeoutId = setTimeout(resolve, LOGOUT_TIMEOUT_MS);
      }),
    ]);
  } catch (error) {
    console.error('[Auth] Logout failed:', error);
  } finally {
    clearTimeout(timeoutId);
  }

  reload();
}

export async function logoutForReauthentication(auth) {
  const suppressProviderEvent = auth.supportsLogoutEventSuppression === true;
  if (!suppressProviderEvent) suppressNextProviderLogout = true;
  let providerLogoutObserved = false;
  let timeoutId;
  try {
    await Promise.race([
      Promise.resolve().then(() => auth.logout({ suppressProviderEvent })).then(() => {
        providerLogoutObserved = true;
      }),
      new Promise(resolve => {
        timeoutId = setTimeout(resolve, LOGOUT_TIMEOUT_MS);
      }),
    ]);
  } catch (error) {
    console.error('[Auth] Reauthentication logout failed:', error);
  } finally {
    clearTimeout(timeoutId);
    if (!suppressProviderEvent && !providerLogoutObserved) suppressNextProviderLogout = false;
  }
}
