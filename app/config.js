// Note: You probably do not want to change any values in here because this
//       file might need to be updated with new default values for new
//       configuration options. Use the [config.local.js] file instead!

globalThis.mumbleWebConfig = {
  // Which fields to show on the Connect to Server dialog
  connectDialog: {
    address: false,
    port: false,
    token: false,
    username: true,
    password: false, // Password is fetched securely from auth server
    channelName: false,
  },
  // Default values for user settings
  // You can see your current value by typing `localStorage.getItem('mumble.$setting')` in the web console.
  settings: {
    voiceMode: "cont", // one of 'cont' (Continuous), 'ptt' (Push-to-Talk)
    pttKey: "ctrl + shift",
    userCountInChannelName: false,
    audioBitrate: 40000, // bits per second
    samplesPerPacket: 960,
    jitterBufferMode: "balanced", // one of 'low-latency', 'balanced', 'high-quality'
  },
  // Default values (can be changed by passing a query parameter of the same name)
  defaults: {
    // Connect Dialog
    address: globalThis.location.hostname,
    port: "443/murmur",
    username: "",
    // SECURITY: Password is no longer configurable here.
    // It is fetched securely from the auth server after JWT validation.
    // General
    theme: "MetroMumbleLight",
  },
  // Authentication provider configuration
  auth: {
    provider: "netlify", // one of 'netlify', 'mock' (for testing)
    netlify: {
      APIUrl: "https://welcome.flexpair.com/identity-proxy",
      locale: "en",
      logo: false,
    },
  },
};
