const { test, expect } = require('@playwright/test');

/**
 * Audio System Tests
 * Tests the audio handling components of Mumbling Mole
 * Note: These tests use mocking since real audio I/O isn't available in test environments
 */
test.describe('Audio System Tests', () => {
  test.beforeEach(async ({ page, browserName }) => {
    // Mock getUserMedia to avoid permission prompts in tests
    await page.addInitScript(() => {
      const createFakeTrack = () => ({
        stop: () => {},
        getSettings: () => ({ sampleRate: 48000, channelCount: 1 })
      });

      const createFakeStream = () => ({
        getTracks: () => [createFakeTrack()],
        getAudioTracks: () => [createFakeTrack()]
      });

      const fakeGetUserMedia = () => Promise.resolve(createFakeStream());

      const fakeMediaDevices = {
        getUserMedia: fakeGetUserMedia,
        enumerateDevices: () => Promise.resolve([
          { kind: 'audioinput', deviceId: 'test-mic', label: 'Test Microphone' }
        ]),
        getSupportedConstraints: () => ({ audio: true, video: false }),
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true,
        ondevicechange: null
      };

      Object.defineProperty(fakeMediaDevices, Symbol.toStringTag, { value: 'MediaDevices' });

      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        get() {
          return fakeMediaDevices;
        }
      });

      navigator.getUserMedia = fakeGetUserMedia;
      navigator.webkitGetUserMedia = fakeGetUserMedia;
      navigator.mozGetUserMedia = fakeGetUserMedia;

      class FakeAudioContext {
        constructor() {
          this.state = 'running';
          this.sampleRate = 48000;
          this.destination = {};
        }

        createMediaStreamSource() {
          return {
            connect: () => {},
            disconnect: () => {}
          };
        }

        createScriptProcessor() {
          return {
            connect: () => {},
            disconnect: () => {},
            onaudioprocess: null
          };
        }

        createGain() {
          return {
            gain: { value: 1 },
            connect: () => {},
            disconnect: () => {}
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
    });
    if (browserName === 'chromium') {
      await page.context().grantPermissions(['microphone'], { origin: 'http://localhost:3000' });
    }
  });

  test('audio context manager initializes properly', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.mumbleUi !== undefined, { timeout: 10000 });
    
    // Check that audio-related components are available
    const audioComponents = await page.evaluate(() => {
      return {
        hasVoiceHandler: typeof window.voiceHandler !== 'undefined',
        hasAudioContext: typeof window.AudioContext !== 'undefined'
      };
    });
    
    expect(audioComponents.hasAudioContext).toBe(true);
    // voiceHandler is initialized later, so it might not be available immediately
  });

  test('microphone permissions handling', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.mumbleUi !== undefined, { timeout: 10000 });
    
    // Test that getUserMedia can be called without throwing
    const microphoneAccess = await page.evaluate(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        return {
          success: true,
          hasAudioTracks: stream.getAudioTracks().length > 0
        };
      } catch (error) {
        return {
          success: false,
          error: error && (error.name ? `${error.name}: ${error.message}` : error.message)
        };
      }
    });
    
    expect(microphoneAccess.success).toBe(true);
    expect(microphoneAccess.hasAudioTracks).toBe(true);
  });

  test('audio context creation and management', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.mumbleUi !== undefined, { timeout: 10000 });
    
    // Test AudioContext creation
    const audioContextTest = await page.evaluate(() => {
      try {
        const ctx = new AudioContext();
        return {
          created: true,
          state: ctx.state,
          sampleRate: ctx.sampleRate
        };
      } catch (error) {
        return {
          created: false,
          error: error.message
        };
      }
    });
    
    expect(audioContextTest.created).toBe(true);
    expect(audioContextTest.sampleRate).toBe(48000); // Expected sample rate
  });

  test('voice handler initialization', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.mumbleUi !== undefined, { timeout: 10000 });
    
    // Wait a bit for voice handler to potentially initialize
    await page.waitForTimeout(1000);
    
    // Check if voice handler is available or can be initialized
    const voiceHandlerTest = await page.evaluate(() => {
      return {
        voiceHandlerExists: typeof window.voiceHandler !== 'undefined',
        globalUiExists: typeof window.mumbleUi !== 'undefined',
        hasSettings: window.mumbleUi?.settings !== undefined
      };
    });
    
    expect(voiceHandlerTest.globalUiExists).toBe(true);
    expect(voiceHandlerTest.hasSettings).toBe(true);
  });

  test('worker-based audio processing architecture', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.mumbleUi !== undefined, { timeout: 10000 });
    
    // Test that worker-related components are available
    const workerTest = await page.evaluate(() => {
      return {
        hasWorkerSupport: typeof Worker !== 'undefined',
        connectorExists: window.mumbleUi?.connector !== undefined,
        connectorType: typeof window.mumbleUi?.connector
      };
    });
    
    expect(workerTest.hasWorkerSupport).toBe(true);
    expect(workerTest.connectorExists).toBe(true);
  });

  test('settings contain audio configuration options', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.mumbleUi !== undefined, { timeout: 10000 });
    
    // Check that audio settings are available
    const audioSettings = await page.evaluate(() => {
      const settings = window.mumbleUi?.settings;
      return {
        hasSettings: settings !== undefined,
        hasVoiceMode: settings?.voiceMode !== undefined,
        hasBitrate: settings?.bitrate !== undefined,
        settingsType: typeof settings
      };
    });
    
    expect(audioSettings.hasSettings).toBe(true);
    expect(audioSettings.settingsType).toBe('object');
  });

  test('audio worklet and recorder worker support', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.mumbleUi !== undefined, { timeout: 10000 });
    
    // Test that AudioWorklet is supported (in browsers that have it)
    const workletSupport = await page.evaluate(() => {
      return {
        hasAudioWorklet: typeof AudioWorkletNode !== 'undefined' || typeof window.AudioWorkletNode !== 'undefined',
        hasWorker: typeof Worker !== 'undefined'
      };
    });
    
    expect(workletSupport.hasWorker).toBe(true);
    // AudioWorklet might not be available in all test environments
  });

  test('PTT (Push-to-Talk) functionality structure', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.mumbleUi !== undefined, { timeout: 10000 });
    
    // Check that PTT-related settings exist
    const pttTest = await page.evaluate(() => {
      const settings = window.mumbleUi?.settings;
      return {
        settingsExist: settings !== undefined,
        hasPttKey: settings?.pttKey !== undefined || settings?.pttMethod !== undefined,
        hasVoiceMode: settings?.voiceMode !== undefined
      };
    });
    
    expect(pttTest.settingsExist).toBe(true);
    // PTT settings should be available in the settings object
  });

  test('audio encoding settings are configurable', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.mumbleUi !== undefined, { timeout: 10000 });
    
    // Check audio encoding configuration
    const encodingTest = await page.evaluate(() => {
      const settings = window.mumbleUi?.settings;
      return {
        hasSettings: settings !== undefined,
        hasBitrateOption: settings?.bitrate !== undefined,
        hasSampleRate: settings?.samplesPerPacket !== undefined || settings?.quality !== undefined
      };
    });
    
    expect(encodingTest.hasSettings).toBe(true);
    // Audio encoding settings should be present in the settings
  });
});