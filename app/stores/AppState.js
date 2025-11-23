import { watch, ref, computed } from 'vue';
import { safeStoreToRefs } from '../utils/safeStoreToRefs';
import { useConnectionStore } from './connectionStore';
import { useAudioStore } from './audioStore';
import { useVoiceStore } from './voiceStore';
import { useUIStore } from './uiStore';
import { useUserStore } from './userStore';
import { useConnectionLogic } from '../composables/useConnectionLogic';
import {
  useConnectionDialog,
  useConnectErrorDialog,
  useSampleRateWarningDialog,
  useConnectionInfo,
} from '../composables';
import { translate } from '../localize';
import packageJson from '../../package.json';

/**
 * AppState - main state coordinator
 * 
 * Composes all state modules using Pinia stores.
 * Provides a centralized API for application-wide state management.
 * 
 * Architecture:
 * - ConnectionStore: client connection, root user/channel setup
 * - AudioStore: AudioContext, beeper, audio pipeline
 * - VoiceStore: voice handler, loopback mode, voice controls
 * - UIStore: modals, message box, settings dialog
 * - UserStore: current user, self mute/deaf, user registration, voice streams
 * 
 * State management:
 * - All state uses Pinia stores
 * - Cross-module dependencies handled via store composition
 */
export default class AppState {
  constructor(config, log) {
    this.config = config;
    this.log = log || console.log.bind(console);
    
    // Store Vue runtime for creating refs/computed
    this._vue = { ref, computed };
    
    // Initialize Pinia stores (source of truth)
    const connectionStore = useConnectionStore();
    const audioStore = useAudioStore();
    const voiceStore = useVoiceStore();
    const uiStore = useUIStore();
    const userStore = useUserStore();
    
    // Initialize connection logic
    this._connectionLogic = useConnectionLogic();
    
    const connectionDialog = useConnectionDialog();
    const connectErrorDialog = useConnectErrorDialog();
    const sampleRateWarningDialog = useSampleRateWarningDialog();

    const connectionInfo = useConnectionInfo();
    
    // Store store references
    // We mix in safeStoreToRefs to provide Ref access (backward compatibility)
    // while keeping actions available from the store instance
    this._vueState = {
      connection: { ...connectionStore, ...safeStoreToRefs(connectionStore) },
      audio: { 
        ...audioStore, 
        ...safeStoreToRefs(audioStore),
        // Expose audioContext as value (getter) for backward compatibility with tests/legacy code
        // that expects the raw AudioContext object, not a Ref.
        get audioContext() { return audioStore.audioContext; }
      },
      voice: { ...voiceStore, ...safeStoreToRefs(voiceStore) },
      ui: { ...uiStore, ...safeStoreToRefs(uiStore) },
      user: { ...userStore, ...safeStoreToRefs(userStore) },
      dialog: connectionDialog,
      errorDialog: connectErrorDialog,
      sampleRateDialog: sampleRateWarningDialog,
      connectionInfoDialog: connectionInfo,
    };

    // External dependencies (set during initialization)
    this.settings = null; // Set externally from index.js
    this.guacamoleFrame = null; // Set externally from index.js
    this.auth = null; // Set externally from index.js
    
    // Guacamole credentials storage
    this._guacLogin = null;
    this._guacPassword = null;
    
    // Connection tracking for race safety
    this._currentConnectionId = null;
    
    // Timer tracking for message confirmation
    this._messageConfirmationTimer = null;
    
    // Set up cross-module subscriptions
    this._setupSubscriptions();
    
    // Initialize lazy computed properties after _vueState is ready
    this._initializeComputedProperties();
  }

  /**
   * Initialize computed properties (called after _vueState is ready)
   * @private
   */
  _initializeComputedProperties() {
    // Message box placeholder hint
    this.messageBoxHint = this._vue.computed(() => {
      if (!this._vueState.user.thisUser.value) {
        return '';
      }
      // With markRaw, channel is a ref that might be undefined
      const channelRef = this._vueState.user.thisUser.value.channel;
      if (!channelRef?.value) {
        return '';
      }
      const target = channelRef.value;
      if (!target?.name) {
        return '';
      }
      return translate('chat.channel_message_placeholder').replace('%1', target.name.value);
    });
    
    // Mailto link for desktop attachment
    this.mailToDesktop = this._vue.ref(
      'mailto:mail@' +
      globalThis.location.hostname +
      '?subject=Send%20attachment%20to%20desktop'
    );
  }

  /**
   * Set up reactive subscriptions between modules
   * @private
   */
  _setupSubscriptions() {
    // When selfMute changes, update voice handler
    watch(() => this._vueState.user.selfMute.value, (mute) => {
      this._vueState.voice.setMute(mute);
    });
  }

  /**
   * Update voice handler based on current settings
   */
  _updateVoiceHandler() {
    this._connectionLogic.updateVoiceHandler();
  }

  // ============================================================
  // PUBLIC API - Expose module functionality
  // ============================================================

  /**
   * Check if connected
   * @returns {boolean}
   */
  connected = () => {
    return this._vueState.user.thisUser.value != null;
  }

  /**
   * Get current client
   * @returns {object|null}
   */
  getClient = () => {
    return this._vueState.connection.getClient();
  }

  /**
   * Connect to Mumble server
   */
  async connect(host, port, username, password, tokens = [], channelName = '') {
    await this._connectionLogic.connect(host, port, username, password, tokens, channelName);
  }

  /**
   * Connect in loopback test mode
   */
  async connectLoopback(host, port, username, password, tokens = [], channelName = '') {
    await this._connectionLogic.connectLoopback(host, port, username, password, tokens, channelName);
  }

  /**
   * Start loopback test on existing connection
   */
  startLoopbackTest = async () => {
    await this._connectionLogic.startLoopbackTest();
  }

  /**
   * Reset client and all state
   */
  resetClient = () => {
    this._connectionLogic.resetClient();
  }

  /**
   * Send message to channel or user
   */
  sendMessage = (target, message) => {
    this._connectionLogic.sendMessage(target, message);
  }

  // ============================================================
  // DELEGATION - Expose Knockout observables for backward compatibility
  // ============================================================

  // Connection Dialog module (Vue refs, no Knockout wrapper needed)
  get connectDialog() { return this._vueState.dialog; }

  // Audio module
  get audioContext() { return this._vueState.audio.audioContext; }
  get audioLockActive() { return this._vueState.audio.audioLockActive; }
  get audioLockReason() { return this._vueState.audio.audioLockReason; }
  get audioLockDetails() { return this._vueState.audio.audioLockDetails; }
  get micPermissionDenied() { return this._vueState.audio.micPermissionDenied; }
  get micPermissionErrorMessage() { return this._vueState.audio.micPermissionErrorMessage; }
  get isBeeping() { return this._vueState.audio.isBeeping; }
  get beeperReady() { return this._vueState.audio.beeperReady; }
  
  startBeep = () => { return this._vueState.audio.startBeep(); }
  stopBeep = () => { return this._vueState.audio.stopBeep(); }
  retryMicrophonePermission = () => { return this._vueState.audio.retryMicrophonePermission(); }
  initializeAudioContext = () => { return this._vueState.audio.initializeAudioContext(); }
  _initializePersistentBeeper = () => { return this._vueState.audio.initializePersistentBeeper(); }

  // Voice module
  get isLoopbackMode() { return this._vueState.voice.isLoopbackMode; }
  get voiceHandlerReady() { return this._vueState.voice.voiceHandlerReady; }
  get loopbackDominantFrequency() { return this._vueState.voice.loopbackDominantFrequency; }
  get voiceHandler() { return this._vueState.voice.voiceHandler; }

  // UI module
  get currentOpenModal() { return this._vueState.ui.currentOpenModal; }
  get messageBox() { return this._vueState.ui.messageBox; }
  get messageConfirmed() { return this._vueState.ui.messageConfirmed; }
  
  // Settings dialog methods (overridden by ConnectionInfoDialog)
  openSettings = () => { console.warn('openSettings called before initialization'); }
  closeSettings = () => { console.warn('closeSettings called before initialization'); }

  submitMessageBox = () => {
    // WORKAROUND: user.channel is not set due to async worker property sync
    // Use root channel directly (all users start in root channel ID 0)
    const target = this._rootChannel;
    
    return this._vueState.ui.submitMessageBox((t, m) => this.sendMessage(t, m), target);
  }

  // User module
  get thisUser() { return this._vueState.user.thisUser; }
  get selfMute() { return this._vueState.user.selfMute; }
  get selfDeaf() { return this._vueState.user.selfDeaf; }
  
  requestMute = (user) => { 
    this._vueState.user.requestMute(user);
  }
  
  requestDeaf = (user) => { 
    this._vueState.user.requestDeaf(user, this._vueState.voice.isLoopbackMode.value);
  }
  
  requestUnmute = (user) => {
    this._vueState.user.requestUnmute(user);
  }
  
  requestUndeaf = (user) => {
    if (this._vueState.audio.audioLockActive.value) {
      this.notifyAudioLock();
      return;
    }
    this._vueState.user.requestUndeaf(user);
    if (this.connected()) {
      this._vueState.connection.getClient().setSelfDeaf(false);
    }
  }

  // Connection module
  get remoteHost() { return this._vueState.connection.remoteHost; }
  get remotePort() { return this._vueState.connection.remotePort; }
  get client() { return this._vueState.connection.getClient(); }
  set client(value) { 
    // Direct assignment is no longer supported - use composable API or connection methods
    throw new Error('Direct assignment to appState.client is no longer supported. Use the composable API or appropriate methods to update the client.');
  }

  // Helpers
  notifyAudioLock = () => {
    const details = this._vueState.audio.audioLockDetails.value || {};
    const sr = details.sampleRate ?? this._vueState.audio.audioContext?.sampleRate;
    this.sampleRateWarningDialog.showInfo(sr);
  }

  handleUnmuteClick = () => {
    if (this._vueState.user.thisUser.value) {
      this.requestUnmute(this._vueState.user.thisUser.value);
    }
  }

  handleUndeafClick = () => {
    if (this._vueState.user.thisUser.value) {
      this.requestUndeaf(this._vueState.user.thisUser.value);
    }
  }

  applySettings = () => {
    // Settings are now managed by Vue composable and saved via dialog
    // Just update the voice handler with new settings
    this._updateVoiceHandler();
  }

  logoutUser = () => {
    this.auth.logout();
    location.reload();
  }

  openSourceCode = () => {
    globalThis.open(packageJson.homepage, '_blank').focus();
  }

  // Expose Vue state for direct access from Vue components
  get connection() { return this._vueState.connection; }
  get audio() { return this._vueState.audio; }
  get voice() { return this._vueState.voice; }
  get ui() { return this._vueState.ui; }
  get user() { return this._vueState.user; }
  get connectErrorDialog() { return this._vueState.errorDialog; }
  get sampleRateWarningDialog() { return this._vueState.sampleRateDialog; }
  get connectionInfo() { return this._vueState.connectionInfoDialog; }
}
