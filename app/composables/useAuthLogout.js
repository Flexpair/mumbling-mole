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

async function clearLocalSessionOrFail(auth) {
  try {
    const cleared = await auth.clearLocalSession?.();
    if (cleared === true) return true;
  } catch (error) {
    console.error('[Auth] Local session cleanup failed:', error);
  }
  console.error('[Auth] Logout could not confirm that the local session was cleared.');
  globalThis.alert?.('Logout could not be completed. Close this browser window and clear its site data before sharing this device.');
  return false;
}

export async function logoutSession(dependencies, reload = () => globalThis.location.reload()) {
  suppressNextProviderLogout = false;
  clearCredentials();
  resetSessionState(dependencies);

  let timeoutId;
  let logoutSucceeded = false;
  try {
    logoutSucceeded = await Promise.race([
      Promise.resolve().then(() => dependencies.auth.logout()).then(() => true),
      new Promise(resolve => {
        timeoutId = setTimeout(resolve, LOGOUT_TIMEOUT_MS);
      }),
    ]);
  } catch (error) {
    console.error('[Auth] Logout failed:', error);
  } finally {
    clearTimeout(timeoutId);
  }

  if (!logoutSucceeded && !await clearLocalSessionOrFail(dependencies.auth)) return false;
  reload();
  return true;
}

export async function logoutForReauthentication(
  auth,
  reload = () => globalThis.location.reload()
) {
  const suppressProviderEvent = auth.supportsLogoutEventSuppression === true;
  if (!suppressProviderEvent) suppressNextProviderLogout = true;
  let providerLogoutObserved = false;
  let timedOut = false;
  let timeoutId;
  const controller = new AbortController();
  try {
    await Promise.race([
      Promise.resolve().then(() => auth.logout({
        suppressProviderEvent,
        signal: controller.signal,
      })).then(() => {
        providerLogoutObserved = true;
      }),
      new Promise(resolve => {
        timeoutId = setTimeout(() => {
          timedOut = true;
          controller.abort();
          resolve();
        }, LOGOUT_TIMEOUT_MS);
      }),
    ]);
  } catch (error) {
    if (error?.name !== 'AbortError') {
      console.error('[Auth] Reauthentication logout failed:', error);
    }
  } finally {
    clearTimeout(timeoutId);
    if (!suppressProviderEvent && !providerLogoutObserved) suppressNextProviderLogout = false;
  }

  if (timedOut || !providerLogoutObserved) {
    if (!await clearLocalSessionOrFail(auth)) return false;
  }
  if (timedOut) {
    reload();
    return false;
  }
  return true;
}
