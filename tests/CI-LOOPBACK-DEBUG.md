# CI Loopback Test Debugging Notes

**Status:** Test fails in CI (0 Hz detected), passes in Codespaces (440 Hz detected)  
**Branch:** feature/loopback-test-automation  
**Last Updated:** October 19, 2025

## Problem Summary

The Playwright loopback frequency test consistently:
- ✅ **PASSES in Codespaces** - Detects 440 Hz successfully
- ❌ **FAILS in CI** - Always reports 0 Hz (all 5 frequency readings are zero)

## What Works in CI

Based on debug logs from commits `28c7466`, `db8eb17`, `3bd989c`, and `e5b468e`:

1. ✅ **Voice packet reception and parsing**
   - `[MUMBLE-CLIENT-DEBUG] UDPTunnel packet received, length: 146`
   - `[MUMBLE-STREAMS-DEBUG] Voice packet parsed successfully - source: 3 target: normal codec: Opus frames: 1 seqNum: XXX`

2. ✅ **Voice packet forwarding to user**
   - `[MUMBLE-CLIENT-DEBUG] _onVoice called - source: 3 target: normal codec: Opus frames: 1`
   - `[MUMBLE-CLIENT-DEBUG] Found user: undefined Forwarding voice data`

3. ✅ **Frame writing to voice stream**
   - `[MUMBLE-USER-DEBUG] _onVoice called - seqNum: XXX codec: Opus frames: 1 end: false`
   - `[MUMBLE-USER-DEBUG] Writing frame to voice stream, frame length: 140`
   - `[MUMBLE-USER-DEBUG] Voice stream already exists, reusing existing stream`

4. ✅ **Voice encoding (sender side)**
   - `[VOICE-DEBUG] PCM frames sent to encoder: 350 latest sample count: 960`

5. ✅ **Server loopback** - Packets travel successfully from client → server → client

## What DOESN'T Work in CI

**Critical finding:** The following debug logs are **COMPLETELY MISSING** in CI:

1. ❌ `[DEBUG-USER-VOICE] Voice event received for user: ...`
   - The `user.on("voice", callback)` event handler is **NEVER CALLED**
   
2. ❌ `[DEBUG-STREAM-DATA] Audio data received`
   - The `stream.on("data", callback)` event is **NEVER FIRED**
   
3. ❌ `[DEBUG-DECODER] Transform called`
   - The DecoderStream `_transform()` method is **NEVER INVOKED**

4. ❌ `[MUMBLE-USER-DEBUG] Creating new voice stream for user: ...`
   - Either never created, or created before our debug logs start

## Root Cause Analysis

### The Pipeline Break Point

The audio pipeline breaks **between** these two points:

```
✅ user._onVoice() writes frames to voice stream
    ↓
❌ stream.on("data") event never fires
    ↓
❌ Decoder never processes frames
    ↓
❌ AnalyserNode receives no audio data
    ↓
❌ 0 Hz detected
```

### Hypothesis: Event Handler Registration

**Most likely cause:** The `user.on("voice", stream => {...})` event handler in `app/state/UserState.js` is:
- Either **not being registered** in CI
- Or **registered too late** (after voice stream already started)
- Or the user object itself is **not properly created/connected**

### Why It Works in Codespaces

**Codespaces environment:**
- Dev container with full audio support (Xvfb + PulseAudio)
- Direct connection to dev server
- Proper timing/initialization

**CI environment:**
- Docker-compose stack (nginx → mumble_web → murmur)
- Headless Chrome with PulseAudio (installed but possibly not working?)
- Different network topology
- Possible timing/race condition

## Code Locations

### Voice Event Handler Registration
**File:** `app/state/UserState.js` (lines ~138-280)
```javascript
user.on("voice", (stream) => {
  console.warn('[DEBUG-USER-VOICE] Voice event received for user:', user.username);
  // ... BufferQueueNode setup
  // ... AnalyserNode setup
  
  stream
    .on("data", (data) => {
      console.warn('[DEBUG-STREAM-DATA] Audio data received');
      userNode.write(data.buffer);
    })
    .on("end", () => { ... });
});
```

### Voice Stream Creation
**File:** `vendors/mumble-client/src/user.js` (lines ~81-110)
```javascript
_getOrCreateVoiceStream() {
  if (!this._voice) {
    console.warn('[MUMBLE-USER-DEBUG] Creating new voice stream for user:', this._username);
    if (!this._client._codecs) {
      this._voice = DropStream.obj()
    } else {
      this._voice = this._client._codecs.createDecoderStream(this)
    }
    this.emit('voice', this._voice)
  } else {
    console.warn('[MUMBLE-USER-DEBUG] Voice stream already exists, reusing existing stream');
  }
  return this._voice;
}
```

### Decoder Stream
**File:** `app/audio/decoder-stream.js`
- `_transform()` method should log `[DEBUG-DECODER] Transform called`
- `_onMessage()` method should log `[DEBUG-DECODER] Decoded audio received`

## Debug Commits

These commits added comprehensive debug logging (keep for future debugging):

1. **28c7466** - "debug: Add voice decoder packet parsing logs"
   - Added logs to `vendors/mumble-client/src/client.js` (_onVoice)
   - Added logs to `vendors/mumble-streams/lib/voice.js` (packet parsing)

2. **db8eb17** - "debug: Add voice stream creation logs to user.js"
   - Added logs to `vendors/mumble-client/src/user.js` (_getOrCreateVoiceStream, _onVoice)

3. **3bd989c** - "debug: Add stream reuse and frame write logs"
   - Added "Voice stream already exists" log
   - Added "Writing frame to voice stream" log

4. **e5b468e** - "debug: Add comprehensive decoder and stream playback logs"
   - Added logs to `app/state/UserState.js` (voice event handler, stream.on("data"))
   - Added logs to `app/audio/decoder-stream.js` (_transform, _onMessage)

## Environment Differences

### CI (GitHub Actions - ubuntu-latest)
```yaml
- Docker-Compose with nginx, mumble_web, murmur
- PulseAudio installed: pulseaudio --start --exit-idle-time=-1
- xvfb-run with 1280x720x24 display
- Playwright connects via https://localhost (through nginx)
```

### Codespaces (Dev Container - Ubuntu 24.04)
```
- Direct dev server (docker-entrypoint.sh)
- Python http.server + websockify
- Full audio support in dev container
- Playwright connects via http://local.flexpair.app:8081
```

## CI Audio Setup

**File:** `.github/workflows/docker-image.yml` (lines 280-293)
```yaml
- name: Install PulseAudio for Web Audio API
  run: |
    sudo apt-get update
    sudo apt-get install -y pulseaudio
    pulseaudio --start --exit-idle-time=-1 --log-target=syslog || true
    pactl info || echo "Warning: PulseAudio not running"

- name: Run Playwright loopback tests
  run: xvfb-run --auto-servernum --server-args="-screen 0 1280x720x24" npm run test:loopback
```

**Note:** The `|| true` after `pulseaudio --start` means **errors are silently ignored**!

## Next Steps (TODO)

When resuming this investigation:

1. **Check PulseAudio status in CI logs**
   - Search for "Warning: PulseAudio not running"
   - If warning appears, PulseAudio failed to start

2. **Check AudioContext state**
   - Add log: `audioContext.state` in UserState.js
   - Should be "running", not "suspended"

3. **Find "Creating new voice stream" log**
   - Search CI logs from the beginning
   - Determine if/when voice stream is created

4. **Check user object creation**
   - Add logs when `_addUser()` is called in worker-client.js
   - Verify user object exists before voice events arrive

5. **Check event registration timing**
   - Log when `user.on("voice", ...)` is registered
   - Log when `user.emit("voice", stream)` is called
   - Check for race condition

6. **Consider environment parity**
   - Option A: Run tests inside dev container in CI
   - Option B: Fix PulseAudio startup (remove `|| true`)
   - Option C: Add AudioContext resume logic

## Known Working Test

The test **does work** when run in Codespaces:
```bash
npm run test:loopback
# ✅ TEST PASSED: All scenarios validated successfully!
# Average frequency: 439.3 Hz (expected ~440 Hz)
```

## References

- Test file: `tests/playwright/loopback-frequency.spec.js`
- Test README: `tests/playwright/README.md`
- Audio debugging guide: `app/audio/README.md`
- CI workflow: `.github/workflows/docker-image.yml`
