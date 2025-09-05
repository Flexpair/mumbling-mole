const { ContinuousVoiceHandler, PushToTalkVoiceHandler } = require('../../app/voice.js');
const { Writable } = require('stream');

class DummyOutbound extends Writable {
  constructor() { super({ objectMode: true }); this.chunks = []; }
  _write(chunk, _e, cb){ this.chunks.push(chunk); cb(); }
}

class DummyClient {
  constructor(){ this.created = []; }
  createVoiceStream(){ const out = new DummyOutbound(); this.created.push(out); return out; }
}

const baseSettings = { samplesPerPacket: 960, pttKey: 'ctrl + shift' };

describe('ContinuousVoiceHandler', () => {
  it('writes through when not muted', (done) => {
    const c = new DummyClient();
    const h = new ContinuousVoiceHandler(c, baseSettings);
    h.write(Buffer.from([1,2,3]), () => {
      expect(c.created[0].chunks.length).toBe(1);
      done();
    });
  });
  it('drops when muted', (done) => {
    const c = new DummyClient();
    const h = new ContinuousVoiceHandler(c, baseSettings);
    h.setMute(true);
    h.write(Buffer.from([9]), () => {
      expect(c.created.length).toBe(0);
      done();
    });
  });
});

describe('PushToTalkVoiceHandler', () => {
  it('does not forward without key pressed', (done) => {
    const c = new DummyClient();
    const h = new PushToTalkVoiceHandler(c, baseSettings);
    h.write(Buffer.from([5]), () => {
      expect(c.created.length).toBe(0);
      done();
    });
  });
  it('forwards after key simulation', (done) => {
    const c = new DummyClient();
    const h = new PushToTalkVoiceHandler(c, baseSettings);
    // simulate key down
    h._keydown_handler();
    h.write(Buffer.from([7]), () => {
      expect(c.created[0].chunks.length).toBe(1);
      // simulate key up -> closes outbound
      h._keyup_handler();
      done();
    });
  });
});
