// You can overwrite the default configuration values set in [config.js] here.
// There should never be any required changes to this file and you can always
// simply copy it over when updating to a new version.

let config = globalThis.mumbleWebConfig;

config.settings.audioBitrate = 96000;

// Use mock auth ONLY when explicitly requested via ?mock-auth URL parameter
// Default: Always use Netlify Identity (production behavior)
const useMockAuth = globalThis.location.search.includes('mock-auth');

if (useMockAuth) {
  config.auth.provider = 'mock';
  config.auth.mock = {
    autoLogin: true,        // Automatically log in a mock user
    autoLoginDelay: 100     // Small delay to simulate async auth
  };
  
  // Default config already uses window.location.hostname for WebSocket
  // No need to override address/port here - it works automatically
  config.defaults.username = 'Test_User';
}
