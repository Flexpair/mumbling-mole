import { watch } from 'vue';
import { useConnectionStore } from './connectionStore';
import { useAudioStore } from './audioStore';
import { useVoiceStore } from './voiceStore';
import { useUIStore } from './uiStore';
import { useUserStore } from './userStore';
import { 
  useConnectionDialog,
  useConnectErrorDialog,
  useSampleRateWarningDialog,
  useConnectionInfo
} from '../composables/index';

/**
 * AppState - Minimal initialization coordinator
 * 
 * Responsibilities:
 * - Initialize Pinia stores
 * - Set up cross-store reactive subscriptions
 * - Register channel in single-channel mode
 * 
 * All business logic has been migrated to:
 * - Pinia stores (connectionStore, audioStore, voiceStore, uiStore, userStore)
 * - Composables (useConnectionLogic, useConnectionDialog, etc.)
 * 
 * Components access state directly via stores, not through AppState.
 */
export default class AppState {
  constructor(config, log) {
    this.config = config;
    this.log = log || console.log.bind(console);
    
    // Initialize Pinia stores
    this.connectionStore = useConnectionStore();
    this.audioStore = useAudioStore();
    this.voiceStore = useVoiceStore();
    this.uiStore = useUIStore();
    this.userStore = useUserStore();
    
    // Alias for tests (backward compatibility)
    this._vueState = {
      connection: this.connectionStore,
      audio: this.audioStore,
      voice: this.voiceStore,
      ui: this.uiStore,
      user: this.userStore
    };
    
    // Set up cross-module subscriptions
    this._setupSubscriptions();
  }

  /**
   * Set up reactive subscriptions between stores
   * @private
   */
  _setupSubscriptions() {
    // When selfMute changes, update voice handler mute state
    watch(() => this.userStore.selfMute, (mute) => {
      this.voiceStore.setMute(mute);
    });
  }

  /**
   * Register channel in single-channel mode
   * Called from index.js after client connection
   */
  _registerChannel(channel) {
    this.connectionStore.registerChannel(channel);
  }

  // Minimal getters for index.js initialization and tests (will be removed once fully migrated)
  get connectDialog() {
    return useConnectionDialog();
  }

  get connectErrorDialog() {
    return useConnectErrorDialog();
  }

  get sampleRateWarningDialog() {
    return useSampleRateWarningDialog();
  }

  get connectionInfo() {
    return useConnectionInfo();
  }

  get user() {
    return this.userStore;
  }

  get audio() {
    return this.audioStore;
  }

  get voice() {
    return this.voiceStore;
  }

  get connection() {
    return this.connectionStore;
  }

  get ui() {
    return this.uiStore;
  }

  get auth() {
    return this._auth;
  }

  set auth(value) {
    this._auth = value;
  }

  get settings() {
    return this._settings;
  }

  set settings(value) {
    this._settings = value;
  }

  get guacamoleFrame() {
    return this._guacamoleFrame;
  }

  set guacamoleFrame(value) {
    this._guacamoleFrame = value;
  }
}
