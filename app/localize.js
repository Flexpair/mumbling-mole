/**
 * English translations - hard-coded for performance
 * Multilanguage support has been disabled
 */
const translations = {
  "connectdialog.title": "Join audio conference",
  "connectdialog.username": "Username",
  "connectdialog.password": "Password",
  "connectdialog.microphone": "Microphone",
  "connectdialog.headphones": "Please use 🎧. Thank you.",
  "connectdialog.connect": "Connect",
  "connectdialog.error.title": "Failed to connect",
  "connectdialog.error.reason.refused": "The connection has been refused.",
  "connectdialog.error.reason.version": "The server uses an incompatible version.",
  "connectdialog.error.reason.username": "Your user name was rejected. Maybe try a different one?",
  "connectdialog.error.reason.userpassword": "The given password is incorrect.\nThe user name you have chosen requires a special one.",
  "connectdialog.error.reason.serverpassword": "The given password is incorrect.",
  "connectdialog.error.reason.username_in_use": "The user name you have chosen is already in use.",
  "connectdialog.error.reason.full": "The server is full.",
  "connectdialog.error.reason.clientcert": "The server requires you to provide a client certificate which is not supported by this web application.",
  "connectdialog.error.reason.server": "The server reports:",
  "connectdialog.error.retry": "Retry",
  "connectdialog.error.cancel": "Cancel",
  "connectinfo.title": "Audio transmission info",
  "connectinfo.server": "Audio server details",
  "connectinfo.webapp": "Statistics for this web app",
  "connectinfo.native": "Desktop client / mobile app",
  "settingsdialog.title": "Audio settings",
  "settingsdialog.transmission": "Transmission",
  "settingsdialog.cont": "Continuous",
  "settingsdialog.ptt": "Push To Talk",
  "settingsdialog.ptt_key": "PTT Key",
  "settingsdialog.audio_quality": "Audio Quality",
  "settingsdialog.packet": "Audio per packet",
  "settingsdialog.close": "Cancel",
  "settingsdialog.submit": "Apply",
  "chat.channel_message_placeholder": "Type message to everyone here...",
  "chat.user_message_placeholder": "Type message to user '%1' here...",
  "logentry.mic_init_error": "Microphone initialization error",
  "logentry.connecting": "Connecting to audio server",
  "logentry.connected": "Connected to audio server",
  "logentry.connection_error": "Connection error",
  "logentry.unknown_voice_mode": "Unknown voice mode",
  "audio.sample_rate.warning.title": "Audio hardware mismatch",
  "audio.sample_rate.warning.body": "Your audio device sample rate (%1 Hz) doesn't match the required 48000 Hz. You can still join without audio, but your microphone and speakers will remain muted.",
  "audio.sample_rate.warning.info": "Audio is disabled because your audio device sample rate (%1 Hz) doesn't match the required 48000 Hz.",
  "audio.sample_rate.warning.accept": "Join without audio",
  "audio.sample_rate.warning.cancel": "Cancel",
  "audio.sample_rate.warning.close": "Close",
  "audio.sample_rate.warning.unknown_rate": "unknown",
  "audio.sample_rate.warning.hints_title": "How to switch your device to 48 kHz",
  "audio.sample_rate.warning.hints.item1": "Windows: Right-click the speaker icon → Sound settings → More sound settings → select your device → Advanced → set Default Format to 48,000 Hz.",
  "audio.sample_rate.warning.hints.item2": "macOS: Open Applications › Utilities › Audio MIDI Setup → select your device → set Format to 48,000 Hz.",
  "audio.sample_rate.warning.hints.item3": "Linux: Use PulseAudio Volume Control (pavucontrol) or system audio settings to choose a 48 kHz profile, then reconnect."
};

/**
 * Initialize localization (no-op since we only support English now)
 * @param {string} languageDefault - Ignored, always uses English
 * @param {string} [languageFallback] - Ignored, always uses English
 */
export async function initialize(languageDefault, languageFallback = "en") {
  // No-op: English translations are hard-coded above
  console.log('Localization initialized (English only)');
}

/**
 * Gets a translation by its key
 *
 * @param {string} key
 * @param {string} [languageChosen] - Ignored, always uses English
 * @return {string}
 */
export function translate(key, languageChosen) {
  if (translations.hasOwnProperty(key)) {
    return translations[key];
  }
  console.warn(`Missing translation for key: ${key}`);
  return "{{" + key + "}}";
}

/**
 * @author svartoyg
 */
function translatePiece(selector, kind, parameters, key) {
  let element = document.querySelector(selector);
  if (element !== null) {
    const translation = translate(key);
    switch (kind) {
      default:
        console.warn('unhandled dom translation kind "' + kind + '"');
        break;
      case "textcontent":
        element.textContent = translation;
        break;
      case "attribute":
        element.setAttribute(parameters.name || "value", translation);
        break;
    }
  } else {
    console.warn(
      `translation selector "${selector}" for "${key}" did not match any element`
    );
  }
}

/**
 * @author svartoyg
 */
export function translateEverything() {
  translatePiece(
    "#connect-dialog_title",
    "textcontent",
    {},
    "connectdialog.title"
  );
  translatePiece(
    "#connect-dialog_input_username",
    "textcontent",
    {},
    "connectdialog.username"
  );
  translatePiece(
    "#connect-dialog_input_password",
    "textcontent",
    {},
    "connectdialog.password"
  );
  translatePiece(
    "#connect-dialog_select_microphone",
    "textcontent",
    {},
    "connectdialog.microphone"
  );
  translatePiece(
    "#connect-dialog_headphones",
    "textcontent",
    {},
    "connectdialog.headphones"
  );
  translatePiece(
    "#connect-dialog_controls_connect",
    "attribute",
    { name: "value" },
    "connectdialog.connect"
  );
  translatePiece(
    ".connect-dialog.error-dialog .dialog-header",
    "textcontent",
    {},
    "connectdialog.error.title"
  );
  translatePiece(
    ".connect-dialog.error-dialog .reason .refused",
    "textcontent",
    {},
    "connectdialog.error.reason.refused"
  );
  translatePiece(
    ".connect-dialog.error-dialog .reason .version",
    "textcontent",
    {},
    "connectdialog.error.reason.version"
  );
  translatePiece(
    ".connect-dialog.error-dialog .reason .username",
    "textcontent",
    {},
    "connectdialog.error.reason.username"
  );
  translatePiece(
    ".connect-dialog.error-dialog .reason .userpassword",
    "textcontent",
    {},
    "connectdialog.error.reason.userpassword"
  );
  translatePiece(
    ".connect-dialog.error-dialog .reason .serverpassword",
    "textcontent",
    {},
    "connectdialog.error.reason.serverpassword"
  );
  translatePiece(
    ".connect-dialog.error-dialog .reason .username-in-use",
    "textcontent",
    {},
    "connectdialog.error.reason.username_in_use"
  );
  translatePiece(
    ".connect-dialog.error-dialog .reason .full",
    "textcontent",
    {},
    "connectdialog.error.reason.full"
  );
  translatePiece(
    ".connect-dialog.error-dialog .reason .clientcert",
    "textcontent",
    {},
    "connectdialog.error.reason.clientcert"
  );
  translatePiece(
    ".connect-dialog.error-dialog .reason .server",
    "textcontent",
    {},
    "connectdialog.error.reason.server"
  );
  translatePiece(
    ".connect-dialog.error-dialog .alternate-username",
    "textcontent",
    {},
    "connectdialog.username"
  );
  translatePiece(
    ".connect-dialog.error-dialog .alternate-password",
    "textcontent",
    {},
    "connectdialog.password"
  );
  translatePiece(
    ".connect-dialog.error-dialog .dialog-submit",
    "attribute",
    { name: "value" },
    "connectdialog.error.retry"
  );
  translatePiece(
    ".connect-dialog.error-dialog .dialog-close",
    "attribute",
    { name: "value" },
    "connectdialog.error.cancel"
  );

  translatePiece(
    "#connection-info_title",
    "textcontent",
    {},
    "connectinfo.title"
  );
  translatePiece(
    "#connection-info_server",
    "textcontent",
    {},
    "connectinfo.server"
  );
  translatePiece(
    "#connection-info_webapp",
    "textcontent",
    {},
    "connectinfo.webapp"
  );
  translatePiece(
    "#connection-info_native",
    "textcontent",
    {},
    "connectinfo.native"
  );

  translatePiece(
    "#settings-dialog_title",
    "textcontent",
    {},
    "settingsdialog.title"
  );
  translatePiece(
    "#settings-dialog_transmission",
    "textcontent",
    {},
    "settingsdialog.transmission"
  );
  translatePiece(
    "#settings-dialog_cont",
    "textcontent",
    {},
    "settingsdialog.cont"
  );
  translatePiece(
    "#settings-dialog_ptt",
    "textcontent",
    {},
    "settingsdialog.ptt"
  );
  translatePiece(
    "#settings-dialog_ptt_key",
    "textcontent",
    {},
    "settingsdialog.ptt_key"
  );
  translatePiece(
    "#settings-dialog_audio_quality",
    "textcontent",
    {},
    "settingsdialog.audio_quality"
  );
  translatePiece(
    "#settings-dialog_packet",
    "textcontent",
    {},
    "settingsdialog.packet"
  );
  translatePiece(
    "#settings-dialog_close",
    "attribute",
    { name: "value" },
    "settingsdialog.close"
  );
  translatePiece(
    "#settings-dialog_submit",
    "attribute",
    { name: "value" },
    "settingsdialog.submit"
  );
}
