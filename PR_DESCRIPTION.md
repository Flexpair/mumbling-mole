# Fix: Audio playback race condition for remote users

## 🐛 Problem

**Symptoms:**
- ❌ Other users' audio cannot be heard in normal connection mode
- ✅ Voice data is successfully received and decoded
- ❌ Decoded audio never reaches AudioContext destination
- ✅ Loopback mode works perfectly

**Impact:** Complete audio playback failure for remote users while loopback testing shows no issues.

## 🔍 Root Cause

### Race Condition in Event Handler Registration

Voice events from remote users can arrive **before** the `newUser` event is processed in the UI thread, causing:

1. Voice event triggers implicit user creation via `_user(id)` 
2. User object is created **without** registering event handlers
3. Later `newUser` event sees user already has `__ui` marker → skips initialization
4. **Result:** No `.on('voice')` handler → no BufferQueueNode → no audio

### Why Loopback Wasn't Affected

Loopback mode uses the self-user migration mechanism:
- Self user is created with `undefined` ID early
- Event handlers are registered during initial creation
- When server assigns real ID, migration preserves handlers
- **Migration only helps self-user, not remote users!**

### Regression Point

**Introduced by:** Commit `4c3e8d4` (Oct 5, 2025) - "Guard worker client init until root channel"

The delayed initialization increased the window for the race condition, making it consistently reproducible.

## ✅ Solution

### Two-Part Fix

#### 1. Auto-emit Events on Implicit Creation

**Files:** `app/worker-client.js`

Modified `_user()` and `_channel()` to emit `newUser`/`newChannel` events when objects are created implicitly:

```javascript
_user(id) {
  if (!this._users[id]) {
    this._users[id] = new User(id, this._client);
    this._dispatchEvent('newUser', [this._users[id]]);  // ✅ Now emits event!
  }
  return this._users[id];
}
```

This ensures event handlers are registered regardless of event ordering.

#### 2. Idempotent Initialization

**Files:** `app/index.js`

Made `_newUser()` and `_newChannel()` idempotent with `__ui` marker check:

```javascript
ui._newUser = function (user) {
  if (user.__ui) return;  // Already initialized
  user.__ui = true;
  // ... register event handlers ...
};
```

This safely handles duplicate initialization attempts without creating duplicate handlers.

### Migration Logic Preserved

The existing self-user migration mechanism (`_users[undefined]` → `_users[actualID]`) remains unchanged. It solves a different problem (self-user ID updates) and both fixes are necessary.

## 📊 Testing

### Automated Tests
```bash
npm run test:audio:system
# ✅ 10/10 tests passed
```

### Manual Testing Required

**Two-client test (recommended before merge):**
1. Open two browser windows
2. Connect both to same Mumble server
3. User A speaks → User B should hear audio
4. User B speaks → User A should hear audio

### Test Coverage Analysis

See [`LOOPBACK_TEST_COVERAGE.md`](LOOPBACK_TEST_COVERAGE.md) for detailed analysis:
- **Loopback coverage:** ~60% (misses remote user scenarios)
- **Two-client coverage:** ~100% (catches this type of bug)

## 📝 Changes

### Modified Files

- `app/worker-client.js`
  - `_user()`: Emit `newUser` event on implicit creation
  - `_channel()`: Emit `newChannel` event on implicit creation
  
- `app/index.js`
  - `_newUser()`: Add idempotency check
  - `_newChannel()`: Add idempotency check

### Documentation Added

- `AUDIO_PLAYBACK_FIX_DOCUMENTATION.md` - Complete technical analysis
- `LOOPBACK_TEST_COVERAGE.md` - Test coverage analysis and recommendations
- Updated `README.md` with documentation links

## 🎓 Key Learnings

1. **Loopback tests have limitations** - They test self-user code paths, not remote-user scenarios
2. **Implicit object creation is dangerous** - Always emit events when creating objects implicitly
3. **Race conditions are real** - Asynchronous initialization can reorder events unpredictably
4. **Migration ≠ universal solution** - It solves self-user ID updates, not remote-user race conditions

## 🔗 Related Documentation

- Technical Analysis: [`AUDIO_PLAYBACK_FIX_DOCUMENTATION.md`](AUDIO_PLAYBACK_FIX_DOCUMENTATION.md)
- Test Coverage: [`LOOPBACK_TEST_COVERAGE.md`](LOOPBACK_TEST_COVERAGE.md)
- Audio Debugging: [`AUDIO_DEBUG_GUIDE.md`](AUDIO_DEBUG_GUIDE.md)

## ✅ Checklist

- [x] Automated tests pass
- [x] Code follows existing patterns
- [x] Documentation added
- [ ] Manual two-client test performed (before merge)
- [ ] Tested on production-like server

---

**Commit:** 4b9e3c6  
**Branch:** test-loopback-on-3.12.1  
**Fixes:** Race condition in remote user audio playback  
**Regression from:** 4c3e8d4 (Oct 5, 2025)
