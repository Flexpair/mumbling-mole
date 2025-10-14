import ko from "knockout";
import { initVoice } from "../audio/voice";
import { translate } from "../localize";

/**
 * Manages connection lifecycle, client state, and connection-related operations
 */
export default class ConnectionManager {
  constructor(connector, audioManager) {
    this.connector = connector;
    this.audioManager = audioManager;
    this.client = null;
    this.remoteHost = ko.observable();
    this.remotePort = ko.observable();
    this.isLoopbackMode = ko.observable(false);
    this._guacLogin = null;
    this._guacPassword = null;
  }

  /**
   * Check if connected to server
   */
  isConnected() {
    return this.client != null;
  }

  /**
   * Reset client connection
   */
  resetClient() {
    this.audioManager.stopBeep();
    if (this.client) {
      this.client.disconnect();
    }
    this.client = null;
    this.isLoopbackMode(false);
    this.audioManager.beeperReady(false);
    this.audioManager.voiceHandlerReady(false);
  }

  /**
   * Perform connection to server
   */
  async performConnect(
    connectionParams,
    { audioEnabled = true, sampleRate = null } = {},
    onVoiceWrite,
    onError
  ) {
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
          if (!this.client) {
            if (this.audioManager.voiceHandler) {
              this.audioManager.voiceHandler.end();
            }
            this.audioManager.voiceHandler = null;
          } else if (this.audioManager.voiceHandler) {
            this.audioManager.voiceHandler.write(data);
          }
        },
        (err) => {
          console.log(translate("logentry.mic_init_error"), err);
        }
      );
    } else {
      this.audioManager.activateAudioLock("sample-rate", { sampleRate });
      if (this.audioManager.voiceHandler) {
        this.audioManager.voiceHandler.end();
        this.audioManager.voiceHandler = null;
      }
    }

    this.resetClient();
    
    // Set loopback mode after resetClient (which resets it to false)
    if (connectionParams.isLoopback) {
      this.isLoopbackMode(true);
    }

    this.remoteHost(host);
    this.remotePort(port);

    console.log(translate("logentry.connecting"), host);

    try {
      if (this.audioManager.audioContext && this.audioManager.audioContext.state === "suspended") {
        await this.audioManager.audioContext.resume();
      } else if (!this.audioManager.audioContext) {
        await this.audioManager.initializeAudioContext();
      }
      
      // WARM-UP: Pre-load AudioWorklet module to reduce first-playback latency
      try {
        await this.audioManager.audioContext.audioWorklet.addModule('playback-buffer-processor.js');
      } catch (err) {
        if (err.name !== 'InvalidStateError') {
          console.warn('[AUDIO-INIT] Playback AudioWorklet pre-warm failed:', err);
        }
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

      this.client = client;
      
      client.on("error", (err) => {
        console.log(translate("logentry.connection_error"), err);
        this.resetClient();
        if (onError) {
          onError(err);
        }
      });

      if (channelName.indexOf("/") != 0) {
        channelName = "/" + channelName;
      }

      if (this.isLoopbackMode()) {
        console.log(translate("logentry.connected_loopback"));
      } else {
        console.log(translate("logentry.connected"));
      }

      return { client, channelName };
    } catch (err) {
      if (err.$type && err.$type.name === "Reject") {
        throw err;
      } else {
        console.log(translate("logentry.connection_error"), err);
        throw err;
      }
    }
  }

  /**
   * Set audio quality on client
   */
  setAudioQuality(audioBitrate, samplesPerPacket) {
    if (this.client) {
      this.client.setAudioQuality(audioBitrate, samplesPerPacket);
    }
  }

  /**
   * Set self mute state on client
   */
  setSelfMute(mute) {
    if (this.client) {
      this.client.setSelfMute(mute);
    }
  }

  /**
   * Set self deaf state on client
   */
  setSelfDeaf(deaf) {
    if (this.client) {
      this.client.setSelfDeaf(deaf);
    }
  }
}
