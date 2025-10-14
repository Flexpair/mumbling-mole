import ko from "knockout";
import BufferQueueNode from "../audio/buffer-queue-node";

const DEBUG_VOICE_LOGGING = false;

function debugLog(tag, ...args) {
  if (DEBUG_VOICE_LOGGING) {
    console.log(tag, ...args);
  }
}

function compareUsers(u1, u2) {
  return u1.name() === u2.name() ? 0 : u1.name() < u2.name() ? -1 : 1;
}

/**
 * UserState - manages user-related state and operations
 * 
 * Responsibilities:
 * - Current user (thisUser) tracking
 * - Self mute/deaf state
 * - User registration and event handling
 * - Voice stream playback for users
 */
export default class UserState {
  constructor(audioState) {
    this.audioState = audioState;
    
    // Current user
    this.thisUser = ko.observable();
    
    // Self mute/deaf state
    this.selfMute = ko.observable();
    this.selfDeaf = ko.observable();
  }

  /**
   * Register a new user and set up UI bindings
   * @param {object} user - User model from mumble-client
   * @param {Function} openContextMenuFn - Function to open context menu
   * @param {Function} getUserContextMenu - Function to get user context menu
   */
  registerUser(user, openContextMenuFn, getUserContextMenu) {
    // Skip if UI already initialized
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
      openContextMenuFn(event, getUserContextMenu(), ui);

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
    
    // Set up observables for simple properties
    Object.entries(simpleProperties).forEach((key) => {
      ui[key[1]] = ko.observable(user[key[0]]);
    });
    
    ui.state = ko.pureComputed(function() {
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
    }, ui);
    
    if (user.channel) {
      ui.channel(user.channel.__ui);
      ui.channel().users.push(ui);
      ui.channel().users.sort(compareUsers);
    }

    // Set up event handlers
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
        }
      })
      .on("remove", () => {
        if (ui.channel()) {
          ui.channel().users.remove(ui);
        }
      })
      .on("voice", (stream) => {
        debugLog('[VOICE]', 'Voice stream received for user:', user.username);
        
        // Create audio node for playing back received voice
        var userNode = new BufferQueueNode({
          audioContext: this.audioState.audioContext,
        });
        
        // Create a GainNode to control volume (for deafen functionality)
        var gainNode = this.audioState.audioContext.createGain();
        
        // Set initial gain based on current deafen state
        gainNode.gain.value = this.selfDeaf() ? 0 : 1;
        debugLog('[VOICE]', 'Initial gain set to:', gainNode.gain.value);
        
        // Connect: userNode -> gainNode -> destination
        userNode.connect(gainNode);
        gainNode.connect(this.audioState.audioContext.destination);
        
        // Subscribe to selfDeaf changes to update gain
        var deafSubscription = this.selfDeaf.subscribe((isDeaf) => {
          gainNode.gain.value = isDeaf ? 0 : 1;
          debugLog('[VOICE]', 'Gain updated to:', gainNode.gain.value);
        });

        stream
          .on("data", (data) => {
            debugLog('[VOICE]', 'Audio data received, target:', data.target);
            
            if (data.target === "normal") {
              ui.talking("on");
            } else if (data.target === "shout") {
              ui.talking("shout");
            } else if (data.target === "whisper") {
              ui.talking("whisper");
            } else if (data.target === "loopback") {
              ui.talking("on");
              debugLog('[VOICE]', 'Loopback audio received!');
            }
            
            userNode.write(data.buffer);
          })
          .on("end", () => {
            debugLog('[VOICE]', 'Voice stream ended for user:', user.username);
            ui.talking("off");
            userNode.end();
            deafSubscription.dispose();
          });
      });
  }

  /**
   * Request mute for user
   * @param {object} user - User UI object
   * @param {Function} onAudioLocked - Callback when audio is locked
   */
  requestMute(user, onAudioLocked) {
    if (user !== this.thisUser()) return;
    this.selfMute(true);
  }

  /**
   * Request deaf for user
   * @param {object} user - User UI object
   * @param {boolean} isLoopbackMode - Whether in loopback mode
   */
  requestDeaf(user, isLoopbackMode = false) {
    if (user !== this.thisUser()) return;
    
    // In loopback mode, allow deaf without mute
    // In normal mode, deaf automatically enables mute
    if (!isLoopbackMode) {
      this.selfMute(true);
    }
    
    this.selfDeaf(true);
  }

  /**
   * Request unmute for user
   * @param {object} user - User UI object
   * @param {Function} onAudioLocked - Callback when audio is locked
   */
  requestUnmute(user, onAudioLocked) {
    if (user !== this.thisUser()) {
      return;
    }
    
    this.selfMute(false);
    this.selfDeaf(false);
  }

  /**
   * Request undeaf for user
   * @param {object} user - User UI object
   * @param {Function} onAudioLocked - Callback when audio is locked
   */
  requestUndeaf(user, onAudioLocked) {
    if (user !== this.thisUser()) return;
    this.selfDeaf(false);
  }

  /**
   * Reset user state
   */
  reset() {
    this.thisUser(null);
    this.selfMute(false);
    this.selfDeaf(false);
  }
}
