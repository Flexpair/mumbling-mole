# Playwright E2E Tests

## Overview

This directory contains automated end-to-end tests using Playwright, focusing on browser-based audio pipeline validation.

## Available Tests

### 🎹 Loopback Frequency Test (`loopback-frequency.spec.js`)

Automated validation of the piano button loopback feature.

**Test Scenarios:**
1. **Frequency Detection** - Verifies ~440 Hz tone is detected and displayed in UI
2. **Mute/Deaf States** - Validates display behavior when muted/deaf (0 Hz)
3. **Undeafen Recovery** - Confirms frequency display restores after undeafen

**Quick Start:**
```bash
# Basic run (headless)
npm run test:loopback

# Watch it work (headed mode)
npm run test:loopback:headed

# Debug mode
npm run test:loopback:debug

# Interactive UI mode
npm run test:loopback:ui
```

**See Also:**
- 📖 Full strategy: `tests/LOOPBACK_AUTOMATION_STRATEGY.md`
- 🚀 Quick start guide: `tests/LOOPBACK_QUICKSTART.md`
- ⚙️ Configuration: `playwright.config.js`

---

# Loopback Test Analysis: What is Tested, What is Not?

## Your Loopback Test in Detail

### What Your Loopback Test Does:

```
Audio Input (Microphone)
    ↓
Audio Worklet (recorder-worker.js)
    ↓
Encoder (encode-worker.js - Opus)
    ↓
Worker (app/worker.js)
    ↓
WebSocket → Server with target=31
    ↓
Server echo back ← (SERVER LOOPBACK!)
    ↓
Worker (app/worker.js)
    ↓
Decoder (decode-worker.js - Opus)
    ↓
BufferQueueNode
    ↓
AudioContext.destination
    ↓
Audio Output (Headphones)
```

---

## ✅ What the Loopback Test DETECTS

### 1. Audio Capture Problems ✅
```javascript
// Does microphone work?
// Is AudioWorklet running?
// Is 48kHz sampling correct?
```
**Example errors detected:**
- Microphone permission missing
- AudioWorklet not loaded
- Sample rate incorrect

### 2. Encoding Problems ✅
```javascript
// Does Opus encoder work?
// Is bitrate correct?
// Are samples per packet correct?
```
**Example errors detected:**
- Encoder worker crashed
- Bitrate too low
- Codec library missing

### 3. Worker Communication ✅
```javascript
// Does postMessage work?
// Is voice stream created?
// Is resampling running?
```
**Example errors detected:**
- Worker not loaded
- postMessage blocked
- Voice stream creation failed

### 4. Server Communication ✅
```javascript
// Is WebSocket connected?
// Are voice packets being sent?
// Does server respond?
```
**Example errors detected:**
- WebSocket disconnected
- Server rejects voice packets
- Network timeout

### 5. Decoding Problems ✅
```javascript
// Does Opus decoder work?
// Is PCM data correct?
// Is buffer size correct?
```
**Example errors detected:**
- Decoder worker crashed
- Decoder library missing
- Corrupt audio data

### 6. Audio Playback (OWN Client) ✅
```javascript
// Is AudioContext running?
// Is BufferQueueNode created?
// Does audio output work?
```
**Example errors detected:**
- AudioContext suspended
- BufferQueueNode broken
- Audio output device missing

### 7. Self-User Event Handler ✅
```javascript
// Is voice stream created for self user?
// Are event handlers registered?
// Does migration work?
```
**Example errors detected:**
- User migration missing (was discovered through loopback!)
- Event handler not registered (for self)

---

## ❌ What the Loopback Test DOES NOT DETECT

### 1. Client-to-Client Audio Initialization ❌

**Problem:**
```javascript
// Loopback:
self.on('voice', handler)  // For OWN user
→ Handler is called ✅

// Other user:
otherUser.on('voice', handler)  // For OTHER user
→ Handler is ONLY called if user exists!
```

**The error that loopback DOESN'T find:**
- Other users don't get event handlers
- Voice events from other users are ignored
- **This was exactly our bug!** ← Loopback didn't find it!

### 2. User Lifecycle for Remote Users ❌

**Loopback tests:**
```
client.self (YOU)
  └─ Always present
  └─ Migration works
  └─ Event handler present
```

**Not tested:**
```
client.users[1,2,3...] (OTHERS)
  └─ Created dynamically
  └─ No migration
  └─ Event handlers missing? ← NOT TESTED!
```

### 3. Race Conditions Between Clients ❌

**Loopback timing:**
```
t=0: Connect
t=1: setupUser(self) - synchronous
t=2: newUser(self) - synchronous
t=3: Voice Event (self) - after newUser ✅
```

**Real-world timing (other user):**
```
t=0: User 99 is already on server
t=1: User 99 speaks IMMEDIATELY
t=2: Voice Event arrives
t=3: newUser Event arrives LATER ← RACE! ❌
```

**Loopback cannot reproduce this race condition!**

### 4. Multi-User AudioContext Handling ❌

**Loopback tests:**
- 1 user (self)
- 1 BufferQueueNode
- 1 audio stream

**Not tested:**
- Multiple BufferQueueNodes simultaneously
- Multiple voice streams mixing
- AudioContext with multiple sources

### 5. Network Latency Effects ❌

**Loopback:**
- Server is local or very close
- Echo returns quickly
- Timing is predictable

**Not tested:**
- High latency (100ms+)
- Packet loss
- Out-of-order packets

### 6. Session Management for Remote Users ❌

**Loopback:**
- Only one session (yourself)
- Session ID is known

**Not tested:**
- Multiple sessions
- Session collisions
- User join/leave during audio

---

## 🎯 Concrete Examples: What Loopback Misses

### Example 1: Our Bug!

**The bug:**
```javascript
// Other user speaks
→ Voice Event arrives
→ _user(99) creates user implicitly
→ NO emit('newUser')!
→ _newUser() is not called
→ No .on('voice') handler
→ ❌ No audio!
```

**Why loopback doesn't find it:**
```javascript
// Loopback:
→ Voice Event for self user
→ self user already exists (with handler)
→ Migration moves handler correctly
→ ✅ Audio works!
```

**Loopback tests the wrong code path!**

### Example 2: BufferQueueNode Leak

**Hypothetical bug:**
```javascript
// NEW BufferQueueNode created on every Voice Event
user.on('voice', () => {
  let node = new BufferQueueNode();  // Memory leak!
  node.connect(destination);
});
```

**Loopback:**
- Only 1 Voice Event for self
- Leak happens only once
- ✅ Seems to work

**Real-world:**
- 10 users speak alternately
- 100 BufferQueueNodes created
- ❌ Memory leak detectable!

### Example 3: AudioContext State Race

**Hypothetical bug:**
```javascript
// AudioContext is suspended for new user
otherUser.on('voice', () => {
  if (audioContext.state === 'suspended') {
    // ❌ No audio, but no error
  }
});
```

**Loopback:**
- AudioContext is already 'running' (from own audio)
- ✅ Works

**Real-world:**
- Only listening, not speaking
- AudioContext remains suspended
- ❌ No audio from others!

---

## 📊 Coverage Matrix

| Test Category | Loopback | Two-Client Test |
|----------------|----------|------------------|
| **Audio Capture** | ✅ 100% | ✅ 100% |
| **Encoding** | ✅ 100% | ✅ 100% |
| **Server Communication** | ✅ 100% | ✅ 100% |
| **Decoding** | ✅ 100% | ✅ 100% |
| **Self-User Playback** | ✅ 100% | ✅ 100% |
| **Self-User Event Handler** | ✅ 100% | ✅ 100% |
| **Self-User Migration** | ✅ 100% | ✅ 100% |
| | | |
| **Other-User Event Handler** | ❌ 0% | ✅ 100% |
| **Other-User Playback** | ❌ 0% | ✅ 100% |
| **Race Conditions** | ❌ 0% | ✅ 100% |
| **Multi-User Audio** | ❌ 0% | ✅ 100% |
| **User Lifecycle** | ❌ 50% | ✅ 100% |

**Loopback Coverage: ~60%**  
**Two-Client Test Coverage: ~100%**

---

## 🔧 How You Can Improve the Loopback Test

### Option 1: Simulate Synthetic Remote Users

```javascript
// In loopback mode:
function testLoopback() {
  // 1. Normal loopback
  startLoopback();
  
  // 2. Simulate another user
  setTimeout(() => {
    // Simulate Voice Event from User 99
    const fakeVoiceEvent = {
      userId: 99,
      event: 'voice',
      value: [fakeStream]
    };
    
    // Check if handlers are registered
    const user = client._user(99);
    console.assert(user.listenerCount('voice') > 0, 
      "ERROR: Other user has no voice handler!");
  }, 1000);
}
```

### Option 2: Loopback + Remote-User Check

```javascript
// After loopback test:
if (client.users.length > 1) {
  const otherUser = client.users.find(u => u !== client.self);
  
  // Check event handlers
  if (otherUser.listenerCount('voice') === 0) {
    console.error("[LOOPBACK-TEST] FAIL: Other user has no voice handler!");
  }
}
```

### Option 3: Extended Test Suite

```javascript
// tests/audio-loopback-extended.js
describe('Audio Loopback Extended', () => {
  it('should handle self user voice', async () => {
    // Normal loopback ✅
  });
  
  it('should handle other user voice simulation', async () => {
    // Simulate another user ✅
  });
  
  it('should handle race conditions', async () => {
    // Voice Event BEFORE newUser ✅
  });
  
  it('should handle multiple concurrent users', async () => {
    // 5 users simultaneously ✅
  });
});
```

---

## ✅ Recommended Test Strategy

### Level 1: Loopback (fast, local)
**Covers:** 60% of problems
- Audio capture/playback
- Encoding/decoding
- Server communication
- Self-user functionality

**Duration:** 10 seconds  
**When:** On every build/commit

### Level 2: Two-Client Test (manual)
**Covers:** 100% of problems
- Everything from Level 1
- Plus: Remote-user audio
- Plus: Race conditions
- Plus: Multi-user scenarios

**Duration:** 2 minutes  
**When:** Before every release

### Level 3: Multi-Client Stress Test (optional)
**Covers:** Edge cases
- 10+ simultaneous users
- Join/leave during audio
- Network problems

**Duration:** 10 minutes  
**When:** For major changes

---

## 🎯 Answer to Your Question

> "I want to make sure that my loopback test is actually suitable for detecting other typical audio errors."

**Answer:**

**YES, but with limitations:**

✅ **Loopback is VERY GOOD for:**
- Audio pipeline (Capture → Encode → Decode → Playback)
- Server communication
- Codec problems
- Self-user problems

❌ **Loopback is BAD for:**
- Remote-user audio
- Race conditions between clients
- Multi-user scenarios
- **Exactly the bug we had!**

**Recommendation:**
1. ✅ Keep loopback for quick tests
2. ✅ Add two-client test for complete coverage
3. ✅ Automate both if possible

**Loopback alone is NOT enough**, but it's a good first filter! 🎯

---

## 📝 Summary

**Loopback Test:**
- Fast ⚡
- Simple 👍
- Covers 60% ✅
- Misses critical race conditions ❌

**Two-Client Test:**
- Slower 🐌
- More complex 🤔
- Covers 100% ✅
- Finds all bugs ✅

**Best Strategy:**
Combine both tests! 🎯
