// Local replacement for deprecated 'audio-context' package.
// Contract:
// - export a factory function: createContext(options|sampleRate)
// - returns a singleton AudioContext per sampleRate (for non-offline)
// - supports { offline, channels, length, sampleRate, latencyHint, ...contextAttributes }
// - accepts a number argument as sampleRate
// - vendor-prefixed fallbacks (webkit*)
// - returns null if not in a browser or constructors unavailable

/* eslint-disable no-undef */

let cache = Object.create(null); // key: sampleRate or 'default' => AudioContext instance

function getWindow() {
  // In browsers, 'window' exists; tests may inject global.window
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined' && global.window) return global.window;
  return undefined;
}

function pickConstructors(win) {
  if (!win) return { AudioContextCtor: null, OfflineAudioContextCtor: null };
  const AudioContextCtor = win.AudioContext || win.webkitAudioContext || null;
  const OfflineAudioContextCtor =
    win.OfflineAudioContext || win.webkitOfflineAudioContext || null;
  return { AudioContextCtor, OfflineAudioContextCtor };
}

function normalizeOptions(optsOrRate) {
  if (typeof optsOrRate === 'number') return { sampleRate: optsOrRate };
  return { ...(optsOrRate || {}) };
}

function createOfflineContext(OfflineAudioContextCtor, opts) {
  const channels = Number(opts.channels) || 2;
  const length = Number(opts.length) || 0;
  const sampleRate = Number(opts.sampleRate) || undefined;
  try {
    return new OfflineAudioContextCtor(channels, length, sampleRate);
  } catch (_) {
    // Some engines require sampleRate; retry without
    try {
      return new OfflineAudioContextCtor(channels, length);
    } catch (e2) {
      return null;
    }
  }
}

function createOnlineContext(AudioContextCtor, opts) {
  const { sampleRate, latencyHint, ...contextAttributes } = opts;
  const args = {};
  if (latencyHint != null) args.latencyHint = latencyHint;
  if (sampleRate != null) args.sampleRate = sampleRate;
  // Pass through any other context attributes (e.g., powerPreference)
  Object.assign(args, contextAttributes);
  try {
    return new AudioContextCtor(args);
  } catch (e) {
    // Older implementations use no-arg constructor
    try {
      return new AudioContextCtor();
    } catch (e2) {
      return null;
    }
  }
}

function keyFor(opts) {
  // Cache key based on sampleRate only, matching original lib semantics
  return String(opts.sampleRate || 'default');
}

function createContext(optionsOrSampleRate) {
  const win = getWindow();
  const { AudioContextCtor, OfflineAudioContextCtor } = pickConstructors(win);
  if (!AudioContextCtor && !OfflineAudioContextCtor) return null;

  const opts = normalizeOptions(optionsOrSampleRate);
  if (opts.offline) {
    if (!OfflineAudioContextCtor) return null;
    return createOfflineContext(OfflineAudioContextCtor, opts);
  }

  if (!AudioContextCtor) return null;
  const cacheKey = keyFor(opts);
  if (!cache[cacheKey]) {
    cache[cacheKey] = createOnlineContext(AudioContextCtor, opts);
  }
  return cache[cacheKey] || null;
}

module.exports = createContext;
