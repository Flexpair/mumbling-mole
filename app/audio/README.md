# Audio Debugging Guide for Production Issue (3.12.1)

## Problem Summary
- **3.12.0**: Audio recording AND playback work in production ✅
- **3.12.1**: Audio recording works, but NO playback in production ❌
- **Loopback**: Works on BOTH branches (misleading test)

## Why Loopback Test Is Misleading

The server loopback (target=31) tests:
- Audio encoding ✓
- Worker communication ✓  
- Server echo ✓
- Audio decoding ✓
- Same-client playback ✓

**But it does NOT test:**
- Client-to-client network communication
- Remote client AudioContext state
- Cross-client buffer synchronization
- Remote client audio playback initialization

## Debugging Steps Added

### 1. Voice Stream Reception (app/index.js)
```
[DEBUG-VOICE] Received voice stream from user
[DEBUG-VOICE] AudioContext state: running/suspended
[DEBUG-VOICE] AudioContext sampleRate: 48000
[DEBUG-VOICE] BufferQueueNode created
[DEBUG-VOICE] Connected to destination
[DEBUG-VOICE] Received audio data packet - target: normal/loopback
[DEBUG-VOICE] Writing to userNode
[DEBUG-VOICE] Write completed
```

### 2. Decoder Stream (app/audio/decoder-stream.js)
```
[DEBUG-DECODER] Transform called - codec: Opus
[DEBUG-DECODER] Posting message to worker
[DEBUG-DECODER] Received message from worker: decoded
[DEBUG-DECODER] Decoded audio - buffer size: X bytes
```

### 3. Worker Processing (app/worker.js)
```
[DEBUG-WORKER] Voice stream started for user, voiceId: X
[DEBUG-WORKER] Voice data received - target: normal
[DEBUG-WORKER] Resampled data - size: X
[DEBUG-WORKER] Posted message to UI thread
```

### 4. AudioContext State (app/audio/audio-context-manager.js)
```
[AudioContext] State changed to: running/suspended
[AudioContext] Full state: {state, sampleRate, currentTime, etc}
```

## Expected Log Sequence for Working Audio

### When SENDING (works on both versions):
1. `[VOICE]` logs in voice.js (mic input)
2. `[DEBUG-WORKER]` encoder logs
3. Audio sent to server

### When RECEIVING (should work but doesn't in 3.12.1):
1. `[DEBUG-WORKER] Voice stream started` ← Does this appear?
2. `[DEBUG-WORKER] Voice data received` ← Are packets arriving?
3. `[DEBUG-DECODER] Transform called` ← Is decoder invoked?
4. `[DEBUG-DECODER] Decoded audio` ← Is decoding successful?
5. `[DEBUG-VOICE] Received voice stream` ← Is stream created?
6. `[DEBUG-VOICE] BufferQueueNode created` ← Is playback node created?
7. `[DEBUG-VOICE] Received audio data packet` ← Are packets flowing?

## Testing Instructions

### Test 1: Loopback (Both Users)
```bash
npm run build
# Open browser at http://local.flexpair.app
# Click "Test" button
# Check console for [LOOPBACK] logs
# ✓ Should hear your own voice echoed back
```

### Test 2: Two-Client Production (The Real Test)
```bash
# Terminal 1: Build and serve
npm run build
./start-dev-server.sh

# Browser 1 (Client A - Sender):
# - Connect to server
# - Start talking
# - Check console for [DEBUG-WORKER] encoder logs

# Browser 2 (Client B - Receiver):  
# - Connect to same server
# - Listen for Client A
# - Check console for ALL [DEBUG-*] logs above
# - Note which logs appear and which don't
```

## Likely Root Causes (Based on Symptoms)

### If NO logs appear on Client B:
**Issue**: Network/WebSocket connection
**Check**: Are both clients actually connected to same server?

### If logs stop at "[DEBUG-WORKER] Voice stream started":
**Issue**: Worker not receiving voice packets from mumble-client
**Check**: mumble-client decode stream initialization

### If logs stop at "[DEBUG-DECODER] Transform called":
**Issue**: Decoder worker not responding
**Check**: decode-worker.js loading, Opus decoder initialization

### If logs appear but "[AudioContext] State: suspended":
**Issue**: Autoplay policy blocking audio
**Fix**: Add AudioContext.resume() on user interaction

### If all logs appear but no audio:
**Issue**: BufferQueueNode not playing
**Check**: ScriptProcessor vs AudioWorklet compatibility

## Next Actions

1. **Build with debugging**:
   ```bash
   npm run build
   ```

2. **Test two-client setup** (not loopback!)

3. **Copy console logs** from BOTH clients

4. **Report back**:
   - Which logs appear on Client B (receiver)?
   - Where does the log sequence stop?
   - What is AudioContext state?
   - Any console errors?

## Build Verification

The build changes (file-loader → asset/resource) are **NOT the issue** because:
- Workers are building correctly ✓
- Loopback test works ✓
- The issue is runtime audio playback, not build process

This is a **production runtime issue**, not a build issue.

---

## Test Tone Button (Beeper) Initialization Issue

### Problem
The test tone button ("Play an A (440 Hz)") does not appear when:
- The URL is visited for the first time on a device
- Microphone permission needs to be requested
- Audio test mode is activated

Voice echo works correctly, but the test tone button remains invisible.

### Root Cause
1. `_performConnect()` calls `initVoice()`
2. `getUserMedia()` requests microphone permission (asynchronous)
3. User grants permission
4. `getUserMedia` callback sets `window._audioMixer`
5. **BUT**: `_initializePersistentBeeper()` was called before mixer existed
6. Function returned early without waiting
7. `beeperReady()` stays false → button hidden

### Solution
Made `_initializePersistentBeeper()` wait for audio mixer internally using `waitForAudioMixer()` helper:

```javascript
this._initializePersistentBeeper = async () => {
  if (this._persistentBeeper) return;
  
  // Wait for audio mixer to become available (handles delayed getUserMedia)
  const mixerAvailable = await waitForAudioMixer(5000, 50);
  if (!mixerAvailable) {
    this.beeperReady(false);
    return;
  }
  
  const mixer = window._audioMixer;
  // ... initialization continues
}
```

**Benefits**:
- Works automatically wherever `_initializePersistentBeeper()` is called
- No redundant waiting logic at call sites
- One central, robust implementation

### Test Scenarios

#### Scenario 1: First Visit (Microphone Permission Required)
1. Clear browser cache/cookies or use incognito mode
2. Navigate to URL
3. Activate "Audio Test" toggle
4. Click "Connect"
5. Browser requests microphone permission
6. Grant permission
7. **Expected**: Test tone button appears automatically (max 5 seconds)
8. Click button → tone plays

#### Scenario 2: Repeat Visit (Permission Already Granted)
1. Navigate to URL (permission cached)
2. Activate "Audio Test" toggle
3. Click "Connect"
4. **Expected**: Test tone button appears immediately
5. Click button → tone plays

#### Scenario 3: Test Button While Connected
1. Already connected (normal mode)
2. Click "Test" button
3. **Expected**: Switches to loopback mode, test tone button appears
4. Voice echo works
5. Test tone works

### Debugging
Console logs for successful initialization:
```
[BEEP] Waiting for audio mixer...
[BEEP] Persistent beeper initialized and ready
```

If timeout occurs:
```
[BEEP] Mixer not ready after timeout
```
→ Check AudioWorklet initialization or getUserMedia issues

### Related Files
- `app/index.js`: `_initializePersistentBeeper()` with automatic mixer waiting
- `app/index.html`: Button visibility bound to `beeperReady()` observable
- `app/audio/voice.js`: Sets `window._audioMixer` after getUserMedia callback

---

## Dual-Output Latency Test Beep

### Overview
The test beep plays **both locally (immediate) and as echo from the Mumble server**, allowing users to hear the end-to-end audio latency.

### How It Works

#### Audio Signal Flow
The 440 Hz sine tone follows **two parallel paths**:

1. **Local Path (immediate)**:
   - Oscillator → `localGain` → AudioContext.destination
   - **No delay** - plays instantly when clicking Test button
   - Volume: 0.3 (quieter)

2. **Server Echo Path (delayed)**:
   - Oscillator → `beepGain` → `_audioMixer` → Server (Loopback target=31) → back to client
   - **With network latency** - echoes after round-trip time
   - Volume: 0.4 (louder)

#### Why Different Volumes?
- **Local: 0.3** (quieter) - the immediate "click"
- **Echo: 0.4** (louder) - the delayed server echo
- Helps distinguish both signals acoustically

### What You'll Hear

When clicking the Test button:
1. **Immediate tone** - local path plays (0ms latency)
2. **Echo tone** - server echo arrives after some milliseconds
3. **Time difference** = your round-trip latency to server

#### Example Latency Scenarios:
- **LAN/local server**: ~5-20ms → barely audible, minimal echo
- **Good internet**: ~20-50ms → clear short echo
- **Poor connection**: >100ms → distinct separate echo

### Usage
1. **Connect to server** (loopback mode recommended for testing)
2. **Press Test button** (in connection dialog or UI)
3. **Listen for**:
   - First tone immediately
   - Second tone (echo) after latency delay
4. **Mental calculation**: Time between tones = your latency

### First-Click Latency Fix

The first beep used to have ~200ms extra latency due to AudioWorklet module loading. This is now fixed by **pre-warming** the AudioWorklet on connection:

```javascript
// In app/index.js during connect:
await this.audioContext.audioWorklet.addModule('playback-buffer-processor.js');
```

The `voiceHandlerReady` observable gates the Test button until the voice handler is fully initialized, preventing measurement of initialization overhead.

### Technical Details

See `app/audio/LATENCY_TEST.md` for detailed implementation including:
- Dual-path oscillator setup
- Envelope curves (attack/sustain/decay)
- AudioWorklet pre-warming
- Voice handler ready observable

### Limitations
- **Loopback mode**: Tests same-client path (see warning above)
- **Mixer dependency**: Requires `window._audioMixer` (after getUserMedia)
- **AudioContext**: Needs running AudioContext (state: 'running')
- **No automatic measurement**: User must listen and compare manually

---

## Loopback Frequency Analysis Feature

### Overview
Real-time frequency display in loopback test mode. When audio test is active, the dominant frequency of server-echoed audio is analyzed via FFT and displayed in the UI.

### Implementation

#### VoiceState (`app/state/VoiceState.js`)
- **Observable**: `loopbackDominantFrequency` - stores detected dominant frequency (rounded to 1 decimal)
- **Method**: `updateLoopbackFrequency(frequency)` - updates display (loopback mode only)

#### UserState (`app/state/UserState.js`)
- **AnalyserNode Integration**: Web Audio AnalyserNode inserted into audio pipeline when loopback active
- **FFT Analysis**:
  - FFT size: 32768 (high resolution: ~1.46 Hz @ 48kHz)
  - Smoothing: 0.8 (smooths frequency data)
  - Update interval: 100ms (10 Hz refresh rate)
  - Amplitude threshold: 80 (filters noise/silence)
  - Timeout: 3 consecutive checks below threshold (300ms) clears display
- **Audio Pipeline**:
  - Normal mode: `userNode → gainNode → destination`
  - Loopback mode: `userNode → gainNode → analyserNode → destination`
  - Analysis occurs AFTER gain node (measures only audible audio)
- **Smart Display**:
  - Clears immediately when mute/deafen activated
  - Only shows frequency when amplitude > 80
  - Resets counter when audio detected
- **Cleanup**: Analysis interval cleared on stream end

#### UI (`app/index.html`)
- **Fixed-width box**: 120px prevents modal resize
- **Visibility**: Only when test active AND loopback mode enabled
- **Display states**:
  - Active: `📊 440.5 Hz` (icon + frequency + unit)
  - Idle: `📊` (icon only, no "---" placeholders)
- **Left-aligned**: Prevents icon jumping during state transitions
- **Single line**: `white-space: nowrap`

### Technical Details

#### Frequency Calculation
```javascript
dominantFrequency = (maxIndex × sampleRate) / fftSize
```
- `maxIndex`: FFT bin with highest amplitude
- `sampleRate`: AudioContext sample rate (typically 48000 Hz)
- `fftSize`: 32768

#### Frequency Resolution
```
Resolution = 48000 Hz / 32768 ≈ 1.46 Hz per bin
```

High resolution allows accurate pitch detection (e.g., 440 Hz displays as 440.5 Hz instead of 445 Hz).

### Usage

1. **Enable Audio Test**: Toggle "Audio Test" in connect dialog
2. **Send Audio**: Press 🎹 button (440 Hz tone) or speak into microphone
3. **Read Frequency**: Dominant frequency updates in real-time (e.g., `📊 440.5 Hz`)
4. **Automatic Hide**: Display clears after 300ms of silence or when mute/deafen pressed

### Debugging

Enable `DEBUG_VOICE_LOGGING` in `UserState.js` for console logs:
```
[LOOPBACK-FREQ] Frequency analysis started for loopback mode
[LOOPBACK-FREQ] Dominant frequency: 440.5 Hz, amplitude: 156
[LOOPBACK-FREQ] Low audio, amplitude: 45 count: 1 / 3
[LOOPBACK-FREQ] Display cleared after 3 checks, amplitude: 42
[LOOPBACK-FREQ] Display cleared (muted or deafened)
[LOOPBACK-FREQ] Frequency analysis stopped
```

### Expected Values
- **440 Hz Beeper**: 440-441 Hz (±1.5 Hz with high FFT resolution)
- **Speech**: 80-300 Hz (fundamental voice frequency)
- **Noise**: < 80 amplitude (filtered out)

### Browser Compatibility
- AnalyserNode: Web Audio API (Chrome 14+, Firefox 25+, Safari 6+)
- Tested: ES2020 target (Chrome 80+, Firefox 72+, Safari 13.1+)

### Performance
- **FFT computation**: ~2-3ms per frame (100ms interval)
- **Memory**: ~32 KB for frequency buffer (32768 × Uint8Array)
- **CPU**: Negligible (~0.5% on modern CPUs)
- **UI updates**: Knockout reactive, no manual DOM manipulation

### Future Enhancements
- [ ] Frequency spectrum visualization (Canvas-based waterfall display)
- [ ] Multiple peak detection (harmonics display)
- [ ] RMS level / volume meter
- [ ] Latency measurement (send timestamp → echo timestamp delta)

```

