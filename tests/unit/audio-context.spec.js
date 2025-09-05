const createCtxModule = require('../../app/audio-context.js');

// audio-context.js exports default (function) via CommonJS exports.default
const create = createCtxModule.default || createCtxModule.createAudioContext || createCtxModule;

describe('audio-context factory', () => {
  it('returns singleton per sampleRate', () => {
    const a = create({ sampleRate: 48000, latencyHint: 'interactive' });
    const b = create(48000);
    expect(a).toBeTruthy();
    expect(a).toBe(b);
  });
  it('different sampleRate => different instance', () => {
    const a = create({ sampleRate: 44100 });
    const b = create({ sampleRate: 48000 });
    if (a && b) expect(a).not.toBe(b);
  });
  it('offline context path', () => {
    const off = create({ offline: true, length: 1024, channels: 2, sampleRate: 44100 });
    expect(off).toBeTruthy();
    expect(off.sampleRate).toBe(44100);
  });
  it('returns null if constructors missing', () => {
    const win = global.window;
    const origAC = win.AudioContext;
    const origOAC = win.OfflineAudioContext;
    delete win.AudioContext; delete win.webkitAudioContext; delete win.OfflineAudioContext; delete win.webkitOfflineAudioContext;
    const fresh = (createCtxModule.default || createCtxModule);
    const res = fresh({});
    expect(res).toBe(null);
    win.AudioContext = origAC; win.OfflineAudioContext = origOAC;
  });
});
