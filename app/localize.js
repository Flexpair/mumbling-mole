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
  if (!element) {
    console.warn(
      `translation selector "${selector}" for "${key}" did not match any element`
    );
    return;
  }
  
  const translation = translate(key);
  switch (kind) {
    case "textcontent":
      element.textContent = translation;
      break;
    case "attribute":
      element.setAttribute(parameters.name || "value", translation);
      break;
    default:
      console.warn('unhandled dom translation kind "' + kind + '"');
      break;
  }
}

/**
 * @author svartoyg
 */
export function translateEverything() {
  // ALL UI components migrated to Vue.js (migration complete)
  // Vue components use {{ translate('key') }} or computed properties via inject('translate')
  // DOM-based translation (translatePiece) no longer needed
  // This function kept as no-op for API compatibility during migration
}
