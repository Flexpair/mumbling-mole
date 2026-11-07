import { jest, it, expect } from '@jest/globals';
import { createApp, h } from '../../node_modules/vue/index.js';

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

const auth = {
  on: jest.fn(),
  init: jest.fn(),
  getCurrentUser: jest.fn(),
};
const dialogStore = { connectDialog: {}, showErrorDialog: jest.fn() };
jest.unstable_mockModule('../../app/auth/AuthFactory', () => ({ default: { create: () => auth } }));
jest.unstable_mockModule('vue', () => ({ createApp }));
jest.unstable_mockModule('pinia', () => ({ createPinia: () => ({ install() {} }), setActivePinia: jest.fn() }));
jest.unstable_mockModule('../../app/components/App.vue', () => ({ default: { render: () => h('main', 'Application ready') } }));
jest.unstable_mockModule('../../app/plugins/pinia-debug', () => ({ createPiniaDebugPlugin: jest.fn() }));
jest.unstable_mockModule('../../app/stores/userStore', () => ({ useUserStore: () => ({}) }));
jest.unstable_mockModule('../../app/stores/audioStore', () => ({ useAudioStore: () => ({}) }));
jest.unstable_mockModule('../../app/stores/voiceStore', () => ({ useVoiceStore: () => ({}) }));
jest.unstable_mockModule('../../app/stores/uiStore', () => ({ useUIStore: () => ({}) }));
jest.unstable_mockModule('../../app/stores/dialogStore', () => ({ useDialogStore: () => dialogStore }));
jest.unstable_mockModule('../../app/stores/settingsStore', () => ({ useSettingsStore: () => ({ initWithDefaults: jest.fn() }) }));
jest.unstable_mockModule('../../app/stores/connectionStore', () => ({ useConnectionStore: () => ({}) }));
jest.unstable_mockModule('../../app/audio/voice', () => ({ enumMicrophones: jest.fn() }));
jest.unstable_mockModule('../../app/localize', () => ({ translate: jest.fn() }));
jest.unstable_mockModule('../../app/composables/index.js', () => ({ vTooltip: {}, announceToScreenReader: jest.fn() }));
jest.unstable_mockModule('../../app/auth/credentials-service.js', () => ({ clearCredentials: jest.fn() }));

it('mounts while authentication is pending and logs an unexpected rejection', async () => {
  const initialization = deferred();
  const reported = deferred();
  const failure = new Error('invalid user metadata');
  const documentListeners = jest.spyOn(document, 'addEventListener');
  const windowListeners = jest.spyOn(globalThis, 'addEventListener');
  const errorLog = jest.spyOn(console, 'error').mockImplementation((message, error) => {
    reported.resolve({ message, error });
  });
  const previousOnload = globalThis.onload;
  const previousBody = document.body.innerHTML;
  document.body.innerHTML = '<div id="app"></div>';
  globalThis.mumbleWebConfig = { settings: {}, defaults: {} };
  auth.init.mockReturnValue(initialization.promise);
  auth.getCurrentUser.mockResolvedValue({
    get user_metadata() { throw failure; },
  });

  try {
    await import('../../app/index.js');
    await globalThis.onload();
    expect(document.querySelector('#app main')?.textContent).toBe('Application ready');
    expect(document.documentElement.classList.contains('app-mounted')).toBe(true);

    initialization.resolve();
    await expect(reported.promise).resolves.toEqual({
      message: '[Auth] Unexpected error during authentication initialization:',
      error: failure,
    });
  } finally {
    for (const [type, listener, options] of documentListeners.mock.calls) {
      document.removeEventListener(type, listener, options);
    }
    for (const [type, listener, options] of windowListeners.mock.calls) {
      globalThis.removeEventListener(type, listener, options);
    }
    documentListeners.mockRestore();
    windowListeners.mockRestore();
    errorLog.mockRestore();
    document.body.innerHTML = previousBody;
    document.documentElement.classList.remove('app-mounted');
    globalThis.onload = previousOnload;
    delete globalThis.mumbleWebConfig;
    delete globalThis.mumbleUi;
    delete globalThis.mumbleLog;
    delete globalThis.__VUE_APP__;
  }
});
