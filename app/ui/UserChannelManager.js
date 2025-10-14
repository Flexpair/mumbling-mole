import ko from "knockout";
import BufferQueueNode from "../audio/buffer-queue-node";

/**
 * Debug logging for voice
 */
const DEBUG_VOICE_LOGGING = false;
function debugLog(tag, ...args) {
  if (DEBUG_VOICE_LOGGING) {
    console.log(tag, ...args);
  }
}

/**
 * Manages users and channels, including UI bindings and event handlers
 */
export default class UserChannelManager {
  constructor(audioContext, selfDeaf, compareUsers, compareChannels, userToState, openContextMenu, userContextMenu, channelContextMenu) {
    this.audioContext = audioContext;
    this.selfDeaf = selfDeaf;
    this.compareUsers = compareUsers;
    this.compareChannels = compareChannels;
    this.userToState = userToState;
    this.openContextMenu = openContextMenu;
    this.userContextMenu = userContextMenu;
    this.channelContextMenu = channelContextMenu;
    
    this.thisUser = ko.observable();
    this.root = ko.observable();
    
    // Callbacks for requests (will be set by parent)
    this.onRequestMute = null;
    this.onRequestDeaf = null;
    this.onRequestUnmute = null;
    this.onRequestUndeaf = null;
  }

  /**
   * Create UI binding for a new user
   */
  createUser(user) {
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
      this.openContextMenu(event, this.userContextMenu, ui);

    ui.toggleMute = () => {
      if (ui.selfMute()) {
        if (this.onRequestUnmute) this.onRequestUnmute(ui);
      } else {
        if (this.onRequestMute) this.onRequestMute(ui);
      }
    };
    
    ui.toggleDeaf = () => {
      if (ui.selfDeaf()) {
        if (this.onRequestUndeaf) this.onRequestUndeaf(ui);
      } else {
        if (this.onRequestDeaf) this.onRequestDeaf(ui);
      }
    };
    
    Object.entries(simpleProperties).forEach((key) => {
      ui[key[1]] = ko.observable(user[key[0]]);
    });
    
    ui.state = ko.pureComputed(this.userToState, ui);
    
    if (user.channel) {
      ui.channel(user.channel.__ui);
      ui.channel().users.push(ui);
      ui.channel().users.sort(this.compareUsers);
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
          ui.channel().users.sort(this.compareUsers);
          if (this.onUpdateLinks) this.onUpdateLinks();
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
          audioContext: this.audioContext,
        });
        
        // Create a GainNode to control volume (for deafen functionality)
        var gainNode = this.audioContext.createGain();
        
        // Set initial gain based on current deafen state
        gainNode.gain.value = this.selfDeaf() ? 0 : 1;
        debugLog('[VOICE]', 'Initial gain set to:', gainNode.gain.value);
        
        // Connect: userNode -> gainNode -> destination
        userNode.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
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
   * Create UI binding for a new channel
   */
  createChannel(channel) {
    // Skip if UI already initialized
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
      this.openContextMenu(event, this.channelContextMenu, ui);
    
    Object.entries(simpleProperties).forEach((key) => {
      ui[key[1]] = ko.observable(channel[key[0]]);
    });
    
    if (channel.parent) {
      ui.parent(channel.parent.__ui);
      ui.parent().channels.push(ui);
      ui.parent().channels.sort(this.compareChannels);
    }
    
    if (this.onUpdateLinks) this.onUpdateLinks();

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
          ui.parent().channels.sort(this.compareChannels);
        }
        if (properties.links !== undefined) {
          if (this.onUpdateLinks) this.onUpdateLinks();
        }
      })
      .on("remove", () => {
        if (ui.parent()) {
          ui.parent().channels.remove(ui);
        }
        if (this.onUpdateLinks) this.onUpdateLinks();
      });
  }

  /**
   * Update channel links
   */
  updateLinks() {
    if (!this.thisUser() || !this.thisUser().channel()) {
      return;
    }

    var allChannels = this.getAllChannels(this.root(), []);
    var ownChannel = this.thisUser().channel().model;
    var allLinked = this.findLinks(ownChannel, []);
    allChannels.forEach((channel) => {
      channel.linked(allLinked.indexOf(channel.model) !== -1);
    });
  }

  /**
   * Find all linked channels recursively
   */
  findLinks(channel, knownLinks) {
    knownLinks.push(channel);
    if (channel.links) {
      channel.links.forEach((next) => {
        if (next && knownLinks.indexOf(next) === -1) {
          this.findLinks(next, knownLinks);
        }
      });
    }
    
    var allChannels = this.getAllChannels(this.root(), []);
    allChannels
      .map((c) => c.model)
      .forEach((next) => {
        if (
          next &&
          next.links &&
          knownLinks.indexOf(next) === -1 &&
          next.links.indexOf(channel) !== -1
        ) {
          this.findLinks(next, knownLinks);
        }
      });
    return knownLinks;
  }

  /**
   * Get all channels recursively
   */
  getAllChannels(channel, channels) {
    channels.push(channel);
    channel.channels().forEach((next) => this.getAllChannels(next, channels));
    return channels;
  }
}
