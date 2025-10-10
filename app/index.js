// Removed legacy 'subworkers' import: nested worker polyfill caused constructor hijack issues.
// Removed redundant manual Buffer/process attachment (handled by ProvidePlugin + DefinePlugin)
import url from "url";
import MumbleClient from "mumble-client";
import WorkerBasedMumbleConnector from "./worker-client";
import audioContextManager, { ensureAudioContext } from "./audio-context-manager";
import ko from "knockout";
import keyboardjs from "keyboardjs";
import BufferQueueNode from "./buffer-queue-node";

import {
  ContinuousVoiceHandler,
  PushToTalkVoiceHandler,
  initVoice,
  enumMicrophones,
} from "./voice";
import {
  initialize as localizationInitialize,
  translateEverything,
  translate,
} from "./localize";

function GuacamoleFrame() {
  var self = this;
  // Start with null source to avoid the browser immediately requesting /guacamole/.
  // The iframe src is only assigned after a successful Mumble connect + role gating.
  // (HTML binding uses fallback about:blank when null/empty.)
  self.guacSource = ko.observable(null);
  self.visible = ko.observable(false);
  self.show = self.visible.bind(self.visible, true);
  self.hide = self.visible.bind(self.visible, false);
  self.loading = ko.observable(false);
  self.error = ko.observable(null);

  self.start = function (guacUser, password) {
    self.loading(true);
    self.error(null);
    // Sanitize previously bad localStorage entries that break Guacamole's JSON.parse
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        if (/guac|token|auth/i.test(k)) {
          const val = localStorage.getItem(k);
          if (val === "undefined" || val === "null") {
            localStorage.removeItem(k);
          }
        }
      }
    } catch (e) {
      console.warn("[Guac] localStorage sanitization failed", e);
    }
    const src =
      "/guacamole/#/?username=" +
      guacUser +
      "&password=" +
      encodeURIComponent(password || "");
    self.guacSource(src);
  };

  self.onLoad = function () {
    self.loading(false);
    try {
      const frame = document.getElementById("guacframe");
      const doc = frame && frame.contentDocument;
    } catch (e) {
      console.warn("[Guac] cannot inspect iframe content", e);
    }
  };
}

function ConnectDialog() {
  var self = this;
  self.address = ko.observable("");
  self.port = ko.observable("");
  self.username = ko.observable("");
  self.password = ko.observable("");
  self.visible = ko.observable(true);
  // LOOPBACK-FEATURE: Track whether loopback test mode is active (prevents deactivation once started)
  self.isTestActive = ko.observable(false);
  self.show = self.visible.bind(self.visible, true);
  self.hide = self.visible.bind(self.visible, false);
  
  self.connect = function () {
    self.hide();
    
    // LOOPBACK-FEATURE: When already connected, this transitions from test mode back to normal mode
    if (ui.connected()) {
      // Switch from loopback test mode back to normal voice routing
      self.isTestActive(false);
      ui.isLoopbackMode(false);
      
      // Recreate voice handler with normal target (not loopback target 31)
      ui._updateVoiceHandler();
      
      // GUACAMOLE-INTEGRATION: Show Guacamole desktop frame after exiting test mode
      // Uses stored credentials from initial connection
      if (ui._guacLogin) {
        ui.guacamoleFrame.loading(false);
        ui.guacamoleFrame.start(ui._guacLogin, ui._guacPassword);
        ui.guacamoleFrame.show();
      } else {
        ui.guacamoleFrame.loading(false);
      }
    } else {
      // Normal connection flow - not yet connected to server
      self.isTestActive(false);
      ui.connect(self.address(), self.port(), self.username(), self.password());
    }
  };
  
  // LOOPBACK-FEATURE: Toggle button handler - activates loopback test mode
  self.toggleLoopback = function () {
      // One-way activation: prevent deactivation via this button (use Connect button instead)
      if (self.isTestActive()) {
        return;
      }
      
      // Mark test as active and connect in loopback mode
      self.isTestActive(true);
      
      // MODAL-BEHAVIOR: Keep dialog open during loopback test (don't call self.hide())
      // This allows user to see connection status and switch back to normal mode
      ui.connectLoopback(self.address(), self.port(), self.username(), self.password());
    };  
  
  // LEGACY-COMPAT: Legacy function for backward compatibility (closes dialog like old behavior)
  self.connectLoopback = function () {
    self.hide();
    ui.connectLoopback(self.address(), self.port(), self.username(), self.password());
  };
}

function ConnectErrorDialog(connectDialog) {
  var self = this;
  self.type = ko.observable(0);
  self.reason = ko.observable("");
  self.username = connectDialog.username;
  self.password = connectDialog.password;
  self.visible = ko.observable(false);
  self.show = self.visible.bind(self.visible, true);
  self.hide = self.visible.bind(self.visible, false);
  self.connect = () => {
    self.hide();
    connectDialog.connect();
  };
}

function SampleRateWarningDialog(ui) {
  var self = this;
  self.visible = ko.observable(false);
  self.mode = ko.observable("confirm");
  self.sampleRate = ko.observable(null);
  self.pendingConnection = null;

  const formatSampleRate = (value) => {
    if (typeof value === "number" && !Number.isNaN(value) && value > 0) {
      return Math.round(value);
    }
    return translate("audio.sample_rate.warning.unknown_rate");
  };

  self.title = ko.pureComputed(() => translate("audio.sample_rate.warning.title"));
  self.isConfirm = ko.pureComputed(() => self.mode() === "confirm");
  self.description = ko.pureComputed(() => {
    const key = self.isConfirm()
      ? "audio.sample_rate.warning.body"
      : "audio.sample_rate.warning.info";
    const template = translate(key);
    return template.replace("%1", formatSampleRate(self.sampleRate()));
  });
  self.primaryLabel = ko.pureComputed(() => translate("audio.sample_rate.warning.accept"));
  self.secondaryLabel = ko.pureComputed(() => {
    const key = self.isConfirm()
      ? "audio.sample_rate.warning.cancel"
      : "audio.sample_rate.warning.close";
    return translate(key);
  });
  self.hintsTitle = ko.pureComputed(() => translate("audio.sample_rate.warning.hints_title"));
  self.hints = ko.pureComputed(() => {
    const hintKeys = [
      "audio.sample_rate.warning.hints.item1",
      "audio.sample_rate.warning.hints.item2",
      "audio.sample_rate.warning.hints.item3"
    ];
    return hintKeys
      .map((key) => translate(key))
      .filter((text) => text && !/^\{\{.*\}\}$/.test(text));
  });

  self.show = (sampleRate, params) => {
    if (ui.currentOpenModal() !== null) {
      return;
    }
    self.mode("confirm");
    self.sampleRate(sampleRate || null);
    self.pendingConnection = params || null;
    self.visible(true);
    ui.currentOpenModal('sampleRateWarning');
  };

  self.showInfo = (sampleRate) => {
    if (ui.currentOpenModal() !== null) {
      return;
    }
    self.mode("info");
    self.sampleRate(sampleRate || null);
    self.pendingConnection = null;
    self.visible(true);
    ui.currentOpenModal('sampleRateWarning');
  };

  self.hide = () => {
    self.visible(false);
    if (ui.currentOpenModal() === 'sampleRateWarning') {
      ui.currentOpenModal(null);
    }
    self.pendingConnection = null;
  };

  self.joinWithoutAudio = () => {
    const params = self.pendingConnection;
    const sampleRate = self.sampleRate();
    self.hide();
    if (params) {
      ui._performConnect(params, {
        audioEnabled: false,
        sampleRate,
      });
    }
  };

  self.cancel = () => {
    self.hide();
  };
}

class ConnectionInfo {
  constructor(ui) {
    this._ui = ui;
    this.visible = ko.observable(false);
    this.serverVersion = ko.observable();
    this.latencyMs = ko.observable(NaN);
    this.latencyDeviation = ko.observable(NaN);
    this.remoteHost = ko.observable();
    this.remotePort = ko.observable();
    this.maxBitrate = ko.observable(NaN);
    this.currentBitrate = ko.observable(NaN);
    this.maxBandwidth = ko.observable(NaN);
    this.currentBandwidth = ko.observable(NaN);
    this.codec = ko.observable();

    this.show = () => {
      // Prevent opening connection info if another modal is already open
      if (this._ui.currentOpenModal() !== null) {
        return;
      }
      this.update();
      this.visible(true);
      this._ui.currentOpenModal('connectionInfo');
    };
    this.hide = () => {
      this.visible(false);
      // Clear the modal state when connection info dialog is closed
      if (this._ui.currentOpenModal() === 'connectionInfo') {
        this._ui.currentOpenModal(null);
      }
    };
  }

  update() {
    let client = this._ui.client;

    if (client) {
      this.serverVersion(client.serverVersion);

      let dataStats = client.dataStats;
      if (dataStats) {
        this.latencyMs(dataStats.mean);
        this.latencyDeviation(Math.sqrt(dataStats.variance));
      }
    } else {
      // Handle case when not connected to server
      this.serverVersion(null);
      this.latencyMs(NaN);
      this.latencyDeviation(NaN);
    }
    this.remoteHost(this._ui.remoteHost());
    this.remotePort(this._ui.remotePort());

    let spp = this._ui.settings.samplesPerPacket;
    if (client) {
      let maxBandwidth = client.maxBandwidth;
      let maxBitrate = client.maxBandwidth !== undefined ? client.getMaxBitrate(spp, false) : NaN;
      let actualBitrate = client.getActualBitrate(spp, false);
      let actualBandwidth = MumbleClient.calcEnforcableBandwidth(
        actualBitrate,
        spp,
        false
      );
      this.maxBitrate(maxBitrate);
      this.currentBitrate(actualBitrate);
      this.maxBandwidth(maxBandwidth);
      this.currentBandwidth(actualBandwidth);
      this.codec("Opus"); // only one supported for sending
    } else {
      // Handle case when not connected to server
      this.maxBitrate(NaN);
      this.currentBitrate(NaN);
      this.maxBandwidth(NaN);
      this.currentBandwidth(NaN);
      this.codec("Unknown");
    }
  }
}

class SettingsDialog {
  constructor(settings) {
    this.voiceMode = ko.observable(settings.voiceMode);
    this.pttKey = ko.observable(settings.pttKey);
    this.pttKeyDisplay = ko.observable(settings.pttKey);
    this.userCountInChannelName = ko.observable(
      settings.userCountInChannelName()
    );
    // Need to wrap this in a pureComputed to make sure it's always numeric
    let audioBitrate = ko.observable(settings.audioBitrate);
    this.audioBitrate = ko.pureComputed({
      read: audioBitrate,
      write: (value) => audioBitrate(Number(value)),
    });
    this.samplesPerPacket = ko.observable(settings.samplesPerPacket);
    this.msPerPacket = ko.pureComputed({
      read: () => this.samplesPerPacket() / 48,
      write: (value) => this.samplesPerPacket(value * 48),
    });
  }

  applyTo(settings) {
    settings.voiceMode = this.voiceMode();
    settings.pttKey = this.pttKey();
    settings.userCountInChannelName(this.userCountInChannelName());
    settings.audioBitrate = this.audioBitrate();
    settings.samplesPerPacket = this.samplesPerPacket();
  }

  end() {
  }

  recordPttKey() {
    var combo = [];
    const keydown = (e) => {
      combo = e.pressedKeys;
      let comboStr = combo.join(" + ");
      this.pttKeyDisplay("> " + comboStr + " <");
    };
    const keyup = () => {
      keyboardjs.unbind("", keydown, keyup);
      let comboStr = combo.join(" + ");
      if (comboStr) {
        this.pttKey(comboStr).pttKeyDisplay(comboStr);
      } else {
        this.pttKeyDisplay(this.pttKey());
      }
    };
    keyboardjs.bind("", keydown, keyup);
    this.pttKeyDisplay("> ? <");
  }

  totalBandwidth() {
    return MumbleClient.calcEnforcableBandwidth(
      this.audioBitrate(),
      this.samplesPerPacket(),
      true
    );
  }

  positionBandwidth() {
    return (
      this.totalBandwidth() -
      MumbleClient.calcEnforcableBandwidth(
        this.audioBitrate(),
        this.samplesPerPacket(),
        false
      )
    );
  }

  overheadBandwidth() {
    return MumbleClient.calcEnforcableBandwidth(
      0,
      this.samplesPerPacket(),
      false
    );
  }
}

class Settings {
  constructor(defaults) {
    const load = (key) => window.localStorage.getItem("mumble." + key);
    this.voiceMode = load("voiceMode") || defaults.voiceMode;
    this.pttKey = load("pttKey") || defaults.pttKey;
    this.userCountInChannelName = ko.observable(
      load("userCountInChannelName") || defaults.userCountInChannelName
    );
    this.audioBitrate = Number(load("audioBitrate")) || defaults.audioBitrate;
    this.samplesPerPacket =
      Number(load("samplesPerPacket")) || defaults.samplesPerPacket;
  }

  save() {
    const save = (key, val) =>
      window.localStorage.setItem("mumble." + key, val);
    save("voiceMode", this.voiceMode);
    save("pttKey", this.pttKey);
    save("userCountInChannelName", this.userCountInChannelName());
    save("audioBitrate", this.audioBitrate);
    save("samplesPerPacket", this.samplesPerPacket);
  }
}

class GlobalBindings {
  constructor(config) {
    this.config = config;
    this.settings = new Settings(config.settings);
    this.connector = new WorkerBasedMumbleConnector();
    this.client = null;
    
    // Add microphone permission state observable
  this.micPermissionDenied = ko.observable(false);
  this.micPermissionErrorMessage = ko.observable("");
    this.micPermissionRetryCount = 0;
    this.maxMicPermissionRetryCount = 3;
    this.micPermissionRetryDelayMs = 1000;
    
    // Use netlify-identity-widget from global scope (loaded via script tag)
    if (window.netlifyIdentity && typeof window.netlifyIdentity.init === "function") {
      this.netlifyIdentity = window.netlifyIdentity;
    } else {
      // Fallback implementation if widget fails to load
      this.netlifyIdentity = {
        init: () => {},
        open: () => {},
        on: () => {},
        currentUser: () => null,
        logout: () => {},
        close: () => {},
      };
    }
    this.connectDialog = new ConnectDialog();
    this.connectErrorDialog = new ConnectErrorDialog(this.connectDialog);
    this.sampleRateWarningDialog = new SampleRateWarningDialog(this);
    this.guacamoleFrame = new GuacamoleFrame();
    this.connectionInfo = new ConnectionInfo(this);
    this.settingsDialog = ko.observable();

    this.audioLockActive = ko.observable(false);
    this.audioLockReason = ko.observable(null);
    this.audioLockDetails = ko.observable(null);
    
    // LOOPBACK-FEATURE: Track whether client is in loopback test mode
    // When true, voice is routed to server loopback (target=31) for echo testing
    this.isLoopbackMode = ko.observable(false);
    
    // GUACAMOLE-INTEGRATION: Store credentials for later use when switching from test to normal mode
    // Allows seamless transition to Guacamole desktop without re-authentication
    this._guacLogin = null; 
    this._guacPassword = null;

    this._activateAudioLock = (reason, details = {}) => {
      this.audioLockReason(reason);
      this.audioLockDetails(details);
      this.audioLockActive(true);
      this.selfMute(true);
      this.selfDeaf(true);
      if (voiceHandler) {
        voiceHandler.setMute(true);
      }
    };

    this._clearAudioLock = ({ resetStates = false } = {}) => {
      if (resetStates && this.audioLockActive()) {
        this.selfMute(false);
        this.selfDeaf(false);
      }
      this.audioLockActive(false);
      this.audioLockReason(null);
      this.audioLockDetails(null);
    };

    this.notifyAudioLock = () => {
      const details = this.audioLockDetails() || {};
      const sr =
        details.sampleRate !== undefined
          ? details.sampleRate
          : this.audioContext && this.audioContext.sampleRate;
      this.sampleRateWarningDialog.showInfo(sr);
    };

    this.handleUnmuteClick = () => {
      if (this.thisUser()) {
        this.requestUnmute(this.thisUser());
      }
    };

    this.handleUndeafClick = () => {
      if (this.thisUser()) {
        this.requestUndeaf(this.thisUser());
      }
    };
    
    // Modal management - track currently open modal to prevent multiple modals
    this.currentOpenModal = ko.observable(null);
    this.remoteHost = ko.observable();
    this.remotePort = ko.observable();
    this.thisUser = ko.observable();
    this.root = ko.observable();
    this.messageBox = ko.observable("");
    this.selected = ko.observable();
    this.selfMute = ko.observable();
    this.selfDeaf = ko.observable();
    this.isBeeping = ko.observable(false);
    
    // Beep test: inject 440Hz tone directly into audio pipeline (like second microphone)
    
    // PERSISTENT-BEEPER: Initialize permanent beep oscillator once, control via gain
    this._initializePersistentBeeper = async () => {
      if (this._persistentBeeper) return; // Already initialized
      
      try {
        const mixer = window._audioMixer;
        if (!mixer) {
          console.log('[BEEP] Mixer not ready, will retry when available');
          return;
        }
        
        const ac = await window.audioContextManager.getAudioContext();
        if (!ac || ac.state !== 'running') {
          console.log('[BEEP] AudioContext not ready, will retry');
          return;
        }
        
        // Create permanent oscillator and gain for beep tone
        const oscillator = ac.createOscillator();
        const beepGain = ac.createGain();
        
        oscillator.frequency.setValueAtTime(440, ac.currentTime);
        oscillator.type = 'sine';
        beepGain.gain.setValueAtTime(0, ac.currentTime); // Start silent
        
        // Connect: Oscillator -> Gain -> Mixer (permanent connection)
        oscillator.connect(beepGain);
        beepGain.connect(mixer);
        
        // Start oscillator permanently (it just runs silently at gain=0)
        oscillator.start();
        
        // Store references
        this._persistentBeeper = {
          oscillator,
          gain: beepGain,
          isPlaying: false
        };
        
        console.log('[BEEP] Persistent beeper initialized and connected to mixer');
      } catch (err) {
        console.error('[BEEP] Failed to initialize persistent beeper:', err);
      }
    };

    this.startBeep = () => {
      console.log('[BEEP] Start beep requested');
      
      if (!this.connected()) {
        console.log('[BEEP] Not connected, ignoring beep');
        return;
      }
      
      // Initialize persistent beeper if needed
      if (!this._persistentBeeper) {
        this._initializePersistentBeeper();
        // If still not ready, ignore this beep request
        if (!this._persistentBeeper) {
          console.log('[BEEP] Persistent beeper not ready yet');
          return;
        }
      }
      
      try {
        const beeper = this._persistentBeeper;
        const ac = beeper.gain.context;
        const currentTime = ac.currentTime;
        
        // Cancel any ongoing fade-outs and set to full volume instantly
        beeper.gain.gain.cancelScheduledValues(currentTime);
        beeper.gain.gain.setValueAtTime(0.4, currentTime);
        
        beeper.isPlaying = true;
        this.isBeeping(true);
        
        console.log('[BEEP] Beep tone activated (gain=0.4)');
      } catch (err) {
        console.error('[BEEP] Error starting beep:', err);
      }
    };

    this.stopBeep = () => {
      console.log('[BEEP] Stop beep requested');
      
      if (!this._persistentBeeper || !this._persistentBeeper.isPlaying) {
        console.log('[BEEP] Beeper not playing, ignoring stop');
        return;
      }
      
      try {
        const beeper = this._persistentBeeper;
        const ac = beeper.gain.context;
        const currentTime = ac.currentTime;
        
        // PIANO-PHYSICS: Real piano strings vibrate for minimum time even on staccato
        // Even quick taps should produce audible tone with natural decay
        const minimumSustain = 0.6; // Minimum sustain like piano string physics
        const fadeTime = 1.2; // Natural exponential decay time
        
        // Schedule fade to start after minimum sustain time
        // This ensures even staccato notes have proper body and presence
        beeper.gain.gain.cancelScheduledValues(currentTime);
        beeper.gain.gain.setValueAtTime(0.4, currentTime); // Hold current level
        beeper.gain.gain.setValueAtTime(0.4, currentTime + minimumSustain); // Sustain minimum time
        beeper.gain.gain.exponentialRampToValueAtTime(0.001, currentTime + minimumSustain + fadeTime);
        
        beeper.isPlaying = false;
        this.isBeeping(false);
        
        console.log(`[BEEP] Piano-style: sustain ${minimumSustain}s + fade ${fadeTime}s = ${minimumSustain + fadeTime}s total`);
      } catch (err) {
        console.error('[BEEP] Error stopping beep:', err);
      }
    };    // Add method to retry microphone permission
    this._attemptMicrophonePermission = () => {
      if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
        return;
      }

      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          this.micPermissionRetryCount = 0;
          this.micPermissionDenied(false);
          this.micPermissionErrorMessage("");
          stream.getTracks().forEach((track) => track.stop());
          // Reinitialize voice if needed
          if (this.client && !voiceHandler) {
            this._updateVoiceHandler();
          }
        })
        .catch((err) => {
          console.error("Microphone permission denied on retry:", err);
          this.micPermissionRetryCount += 1;
          const isPermissionBlocked =
            err &&
            (err.name === "NotAllowedError" ||
              err.name === "SecurityError" ||
              (typeof err.message === "string" &&
                err.message.toLowerCase().includes("denied")));

          if (isPermissionBlocked) {
            this.micPermissionErrorMessage(
              "Microphone access is blocked by the browser. Please allow it in the address bar or system settings, then try again."
            );
          }

          if (this.micPermissionRetryCount >= this.maxMicPermissionRetryCount) {
            return;
          }
          if (isPermissionBlocked) {
            return;
          }
          setTimeout(() => this._attemptMicrophonePermission(), this.micPermissionRetryDelayMs);
        });
    };

    this.retryMicrophonePermission = () => {
      this.micPermissionRetryCount = 0;
      this.micPermissionErrorMessage("");
      this._attemptMicrophonePermission();
    };
    
    // AUDIO-CONTEXT: Initialize managed AudioContext with autoplay policy handling
    // This method ensures singleton pattern and handles browser autoplay restrictions
    this.initializeAudioContext = async () => {
      // SINGLETON-PATTERN: Prevent duplicate initialization - reuse existing instance
      if (this.audioContext) {
        // AudioContext already exists, reusing singleton instance
        return;
      }
      
      try {
        // AUTOPLAY-POLICY: Use managed AudioContext that handles browser autoplay restrictions
        // Waits for user interaction before allowing audio playback
        this.audioContext = await ensureAudioContext({ 
          latencyHint: "interactive" 
        });

        // STATE-MONITORING: Set up event handlers for audio context state changes
        // These help diagnose audio issues by tracking suspend/resume cycles
        audioContextManager.onSuspend(() => {
          // AudioContext suspended - audio features may be limited until user interaction
        });

        audioContextManager.onResume(() => {
          // AudioContext resumed - audio features restored
        });

      } catch (error) {
        console.error('Failed to initialize AudioContext:', error);
        
        // FALLBACK-STRATEGY: Try legacy AudioContext creation if managed approach fails
        // Some older browsers or restricted environments may not support managed approach
        try {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          if (!AudioContextClass) {
            throw new Error("AudioContext is not supported in this browser");
          }
          this.audioContext = new AudioContextClass({ latencyHint: "interactive" });
        } catch (fallbackError) {
          console.error('Both managed and legacy AudioContext initialization failed:', fallbackError);
          // DEGRADED-MODE: AudioContext remains null, audio features will be disabled
        }
      }
    };
    
    // Use managed AudioContext with autoplay policy handling
    this.audioContext = null;
    this.initializeAudioContext();

    this.selfMute.subscribe((mute) => {
      if (voiceHandler) {
        voiceHandler.setMute(mute);
      }
    });

    this.select = (element) => {
      this.selected(element);
    };

    this.openSettings = () => {
      // Prevent opening settings if another modal is already open
      if (this.currentOpenModal() !== null) {
        return;
      }
      this.settingsDialog(new SettingsDialog(this.settings));
      this.currentOpenModal('settings');
    };

    this.logoutUser = () => {
      this.netlifyIdentity.logout();
      location.reload()
    };

    this.applySettings = () => {
      const settingsDialog = this.settingsDialog();

      settingsDialog.applyTo(this.settings);

      this._updateVoiceHandler();

      this.settings.save();
      this.closeSettings();
    };

    this.closeSettings = () => {
      if (this.settingsDialog()) {
        this.settingsDialog().end();
      }
      this.settingsDialog(null);
      // Clear the modal state when settings dialog is closed
      if (this.currentOpenModal() === 'settings') {
        this.currentOpenModal(null);
      }
    };

    this.connect = async (
      host,
      port,
      username,
      password,
      tokens = [],
      channelName = ""
    ) => {
      const identity = this.netlifyIdentity.currentUser();
      if (!identity || !identity.app_metadata) {
        alert(
          "You do not have permission to connect to the server. Please contact the administrator."
        );
        return;
      }

      var user_roles = identity.app_metadata.roles || [];
      if (!Array.isArray(user_roles)) {
        user_roles = [];
      }

      // Ensure roles contain defaults
      if (!user_roles.includes("watch")) user_roles.push("watch");
      if (!user_roles.includes("listen")) user_roles.push("listen");
      identity.app_metadata.roles = user_roles;

      // Prepare AudioContext information before prompting for permissions
      if (!this.audioContext) {
        await this.initializeAudioContext();
      }
      const currentSampleRate = this.audioContext
        ? this.audioContext.sampleRate
        : null;
      const audioCompatible = currentSampleRate === 48000;
      const connectionParams = {
        host,
        port,
        username,
        password,
        tokens,
        channelName,
      };

      if (!audioCompatible) {
        this.sampleRateWarningDialog.show(currentSampleRate, connectionParams);
        return;
      }

      // Request microphone permission and show overlay only if denied
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices
          .getUserMedia({ audio: true })
          .then((stream) => {
            this.micPermissionDenied(false);
            stream.getTracks().forEach((track) => track.stop());
          })
          .catch((err) => {
            console.warn(
              "Microphone permission denied, showing retry option:",
              err
            );
            this.micPermissionDenied(true);
          });
      }

      this._clearAudioLock({ resetStates: true });
      await this._performConnect(connectionParams, { audioEnabled: true });
    };

    // LOOPBACK-FEATURE: Connect to server in loopback test mode
    // Routes voice through server echo (target=31) for testing audio encode/decode pipeline
    this.connectLoopback = async (
      host,
      port,
      username,
      password,
      tokens = [],
      channelName = ""
    ) => {
      // AUTH-CHECK: Verify Netlify Identity authentication before connecting
      const identity = this.netlifyIdentity.currentUser();
      if (!identity || !identity.app_metadata) {
        alert(
          "You do not have permission to connect to the server. Please contact the administrator."
        );
        return;
      }

      // ROLE-MANAGEMENT: Ensure user has minimum required roles for voice testing
      var user_roles = identity.app_metadata.roles || [];
      if (!Array.isArray(user_roles)) {
        user_roles = [];
      }

      // Add default roles if missing (watch for UI, listen for audio)
      if (!user_roles.includes("watch")) user_roles.push("watch");
      if (!user_roles.includes("listen")) user_roles.push("listen");
      identity.app_metadata.roles = user_roles;

      // AUDIO-INIT: Prepare AudioContext before requesting microphone permissions
      // This ensures audio subsystem is ready for loopback testing
      if (!this.audioContext) {
        await this.initializeAudioContext();
      }

      const connectionParams = {
        host,
        port,
        username,
        password,
        tokens,
        channelName,
        isLoopback: true, // ROUTING-FLAG: Mark connection for loopback voice routing (target=31)
      };

      // MIC-PERMISSION: Request microphone access and track permission state
      // Shows retry overlay if user denies permission
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices
          .getUserMedia({ audio: true })
          .then((stream) => {
            this.micPermissionDenied(false);
            // CLEANUP: Stop temporary permission check stream immediately
            stream.getTracks().forEach((track) => track.stop());
          })
          .catch((err) => {
            console.warn(
              "Microphone permission denied, showing retry option:",
              err
            );
            this.micPermissionDenied(true);
          });
      }

      this._clearAudioLock({ resetStates: true });
      
      // MODE-FLAG: Set loopback mode before connection to affect voice handler creation
      this.isLoopbackMode(true);
      await this._performConnect(connectionParams, { audioEnabled: true });
    };

    // TEST-BUTTON: Wrapper function for the Test button - enables loopback on existing connection
    // This allows testing audio without reconnecting if already connected to server
    this.startLoopbackTest = () => {
      if (this.connected()) {
        // ALREADY-CONNECTED: Switch existing connection to loopback mode
        // More efficient than disconnecting and reconnecting
        this.isLoopbackMode(true);
        
        // VOICE-HANDLER-RESET: Force recreation of voice handler with new loopback target
        // Old handler uses normal routing, new one will use target=31 for loopback
        if (this.voiceHandler) {
          this.voiceHandler.setMute(true);
          this.voiceHandler.end();
          this.voiceHandler = null;
        }
        
        // HANDLER-RECREATION: Create new voice handler with loopback target (31)
        this._updateVoiceHandler();
      } else {
        // NOT-CONNECTED: Use default connection parameters for initial loopback connection
        const host = this.config.defaults.host || "localhost";
        const port = this.config.defaults.port || 64738;
        const username = this.config.defaults.username || "WebClient";
        const password = this.config.defaults.password || "";
        this.connectLoopback(host, port, username, password);
      }
    };

    this._performConnect = async (
      connectionParams,
      { audioEnabled = true, sampleRate = null } = {}
    ) => {
      const {
        host,
        port,
        username,
        password,
        tokens = [],
        channelName: targetChannel = "",
      } = connectionParams;

      let channelName = targetChannel;

      if (audioEnabled) {
        initVoice(
          (data) => {
            if (!ui.client) {
              if (voiceHandler) {
                voiceHandler.end();
              }
              voiceHandler = null;
            } else if (voiceHandler) {
              voiceHandler.write(data);
            }
          },
          (err) => {
            log(translate("logentry.mic_init_error"), err);
          }
        );
      } else {
        this._activateAudioLock("sample-rate", { sampleRate });
        if (voiceHandler) {
          voiceHandler.end();
          voiceHandler = null;
        }
      }

      this.resetClient();
      
      // Set loopback mode after resetClient (which resets it to false)
      if (connectionParams.isLoopback) {
        this.isLoopbackMode(true);
      }

      this.remoteHost(host);
      this.remotePort(port);

      log(translate("logentry.connecting"), host);

      try {
        if (this.audioContext && this.audioContext.state === "suspended") {
          await this.audioContext.resume();
        } else if (!this.audioContext) {
          await this.initializeAudioContext();
        }
      } catch (error) {
        console.warn("AudioContext resume failed, continuing anyway:", error);
      }

      try {
        const client = await this.connector.connect(`wss://${host}:${port}`, {
          username: username,
          password: password,
          tokens: tokens,
        });
        var user_roles =
          (this.netlifyIdentity.currentUser()?.app_metadata?.roles) || [];
        let guac_login = false;
        if (user_roles.includes("admin")) {
          guac_login = "admin";
        } else if (user_roles.includes("edit")) {
          guac_login = "editor";
        } else if (user_roles.includes("watch")) {
          guac_login = "watcher";
        }
        
        // Store Guacamole credentials for later use (e.g., when switching from loopback to normal)
        this._guacLogin = guac_login;
        this._guacPassword = this.connectDialog.password();
        
        // Only show Guacamole frame if NOT in loopback mode
        if (guac_login && !this.isLoopbackMode()) {
          this.guacamoleFrame.start(
            guac_login,
            this.connectDialog.password()
          );
          this.guacamoleFrame.show();
        } else if (!guac_login && !this.isLoopbackMode()) {
          alert("For visual access please ask your administrator.");
        }
        
        if (this.isLoopbackMode()) {
          log(translate("logentry.connected_loopback"));
        } else {
          log(translate("logentry.connected"));
        }

        this.client = client;
        client.on("error", (err) => {
          log(translate("logentry.connection_error"), err);
          this.resetClient();
        });

        if (channelName.indexOf("/") != 0) {
          channelName = "/" + channelName;
        }
        const registerChannel = (channel, channelPath) => {
          this._newChannel(channel);
          if (channelPath === channelName) {
            client.self.setChannel(channel);
          }
          channel.children.forEach((ch) =>
            registerChannel(ch, channelPath + "/" + ch.name)
          );
        };
        registerChannel(client.root, "");

        client.users.forEach((user) => this._newUser(user));

        client.on("newChannel", (channel) => this._newChannel(channel));
        client.on("newUser", (user) => this._newUser(user));

        // Ensure client.self has __ui before setting thisUser
        if (client.self && !client.self.__ui) {
          this._newUser(client.self);
        }
        
        this.thisUser(client.self.__ui);
        this.root(client.root.__ui);
        this._updateLinks();

        this._updateVoiceHandler();

        if (this.audioLockActive()) {
          this.client.setSelfMute(true);
          this.client.setSelfDeaf(true);
        } else if (this.selfDeaf()) {
          this.client.setSelfDeaf(true);
        } else if (this.selfMute()) {
          this.client.setSelfMute(true);
        }
      } catch (err) {
        if (err.$type && err.$type.name === "Reject") {
          this.connectErrorDialog.type(err.type);
          this.connectErrorDialog.reason(err.reason);
          this.connectErrorDialog.show();
        } else {
          log(translate("logentry.connection_error"), err);
        }
      }
    };

    this._newUser = (user) => {
      // Skip if UI already initialized (prevents duplicate event handlers)
      if (user.__ui) {
        return;
      }
      
      const simpleProperties = {
        uniqueId: "uid",
        username: "name",
        mute: "mute",
        deaf: "deaf",
        suppress: "suppress",
        selfMute: "selfMute",
        selfDeaf: "selfDeaf",
      };
      var ui = (user.__ui = {
        model: user,
        talking: ko.observable("off"),
        channel: ko.observable(),
      });
      ui.openContextMenu = (_, event) =>
        openContextMenu(event, this.userContextMenu, ui);

      ui.toggleMute = () => {
        if (ui.selfMute()) {
          this.requestUnmute(ui);
        } else {
          this.requestMute(ui);
        }
      };
      ui.toggleDeaf = () => {
        if (ui.selfDeaf()) {
          this.requestUndeaf(ui);
        } else {
          this.requestDeaf(ui);
        }
      };
      Object.entries(simpleProperties).forEach((key) => {
        ui[key[1]] = ko.observable(user[key[0]]);
      });
      ui.state = ko.pureComputed(userToState, ui);
      if (user.channel) {
        ui.channel(user.channel.__ui);
        ui.channel().users.push(ui);
        ui.channel().users.sort(compareUsers);
      }

      user
        .on("update", (actor, properties) => {
          Object.entries(simpleProperties).forEach((key) => {
            if (properties[key[0]] !== undefined) {
              ui[key[1]](properties[key[0]]);
            }
          });
          if (properties.channel !== undefined) {
            if (ui.channel()) {
              ui.channel().users.remove(ui);
            }
            ui.channel(properties.channel.__ui);
            ui.channel().users.push(ui);
            ui.channel().users.sort(compareUsers);
            this._updateLinks();
          }
        })
        .on("remove", () => {
          if (ui.channel()) {
            ui.channel().users.remove(ui);
          }
        })
        .on("voice", (stream) => {
          console.log('[VOICE] Voice stream received for user:', user.username);
          
          // Create audio node for playing back received voice
          var userNode = new BufferQueueNode({
            audioContext: this.audioContext,
          });
          
          // Create a GainNode to control volume (for deafen functionality)
          var gainNode = this.audioContext.createGain();
          
          // Set initial gain based on current deafen state
          gainNode.gain.value = this.selfDeaf() ? 0 : 1;
          console.log('[VOICE] Initial gain set to:', gainNode.gain.value, '(selfDeaf:', this.selfDeaf(), ')');
          
          // Connect: userNode -> gainNode -> destination
          userNode.connect(gainNode);
          gainNode.connect(this.audioContext.destination);
          
          // Subscribe to selfDeaf changes to update gain
          var deafSubscription = this.selfDeaf.subscribe((isDeaf) => {
            gainNode.gain.value = isDeaf ? 0 : 1;
            console.log('[VOICE] Gain updated to:', gainNode.gain.value, '(deaf:', isDeaf, ')');
          });

          stream
            .on("data", (data) => {
              console.log('[VOICE] Audio data received, target:', data.target, 'buffer size:', data.buffer?.length);
              
              if (data.target === "normal") {
                ui.talking("on");
              } else if (data.target === "shout") {
                ui.talking("shout");
              } else if (data.target === "whisper") {
                ui.talking("whisper");
              } else if (data.target === "loopback") {
                // Server loopback - show talking status
                ui.talking("on");
                console.log('[VOICE] Loopback audio received!');
              }
              
              userNode.write(data.buffer);
            })
            .on("end", () => {
              console.log('[VOICE] Voice stream ended for user:', user.username);
              ui.talking("off");
              userNode.end();
              // Clean up subscription when stream ends
              deafSubscription.dispose();
            });
        });
    };

    this._newChannel = (channel) => {
      // Skip if UI already initialized (prevents duplicate event handlers)
      if (channel.__ui) {
        return;
      }
      
      const simpleProperties = {
        position: "position",
        name: "name",
        description: "description",
      };
      var ui = (channel.__ui = {
        model: channel,
        expanded: ko.observable(true),
        parent: ko.observable(),
        channels: ko.observableArray(),
        users: ko.observableArray(),
        linked: ko.observable(false),
      });
      ui.userCount = () => {
        return ui
          .channels()
          .reduce((acc, c) => acc + c.userCount(), ui.users().length);
      };
      ui.openContextMenu = (_, event) =>
        openContextMenu(event, this.channelContextMenu, ui);
      Object.entries(simpleProperties).forEach((key) => {
        ui[key[1]] = ko.observable(channel[key[0]]);
      });
      if (channel.parent) {
        ui.parent(channel.parent.__ui);
        ui.parent().channels.push(ui);
        ui.parent().channels.sort(compareChannels);
      }
      this._updateLinks();

      channel
        .on("update", (properties) => {
          Object.entries(simpleProperties).forEach((key) => {
            if (properties[key[0]] !== undefined) {
              ui[key[1]](properties[key[0]]);
            }
          });
          if (properties.parent !== undefined) {
            if (ui.parent()) {
              ui.parent().channel.remove(ui);
            }
            ui.parent(properties.parent.__ui);
            ui.parent().channels.push(ui);
            ui.parent().channels.sort(compareChannels);
          }
          if (properties.links !== undefined) {
            this._updateLinks();
          }
        })
        .on("remove", () => {
          if (ui.parent()) {
            ui.parent().channels.remove(ui);
          }
          this._updateLinks();
        });
    };

    this.resetClient = () => {
      this.stopBeep(); // Stop beep if active
      if (this.client) {
        this.client.disconnect();
      }
      this.client = null;
      this.selected(null).root(null).thisUser(null);
      this.isLoopbackMode(false); // Reset loopback mode on disconnect
      
      // Note: We don't automatically reset isTestActive here anymore
      // It's controlled manually by the toggle function
    };

    this.connected = () => this.thisUser() != null;

    // VOICE-HANDLER-UPDATE: Recreate voice handler when mode or target changes
    // Called when switching between normal/loopback mode or changing PTT/continuous settings
    this._updateVoiceHandler = () => {
      if (!this.client) {
        return;
      }
      
      // CLEANUP: Destroy existing handler before creating new one
      if (voiceHandler) {
        voiceHandler.end();
        voiceHandler = null;
      }
      
      let mode = this.settings.voiceMode;
      
      // TARGET-ROUTING: Determine voice routing target based on mode
      // target=31 routes to server loopback for echo testing (loopback mode)
      // target=0 routes normally to channel/user (normal mode)
      let target = this.isLoopbackMode() ? 31 : 0;
      
      // HANDLER-CREATION: Create appropriate handler based on voice activation mode
      if (mode === "cont") {
        // Continuous transmission - always sending audio
        voiceHandler = new ContinuousVoiceHandler(this.client, this.settings, target);
      } else if (mode === "ptt") {
        // Push-to-talk - only sending when key is pressed
        voiceHandler = new PushToTalkVoiceHandler(this.client, this.settings, target);
      } else {
        log(translate("logentry.unknown_voice_mode"), mode);
        return;
      }
      
      // UI-BINDING: Connect voice handler events to UI talking indicators
      voiceHandler.on("started_talking", () => {
        if (this.thisUser()) {
          this.thisUser().talking("on");
        }
      });
      voiceHandler.on("stopped_talking", () => {
        if (this.thisUser()) {
          this.thisUser().talking("off");
        }
      });
      
      // MUTE-STATE: Apply current mute state to new handler
      if (this.audioLockActive() || this.selfMute()) {
        voiceHandler.setMute(true);
      }

      // PERSISTENT-BEEPER: Initialize beeper when voice handler is ready
      // This ensures beeper is available for loopback testing
      setTimeout(() => {
        this._initializePersistentBeeper();
      }, 500); // Small delay to ensure mixer is ready

      this.client.setAudioQuality(
        this.settings.audioBitrate,
        this.settings.samplesPerPacket
      );
    };

    this.messageBoxHint = ko.pureComputed(() => {
      if (!this.thisUser()) {
        return ""; // Not yet connected
      }
      var target = this.selected();
      if (!target) {
        target = this.thisUser();
      }
      if (target === this.thisUser()) {
        target = target.channel();
      }
      if (target.users) {
        // Channel
        return translate("chat.channel_message_placeholder").replace(
          "%1",
          target.name()
        );
      } else {
        // User
        return translate("chat.user_message_placeholder").replace(
          "%1",
          target.name()
        );
      }
    });

    this.submitMessageBox = () => {
      this.sendMessage(this.selected(), this.messageBox());
      this.messageBox("");
    };

    this.mailToDesktop = ko.observable(
      "mailto:mail@" +
      window.location.hostname +
      "?subject=Send%20attachment%20to%20desktop"
    );

    this.sendMessage = (target, message) => {
      if (this.connected()) {
        // If no target is selected, choose our own user
        if (!target) {
          target = this.thisUser();
        }
        // If target is our own user, send to our channel
        if (target === this.thisUser()) {
          target = target.channel();
        }
        // Send message
        target.model.sendMessage(message);
      }
    };

    this.requestMute = (user) => {
      if (user !== this.thisUser()) return;
      this.selfMute(true);
      if (this.connected()) {
        this.client.setSelfMute(true);
      }
    };

    this.requestDeaf = (user) => {
      if (user !== this.thisUser()) return;
      
      // LOOPBACK-FEATURE: Allow deaf without mute in loopback test mode
      // In normal mode, deaf automatically enables mute (standard Mumble behavior)
      // In loopback mode, allow deaf without mute for testing purposes
      if (!this.isLoopbackMode()) {
        this.selfMute(true);
      }
      
      this.selfDeaf(true);
      if (this.connected()) {
        this.client.setSelfDeaf(true);
      }
    };

    this.requestUnmute = (user) => {
      if (this.audioLockActive()) {
        this.notifyAudioLock();
        return;
      }
      if (user !== this.thisUser()) {
        return;
      }
      
      this.selfMute(false);
      this.selfDeaf(false);
      
      if (this.connected()) {
        this.client.setSelfMute(false);
        this.client.setSelfDeaf(false);
      }
    };

    this.requestUndeaf = (user) => {
      if (this.audioLockActive()) {
        this.notifyAudioLock();
        return;
      }
      if (user !== this.thisUser()) return;
      this.selfDeaf(false);
      if (this.connected()) {
        this.client.setSelfDeaf(false);
      }
    };

    this._updateLinks = () => {
      if (!this.thisUser() || !this.thisUser().channel()) {
        return;
      }

      var allChannels = getAllChannels(this.root(), []);
      var ownChannel = this.thisUser().channel().model;
      var allLinked = findLinks(ownChannel, []);
      allChannels.forEach((channel) => {
        channel.linked(allLinked.indexOf(channel.model) !== -1);
      });

      function findLinks(channel, knownLinks) {
        knownLinks.push(channel);
        if (channel.links) {
          channel.links.forEach((next) => {
            if (next && knownLinks.indexOf(next) === -1) {
              findLinks(next, knownLinks);
            }
          });
        }
        allChannels
          .map((c) => c.model)
          .forEach((next) => {
            if (
              next &&
              next.links &&
              knownLinks.indexOf(next) === -1 &&
              next.links.indexOf(channel) !== -1
            ) {
              findLinks(next, knownLinks);
            }
          });
        return knownLinks;
      }

      function getAllChannels(channel, channels) {
        channels.push(channel);
        channel.channels().forEach((next) => getAllChannels(next, channels));
        return channels;
      }
    };

    this.openSourceCode = () => {
      var homepage = require("../package.json").homepage;
      window.open(homepage, "_blank").focus();
    };
  }
}
var ui = new GlobalBindings(window.mumbleWebConfig);

// Used only for debugging
window.mumbleUi = ui;

// Make netlify identity available globally
if (ui.netlifyIdentity) {
  window.netlifyIdentity = ui.netlifyIdentity;
}

function initializeUI() {
  // Guard identity init so offline/local dev without the proxy does not break UI
  let user = null;
  try {
    ui.netlifyIdentity.init({
      APIUrl: "https://welcome.flexpair.com/identity-proxy",
      locale: "en",
      logo: false,
    });
    user = ui.netlifyIdentity.currentUser();
  } catch (e) {
    console.warn('[identity] initialization failed; continuing without identity integration', e);
  }

  ui.netlifyIdentity.on("login", (user) => {
    ui.connectDialog.username(
      user.user_metadata.full_name.replace(/[\s]+/g, "_")
    );
    ui.netlifyIdentity.close();
  });

  ui.netlifyIdentity.on("close", () => {
    if (!ui.connectDialog.username()) {
      ui.netlifyIdentity.open("login"); // open the modal to the login tab
    }
  });

  if (user == null) {
    ui.netlifyIdentity.open("signup"); // open the modal to the signup tab
  } else {
    const sanitized = user.user_metadata.full_name.replace(/[^A-Za-z0-9_]+/g, "_");
    ui.connectDialog.username(sanitized);
  }

  var queryParams = url.parse(document.location.href, true).query;
  queryParams = Object.assign({}, window.mumbleWebConfig.defaults, queryParams);
  if (queryParams.address) {
    ui.connectDialog.address(queryParams.address);
  }
  if (queryParams.port) {
    ui.connectDialog.port(queryParams.port);
  }
  if (queryParams.password) {
    ui.connectDialog.password(queryParams.password);
  }
  ko.applyBindings(ui);
}

function log() {
  console.log.apply(console, arguments);
}

function compareChannels(c1, c2) {
  if (c1.position() === c2.position()) {
    return c1.name() === c2.name() ? 0 : c1.name() < c2.name() ? -1 : 1;
  }
  return c1.position() - c2.position();
}

function compareUsers(u1, u2) {
  return u1.name() === u2.name() ? 0 : u1.name() < u2.name() ? -1 : 1;
}

function userToState() {
  var flags = [];
  if (this.uid()) {
    flags.push("Authenticated");
  }
  if (this.mute()) {
    flags.push("Muted (server)");
  }
  if (this.deaf()) {
    flags.push("Deafened (server)");
  }
  if (this.selfMute()) {
    flags.push("Muted (self)");
  }
  if (this.selfDeaf()) {
    flags.push("Deafened (self)");
  }
  return flags.join(", ");
}

var voiceHandler;

async function main() {
  document.title = window.location.hostname;
  await localizationInitialize('en'); // Always use English
  translateEverything();
  initializeUI();
  enumMicrophones();
}

window.onload = main;
