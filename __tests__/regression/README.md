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
