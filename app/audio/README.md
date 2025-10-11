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
