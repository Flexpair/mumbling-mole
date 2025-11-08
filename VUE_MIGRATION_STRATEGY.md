# Vue.js Migration - Implementierungsanleitung für Programmierer

**Status:** November 2025  
**Version:** 2.0 (Konsolidierte Strategie)  
**Ziel:** Vollständige Entfernung von Knockout.js bei 100% Test-Stabilität

---

## Executive Summary

Die UI-Migration ist **abgeschlossen** (9 Vue-Komponenten, 1477 Tests bestehen). Diese Anleitung beschreibt die **finale Knockout-Entfernung** in sicheren, testbaren Schritten.

**Kritische Prinzipien:**
- ✅ **Audio-Pipeline bleibt UNVERÄNDERT** (voice.js, recorder-worker.js, Worker-Threads)
- ✅ **Tests müssen IMMER grün bleiben** (1477+ Tests)
- ✅ **Dual-Runtime während Migration** (Composables + Knockout parallel)
- ✅ **Worker-Kommunikation nicht anfassen** (nur IDs, keine Objekte)

---

## Phase 1: Test-Coverage-Boost (Woche 1) ⚠️ KRITISCH

**Warum zuerst?** Ohne solide Tests ist State-Migration zu riskant.

### 1.1 AppState.js Coverage: 31.65% → 80%+

**Datei:** `__tests__/state/AppState.test.js`

**Neue Tests hinzufügen:**

```javascript
describe('AppState - Channel Registration', () => {
  it('should register channel with single-channel mode', () => {
    const channel = { id: 1, name: 'Root' };
    const ui = appState._registerChannel(channel);
    
    expect(ui.model).toBe(channel);
    expect(ui.name()).toBe('Root');
    expect(appState.root).toBe(ui);
  });
  
  it('should update channel name reactively', () => {
    const channel = { id: 1, name: 'Initial' };
    const ui = appState._registerChannel(channel);
    
    channel.name = 'Updated';
    expect(ui.name()).toBe('Updated');
  });
});

describe('AppState - Connection Flow', () => {
  it('should perform connect with audio enabled', async () => {
    const connectArgs = {
      host: 'localhost',
      port: 64738,
      token: 'test-token',
      audioEnabled: true
    };
    
    await appState._performConnect(connectArgs);
    
    expect(appState.connection.remoteHost()).toBe('localhost');
    expect(appState.connection.remotePort()).toBe(64738);
  });
  
  it('should perform connect without audio (sample rate bypass)', async () => {
    const connectArgs = {
      host: 'localhost',
      port: 64738,
      audioEnabled: false
    };
    
    await appState._performConnect(connectArgs);
    
    expect(appState.audio.audioContext).toBeNull();
  });
  
  it('should cleanup on disconnect', async () => {
    await appState._performConnect({ host: 'localhost', port: 64738 });
    await appState._performDisconnect();
    
    expect(appState.connection.client).toBeNull();
    expect(appState.voice.voiceHandler()).toBeNull();
  });
});

describe('AppState - Backward Compatibility', () => {
  it('should delegate connected getter to user state', () => {
    appState.user.thisUser(null);
    expect(appState.connected).toBe(false);
    
    appState.user.thisUser({ id: 1, name: 'Test' });
    expect(appState.connected).toBe(true);
  });
  
  it('should delegate audioContext getter to audio state', () => {
    appState.audio.audioContext = mockAudioContext;
    expect(appState.audioContext).toBe(mockAudioContext);
  });
});
```

**Ziel:** AppState Coverage 31% → 80%+ (150+ neue Tests)

### 1.2 UserState.js Coverage: 32.5% → 90%+

**Datei:** `__tests__/state/UserState.test.js`

**Neue Tests hinzufügen:**

```javascript
describe('UserState - User Registration', () => {
  it('should register new user', () => {
    const user = { id: 1, username: 'TestUser', channel: { id: 0 } };
    const userUI = userState._registerUser(user);
    
    expect(userUI.model).toBe(user);
    expect(userUI.name()).toBe('TestUser');
    expect(userUI.talking()).toBe('off');
  });
  
  it('should handle user migration (undefined → actualID)', () => {
    // Initial registration with undefined ID
    const user = { id: undefined, username: 'Self' };
    const userUI1 = userState._registerUser(user);
    
    // Server assigns actual ID
    user.id = 42;
    const userUI2 = userState._registerUser(user);
    
    // Should return same UI object (migrated)
    expect(userUI1).toBe(userUI2);
  });
});

describe('UserState - Voice Stream Management', () => {
  it('should setup voice stream on user voice event', () => {
    const user = { id: 1, username: 'Speaker' };
    const userUI = userState._registerUser(user);
    
    const mockStream = createMockVoiceStream();
    user.emit('voice', mockStream);
    
    // Voice stream should be active
    expect(userState._activeVoiceStreams.has(mockStream.id)).toBe(true);
    expect(userUI.talking()).toBe('on');
  });
  
  it('should cleanup voice stream on disconnect', () => {
    const user = { id: 1, username: 'Speaker' };
    const userUI = userState._registerUser(user);
    const mockStream = createMockVoiceStream();
    
    user.emit('voice', mockStream);
    userState._cleanupVoiceStream(mockStream.id);
    
    expect(userState._activeVoiceStreams.has(mockStream.id)).toBe(false);
    expect(userUI.talking()).toBe('off');
  });
});

describe('UserState - Cross-Module Subscriptions', () => {
  it('should sync selfMute to VoiceState', () => {
    const voiceStateMock = { setMute: jest.fn() };
    const userState = new UserState(audioState, voiceStateMock);
    
    userState.selfMute(true);
    expect(voiceStateMock.setMute).toHaveBeenCalledWith(true);
    
    userState.selfMute(false);
    expect(voiceStateMock.setMute).toHaveBeenCalledWith(false);
  });
  
  it('should respect audio lock when unmuting', () => {
    audioState.audioLockActive(true);
    
    userState.requestUnmute();
    
    expect(userState.selfMute()).toBe(true); // Should stay muted
  });
});
```

**Ziel:** UserState Coverage 32% → 90%+ (100+ neue Tests)

**Validation:**

```bash
npm run test:unit:coverage -- __tests__/state/AppState.test.js
npm run test:unit:coverage -- __tests__/state/UserState.test.js
```

---

## Phase 2: Vue Composables erstellen (Woche 2)

**Strategie:** Composables laufen PARALLEL zu Knockout (Dual-Runtime). Tests bleiben grün.

### 2.1 useAudioState Composable

**Datei:** `app/composables/useAudioState.js` (NEU ERSTELLEN)

```javascript
import { ref, watch } from 'vue';

export function useAudioState() {
  // ===== STATE =====
  const audioContext = ref(null);
  const audioLockActive = ref(false);
  const audioLockReason = ref(null);
  const audioLockDetails = ref(null);
  const micPermissionDenied = ref(false);
  const micPermissionErrorMessage = ref('');
  const isBeeping = ref(false);
  const beeperReady = ref(false);
  
  // ===== INTERNAL STATE =====
  const _audioContextInitPromise = ref(null);
  const _persistentBeeper = ref(null);
  const _beeperInitPromise = ref(null);
  const _loadedModules = new Set();
  
  // ===== METHODS =====
  
  /**
   * Initialize AudioContext singleton
   * Uses promise caching to prevent race conditions
   */
  async function initializeAudioContext() {
    if (audioContext.value) return;
    if (_audioContextInitPromise.value) return _audioContextInitPromise.value;
    
    _audioContextInitPromise.value = (async () => {
      const { ensureAudioContext } = await import('../audio/audio-context-manager.js');
      audioContext.value = await ensureAudioContext();
      
      // State change logging
      audioContext.value.addEventListener('statechange', () => {
        console.log('[AudioState] AudioContext state:', audioContext.value.state);
      });
      
      console.log('[AudioState] AudioContext initialized:', {
        state: audioContext.value.state,
        sampleRate: audioContext.value.sampleRate,
      });
    })();
    
    return _audioContextInitPromise.value;
  }
  
  /**
   * Resume AudioContext (handles autoplay policy)
   */
  async function resumeAudioContext() {
    if (!audioContext.value) {
      console.warn('[AudioState] Cannot resume - AudioContext not initialized');
      return;
    }
    
    if (audioContext.value.state === 'suspended') {
      try {
        await audioContext.value.resume();
        console.log('[AudioState] AudioContext resumed successfully');
      } catch (err) {
        console.error('[AudioState] Failed to resume AudioContext:', err);
        throw err;
      }
    }
  }
  
  /**
   * Activate audio lock (prevents audio operations)
   * @param {string} reason - Lock reason ('sample-rate', 'mic-permission', etc.)
   * @param {object} details - Additional details
   */
  function activateAudioLock(reason, details = {}) {
    audioLockActive.value = true;
    audioLockReason.value = reason;
    audioLockDetails.value = details;
    console.log('[AudioState] Audio lock activated:', reason, details);
  }
  
  /**
   * Clear audio lock
   * @param {object} options - resetStates: also clear mic permission errors
   */
  function clearAudioLock({ resetStates = false } = {}) {
    audioLockActive.value = false;
    audioLockReason.value = null;
    audioLockDetails.value = null;
    
    if (resetStates) {
      micPermissionDenied.value = false;
      micPermissionErrorMessage.value = '';
    }
    
    console.log('[AudioState] Audio lock cleared', { resetStates });
  }
  
  /**
   * Load AudioWorklet processor module
   * Prevents duplicate loading via Set tracking
   */
  async function loadAudioWorkletModule(filename) {
    if (!audioContext.value) {
      throw new Error('[AudioState] AudioContext not initialized');
    }
    
    const moduleUrl = new URL(`../${filename}`, import.meta.url).href;
    
    if (_loadedModules.has(moduleUrl)) {
      console.log('[AudioState] Module already loaded:', filename);
      return;
    }
    
    try {
      await audioContext.value.audioWorklet.addModule(moduleUrl);
      _loadedModules.add(moduleUrl);
      console.log('[AudioState] Loaded AudioWorklet module:', filename);
    } catch (err) {
      console.error('[AudioState] Failed to load AudioWorklet module:', filename, err);
      throw err;
    }
  }
  
  /**
   * Initialize persistent beeper for latency testing
   * Event-based initialization (called from onAudioMixerReady)
   */
  async function initializePersistentBeeper() {
    if (_persistentBeeper.value) return;
    if (_beeperInitPromise.value) return _beeperInitPromise.value;
    
    _beeperInitPromise.value = (async () => {
      if (!audioContext.value) {
        await initializeAudioContext();
      }
      
      // Resume if suspended (autoplay policy)
      if (audioContext.value.state === 'suspended') {
        await resumeAudioContext();
      }
      
      const { Beeper } = await import('../audio/beeper.js');
      _persistentBeeper.value = new Beeper(audioContext.value);
      beeperReady.value = true;
      console.log('[AudioState] Persistent beeper initialized');
    })();
    
    return _beeperInitPromise.value;
  }
  
  /**
   * Start beeping (440 Hz tone)
   */
  function startBeep() {
    if (!_persistentBeeper.value || !beeperReady.value) {
      console.warn('[AudioState] Cannot beep - beeper not ready');
      return;
    }
    _persistentBeeper.value.start();
    isBeeping.value = true;
  }
  
  /**
   * Stop beeping
   */
  function stopBeep() {
    if (!_persistentBeeper.value) return;
    _persistentBeeper.value.stop();
    isBeeping.value = false;
  }
  
  /**
   * Retry microphone permission after denial
   */
  async function retryMicrophonePermission() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micPermissionDenied.value = false;
      micPermissionErrorMessage.value = '';
      
      // Stop tracks immediately (permission check only)
      stream.getTracks().forEach(track => track.stop());
      
      console.log('[AudioState] Microphone permission granted on retry');
    } catch (err) {
      console.warn('[AudioState] Microphone permission retry failed:', err);
      micPermissionDenied.value = true;
      micPermissionErrorMessage.value = err.message || 'Permission denied';
    }
  }
  
  // ===== RETURN PUBLIC API =====
  return {
    // State (reactive)
    audioContext,
    audioLockActive,
    audioLockReason,
    audioLockDetails,
    micPermissionDenied,
    micPermissionErrorMessage,
    isBeeping,
    beeperReady,
    
    // Methods
    initializeAudioContext,
    resumeAudioContext,
    activateAudioLock,
    clearAudioLock,
    loadAudioWorkletModule,
    initializePersistentBeeper,
    startBeep,
    stopBeep,
    retryMicrophonePermission,
  };
}
```

**Tests erstellen:**

```javascript
// __tests__/composables/useAudioState.test.js (NEU)
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { useAudioState } from '../../app/composables/useAudioState.js';

describe('useAudioState', () => {
  let audioState;
  
  beforeEach(() => {
    audioState = useAudioState();
  });
  
  it('should initialize with default state', () => {
    expect(audioState.audioContext.value).toBeNull();
    expect(audioState.audioLockActive.value).toBe(false);
    expect(audioState.micPermissionDenied.value).toBe(false);
    expect(audioState.isBeeping.value).toBe(false);
    expect(audioState.beeperReady.value).toBe(false);
  });
  
  it('should activate audio lock', () => {
    audioState.activateAudioLock('sample-rate', { sampleRate: 44100 });
    
    expect(audioState.audioLockActive.value).toBe(true);
    expect(audioState.audioLockReason.value).toBe('sample-rate');
    expect(audioState.audioLockDetails.value).toEqual({ sampleRate: 44100 });
  });
  
  it('should clear audio lock', () => {
    audioState.activateAudioLock('test');
    audioState.clearAudioLock();
    
    expect(audioState.audioLockActive.value).toBe(false);
    expect(audioState.audioLockReason.value).toBeNull();
  });
  
  // ... weitere Tests (>90% Coverage)
});
```

### 2.2 useVoiceState Composable

**Datei:** `app/composables/useVoiceState.js` (NEU)

```javascript
import { ref } from 'vue';

export function useVoiceState() {
  // ===== STATE =====
  const voiceHandler = ref(null);
  const isLoopbackMode = ref(false);
  const voiceHandlerReady = ref(false);
  const loopbackDominantFrequency = ref(0);
  
  // ===== INTERNAL STATE =====
  let _currentVoiceInput = null;
  let _voiceHandlerCreationPromise = null;
  
  // ===== METHODS =====
  
  /**
   * Initialize voice input handler
   * Delegates to voice.js (audio pipeline unchanged)
   */
  function initVoiceInput(ondata, onerror, onready) {
    console.log('[VoiceState] Initializing voice input');
    
    // Import voice.js dynamically
    return import('../audio/voice.js').then(({ default: voiceModule }) => {
      _currentVoiceInput = voiceModule;
      _currentVoiceInput.start(ondata, onerror, onready);
    });
  }
  
  /**
   * Write voice data to handler
   */
  function writeVoiceData(data) {
    if (!voiceHandler.value) {
      console.warn('[VoiceState] No voice handler available');
      return;
    }
    voiceHandler.value.write(data);
  }
  
  /**
   * Set mute state on voice handler
   */
  function setMute(muted) {
    if (!voiceHandler.value) return;
    voiceHandler.value.setMute(muted);
    console.log('[VoiceState] Mute state changed:', muted);
  }
  
  /**
   * Update voice handler (PTT/continuous mode)
   * @param {object} client - Mumble client instance
   * @param {object} settings - Voice settings (voiceMode, pttKey)
   * @param {function} onStartTalking - Callback when talking starts
   * @param {function} onStopTalking - Callback when talking stops
   */
  async function updateVoiceHandler(client, settings, onStartTalking, onStopTalking) {
    if (_voiceHandlerCreationPromise) {
      await _voiceHandlerCreationPromise;
    }
    
    _voiceHandlerCreationPromise = (async () => {
      // End existing handler
      if (voiceHandler.value) {
        voiceHandler.value.end();
        voiceHandler.value = null;
        voiceHandlerReady.value = false;
      }
      
      // Import voice.js
      const { default: voiceModule } = await import('../audio/voice.js');
      
      // Create new handler (PTT or Continuous)
      const target = isLoopbackMode.value ? 31 : 0; // 31 = loopback
      const newHandler = await voiceModule.createVoiceHandler(
        client,
        settings,
        target,
        onStartTalking,
        onStopTalking
      );
      
      voiceHandler.value = newHandler;
      voiceHandlerReady.value = true;
      
      console.log('[VoiceState] Voice handler updated:', {
        mode: settings.voiceMode,
        loopback: isLoopbackMode.value,
      });
    })();
    
    return _voiceHandlerCreationPromise;
  }
  
  /**
   * End voice handler (cleanup)
   */
  function endVoiceHandler() {
    if (voiceHandler.value) {
      voiceHandler.value.end();
      voiceHandler.value = null;
      voiceHandlerReady.value = false;
      console.log('[VoiceState] Voice handler ended');
    }
  }
  
  // ===== RETURN PUBLIC API =====
  return {
    // State (reactive)
    voiceHandler,
    isLoopbackMode,
    voiceHandlerReady,
    loopbackDominantFrequency,
    
    // Methods
    initVoiceInput,
    writeVoiceData,
    setMute,
    updateVoiceHandler,
    endVoiceHandler,
  };
}
```

### 2.3 useUserState Composable (mit Dependency Injection)

**Datei:** `app/composables/useUserState.js` (NEU)

```javascript
import { ref, watch } from 'vue';

/**
 * User state management composable
 * @param {object} audioState - AudioState composable instance (dependency injection)
 * @param {object} voiceState - VoiceState composable instance (dependency injection)
 */
export function useUserState(audioState, voiceState) {
  // ===== STATE =====
  const thisUser = ref(null);
  const selfMute = ref(false);
  const selfDeaf = ref(false);
  
  // ===== INTERNAL STATE =====
  const _userRegistry = new Map(); // userId -> userState
  const _activeVoiceStreams = new Map(); // sessionId -> { interval, subscription, userNode }
  
  // ===== CROSS-MODULE SUBSCRIPTION =====
  // Sync selfMute to VoiceState (critical for audio pipeline)
  watch(selfMute, (muted) => {
    if (voiceState) {
      voiceState.setMute(muted);
    }
  });
  
  // ===== METHODS =====
  
  /**
   * Register user and setup voice stream handling
   */
  function registerUser(user) {
    if (_userRegistry.has(user.id)) {
      return _userRegistry.get(user.id);
    }
    
    const userState = {
      model: user,
      name: ref(user.username),
      channel: ref(user.channel?.__ui || null),
      selfMute: ref(user.selfMute || false),
      selfDeaf: ref(user.selfDeaf || false),
      talking: ref('off'), // 'on', 'off', 'mute'
    };
    
    _userRegistry.set(user.id, userState);
    
    // Voice stream event handler
    user.on('voice', (stream) => {
      _handleVoiceStream(user.id, stream, audioState);
    });
    
    console.log('[UserState] User registered:', user.id, user.username);
    return userState;
  }
  
  /**
   * Handle incoming voice stream for user
   * CRITICAL: Audio pipeline unchanged - only state management
   */
  async function _handleVoiceStream(userId, stream, audioState) {
    // Cleanup old stream
    _cleanupVoiceStream(userId);
    
    if (!audioState.audioContext.value) {
      console.warn('[UserState] Cannot handle voice stream - AudioContext not initialized');
      return;
    }
    
    const userState = _userRegistry.get(userId);
    if (!userState) return;
    
    // Setup decoder and audio node (delegated to existing pipeline)
    const { BufferQueueNode } = await import('../audio/buffer-queue-node.js');
    const userNode = new BufferQueueNode(audioContext.value);
    userNode.connect(audioContext.value.destination);
    
    // Track talking state
    const interval = setInterval(() => {
      if (stream.isActive) {
        userState.talking.value = 'on';
      } else {
        userState.talking.value = 'off';
      }
    }, 100);
    
    // Track resources for cleanup
    _activeVoiceStreams.set(stream.id, {
      interval,
      userNode,
    });
    
    console.log('[UserState] Voice stream started for user:', userId);
  }
  
  /**
   * Cleanup voice stream resources
   * CRITICAL: Prevents memory leaks and dangling audio nodes
   */
  function _cleanupVoiceStream(userId) {
    const resources = _activeVoiceStreams.get(userId);
    if (!resources) return; // Idempotent
    
    if (resources.interval) {
      clearInterval(resources.interval);
    }
    
    if (resources.userNode) {
      resources.userNode.disconnect();
    }
    
    _activeVoiceStreams.delete(userId);
    console.log('[UserState] Voice stream cleaned up for user:', userId);
  }
  
  /**
   * Request mute
   */
  function requestMute() {
    selfMute.value = true;
  }
  
  /**
   * Request unmute
   * Respects audio lock (sample rate warning, mic permission)
   */
  function requestUnmute() {
    if (audioState.audioLockActive.value) {
      console.warn('[UserState] Cannot unmute - audio lock active:', audioState.audioLockReason.value);
      return;
    }
    
    selfMute.value = false;
    selfDeaf.value = false; // Unmute also undeafens
  }
  
  /**
   * Request deaf
   * @param {boolean} isLoopback - In loopback mode, deaf doesn't imply mute
   */
  function requestDeaf(isLoopback = false) {
    selfDeaf.value = true;
    
    // Deaf implies mute (except in loopback mode)
    if (!isLoopback) {
      selfMute.value = true;
    }
  }
  
  /**
   * Request undeaf
   */
  function requestUndeaf() {
    if (audioState.audioLockActive.value) {
      console.warn('[UserState] Cannot undeaf - audio lock active');
      return;
    }
    
    selfDeaf.value = false;
  }
  
  // ===== RETURN PUBLIC API =====
  return {
    // State (reactive)
    thisUser,
    selfMute,
    selfDeaf,
    
    // Methods
    registerUser,
    requestMute,
    requestUnmute,
    requestDeaf,
    requestUndeaf,
  };
}
```

### 2.4 useUIState Composable

**Datei:** `app/composables/useUIState.js` (NEU)

```javascript
import { ref } from 'vue';

export function useUIState() {
  // ===== STATE =====
  const currentOpenModal = ref(null);
  const messageBox = ref('');
  const settingsDialog = ref(null);
  
  // ===== METHODS =====
  
  /**
   * Open settings dialog
   * Prevents multiple modals from opening simultaneously
   */
  function openSettings(settings, SettingsDialogClass) {
    if (currentOpenModal.value !== null) {
      console.warn('[UIState] Cannot open settings - modal already open:', currentOpenModal.value);
      return;
    }
    
    const dialog = new SettingsDialogClass(settings);
    settingsDialog.value = dialog;
    currentOpenModal.value = 'settings';
    console.log('[UIState] Settings dialog opened');
  }
  
  /**
   * Close settings dialog
   */
  function closeSettings() {
    if (settingsDialog.value) {
      if (typeof settingsDialog.value.end === 'function') {
        settingsDialog.value.end();
      }
      settingsDialog.value = null;
    }
    
    if (currentOpenModal.value === 'settings') {
      currentOpenModal.value = null;
    }
    
    console.log('[UIState] Settings dialog closed');
  }
  
  /**
   * Submit message from message box
   */
  function submitMessageBox(sendMessageFn, target) {
    const message = messageBox.value.trim();
    if (!message) {
      console.warn('[UIState] Cannot submit empty message');
      return;
    }
    
    sendMessageFn(target, message);
    messageBox.value = ''; // Clear after send
    console.log('[UIState] Message submitted');
  }
  
  // ===== RETURN PUBLIC API =====
  return {
    // State (reactive)
    currentOpenModal,
    messageBox,
    settingsDialog,
    
    // Methods
    openSettings,
    closeSettings,
    submitMessageBox,
  };
}
```

### 2.5 useSettings Composable

**Datei:** `app/composables/useSettings.js` (NEU)

```javascript
import { ref, watch } from 'vue';

export function useSettings(defaults) {
  // ===== STATE =====
  const voiceMode = ref(_loadSetting('voiceMode', defaults.voiceMode));
  const pttKey = ref(_loadSetting('pttKey', defaults.pttKey));
  const userCountInChannelName = ref(_loadSetting('userCountInChannelName', defaults.userCountInChannelName));
  const audioBitrate = ref(parseInt(_loadSetting('audioBitrate', defaults.audioBitrate), 10));
  const samplesPerPacket = ref(parseInt(_loadSetting('samplesPerPacket', defaults.samplesPerPacket), 10));
  
  // ===== HELPERS =====
  
  function _loadSetting(key, defaultValue) {
    const stored = globalThis.localStorage.getItem('mumble.' + key);
    return stored !== null ? stored : defaultValue;
  }
  
  function _saveSetting(key, value) {
    globalThis.localStorage.setItem('mumble.' + key, value);
  }
  
  // ===== AUTO-SAVE ON CHANGE =====
  watch(voiceMode, (val) => _saveSetting('voiceMode', val));
  watch(pttKey, (val) => _saveSetting('pttKey', val));
  watch(userCountInChannelName, (val) => _saveSetting('userCountInChannelName', val));
  watch(audioBitrate, (val) => _saveSetting('audioBitrate', val));
  watch(samplesPerPacket, (val) => _saveSetting('samplesPerPacket', val));
  
  // ===== METHODS =====
  
  /**
   * Explicit save (called from SettingsDialog)
   */
  function save() {
    _saveSetting('voiceMode', voiceMode.value);
    _saveSetting('pttKey', pttKey.value);
    _saveSetting('userCountInChannelName', userCountInChannelName.value);
    _saveSetting('audioBitrate', audioBitrate.value);
    _saveSetting('samplesPerPacket', samplesPerPacket.value);
    console.log('[Settings] Settings saved to localStorage');
  }
  
  // ===== RETURN PUBLIC API =====
  return {
    // State (reactive)
    voiceMode,
    pttKey,
    userCountInChannelName,
    audioBitrate,
    samplesPerPacket,
    
    // Methods
    save,
  };
}
```

---

## Phase 3: Dual-Runtime Integration (Woche 2-3)

**Ziel:** Composables laufen parallel zu Knockout. Tests bleiben grün.

### 3.1 AppState.js Update

**Datei:** `app/state/AppState.js`

```javascript
import { useAudioState } from '../composables/useAudioState.js';
import { useVoiceState } from '../composables/useVoiceState.js';
import { useUserState } from '../composables/useUserState.js';
import { useUIState } from '../composables/useUIState.js';
import { useSettings } from '../composables/useSettings.js';

// Existing imports...
import ko from 'knockout';
import ConnectionState from './ConnectionState.js';
import AudioState from './AudioState.js';
import VoiceState from './VoiceState.js';
import UIState from './UIState.js';
import UserState from './UserState.js';

export default class AppState {
  constructor(config, log) {
    this.config = config;
    this.log = log;
    
    // ===== KNOCKOUT STATE (legacy - to be removed) =====
    this.connection = new ConnectionState();
    this.audio = new AudioState();
    this.voice = new VoiceState();
    this.ui = new UIState();
    this.user = new UserState(this.audio, this.voice);
    
    // ===== VUE COMPOSABLES (new - parallel) =====
    this._vueAudio = useAudioState();
    this._vueVoice = useVoiceState();
    this._vueUser = useUserState(this._vueAudio, this._vueVoice);
    this._vueUI = useUIState();
    this._vueSettings = useSettings(config.settings);
    
    // ===== BIDIRECTIONAL SYNC =====
    this._setupBidirectionalSync();
    
    // ... rest of constructor
  }
  
  /**
   * Bidirectional synchronization between Knockout and Vue
   * TEMPORARY: Will be removed once Knockout is fully replaced
   */
  _setupBidirectionalSync() {
    // AudioState: Knockout → Vue
    this.audio.audioLockActive.subscribe(val => {
      this._vueAudio.audioLockActive.value = val;
    });
    
    // AudioState: Vue → Knockout
    watch(this._vueAudio.audioLockActive, val => {
      this.audio.audioLockActive(val);
    });
    
    // ... repeat for all state properties
  }
  
  // Backward compatibility getters
  get audioLockActive() {
    return this.audio.audioLockActive; // Still returns Knockout observable
  }
  
  // ... rest of class
}
```

**Validation:**

```bash
# Tests sollten ALLE grün bleiben
npm run test:unit
npm run test:loopback
```

### 3.2 Vue-Komponenten auf Composables umstellen

**Beispiel:** `app/components/App.vue`

**VORHER:**

```vue
<script setup>
import { inject, ref, onMounted } from 'vue';

const appState = inject('appState');
const audioLockActive = ref(false);

onMounted(() => {
  audioLockActive.value = appState.audio.audioLockActive();
  appState.audio.audioLockActive.subscribe(val => {
    audioLockActive.value = val;
  });
});
</script>
```

**NACHHER:**

```vue
<script setup>
import { inject } from 'vue';

const appState = inject('appState');
const { audioLockActive, isBeeping } = appState._vueAudio;

// Direkt ref-Zugriff - keine manuelle Synchronisation!
</script>

<template>
  <div v-if="audioLockActive">Audio Lock Active</div>
  <div v-if="isBeeping">Beeping...</div>
</template>
```

**Alle 9 Komponenten aktualisieren:**

- App.vue
- ConnectDialog.vue
- ConnectionInfoDialog.vue
- SampleRateWarningDialog.vue
- Toolbar.vue
- SettingsDialog.vue
- MicPermissionRetryOverlay.vue
- GuacamoleFrame.vue
- ConnectErrorDialog.vue

**Validation nach jeder Komponente:**

```bash
npm run test:unit -- __tests__/components/ComponentName.test.js
```

---

## Phase 4: Knockout-Entfernung (Woche 3-4)

**Jetzt können wir sicher Knockout entfernen - Tests sind grün!**

### 4.1 Bidirektionale Synchronisation entfernen

**Datei:** `app/state/AppState.js`

```javascript
// ENTFERNEN:
_setupBidirectionalSync() { ... }

// ENTFERNEN: Alle _ko_* observables
this._ko_audioLockActive = ko.observable(false);
// ... etc.

// UPDATE: Getter direkt auf Vue refs
get audioLockActive() {
  return this._vueAudio.audioLockActive; // Jetzt Vue ref statt Knockout observable
}
```

### 4.2 Knockout State-Klassen entfernen

**Dateien LÖSCHEN:**

- `app/state/AudioState.js` (ersetzt durch `useAudioState`)
- `app/state/VoiceState.js` (ersetzt durch `useVoiceState`)
- `app/state/UserState.js` (ersetzt durch `useUserState`)
- `app/state/UIState.js` (ersetzt durch `useUIState`)

**ConnectionState.js** kann bleiben (minimale Knockout-Dependencies).

### 4.3 index.js bereinigen

**Datei:** `app/index.js`

```javascript
// ENTFERNEN: ConnectionInfo Klasse (Zeilen 44-107)
// Ersetzt durch ConnectionInfoDialog.vue

// ENTFERNEN: SettingsDialog Klasse (Zeilen 109-168)
// Ersetzt durch SettingsDialog.vue + useSettings

// ENTFERNEN: Settings Klasse (Zeilen 170-186)
// Ersetzt durch useSettings

// ENTFERNEN: globalThis.ui = ui; (Zeile 199)
// Behalten nur für debugging:
globalThis.mumbleUi = ui;

// ENTFERNEN: ko.applyBindings(ui);
// Vue mount bleibt:
const app = createApp(App);
app.provide('appState', ui);
app.mount('#app');
```

### 4.4 Package.json bereinigen

```bash
npm uninstall knockout

# Validation
npm ls knockout
# Sollte: (empty) anzeigen
```

### 4.5 Imports bereinigen

```bash
# Finde alle Knockout-Imports
grep -r "import.*knockout" app/
grep -r "from 'knockout'" app/

# Für jede Datei:
# - Entferne "import ko from 'knockout';"
# - Entferne "import * as ko from 'knockout';"
```

### 4.6 Build-System bereinigen

**Datei:** `build-esbuild.mjs`

```javascript
// ENTFERNEN: Knockout alias (falls vorhanden)
alias: {
  // knockout: ... LÖSCHEN
}
```

---

## Phase 5: Testing & Validation (Woche 4)

### 5.1 Full Test Suite

```bash
# Unit Tests
npm run test:unit
# Erwartung: 1477+ tests passing

# Integration Tests
npm run test:loopback
# Erwartung: 440 Hz validation successful

# Security Audit
npm run audit:ci
# Erwartung: No critical vulnerabilities

# Dependency Check
npm run check:deps
# Erwartung: knockout flagged as unused (sollte nicht mehr existieren)
```

### 5.2 Coverage Validation

```bash
npm run test:unit:coverage

# Ziel:
# - useAudioState: >93%
# - useVoiceState: >97%
# - useUserState: >94%
# - useUIState: 100%
# - AppState: >80%
```

### 5.3 Bundle Analysis

```bash
npm run analyze

# Prüfe:
# - Knockout (~60KB) nicht mehr im Bundle
# - Vue.js als einziges Framework
# - Bundle-Größe reduziert
```

---

## Häufige Fallstricke & Lösungen

### Problem 1: Tests brechen mit "Cannot read property 'value'"

**Symptom:**

```javascript
TypeError: Cannot read property 'value' of undefined
```

**Lösung:**

```javascript
// FALSCH (Knockout-Syntax):
expect(audioState.audioLockActive()).toBe(false);

// RICHTIG (Vue-Syntax):
expect(audioState.audioLockActive.value).toBe(false);
```

### Problem 2: Worker-Kommunikation bricht

**Symptom:** Voice-Pipeline funktioniert nicht mehr

**Lösung:** Worker-Threads NICHT anfassen!

```javascript
// ✅ RICHTIG: Worker bleibt unverändert
// app/worker.js - KEINE ÄNDERUNGEN
// app/worker-client.js - KEINE ÄNDERUNGEN

// ❌ FALSCH: Worker auf Vue migrieren
// Nur AppState kommuniziert mit Worker
```

### Problem 3: AudioContext wird mehrfach initialisiert

**Lösung:** Promise-Caching verwenden (siehe useAudioState Pattern)

### Problem 4: Cross-Module Dependencies fehlen

**Symptom:** `UserState` kann nicht auf `AudioState` zugreifen

**Lösung:** Dependency Injection:

```javascript
// RICHTIG:
const audioState = useAudioState();
const voiceState = useVoiceState();
const userState = useUserState(audioState, voiceState); // DI!
```

---

## Checkliste

### Phase 1: Test-Coverage ✅

- [ ] AppState Coverage 31% → 80%+ (150+ Tests)
- [ ] UserState Coverage 32% → 90%+ (100+ Tests)
- [ ] Alle Tests grün

### Phase 2: Composables ✅

- [ ] useAudioState() erstellt + Tests (>93% Coverage)
- [ ] useVoiceState() erstellt + Tests (>97% Coverage)
- [ ] useUserState() erstellt + Tests (>94% Coverage)
- [ ] useUIState() erstellt + Tests (100% Coverage)
- [ ] useSettings() erstellt + Tests (>90% Coverage)

### Phase 3: Dual-Runtime ✅

- [ ] AppState.js mit Composables parallel
- [ ] Bidirektionale Sync funktioniert
- [ ] Alle 9 Vue-Komponenten auf Composables umgestellt
- [ ] Tests ALLE grün (1477+)

### Phase 4: Knockout-Entfernung ✅

- [ ] Bidirektionale Sync entfernt
- [ ] Knockout State-Klassen gelöscht
- [ ] index.js bereinigt
- [ ] `npm uninstall knockout` erfolgreich
- [ ] Alle Imports bereinigt

### Phase 5: Validation ✅

- [ ] npm run test (alle grün)
- [ ] npm run test:loopback (erfolgreich)
- [ ] npm run audit:ci (keine Vulnerabilities)
- [ ] Coverage >90% für alle State-Module
- [ ] Bundle-Größe reduziert

---

## Zeitschätzung

- **Phase 1:** 3-5 Tage (Test-Coverage)
- **Phase 2:** 5-7 Tage (Composables)
- **Phase 3:** 3-4 Tage (Dual-Runtime)
- **Phase 4:** 2-3 Tage (Knockout-Entfernung)
- **Phase 5:** 2-3 Tage (Testing)

**Total:** 15-22 Arbeitstage (3-4 Wochen)

---

## Success Criteria

✅ Alle 1477+ Tests grün  
✅ Knockout.js komplett entfernt  
✅ Audio-Pipeline funktioniert  
✅ Bundle-Größe reduziert (~60KB)  
✅ Coverage >90% für alle State-Module  
✅ Dokumentation aktualisiert

---

**Prepared by:** GitHub Copilot + Team Consensus  
**Date:** November 8, 2025  
**Status:** Ready for Implementation ✅
