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
  suppressNextProviderLogout = true;
  try {
    await Promise.race([
      Promise.resolve().then(() => auth.logout()),
      new Promise(resolve => setTimeout(resolve, LOGOUT_TIMEOUT_MS)),
    ]);
  } catch (error) {
    console.error('[Auth] Reauthentication logout failed:', error);
  }
}
