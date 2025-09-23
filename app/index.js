// Removed legacy 'subworkers' import: nested worker polyfill caused constructor hijack issues.
// Removed redundant manual Buffer/process attachment (handled by ProvidePlugin + DefinePlugin)
import url from "url";
import MumbleClient from "mumble-client";
import WorkerBasedMumbleConnector from "./worker-client";
import BufferQueueNode from "web-audio-buffer-queue";
import getAudioContext from "audio-context";
import audioContextManager, { ensureAudioContext } from "./audio-context-manager";
import { initializeAudioStatusUI } from "./audio-status-ui";
import ko from "knockout";
import keyboardjs from "keyboardjs";

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
    console.log("[Guac] setting iframe src", src);
    self.guacSource(src);
  };

  self.onLoad = function () {
    self.loading(false);
    console.log("[Guac] iframe load event", self.guacSource());
    try {
      const frame = document.getElementById("guacframe");
      const doc = frame && frame.contentDocument;
      if (doc) {
        console.log("[Guac] iframe title:", doc.title);
      }
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
  self.show = self.visible.bind(self.visible, true);
  self.hide = self.visible.bind(self.visible, false);
  self.connect = function () {
    self.hide();
    ui.connect(self.address(), self.port(), self.username(), self.password());
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
      this.update();
      this.visible(true);
    };
    this.hide = () => this.visible(false);
  }

  update() {
    let client = this._ui.client;

    this.serverVersion(client.serverVersion);

    let dataStats = client.dataStats;
    if (dataStats) {
      this.latencyMs(dataStats.mean);
      this.latencyDeviation(Math.sqrt(dataStats.variance));
    }
    this.remoteHost(this._ui.remoteHost());
    this.remotePort(this._ui.remotePort());

    let spp = this._ui.settings.samplesPerPacket;
    let maxBitrate = client.getMaxBitrate(spp, false);
    let maxBandwidth = client.maxBandwidth;
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
    this.guacamoleFrame = new GuacamoleFrame();
    this.connectionInfo = new ConnectionInfo(this);
    this.settingsDialog = ko.observable();
    this.remoteHost = ko.observable();
    this.remotePort = ko.observable();
    this.thisUser = ko.observable();
    this.root = ko.observable();
    this.messageBox = ko.observable("");
    this.selected = ko.observable();
    this.selfMute = ko.observable();
    this.selfDeaf = ko.observable();
    
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
      this.settingsDialog(new SettingsDialog(this.settings));
    };

    this.initializeAudioContext = async () => {
      try {
        console.log('Initializing managed AudioContext...');
        this.audioContext = await ensureAudioContext({ 
          latencyHint: "interactive" 
        });
        
        console.log('AudioContext initialized:', {
          state: this.audioContext.state,
          sampleRate: this.audioContext.sampleRate
        });

        // Set up event handlers for audio context state changes
        audioContextManager.onSuspend(() => {
          console.log('AudioContext suspended - audio features may be limited');
        });

        audioContextManager.onResume(() => {
          console.log('AudioContext resumed - audio features restored');
        });

      } catch (error) {
        console.error('Failed to initialize AudioContext:', error);
        
        // Fallback to legacy approach if managed approach fails
        try {
          this.audioContext = getAudioContext({ latencyHint: "interactive" });
          console.log('Fallback to legacy AudioContext successful');
        } catch (fallbackError) {
          console.error('Both managed and legacy AudioContext initialization failed:', fallbackError);
          // AudioContext will remain null, audio features will be disabled
        }
      }
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
    };

    this.connect = async (
      host,
      port,
      username,
      password,
      tokens = [],
      channelName = ""
    ) => {
      var user_roles = (this.netlifyIdentity.currentUser().app_metadata.roles) || [];
      if (Array.isArray(user_roles)) {
        // Add "watch" and "listen" roles if they are not already present
        if (!user_roles.includes("watch")) user_roles.push("watch");
        if (!user_roles.includes("listen")) user_roles.push("listen");
        this.netlifyIdentity.currentUser().app_metadata.roles = user_roles
        
        // Ensure AudioContext is ready and has proper sample rate
        if (!this.audioContext) {
          await this.initializeAudioContext();
        }
        
        if (this.audioContext && this.audioContext.sampleRate == 48000) {
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

          this.resetClient();

          this.remoteHost(host);
          this.remotePort(port);

          log(translate("logentry.connecting"), host);

          // Ensure AudioContext is ready before connecting
          try {
            if (this.audioContext && this.audioContext.state === 'suspended') {
              await this.audioContext.resume();
              console.log('AudioContext resumed for connection');
            } else if (!this.audioContext) {
              await this.initializeAudioContext();
            }
          } catch (error) {
            console.warn('AudioContext resume failed, continuing anyway:', error);
          }

          this.connector
            .connect(`wss://${host}:${port}`, {
              username: username,
              password: password,
              tokens: tokens,
            })
            .done(
              (client) => {
                var user_roles = (this.netlifyIdentity.currentUser()?.app_metadata?.roles) || [];
                let guac_login = false;
                if (user_roles.includes("admin")) {
                  guac_login = "admin";
                } else if (user_roles.includes("edit")) {
                  guac_login = "editor";
                } else if (user_roles.includes("watch")) {
                  guac_login = "watcher";
                }
                if (guac_login) {
                  this.guacamoleFrame.start(
                    guac_login,
                    this.connectDialog.password()
                  );
                  this.guacamoleFrame.show();
                } else {
                  alert("For visual access please ask your administrator.");
                }
                log(translate("logentry.connected"));

                this.client = client;
                // Prepare for connection errors
                client.on("error", (err) => {
                  log(translate("logentry.connection_error"), err);
                  this.resetClient();
                });

                // Register all channels, recursively
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

                // Register all users
                client.users.forEach((user) => this._newUser(user));

                // Register future channels
                client.on("newChannel", (channel) => this._newChannel(channel));
                // Register future users
                client.on("newUser", (user) => this._newUser(user));

                // Set own user and root channel
                this.thisUser(client.self.__ui);
                this.root(client.root.__ui);
                // Upate linked channels
                this._updateLinks();

                // Startup audio input processing
                this._updateVoiceHandler();
                // Tell server our mute/deaf state (if necessary)
                if (this.selfDeaf()) {
                  this.client.setSelfDeaf(true);
                } else if (this.selfMute()) {
                  this.client.setSelfMute(true);
                }
              },
              (err) => {
                if (err.$type && err.$type.name === "Reject") {
                  this.connectErrorDialog.type(err.type);
                  this.connectErrorDialog.reason(err.reason);
                  this.connectErrorDialog.show();
                } else {
                  log(translate("logentry.connection_error"), err);
                }
              }
            );
        } else {
          alert(
            "Please set the sample rate of your audio devices to 48 kHz on system level in order to proceed."
          );
        }
      } else {
        alert(
          "You do not have permission to connect to the server. Please contact the administrator."
        );
      }
    };

    this._newUser = (user) => {
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
          var userNode = new BufferQueueNode({
            audioContext: this.audioContext,
          });
          userNode.connect(this.audioContext.destination);

          stream
            .on("data", (data) => {
              if (data.target === "normal") {
                ui.talking("on");
              } else if (data.target === "shout") {
                ui.talking("shout");
              } else if (data.target === "whisper") {
                ui.talking("whisper");
              }
              userNode.write(data.buffer);
            })
            .on("end", () => {
              ui.talking("off");
              userNode.end();
            });
        });
    };

    this._newChannel = (channel) => {
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
      if (this.client) {
        this.client.disconnect();
      }
      this.client = null;
      this.selected(null).root(null).thisUser(null);
    };

    this.connected = () => this.thisUser() != null;

    this._updateVoiceHandler = () => {
      if (!this.client) {
        return;
      }
      if (voiceHandler) {
        voiceHandler.end();
        voiceHandler = null;
      }
      let mode = this.settings.voiceMode;
      if (mode === "cont") {
        voiceHandler = new ContinuousVoiceHandler(this.client, this.settings);
      } else if (mode === "ptt") {
        voiceHandler = new PushToTalkVoiceHandler(this.client, this.settings);
      } else {
        log(translate("logentry.unknown_voice_mode"), mode);
        return;
      }
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
      if (this.selfMute()) {
        voiceHandler.setMute(true);
      }

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
      this.selfMute(true);
      this.selfDeaf(true);
      if (this.connected()) {
        this.client.setSelfDeaf(true);
      }
    };

    this.requestUnmute = (user) => {
      if (user !== this.thisUser()) return;
      this.selfMute(false);
      this.selfDeaf(false);
      if (this.connected()) {
        this.client.setSelfMute(false);
      }
    };

    this.requestUndeaf = (user) => {
      if (user !== this.thisUser()) return;
      this.selfDeaf(false);
      if (this.connected()) {
        this.client.setSelfDeaf(false);
      }
    };

    this._updateLinks = () => {
      if (!this.thisUser()) {
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
        channel.links.forEach((next) => {
          if (next && knownLinks.indexOf(next) === -1) {
            findLinks(next, knownLinks);
          }
        });
        allChannels
          .map((c) => c.model)
          .forEach((next) => {
            if (
              next &&
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
    });
    user = ui.netlifyIdentity.currentUser();
  } catch (e) {
    console.warn('[identity] initialization failed; continuing without identity integration', e);
  }

  ui.netlifyIdentity.on("login", (user) => {
    console.log("login", user);
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
  console.log('Starting Mumbling Mole initialization...');
  
  document.title = window.location.hostname;
  await localizationInitialize(navigator.language);
  translateEverything();
  initializeUI();
  enumMicrophones();
  
  // Initialize audio status UI to help users with autoplay policies
  initializeAudioStatusUI();
  
  console.log('Mumbling Mole initialization completed successfully');
}

window.onload = main;

// (Previously: boot watchdog + diagnostic banner removed after resolving initialization race & polyfill issues)
