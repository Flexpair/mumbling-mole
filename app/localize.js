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
 * Gets a translation by its key (English only)
 *
 * @param {string} key - Translation key in dot notation (e.g., "connectdialog.title")
 * @return {string} The translated string or a placeholder if key is missing
 */
export function translate(key) {
  if (Object.hasOwn(translations, key)) {
    return translations[key];
  }
  console.warn(`Missing translation for key: ${key}`);
  return "{{" + key + "}}";
}
