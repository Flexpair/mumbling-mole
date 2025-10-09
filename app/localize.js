/**
 * English translations - statically imported for performance
 * Multi-language support has been removed in favor of English-only
 */
import translationsJson from '../localize/en.json';

/**
 * Flatten nested translation object into dot-notation keys
 * @param {Object} tree - Nested translation object
 * @param {string} prefix - Current key prefix
 * @param {Object} result - Flattened result object
 */
function flatten(tree, prefix, result) {
  for (const [key, value] of Object.entries(tree)) {
    if (typeof value === "string") {
      result[prefix + key] = value;
    } else {
      flatten(value, prefix + key + ".", result);
    }
  }
}

// Flatten translations at module load time
const translations = {};
flatten(translationsJson, "", translations);

/**
 * Initialize localization (no-op since we only support English now)
 * Kept for API compatibility with existing code
 * @param {string} _languageDefault - Ignored, always uses English
 * @param {string} [_languageFallback] - Ignored, always uses English
 */
export async function initialize(_languageDefault, _languageFallback = "en") {
  // No-op: English translations are statically imported above
}

/**
 * Gets a translation by its key (English only)
 *
 * @param {string} key - Translation key in dot notation (e.g., "connectdialog.title")
 * @param {string} [_languageChosen] - Ignored, always uses English (kept for API compatibility)
 * @return {string} The translated string or a placeholder if key is missing
 */
export function translate(key, _languageChosen) {
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
    "#connect-dialog_controls_loopback",
    "attribute",
    { name: "value" },
    "connectdialog.loopback"
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
