// You can overwrite the default configuration values set in [config.js] here.
// There should never be any required changes to this file and you can always
// simply copy it over when updating to a new version.

let config = window.mumbleWebConfig;

config.settings.audioBitrate = 96000;

// Use mock auth for automated tests (bypasses Netlify Identity)
// Trigger: Either ?mock-auth in URL, or non-Codespaces localhost, or Codespaces URLs
const isTestEnvironment = window.location.search.includes('mock-auth') 
  || window.location.hostname === 'localhost'
  || window.location.hostname.includes('.app.github.dev');

if (isTestEnvironment) {
  config.auth.provider = 'mock';
  config.auth.mock = {
    autoLogin: true,        // Automatically log in a mock user
    autoLoginDelay: 100     // Small delay to simulate async auth
  };
  
  // Default config already uses window.location.hostname for WebSocket
  // No need to override address/port here - it works automatically
  config.defaults.username = 'Test_User';
}
