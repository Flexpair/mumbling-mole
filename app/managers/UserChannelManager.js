import ko from "knockout";
import BufferQueueNode from "../audio/buffer-queue-node";

// Debug flag for controlling verbose logging
const DEBUG_VOICE_LOGGING = false;

function debugLog(tag, ...args) {
  if (DEBUG_VOICE_LOGGING) {
    console.log(tag, ...args);
  }
}

/**
 * UserChannelManager - Manages user and channel tree structure
 * Responsibilities:
 * - Creating UI proxies for users (_newUser)
 * - Creating UI proxies for channels (_newChannel)
 * - Managing channel linking (_updateLinks)
 */
export class UserChannelManager {
  constructor(context) {
    // Store references to GlobalBindings context
    this.getAudioContext = context.getAudioContext;
    this.selfDeaf = context.selfDeaf;
    this.userContextMenu = context.userContextMenu;
    this.channelContextMenu = context.channelContextMenu;
    this.requestUnmute = context.requestUnmute;
    this.requestMute = context.requestMute;
    this.requestUndeaf = context.requestUndeaf;
    this.requestDeaf = context.requestDeaf;
    
    // For _updateLinks access
    this.thisUser = context.thisUser;
    this.root = context.root;
  }

  /**
   * Create UI proxy for a user with event handlers
   * @param {Object} user - User model from mumble-client
   * @param {Function} compareUsers - Sort function for users
   * @param {Function} userToState - Compute user state
   * @param {Function} openContextMenu - Context menu handler
   */
  _newUser(user, compareUsers, userToState, openContextMenu) {
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
        debugLog('[VOICE]', 'Voice stream received for user:', user.username);
        
        // Get audio context dynamically
        const audioContext = this.getAudioContext();
        if (!audioContext) {
          console.warn('[VOICE] AudioContext not available, cannot play voice');
          return;
        }
        
        // Create audio node for playing back received voice
        var userNode = new BufferQueueNode({
          audioContext: audioContext,
        });
        
        // Create a GainNode to control volume (for deafen functionality)
        var gainNode = audioContext.createGain();
        
        // Set initial gain based on current deafen state
        gainNode.gain.value = this.selfDeaf() ? 0 : 1;
        debugLog('[VOICE]', 'Initial gain set to:', gainNode.gain.value, '(selfDeaf:', this.selfDeaf(), ')');
        
        // Connect: userNode -> gainNode -> destination
        userNode.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Subscribe to selfDeaf changes to update gain
        var deafSubscription = this.selfDeaf.subscribe((isDeaf) => {
          gainNode.gain.value = isDeaf ? 0 : 1;
          debugLog('[VOICE]', 'Gain updated to:', gainNode.gain.value, '(deaf:', isDeaf, ')');
        });

        stream
          .on("data", (data) => {
            debugLog('[VOICE]', 'Audio data received, target:', data.target, 'buffer size:', data.buffer?.length);
            
            if (data.target === "normal") {
              ui.talking("on");
            } else if (data.target === "shout") {
              ui.talking("shout");
            } else if (data.target === "whisper") {
              ui.talking("whisper");
            } else if (data.target === "loopback") {
              // Server loopback - show talking status
              ui.talking("on");
              debugLog('[VOICE]', 'Loopback audio received!');
            }
            
            userNode.write(data.buffer);
          })
          .on("end", () => {
            debugLog('[VOICE]', 'Voice stream ended for user:', user.username);
            ui.talking("off");
            userNode.end();
            // Clean up subscription when stream ends
            deafSubscription.dispose();
          });
      });
  }

  /**
   * Create UI proxy for a channel with event handlers
   * @param {Object} channel - Channel model from mumble-client
   * @param {Function} compareChannels - Sort function for channels
   * @param {Function} openContextMenu - Context menu handler
   */
  _newChannel(channel, compareChannels, openContextMenu) {
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
  }

  /**
   * Update channel linking status
   */
  _updateLinks() {
    if (!this.thisUser || !this.thisUser() || !this.thisUser().channel) {
      return;
    }

    var ownChannel = this.thisUser().channel().model;
    var allChannels = getAllChannels(this.root(), []);

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
  }
}
