const { test, expect } = require('@playwright/test');

const DEFAULT_ROLES = ['watch', 'edit'];

async function installIdentityMocks(page, roles = DEFAULT_ROLES) {
  const uniqueRoles = Array.from(new Set(['watch', ...roles]));
  await page.addInitScript(({ roles: roleList }) => {
    const identityUser = {
      app_metadata: {
        roles: roleList,
      },
    };

    const identityStub = {
      init() {},
      on() {},
      open() {},
      close() {},
      logout() {},
      currentUser: () => identityUser,
    };

    window.__mumbleTestIdentityStub = identityStub;
    window.netlifyIdentity = identityStub;
  }, { roles: uniqueRoles });
}

async function installMediaMocks(page, { initialAllow = true, controllable = false } = {}) {
  await page.addInitScript(({ allowInitial, controllableFlag }) => {
    const createFakeTrack = () => ({
      stop() {},
      getSettings: () => ({ sampleRate: 48000, channelCount: 1 }),
    });

    const fakeStream = {
      getTracks: () => [createFakeTrack()],
      getAudioTracks: () => [createFakeTrack()],
    };

    let allow = allowInitial;

    const fakeGetUserMedia = () => {
      if (allow) {
        return Promise.resolve(fakeStream);
      }
      const error = new Error('Microphone access denied');
      error.name = 'NotAllowedError';
      return Promise.reject(error);
    };

    const fakeMediaDevices = {
      getUserMedia: fakeGetUserMedia,
      enumerateDevices: () => Promise.resolve([
        { kind: 'audioinput', deviceId: 'test-mic', label: 'Test Microphone' },
      ]),
      getSupportedConstraints: () => ({ audio: true }),
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent: () => true,
      ondevicechange: null,
    };

    Object.defineProperty(fakeMediaDevices, Symbol.toStringTag, { value: 'MediaDevices' });

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      get() {
        return fakeMediaDevices;
      },
    });

    navigator.getUserMedia = fakeGetUserMedia;
    navigator.webkitGetUserMedia = fakeGetUserMedia;
    navigator.mozGetUserMedia = fakeGetUserMedia;

    if (controllableFlag) {
      window.__setMicPermission = (value) => {
        allow = !!value;
      };
    } else {
      delete window.__setMicPermission;
    }

    class FakeAudioContext {
      constructor() {
        this.state = 'running';
        this.sampleRate = 48000;
        this.destination = {};
        this.audioWorklet = {
          addModule: () => Promise.resolve(),
        };
      }

      createMediaStreamSource() {
        return {
          connect() {},
          disconnect() {},
        };
      }

      createGain() {
        return {
          gain: { value: 1 },
          connect() {},
          disconnect() {},
        };
      }

      resume() {
        this.state = 'running';
        return Promise.resolve();
      }

      suspend() {
        this.state = 'suspended';
        return Promise.resolve();
      }

      close() {
        this.state = 'closed';
        return Promise.resolve();
      }
    }

    window.AudioContext = FakeAudioContext;
    window.webkitAudioContext = FakeAudioContext;
  }, { allowInitial: initialAllow, controllableFlag: controllable });
}

async function syncIdentityWithUI(page) {
  await page.evaluate(() => {
    if (window.mumbleUi && window.__mumbleTestIdentityStub) {
      window.mumbleUi.netlifyIdentity = window.__mumbleTestIdentityStub;
    }
  });
}

async function bootstrapPage(page, { roles = DEFAULT_ROLES, media } = {}) {
  await installIdentityMocks(page, roles);
  await installMediaMocks(page, media);
  await page.goto('/');
  await page.waitForFunction(() => window.mumbleUi !== undefined, { timeout: 10000 });
  await syncIdentityWithUI(page);
}

async function setAudioContext(page, sampleRate) {
  await page.evaluate((rate) => {
    const contextStub = {
      sampleRate: rate,
      state: 'running',
      resume: () => Promise.resolve(),
      suspend: () => Promise.resolve(),
    };
    window.mumbleUi.audioContext = contextStub;
    window.mumbleUi.initializeAudioContext = async () => {
      window.mumbleUi.audioContext = contextStub;
      return contextStub;
    };
  }, sampleRate);
}

async function stubConnector(page) {
  await page.evaluate(() => {
    class Emitter {
      constructor() {
        this._handlers = new Map();
      }

      on(event, handler) {
        if (!this._handlers.has(event)) {
          this._handlers.set(event, []);
        }
        this._handlers.get(event).push(handler);
        return this;
      }

      emit(event, ...args) {
        (this._handlers.get(event) || []).forEach((handler) => handler(...args));
      }
    }

    class FakeChannel extends Emitter {
      constructor(id, name, parent = null) {
        super();
        this.id = id;
        this.name = name;
        this.description = '';
        this.position = 0;
        this.parent = parent;
        this.links = [];
        this.children = [];
      }
    }

    class FakeUser extends Emitter {
      constructor(id, name, channel) {
        super();
        this.uniqueId = id;
        this.username = name;
        this.mute = false;
        this.deaf = false;
        this.suppress = false;
        this.selfMute = false;
        this.selfDeaf = false;
        this.channel = channel;
      }

      setChannel(channel) {
        this.channel = channel;
        this.emit('update', this, { channel });
      }
    }

    class FakeClient extends Emitter {
      constructor(username) {
        super();
        this._root = new FakeChannel(1, 'Root');
        const lobby = new FakeChannel(2, 'Lobby', this._root);
        this._root.children.push(lobby);
        this.users = [];
        this._self = new FakeUser(10, username || 'guest', lobby);
        this.users.push(this._self);
        this.maxBandwidth = 72000;
      }

      get root() {
        return this._root;
      }

      get self() {
        return this._self;
      }

      disconnect() {}
      setAudioQuality() {}
      setSelfMute() {}
      setSelfDeaf() {}
      getMaxBitrate() {
        return 72000;
      }
      getActualBitrate() {
        return 64000;
      }
      createVoiceStream() {
        return {
          write(_chunk, callback) {
            if (callback) callback();
          },
          end() {},
        };
      }
    }

    window.mumbleUi.connector.connect = async (_url, params) => {
      return new FakeClient(params.username);
    };
  });
}

async function fillConnectDialog(page, overrides = {}) {
  const defaults = {
    address: 'voice.example.com',
    port: '64738',
    username: 'playwright',
    password: 'secret',
  };
  const params = { ...defaults, ...overrides };
  await page.evaluate((dialogValues) => {
    const ui = window.mumbleUi;
    ui.connectDialog.address(dialogValues.address);
    ui.connectDialog.port(dialogValues.port);
    ui.connectDialog.username(dialogValues.username);
    ui.connectDialog.password(dialogValues.password);
  }, params);
}

async function triggerConnect(page, overrides = {}) {
  const defaults = {
    address: 'voice.example.com',
    port: '64738',
    username: 'playwright',
    password: 'secret',
  };
  const params = { ...defaults, ...overrides };
  await page.evaluate(async (connectParams) => {
    const ui = window.mumbleUi;
    await ui.connect(
      connectParams.address,
      connectParams.port,
      connectParams.username,
      connectParams.password
    );
  }, params);
}

test.describe('Connection Flow', () => {
  test('joins with stubbed connector and exposes Guacamole iframe', async ({ page }) => {
    await bootstrapPage(page, { media: { initialAllow: true } });

    await setAudioContext(page, 48000);
    await stubConnector(page);
    await fillConnectDialog(page);
    await triggerConnect(page);

    await page.waitForFunction(() => !!window.mumbleUi.client, { timeout: 5000 });

    const state = await page.evaluate(() => {
      const ui = window.mumbleUi;
      const root = ui.root();
      const lobby = root?.channels?.()[0];
      return {
        guacVisible: ui.guacamoleFrame.visible(),
        guacSource: ui.guacamoleFrame.guacSource(),
        username: ui.thisUser()?.name?.(),
        rootChannel: root?.name?.(),
        lobbyName: lobby?.name?.(),
      };
    });

    expect(state.guacVisible).toBe(true);
    expect(state.guacSource).toContain('/guacamole/#/?username=editor');
    expect(state.guacSource).toContain('password=secret');
    expect(state.username).toBe('playwright');
    expect(state.rootChannel).toBe('Root');
    expect(state.lobbyName).toBe('Lobby');
  });

  test('surfaces microphone denial and recovers after retry', async ({ page }) => {
    await bootstrapPage(page, { media: { initialAllow: false, controllable: true } });

    await setAudioContext(page, 48000);
    await stubConnector(page);
    await fillConnectDialog(page);

    await triggerConnect(page);

    await page.waitForFunction(() => window.mumbleUi.micPermissionDenied(), { timeout: 5000 });

    const deniedState = await page.evaluate(() => ({
      denied: window.mumbleUi.micPermissionDenied(),
      message: (() => {
        const field = window.mumbleUi.micPermissionErrorMessage;
        if (typeof field === 'function') {
          return field();
        }
        return field ?? '';
      })(),
      overlayVisible: (() => {
        const el = document.querySelector('.mic-permission-retry');
        if (!el) return false;
        return window.getComputedStyle(el).display !== 'none';
      })(),
    }));

    expect(deniedState.denied).toBe(true);
    expect(typeof deniedState.message).toBe('string');
    expect(deniedState.overlayVisible).toBe(true);

    await page.evaluate(() => window.__setMicPermission(true));
    await page.evaluate(() => window.mumbleUi.retryMicrophonePermission());

    await page.waitForFunction(() => !window.mumbleUi.micPermissionDenied(), { timeout: 5000 });

    const recoveredState = await page.evaluate(() => ({
      denied: window.mumbleUi.micPermissionDenied(),
      message: (() => {
        const field = window.mumbleUi.micPermissionErrorMessage;
        if (typeof field === 'function') {
          return field();
        }
        return field ?? '';
      })(),
      overlayVisible: (() => {
        const el = document.querySelector('.mic-permission-retry');
        if (!el) return false;
        return window.getComputedStyle(el).display !== 'none';
      })(),
    }));

    expect(recoveredState.denied).toBe(false);
    expect(recoveredState.message).toBe('');
    expect(recoveredState.overlayVisible).toBe(false);
  });

  test('persists settings changes across reloads', async ({ page }) => {
    await bootstrapPage(page, { media: { initialAllow: true } });

    await page.evaluate(() => {
      window.localStorage.clear();
      window.mumbleUi.openSettings();
      const dialog = window.mumbleUi.settingsDialog();
      dialog.voiceMode('ptt');
      dialog.pttKey('CTRL + SPACE');
      dialog.pttKeyDisplay('CTRL + SPACE');
      dialog.audioBitrate(96000);
      dialog.samplesPerPacket(1920);
      window.mumbleUi.applySettings();
    });

    const stored = await page.evaluate(() => ({
      voiceMode: window.localStorage.getItem('mumble.voiceMode'),
      pttKey: window.localStorage.getItem('mumble.pttKey'),
      bitrate: window.localStorage.getItem('mumble.audioBitrate'),
      samplesPerPacket: window.localStorage.getItem('mumble.samplesPerPacket'),
    }));

    expect(stored.voiceMode).toBe('ptt');
    expect(stored.pttKey).toBe('CTRL + SPACE');
    expect(stored.bitrate).toBe('96000');
    expect(stored.samplesPerPacket).toBe('1920');

    await page.reload();
    await page.waitForFunction(() => window.mumbleUi !== undefined, { timeout: 10000 });
    await syncIdentityWithUI(page);

    const persisted = await page.evaluate(() => ({
      voiceMode: window.mumbleUi.settings.voiceMode,
      pttKey: window.mumbleUi.settings.pttKey,
      bitrate: window.mumbleUi.settings.audioBitrate,
      samplesPerPacket: window.mumbleUi.settings.samplesPerPacket,
    }));

    expect(persisted.voiceMode).toBe('ptt');
    expect(persisted.pttKey).toBe('CTRL + SPACE');
    expect(persisted.bitrate).toBe(96000);
    expect(persisted.samplesPerPacket).toBe(1920);
  });
});
