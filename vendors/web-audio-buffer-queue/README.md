# Web-Audio-Buffer-Queue Fork Rationale

## Overview
This is a fork of [johni0702/web-audio-buffer-queue](https://github.com/johni0702/web-audio-buffer-queue) maintained by Flexpair for use in the Mumbling Mole project.

**Upstream Repository:** https://github.com/johni0702/web-audio-buffer-queue  
**Fork Repository:** https://github.com/jafudi/web-audio-buffer-queue  
**Upstream Version Basis:** v1.1.0  
**Fork Version:** v1.1.1  
**Last Sync Date:** Unknown (no upstream tracking)

---

## Why This Fork Exists

### 1. **Pre-compiled Library Distribution**
- **Upstream:** Distributes source in `src/` with babel compile step required
- **Fork:** Distributes pre-compiled ES5 code in `lib/` directory
- **Reason:** Simplifies integration with Mumbling Mole build system

### 2. **Removed Browser Polyfill Dependency**
- **Upstream:** Depends on `audio-context` package (polyfill for AudioContext)
- **Fork:** Removed dependency, implements minimal AudioContext detection inline
- **Reason:** Modern browsers natively support AudioContext; avoids unnecessary polyfill overhead

### 3. **Simplified Package**
- **Upstream:** Includes full build toolchain, tests, and dev dependencies
- **Fork:** Ships only compiled code in `lib/` directory
- **Reason:** Reduce package size and eliminate unnecessary build step

### 4. **Main Entry Point Change**
- **Upstream:** `"main": "index.js"` (wrapper that requires compilation)
- **Fork:** `"main": "lib/index.js"` (pre-compiled, ready to use)
- **Reason:** Direct usage without build step

---

## Code Differences

### Major Changes

#### 1. AudioContext Handling
```javascript
// Upstream (using audio-context package)
import globalAudioContext from 'audio-context'

// Fork (native implementation)
let defaultAudioContext = null;

function getDefaultAudioContext() {
  if (defaultAudioContext) {
    return defaultAudioContext;
  }
  
  if (typeof window === 'undefined') {
    return null;
  }
  
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return null;
  }
  
  defaultAudioContext = new AudioContextClass();
  return defaultAudioContext;
}
```

**Impact:**
- ✅ No external dependency for AudioContext
- ✅ Better tree-shaking (smaller bundle)
- ✅ Works in modern browsers (2015+)
- ⚠️ No polyfill for very old browsers (acceptable trade-off)

#### 2. Code Structure Modernization
The fork refactored internal classes for better performance:

**Upstream:**
- Single `BufferQueueNode` class with all logic inline
- Format detection in constructor

**Fork:**
- Separate wrapper classes (`AudioBufferWrapper`, `TypedArrayWrapper`)
- Cleaner separation of concerns
- Better memory management

#### 3. Import/Export Style
```javascript
// Upstream
import { Writable } from 'stream'
export default BufferQueueNode
// Also exports format constants

// Fork
import { Writable } from 'stream';
import extend from 'extend';
// Same exports, cleaned up
```

### Files Modified
- ✏️ `src/index.js` → `lib/index.js` (compiled + refactored)
- 📦 `package.json` - Simplified dependencies, updated metadata
- 🗑️ Removed build scripts

### Files Removed
- All devDependencies
- Test files (handled by parent project)
- Build configuration

---

## Functional Changes

### Breaking Changes
❌ **None** - API is fully compatible

### Non-Breaking Changes
✅ **AudioContext creation** - Now creates context lazily when needed  
✅ **Performance** - Slight improvement from reduced polyfill overhead  
✅ **Bundle size** - Smaller due to removed `audio-context` dependency

---

## Package.json Comparison

| Field | Upstream | Fork | Change |
|-------|----------|------|--------|
| version | 1.1.0 | 1.1.1 | Minor bump |
| description | Original description | "..._(Flexpair fork)_" | Marked as fork |
| main | index.js | lib/index.js | Points to compiled |
| repository | johni0702/web-audio-buffer-queue | jafudi/web-audio-buffer-queue | Fork URL |
| dependencies.audio-context | ^1.0.3 | ❌ Removed | No longer needed |
| dependencies.extend | ^3.0.0 | ^3.0.0 | Kept |
| devDependencies | 13 packages | ❌ All removed | No build step |
| scripts | 4 scripts | ❌ All removed | No build step |
| keywords | 8 keywords | ❌ Removed | Simplified |

---

## Dependencies

### Upstream Dependencies
```json
{
  "dependencies": {
    "audio-context": "^1.0.3",  // ← REMOVED
    "extend": "^3.0.0"           // ← KEPT
  }
}
```

### Fork Dependencies
```json
{
  "dependencies": {
    "extend": "^3.0.0"  // Only dependency
  }
}
```

**Removed Dependency Analysis:**
- `audio-context` (v1.0.3) - Adds ~15KB to bundle
  - Polyfills `AudioContext` for older browsers
  - Not needed for Mumbling Mole's target browsers (modern only)
  - Reimplemented inline with ~15 lines of code

---

## Browser Compatibility

### Upstream Target
- Works in browsers back to IE10 (with polyfills)
- Supports Web Audio API via polyfill package

### Fork Target
- Modern browsers with native `AudioContext` support:
  - Chrome 35+ (2014)
  - Firefox 25+ (2013)
  - Safari 14.1+ (2021)
  - Edge 79+ (2020)
  - Opera 22+ (2014)

**Trade-off Accepted:**
- ❌ Dropped support for IE10-11 and very old mobile browsers
- ✅ Gained smaller bundle size and simpler code
- ✅ Acceptable for Mumbling Mole's deployment targets

---

## Integration with Mumbling Mole

### Import Pattern
```javascript
// app/index.js
import BufferQueueNodeDefault, { 
  BufferQueueNode as BufferQueueNodeNamed 
} from "web-audio-buffer-queue";

// Handle both default and named exports
const BufferQueueNode = BufferQueueNodeDefault || BufferQueueNodeNamed;
```

**Why this pattern?**
- Fork may export differently than upstream
- Defensive import ensures compatibility
- Works regardless of bundler behavior

### Usage in Audio Pipeline
```javascript
// Creating a playback node for decoded audio
const bufferNode = new BufferQueueNode({
  audioContext: this.audioContext,
  channels: numberOfChannels,
  bufferSize: 4096
});

// Connect to audio output
bufferNode.connect(audioContext.destination);

// Write PCM data
bufferNode.write(audioBuffer);
```

---

## Testing

### Upstream Tests
- ❌ Not maintained in fork
- ℹ️ Upstream has Mocha tests using `web-audio-engine`

### Integration Testing
Tested via Mumbling Mole test suite:

```bash
# System test validates import
npm run test:audio:system

# Audio pipeline test validates playback
npm run test:audio

# Loopback test validates buffer queueing
npm run test:loopback
```

**Test Coverage:**
- ✅ Module can be imported
- ✅ BufferQueueNode can be instantiated
- ✅ Audio buffers can be written
- ✅ AudioContext integration works
- ✅ Multiple channels supported

---

## Maintenance Strategy

### Current State: ⚠️ **No Active Sync Process**

### Upstream Activity
- **Last upstream commit:** Check https://github.com/johni0702/web-audio-buffer-queue/commits
- **Active development:** Appears dormant (no recent updates)
- **Issues:** Check open issues for bugs

### Sync Recommendations

**Low Priority for Syncing:**
- Upstream is stable and dormant
- Fork has different architecture (pre-compiled vs source)
- Functional requirements met

**Monitor For:**
- Security vulnerabilities in `extend` dependency
- Bug reports in upstream issues
- Pull requests with critical fixes

**Sync Process (if needed):**
```bash
cd vendors/web-audio-buffer-queue
git remote add upstream https://github.com/johni0702/web-audio-buffer-queue.git
git fetch upstream

# Review changes
git log HEAD..upstream/master --oneline
git diff HEAD..upstream/master src/index.js

# If critical fix found, manually apply to lib/index.js
# OR recompile from upstream src/ with current tooling
```

---

## Known Issues

### 1. Pre-compiled Code Hard to Maintain
- **Issue:** `lib/index.js` is manually edited or compiled from old source
- **Impact:** Difficult to track changes or rebuild from source
- **Mitigation:** Document compilation process or keep source in sync

### 2. No Source Maps
- **Issue:** Debugging compiled code is harder
- **Impact:** Stack traces reference compiled code, not original source
- **Mitigation:** Low priority - code is stable and small (~300 lines)

### 3. Divergent Architecture
- **Issue:** Fork refactored internals (wrapper classes)
- **Impact:** Cannot easily merge upstream changes
- **Mitigation:** Manual review required if upstream updates occur

---

## Future Considerations

### Option 1: Publish to NPM
Publish fork as `@flexpair/web-audio-buffer-queue`
- **Pros:** Standard dependency management, versioning
- **Cons:** Maintenance overhead for publishing

### Option 2: Inline the Code
Copy `lib/index.js` directly into Mumbling Mole codebase
- **Pros:** No external dependency, full control
- **Cons:** ~300 lines of code to maintain

### Option 3: Find Alternative Package
Use a different audio buffer queue library
- **Pros:** Community-maintained, potentially better features
- **Cons:** Migration effort, learning curve

### Option 4: Keep Current Approach
Continue using vendored fork
- **Pros:** Works well, no migration cost
- **Cons:** Maintenance overhead for vendored dependency

**Recommended:** **Option 4** (Keep Current Approach)
- Code is stable and working
- Low risk of security issues (minimal dependencies)
- Upstream unlikely to release breaking changes

---

## API Documentation

### Constructor Options
```javascript
new BufferQueueNode({
  audioContext: AudioContext,  // Required: Audio context instance
  channels: Number,             // Default: 1 (mono)
  bufferSize: Number,          // Default: 0 (auto), must be power of 2
  interleaved: Boolean,        // Default: true
  dataType: Constructor        // Default: Float32Array
})
```

### Methods
- `write(buffer)` - Queue audio buffer for playback
- `end()` - Signal end of stream
- `connect(destination)` - Connect to audio destination
- `disconnect()` - Disconnect from audio graph

### Events
Inherits from `Writable` stream:
- `finish` - All data consumed
- `error` - Error occurred

---

## Contacts

**Original Author:** Jonas Herzig <me@johni0702.de>  
**Fork Maintainer:** Flexpair Team  
**Issues:** https://github.com/jafudi/web-audio-buffer-queue/issues

---

**Last Updated:** October 10, 2025  
**Next Review:** July 2026 (Annual - low priority)
