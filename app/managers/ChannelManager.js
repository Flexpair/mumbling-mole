import ko from "knockout";

/**
 * Compare channels by position and name
 */
function compareChannels(c1, c2) {
  if (c1.position() === c2.position()) {
    return c1.name() === c2.name() ? 0 : c1.name() < c2.name() ? -1 : 1;
  }
  return c1.position() - c2.position();
}

/**
 * Compare users by name
 */
function compareUsers(u1, u2) {
  return u1.name() === u2.name() ? 0 : u1.name() < u2.name() ? -1 : 1;
}

/**
 * Compute user state string from flags
 */
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

/**
 * ChannelManager - Manages channel and user tree structure
 * Handles channel/user creation, updates, context menus, and link updates
 */
export class ChannelManager {
  constructor() {
    // Context menus
    this.channelContextMenu = ko.observable();
    this.userContextMenu = ko.observable();
  }
  
  /**
   * Create new channel UI binding
   */
  newChannel(channel, requestMethods) {
    if (channel.__ui) {
      return;
    }

    var ui = (channel.__ui = {
      model: channel,
      channels: ko.observableArray(),
      users: ko.observableArray(),
      linked: ko.observable(false),
      parent: ko.observable(),
      expanded: ko.observable(false),
    });

    ui.openContextMenu = (_, event) => {
      const menu = this.channelContextMenu();
      if (menu) {
        openContextMenu(event, menu, ui);
      }
    };
    ui.toggle = () => ui.expanded(!ui.expanded());

    const simpleProperties = {
      position: "position",
      name: "name",
      description: "description",
    };

    Object.entries(simpleProperties).forEach((key) => {
      ui[key[1]] = ko.observable(channel[key[0]]);
    });

    if (channel.parent) {
      ui.parent(channel.parent.__ui);
      ui.parent().channels.push(ui);
      ui.parent().channels.sort(compareChannels);
    }

    channel
      .on("update", (actor, properties) => {
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
          requestMethods.updateLinks();
        }
      })
      .on("remove", () => {
        if (ui.parent()) {
          ui.parent().channels.remove(ui);
        }
        requestMethods.updateLinks();
      });
  }

  /**
   * Create new user UI binding
   */
  newUser(user, requestMethods) {
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

    ui.openContextMenu = (_, event) => {
      const menu = this.userContextMenu();
      if (menu) {
        openContextMenu(event, menu, ui);
      }
    };

    ui.toggleMute = () => {
      if (ui.selfMute()) {
        requestMethods.requestUnmute(ui);
      } else {
        requestMethods.requestMute(ui);
      }
    };

    ui.toggleDeaf = () => {
      if (ui.selfDeaf()) {
        requestMethods.requestUndeaf(ui);
      } else {
        requestMethods.requestDeaf(ui);
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
        }
      })
      .on("voice", (stream) => {
        stream.on("start_talking", () => ui.talking("on"));
        stream.on("stop_talking", () => ui.talking("off"));
      })
      .on("remove", () => {
        if (ui.channel()) {
          ui.channel().users.remove(ui);
        }
      });
  }

  /**
   * Update channel links
   */
  updateLinks(root) {
    let allChannels = [];
    let ownChannel = root();
    
    if (!ownChannel) {
      return;
    }

    var getAllChannels = function (channel, channels) {
      channels.push(channel);
      channel.channels().forEach((next) => getAllChannels(next, channels));
      return channels;
    };

    getAllChannels(ownChannel, allChannels);
    
    var findLinks = function (channel, knownLinks) {
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
    };

    var allLinked = findLinks(ownChannel, []);
    allChannels.forEach((channel) => {
      channel.linked(allLinked.indexOf(channel.model) !== -1);
    });
  }
}

/**
 * Helper to open context menu
 */
function openContextMenu(event, menu, target) {
  event.preventDefault();
  menu.posX(event.pageX);
  menu.posY(event.pageY);
  menu.target(target);
  menu.show();
}
