// You can overwrite the default configuration values set in [config.js] here.
// There should never be any required changes to this file and you can always
// simply copy it over when updating to a new version.

let config = globalThis.mumbleWebConfig;

config.settings.audioBitrate = 96000;

// Fix for dev environment: use the same port as the web server
// This ensures we connect to websockify on port 8081 instead of trying 443/murmur
if (globalThis.location.port && globalThis.location.port !== '80' && globalThis.location.port !== '443') {
  config.defaults.port = globalThis.location.port;
}
