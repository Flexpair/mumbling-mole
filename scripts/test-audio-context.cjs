#!/usr/bin/env node
// Lightweight test for the audio context helper usage/contract.
// We mock window.AudioContext and window.OfflineAudioContext and assert:
// - Options are passed to the constructor (latencyHint, sampleRate)
// - Singleton behavior (same instance returned for same/effective sampleRate)
// - Numeric argument treated as sampleRate
// - Offline mode returns an OfflineAudioContext instance
// - No support case returns null (no throw)

const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

class FakeAudioContext {
  constructor(opts = {}) {
    // store raw options for verification
    this._opts = { ...opts };
    this.sampleRate = opts.sampleRate || 48000;
    this.state = 'suspended';
    this.destination = { _kind: 'destination' };
  }
  resume() { this.state = 'running'; return Promise.resolve(this); }
  suspend() { this.state = 'suspended'; return Promise.resolve(this); }
  close() { this.state = 'closed'; return Promise.resolve(); }
}

class FakeOfflineAudioContext {
  constructor(channels, length, sampleRate) {
    this._channels = channels;
    this._length = length;
    this.sampleRate = sampleRate || 44100;
    this._type = 'offline';
  }
}

function loadLibWithWindow(win) {
  // Reset cached module state for a clean load
  const path = require('path');
  const helperPath = path.join(__dirname, '..', 'app', 'audio-context.js');
  delete require.cache[helperPath];
  global.window = win;
  const mod = require(helperPath);
  // Support both CommonJS function export and {default: fn}
  return typeof mod === 'function' ? mod : mod.default;
}

(async function run() {
  let passed = 0;

  // 1) Happy path with both constructors available
  let create = loadLibWithWindow({ AudioContext: FakeAudioContext, OfflineAudioContext: FakeOfflineAudioContext });
  let ac1 = create({ latencyHint: 'interactive', sampleRate: 48000 });
  assert(ac1 instanceof FakeAudioContext, 'Expected FakeAudioContext instance');
  assert(ac1._opts.latencyHint === 'interactive', 'latencyHint not forwarded');
  assert(ac1.sampleRate === 48000, 'sampleRate not applied');
  passed++;

  // 2) Singleton behavior
  let ac2 = create({ sampleRate: 48000 });
  assert(ac2 === ac1, 'Expected singleton for same effective sampleRate');
  let ac3 = create(48000); // numeric argument
  assert(ac3 === ac1, 'Numeric sampleRate should hit same singleton');
  passed++;

  // 3) Offline context
  let off = create({ offline: true, channels: 2, length: 1024, sampleRate: 44100 });
  assert(off instanceof FakeOfflineAudioContext, 'Expected OfflineAudioContext instance');
  assert(off._channels === 2 && off._length === 1024 && off.sampleRate === 44100, 'OfflineAudioContext args mismatch');
  passed++;

  // 4) Support detection – no AudioContext available returns null
  create = loadLibWithWindow({});
  let none = create({});
  assert(none === null, 'Expected null when no AudioContext support');
  passed++;

  // 5) Vendor prefix support – only webkit* present
  create = loadLibWithWindow({ webkitAudioContext: FakeAudioContext, webkitOfflineAudioContext: FakeOfflineAudioContext });
  let ac4 = create({ latencyHint: 'playback', sampleRate: 44100 });
  assert(ac4 instanceof FakeAudioContext, 'Expected FakeAudioContext via webkitAudioContext');
  assert(ac4._opts.latencyHint === 'playback', 'latencyHint not forwarded via webkit');
  passed++;

  // 6) Resume/close basic operability (instance-level checks)
  await ac4.resume();
  assert(ac4.state === 'running', 'resume() should set running state');
  await ac4.close();
  assert(ac4.state === 'closed', 'close() should set closed state');
  passed++;

  console.log(`audio-context contract tests passed: ${passed} checks`);
  process.exit(0);
})().catch((e) => {
  console.error('audio-context contract test FAILED:', e && e.message ? e.message : e);
  process.exit(1);
});
