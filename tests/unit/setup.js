// Global test setup for Jest

// Basic window / navigator mocks if not present
if (!global.window) {
  global.window = {};
}
// Minimal event listener stubs required by keyboardjs
if (!window.addEventListener) {
  window._events = {};
  window.addEventListener = (type, cb) => { (window._events[type] ||= []).push(cb); };
  window.removeEventListener = (type, cb) => {
    if (window._events[type]) window._events[type] = window._events[type].filter(f => f!==cb);
  };
}

// keyboardjs mock (bind/unbind no-ops)
jest.mock('keyboardjs', () => ({
  bind: () => {},
  unbind: () => {},
}));

// Provide dummy select#audioSource element used in voice.js
if (typeof document !== 'undefined' && !document.querySelector('select#audioSource')) {
  const sel = document.createElement('select');
  sel.id = 'audioSource';
  document.body.appendChild(sel);
}
if (!global.navigator) {
  global.navigator = { mediaDevices: { enumerateDevices: () => Promise.resolve([]) } };
}

// Minimal AudioContext mocks for components that might import it indirectly
class DummyAudioContext {
  constructor(opts = {}) { this.sampleRate = opts.sampleRate || 48000; this.state = 'running'; this.destination = {}; }
  resume(){ return Promise.resolve(this); }
  close(){ return Promise.resolve(); }
}
class DummyOfflineAudioContext { constructor(ch,l,sr){ this.sampleRate = sr || 44100; } }
window.AudioContext = DummyAudioContext;
window.OfflineAudioContext = DummyOfflineAudioContext;

// Simple localStorage mock
if (!window.localStorage) {
  const store = new Map();
  window.localStorage = {
    getItem: (k) => store.has(k) ? store.get(k) : null,
    setItem: (k,v) => store.set(k,String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear()
  };
}

// Nothing to export for Jest setup
