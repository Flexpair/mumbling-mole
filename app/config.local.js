// You can overwrite the default configuration values set in [config.js] here.
// There should never be any required changes to this file and you can always
// simply copy it over when updating to a new version.

let config = window.mumbleWebConfig;

config.settings.audioBitrate = 96000;

// Use mock auth for automated tests (bypasses Netlify Identity)
if (window.location.search.includes('mock-auth') || window.location.hostname === 'localhost') {
  config.auth.provider = 'mock';
  config.auth.mock = {
    autoLogin: true,        // Automatically log in a mock user
    autoLoginDelay: 100     // Small delay to simulate async auth
  };
  
  // Use test mumble server via websockify proxy
  // The browser connects to websockify (running on same port as web server)
  // which then tunnels the WebSocket connection to the actual Mumble server
  config.defaults.address = 'localhost';  // websockify proxy
  config.defaults.port = '8081';          // same port as dev server
  config.defaults.username = 'Test_User';
}
