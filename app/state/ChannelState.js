import ko from "knockout";

function compareChannels(c1, c2) {
  if (c1.position() === c2.position()) {
    return c1.name() === c2.name() ? 0 : c1.name() < c2.name() ? -1 : 1;
  }
  return c1.position() - c2.position();
}

/**
 * ChannelState - manages channel tree and links
 * 
 * Responsibilities:
 * - Root channel tracking
 * - Channel registration and event handling
 * - Channel linking (linked channels)
 */
export default class ChannelState {
  constructor() {
    // Root channel
    this.root = ko.observable();
  }

  /**
   * Register a new channel and set up UI bindings
   * @param {object} channel - Channel model from mumble-client
   * @param {Function} openContextMenuFn - Function to open context menu
   * @param {Function} getChannelContextMenu - Function to get channel context menu
   * @param {Function} updateLinksFn - Function to update channel links
   */
  registerChannel(channel, openContextMenuFn, getChannelContextMenu, updateLinksFn) {
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
      openContextMenuFn(event, getChannelContextMenu(), ui);
    
    // Set up observables for simple properties
    Object.entries(simpleProperties).forEach((key) => {
      ui[key[1]] = ko.observable(channel[key[0]]);
    });
    
    if (channel.parent) {
      ui.parent(channel.parent.__ui);
      ui.parent().channels.push(ui);
      ui.parent().channels.sort(compareChannels);
    }
    
    updateLinksFn();

    // Set up event handlers
    channel
      .on("update", (properties) => {
        Object.entries(simpleProperties).forEach((key) => {
          if (properties[key[0]] !== undefined) {
            ui[key[1]](properties[key[0]]);
          }
        });
        if (properties.parent !== undefined) {
          if (ui.parent()) {
            ui.parent().channels.remove(ui);
          }
          ui.parent(properties.parent.__ui);
          ui.parent().channels.push(ui);
          ui.parent().channels.sort(compareChannels);
        }
        if (properties.links !== undefined) {
          updateLinksFn();
        }
      })
      .on("remove", () => {
        if (ui.parent()) {
          ui.parent().channels.remove(ui);
        }
        updateLinksFn();
      });
  }

  /**
   * Update channel links
   */
  updateLinks() {
    if (!this.root() || !this.root().model) {
      return;
    }

    var allChannels = this._getAllChannels(this.root(), []);
    var thisUserChannel = this.root().model;
    var allLinked = this._findLinks(thisUserChannel, [], allChannels);
    
    allChannels.forEach((channel) => {
      channel.linked(allLinked.indexOf(channel.model) !== -1);
    });
  }

  /**
   * Get all channels in the tree
   * @param {object} channel - Root channel UI object
   * @param {Array} channels - Accumulator array
   * @returns {Array} All channel UI objects
   */
  _getAllChannels(channel, channels) {
    channels.push(channel);
    channel.channels().forEach((next) => this._getAllChannels(next, channels));
    return channels;
  }

  /**
   * Find all linked channels
   * @param {object} channel - Channel model
   * @param {Array} knownLinks - Accumulator array
   * @param {Array} allChannels - All channel UI objects
   * @returns {Array} All linked channel models
   */
  _findLinks(channel, knownLinks, allChannels) {
    knownLinks.push(channel);
    if (channel.links) {
      channel.links.forEach((next) => {
        if (next && knownLinks.indexOf(next) === -1) {
          this._findLinks(next, knownLinks, allChannels);
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
          this._findLinks(next, knownLinks, allChannels);
        }
      });
    return knownLinks;
  }

  /**
   * Reset channel state
   */
  reset() {
    this.root(null);
  }
}
