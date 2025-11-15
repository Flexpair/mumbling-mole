# Regression Test Documentation

## UI Initialization Blocking (3.16.0 → 3.16.1 → 3.16.5)

### Problem Summary
Production deployment showed **white screen for 3-4 seconds** after page load. UI only appeared after first user click. Issue did NOT occur in Codespaces development environment.

### Root Cause (PROVEN)

**Commit that broke it:** `96ee6fd74e63d40d8f0f880c6ae07e0611b6cbb4`  
**Date:** Sat Nov 1 22:49:25 2025  
**Message:** "fix: enhance initialization and error handling in AppState..."

**What it did:**
1. Added `async initialize()` method to `app/state/AppState.js`:
   ```javascript
   async initialize() {
     await this.audio.initializeAudioContext();
   }
   ```

2. Added `await ui.initialize()` call in `app/index.js` BEFORE `ko.applyBindings()`:
   ```javascript
   async function initializeUI() {
     await ui.initialize();  // ← BLOCKS HERE
     // ... auth code ...
     ko.applyBindings(ui);   // ← UI WAITS HERE
   }
   ```

### The Blocking Chain

```text
await ui.initialize()
  ↓
await audio.initializeAudioContext()
  ↓
await ensureAudioContext()
  ↓
await resumeAudioContext()
  ↓
Try 1: resume() → FAIL (Autoplay Policy) → wait 100ms
Try 2: resume() → FAIL (Autoplay Policy) → wait 200ms
Try 3: resume() → FAIL (Autoplay Policy) → wait 400ms
Try 4: resume() → FAIL (Autoplay Policy) → wait 800ms
Try 5: resume() → FAIL (Autoplay Policy) → give up
  ↓
Total delay: 100 + 200 + 400 + 800 = 1500ms
  ↓
ko.applyBindings(ui)  ← Called AFTER 1500ms delay
```

**Why this happened**: Browser Autoplay Policy blocks `AudioContext.resume()` without user gesture. All 5 retry attempts failed, each followed by exponential backoff delay (except the last attempt).


### Why Browser Blocked It

**Browser Autoplay Policy:** Modern browsers prevent `AudioContext.resume()` without user gesture.

1. AudioContext created with `state: 'suspended'`
2. `ensureAudioContext()` tries to resume it
3. Browser blocks every attempt (no user interaction yet)
4. Exponential backoff retry: 100ms → 200ms → 400ms → 800ms (4 delays for 5 attempts)
5. **Total delay: 1500ms**
6. UI blocked waiting for promise to resolve

### Why It Only Failed in Production

**Codespaces:** Fast local network, scripts load quickly, minimal delay not noticeable  
**Production:** External Netlify Identity Widget loading adds delay on top of 1500ms audio blocking → total 2-3 seconds white screen

### The Fix (3.16.5)

**Commit:** `1cb5b37`  
**Tag:** `3.16.5`  
**Message:** "fix: prevent UI freeze on production by applying Knockout bindings before auth initialization"

**Changes:**

1. **Removed** `await ui.initialize()` call from `initializeUI()`
2. **Removed** `initialize()` method from `AppState`
3. **Moved** `ko.applyBindings(ui)` to be called IMMEDIATELY
4. **Made** auth initialization async (IIFE, doesn't block)
5. **Result:** AudioContext lazy-initialized when actually needed

**Before (3.16.1):**

```javascript
async function initializeUI() {
  await ui.initialize();      // ← BLOCKS 1500ms
  await ui.auth.init();        // ← BLOCKS 1-2 seconds
  ko.applyBindings(ui);        // ← Called after 2-3 seconds
}
```

**After (3.16.5):**

```javascript
function initializeUI() {
  ko.applyBindings(ui);        // ← Called IMMEDIATELY

  (async () => {               // ← Runs in background
    await ui.auth.init();
    // ... handle auth result ...
  })();
}
```

### Test Coverage

**Test file:** `__tests__/regression/ui-initialization-blocking.test.js`

**Tests:**

1. `BROKEN (3.16.1): ko.applyBindings() blocked by AudioContext resume retries` - Simulates 5 failed resume attempts with exponential backoff, proves 1500ms delay
2. `FIXED (3.16.5): ko.applyBindings() called immediately, no blocking` - Proves immediate execution (<10ms)
3. `CALCULATION: Exponential backoff totals 1500ms for 5 failed attempts` - Mathematical validation of delay calculation
4. `VERIFICATION: Current code does not call ui.initialize()` - Integration test that reads actual app/index.js
5. `VERIFICATION: AppState.initialize() method removed` - Integration test that reads actual app/state/AppState.js

**Run test:**

```bash
npm run test:unit -- ui-initialization-blocking.test.js
```

### Timeline Comparison

| Event | 3.16.1 (Broken) | 3.16.5 (Fixed) |
|-------|-----------------|----------------|
| Page loads | 0ms | 0ms |
| initializeUI() starts | 0ms | 0ms |
| AudioContext resume attempts | 0-1500ms | (lazy, later) |
| Auth initialization | 1500-3500ms | 0-2000ms (async) |
| ko.applyBindings() called | ~3500ms | <10ms |
| **UI renders** | **~3500ms** | **<10ms** |

### Lessons Learned

1. ✅ **Never** block UI rendering with async initialization
2. ✅ **Always** call `ko.applyBindings()` immediately, init async resources in background
3. ✅ **Lazy-load** AudioContext (browser needs user gesture anyway)
4. ✅ **Test in production-like conditions** (Codespaces != Production timing)
5. ✅ **Monitor** Browser Autoplay Policies when using Web Audio API

### Related Files

- `app/index.js` - Main UI initialization
- `app/state/AppState.js` - State coordinator
- `app/state/AudioState.js` - AudioContext management
- `app/audio/audio-context-manager.js` - Resume retry logic
- `themes/MetroMumbleLight/main.scss` - Also fixed CSS dialog hiding bug

### Git History

```bash
# Working version
git show 3.16.0:app/index.js

# Broken version (commit that broke it)
git show 96ee6fd:app/state/AppState.js

# Fixed version
git show 3.16.5:app/index.js

# See the diff
git diff 3.16.1 3.16.5 -- app/index.js app/state/AppState.js
```

## Protobuf.js camelCase Field Naming (3.17.0)

### Problem Summary
Two critical bugs caused by Protobuf.js **silently dropping** incorrectly-named fields:
1. Mute/deaf buttons appeared to work locally but server never received state changes
2. SendMessage completely broken with "Target not found" error

### Root Cause (PROVEN)

**What broke:** Protobuf.js automatically converts snake_case → camelCase, and **silently drops** fields with wrong names (no errors, no warnings).

**Field name mismatches:**
- Code used: `self_mute`, `self_deaf`, `channel_id`
- Protobuf.js expected: `selfMute`, `selfDeaf`, `channelId`
- Result: Fields silently dropped, features broke

### Why This Was Hard to Find

1. **No runtime errors** - Protobuf.js just drops the fields
2. **No console warnings** - Silent failure
3. **Local testing worked** - UI state updated even though server ignored messages
4. **Loopback tests passed** - Mute/deaf only tested client-side UI

### The Blocking Chain

```text
User clicks "Mute" button
  ↓
UI toggles mute state (Vue reactive)
  ↓
Code sends { session: 1, self_mute: true }  ← Wrong field name!
  ↓
Protobuf.js serialization
  ↓
DROPS self_mute field (unrecognized)
  ↓
Actually sends { session: 1 }  ← Field missing!
  ↓
Server receives message without mute state
  ↓
Server ignores message (no state change)
  ↓
User sees muted icon (client-side only) but server still hears them
```

### The Fixes (3.17.0)

**Files modified:** 11 total
**Tests added:** 27 total (11 regression + 16 integration)

#### Code Changes

1. **app/mumble-client/client.js** - Fixed all Protobuf handlers:
   ```javascript
   // Before (WRONG)
   setSelfMute(mute) {
     this._send('UserState', { session: this._session, self_mute: mute });
   }
   
   // After (CORRECT)
   setSelfMute(mute) {
     this._send('UserState', { session: this._session, selfMute: mute });
   }
   ```

2. **Added fallback handling** for backward compatibility:
   ```javascript
   _onChannelState(payload) {
     const channelId = payload.channelId ?? payload.channel_id ?? 0;
     // ... rest of handler
   }
   ```

3. **Fixed circular reference bug** found during testing:
   ```javascript
   // app/worker.js
   const setupChannel = (id, channel, visited = new Set()) => {
     if (visited.has(channel.id)) return { id: channel.id };
     visited.add(channel.id);
     // ... rest of setup
   };
   ```

#### Test Coverage

**Regression Tests** (`__tests__/regression/protobuf-camelcase.test.js` - 11 tests):
- Documents correct field name patterns
- Tests mute/deaf field names
- Tests channel/user ID handling
- Tests TextMessage protocol (uses snake_case)
- Tests circular reference protection
- Tests edge cases (100 channels, 10 toggles)

**Integration Tests** (`__tests__/integration/protobuf-serialization.test.js` - 16 tests):
- **Silent Field Dropping Behavior** (2 tests):
  * Documents that Protobuf.js silently drops snake_case fields
  * Documents automatic conversion on incoming messages
  
- **Required Field Names** (7 tests):
  * setSelfMute MUST use `selfMute` not `self_mute`
  * setSelfDeaf MUST use both `selfMute` and `selfDeaf`
  * ChannelState handler MUST accept `channelId`
  * Handler MUST fallback to `channel_id`
  * TextMessage MUST use `channel_id` array (protocol field)
  * UserState MUST accept `channelId` and default to 0
  * User._update MUST accept camelCase `channelId`
  
- **Field Name Patterns** (3 tests):
  * Documents correct pattern for incoming messages
  * Documents correct pattern for outgoing messages
  * Documents TextMessage special case
  
- **Regression Detection** (2 tests):
  * Will FAIL if code changes back to snake_case
  * Will FAIL if handlers remove camelCase support
  
- **Future Development** (2 tests):
  * Example: how to handle new Protobuf fields
  * Example: how to send new Protobuf fields

**E2E Tests** (`tests/playwright/mute-deaf-sendmessage.spec.js`):
- Automated UI tests for mute/deaf toggles
- Tests text message sending
- Verifies server state sync

### Why These Tests Matter

**Silent failures need explicit detection.** Standard unit tests would still pass even if someone changed field names back to snake_case, because:

1. Code would compile successfully
2. UI would still update (Vue reactivity)
3. No runtime errors would occur
4. Only the server would silently ignore messages

**Our integration tests explicitly check:**
- Field names are camelCase (not snake_case)
- Tests FAIL with descriptive errors if names change
- Documents what happens with wrong names
- Covers ALL Protobuf message types

### Lessons Learned

1. **Silent failures need defensive tests** - Can't rely on runtime errors
2. **Document the "why"** - Future developers need to understand the constraint
3. **Test the constraint, not just the feature** - Verify field names explicitly
4. **Regression tests must fail loudly** - Descriptive error messages
5. **Protobuf.js behavior is not obvious** - Needs explicit documentation

### References

**Pull Request:** #209  
**Branch:** `fix/protobuf-camelcase-mute-deaf-sendmessage`  
**Commits:** Multiple commits documenting the investigation and fix  
**Test Results:** 1145 tests passing (added 27 new tests)
