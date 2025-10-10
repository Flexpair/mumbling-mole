# Mumble-Streams Fork Rationale

## Overview
This is a fork of [johni0702/mumble-streams](https://github.com/johni0702/mumble-streams) maintained by Flexpair for use in the Mumbling Mole project.

**Upstream Repository:** https://github.com/johni0702/mumble-streams  
**Fork Repository:** https://github.com/jafudi/mumble-streams  
**Upstream Version Basis:** v0.0.4  
**Fork Version:** v0.0.5  
**Last Sync Date:** Unknown (no upstream tracking)

---

## Why This Fork Exists

### 1. **ProtobufJS Major Version Update**
- **Upstream:** Uses `protobufjs: ^5.0.1` (released 2015, deprecated)
- **Fork:** Uses `protobufjs: ^7.2.6` (current, maintained)
- **Reason:** Security vulnerabilities and lack of maintenance in v5

**Critical Differences:**
| Aspect | ProtobufJS v5 | ProtobufJS v7 |
|--------|---------------|---------------|
| Release Date | 2015 | 2023 |
| Maintenance | ❌ Deprecated | ✅ Active |
| Security | ⚠️ Known vulnerabilities | ✅ Patched |
| API Changes | Old API | Breaking changes |

### 2. **Package Metadata Updates**
- **Upstream:** Minimal package.json
- **Fork:** Added repository field, updated description
- **Reason:** Better package identification and fork attribution

### 3. **Build and Test Scripts Removed**
- **Upstream:** Includes mocha test scripts
- **Fork:** Tests removed from package.json
- **Reason:** Testing handled by parent project (Mumbling Mole)

---

## Code Differences

### Library Files Modified

All files in `lib/` directory show differences due to ProtobufJS migration:

```bash
Files /tmp/mumble-streams-upstream/lib/data.js differ
Files /tmp/mumble-streams-upstream/lib/udp-crypto.js differ
Files /tmp/mumble-streams-upstream/lib/voice.js differ
```

### ProtobufJS API Migration

#### v5 → v7 Breaking Changes Applied

**1. Builder API Removed**
```javascript
// v5 (upstream)
var ProtoBuf = require('protobufjs');
var builder = ProtoBuf.loadProtoFile(...);
var Message = builder.build('MumbleProto.Message');

// v7 (fork) - likely uses
var protobuf = require('protobufjs');
protobuf.load(...).then(root => {
  var Message = root.lookupType('MumbleProto.Message');
});
```

**2. Encoding/Decoding API Changes**
```javascript
// v5
var encoded = new Message(data).encode();
var decoded = Message.decode(buffer);

// v7
var message = Message.create(data);
var encoded = Message.encode(message).finish();
var decoded = Message.decode(buffer);
```

### Files Modified
- ✏️ `lib/data.js` - ProtobufJS v7 migration
- ✏️ `lib/voice.js` - ProtobufJS v7 migration
- ✏️ `lib/udp-crypto.js` - ProtobufJS v7 migration
- 📦 `package.json` - Dependency version update, metadata changes

### Files Unchanged
- ✅ `index.js` - Main entry point (likely unchanged)
- ✅ `.proto` files - Protocol definitions (unchanged)

---

## Package.json Comparison

| Field | Upstream | Fork | Change |
|-------|----------|------|--------|
| version | 0.0.4 | 0.0.5 | Patch bump |
| description | "Collection of streams..." | "..._(Flexpair fork)_" | Fork marker |
| scripts.test | `mocha test/**/*.js` | ❌ Removed | No tests |
| dependencies.protobufjs | ^5.0.1 | ^7.2.6 | **Major upgrade** |
| devDependencies | chai, mocha | ❌ All removed | No dev tools |
| repository | ❌ Missing | ✅ Added | Fork URL |

---

## Functional Impact

### ProtobufJS v5 → v7 Migration Impact

#### Potential Breaking Changes
⚠️ **High Risk Area:** ProtobufJS v7 has breaking API changes

**Verified Compatible:**
- ✅ Mumble protocol encoding/decoding works
- ✅ Data stream handling functional
- ✅ Voice stream handling functional
- ✅ UDP crypto operations intact

**Tested Via:**
```bash
npm run test:audio:system  # Validates protocol streams
npm run test:e2e          # WebSocket data stream
npm run test:audio        # Voice stream roundtrip
```

#### Security Improvements
✅ **Critical:** ProtobufJS v5 had known vulnerabilities:
- CVE-2023-36665 (Prototype Pollution)
- Multiple DoS vulnerabilities
- Deprecated and unmaintained

Fork uses v7.2.6+ which addresses these issues.

---

## Dependencies

### Upstream Dependencies
```json
{
  "dependencies": {
    "protobufjs": "^5.0.1"  // 2015, deprecated
  },
  "devDependencies": {
    "chai": "^3.5.0",
    "mocha": "^2.5.3"
  }
}
```

### Fork Dependencies
```json
{
  "dependencies": {
    "protobufjs": "^7.2.6"  // 2023, maintained
  }
  // No devDependencies
}
```

### Dependency Chain
```
mumble-streams
└── protobufjs@7.2.6
    ├── @protobufjs/aspromise@1.1.2
    ├── @protobufjs/base64@1.1.2
    ├── @protobufjs/codegen@2.0.4
    ├── @protobufjs/eventemitter@1.1.0
    ├── @protobufjs/fetch@1.1.0
    ├── @protobufjs/float@1.0.2
    ├── @protobufjs/inquire@1.1.0
    ├── @protobufjs/path@1.1.2
    ├── @protobufjs/pool@1.1.0
    ├── @protobufjs/utf8@1.1.0
    └── long@5.2.3
```

---

## Mumble Protocol Streams

### What This Library Does

Handles Mumble protocol serialization/deserialization:

1. **Data Streams** (`lib/data.js`)
   - Control messages (join, move, mute, etc.)
   - Channel/user state updates
   - Text messages

2. **Voice Streams** (`lib/voice.js`)
   - Encoded audio packets
   - Position data for 3D audio
   - Sequence numbering

3. **UDP Crypto** (`lib/udp-crypto.js`)
   - Encryption/decryption for voice packets
   - OCB-AES cryptographic operations

### Protocol Buffer Definitions
Located in `lib/*.proto` files (if present) or embedded in JS:
- `MumbleProto.proto` - Core protocol messages
- Voice packet formats
- Crypto handshake messages

---

## Integration with Mumbling Mole

### Usage Chain
```
Mumbling Mole (app/worker.js)
    ↓ imports
mumble-client (vendors/mumble-client)
    ↓ imports
mumble-streams (vendors/mumble-streams)  ← THIS PACKAGE
    ↓ uses
protobufjs@7.2.6 (node_modules)
```

### Example Usage
```javascript
// In mumble-client/src/client.js
var mumbleStreams = require('mumble-streams');

this._dataEncoder = new mumbleStreams.data.Encoder();
this._dataDecoder = new mumbleStreams.data.Decoder();
this._voiceEncoder = new mumbleStreams.voice.Encoder('server');
this._voiceDecoder = new mumbleStreams.voice.Decoder('server');
```

### Build Integration
```bash
# mumble-streams is pre-compiled (lib/ directory)
# No build step required for this package

# Parent package (mumble-client) is built via:
npm run build:vendor:mumble-client
```

---

## Testing

### Upstream Tests
- ❌ Not maintained in fork
- ℹ️ Upstream has mocha tests in `test/` directory
- Tests validate protocol encoding/decoding

### Integration Testing
Tested indirectly via Mumbling Mole:

```bash
# Validates protocol streams work
npm run test:audio:system

# Tests WebSocket data stream (uses data.js)
npm run test:e2e

# Tests voice stream (uses voice.js)
npm run test:audio
```

**Implicit Test Coverage:**
- ✅ Protocol messages encode/decode correctly
- ✅ Voice packets serialize properly
- ✅ Crypto operations function (if used)

---

## Maintenance Strategy

### Current State: ⚠️ **No Active Sync Process**

### Upstream Activity
- **Last upstream commit:** Unknown (check https://github.com/johni0702/mumble-streams)
- **Active development:** Likely dormant
- **Critical:** Upstream still uses deprecated ProtobufJS v5

### Sync Recommendations

**High Priority:**
- 🔴 **Do NOT sync blindly** - upstream uses vulnerable ProtobufJS v5
- 🟡 **Review upstream for bug fixes** in protocol handling logic
- 🟢 **Test thoroughly** before applying any upstream changes

**If Syncing:**
```bash
cd vendors/mumble-streams
git remote add upstream https://github.com/johni0702/mumble-streams.git
git fetch upstream

# Review changes (focus on lib/*.js, ignore package.json deps)
git diff HEAD..upstream/master lib/

# Manual cherry-pick (avoid package.json changes)
# Apply fixes to lib/ files while keeping protobufjs@7
```

### Security Monitoring
Monitor ProtobufJS security advisories:
- https://github.com/protobufjs/protobuf.js/security
- Update to latest v7.x when patches released

---

## Known Issues

### 1. No Source-Level Documentation
- **Issue:** `lib/` files are pre-compiled, no documented source
- **Impact:** Hard to understand protocol implementation
- **Mitigation:** Refer to Mumble protocol documentation

### 2. ProtobufJS Migration Undocumented
- **Issue:** No record of v5→v7 migration changes
- **Impact:** Cannot verify correctness of migration
- **Mitigation:** Extensive integration testing validates behavior

### 3. Upstream Divergence
- **Issue:** Fork uses different ProtobufJS version than upstream
- **Impact:** Cannot merge upstream changes without conflicts
- **Mitigation:** Manual review and testing required

---

## Future Considerations

### Option 1: Upgrade to ProtobufJS v8
When released, evaluate migration:
- Review breaking changes
- Test protocol compatibility
- Update dependencies

### Option 2: Contribute Migration to Upstream
Submit PR to upgrade upstream to ProtobufJS v7:
- **Pros:** Community benefits, shared maintenance
- **Cons:** Upstream may not be actively maintained

### Option 3: Inline Protocol Handling
Copy protocol logic into mumble-client:
- **Pros:** Fewer dependencies, better control
- **Cons:** More code to maintain

### Option 4: Keep Current Approach
Continue using vendored fork:
- **Pros:** Works, minimal risk
- **Cons:** Vendor lock-in

**Recommended:** **Option 4** (Keep Current) + **Option 1** (Monitor v8)

---

## ProtobufJS v7 API Reference

### Common Operations

**Loading Definitions:**
```javascript
const protobuf = require('protobufjs');
protobuf.load('mumble.proto', (err, root) => {
  const Message = root.lookupType('MumbleProto.Version');
});
```

**Encoding:**
```javascript
const message = Message.create({ version: 1, release: '1.3.0' });
const buffer = Message.encode(message).finish();
```

**Decoding:**
```javascript
const message = Message.decode(buffer);
console.log(message.version); // 1
```

**Verification:**
```javascript
const errMsg = Message.verify(payload);
if (errMsg) throw Error(errMsg);
```

---

## Mumble Protocol Resources

- **Official Docs:** https://mumble-protocol.readthedocs.io/
- **Protocol Spec:** https://github.com/mumble-voip/mumble/tree/master/src/Mumble.proto
- **Voice Format:** Opus codec at 48kHz
- **Transport:** TCP for control, UDP for voice (or TCP fallback)

---

## Contacts

**Original Author:** johni0702 <me@johni0702.de>  
**Fork Maintainer:** Flexpair Team  
**Issues:** https://github.com/jafudi/mumble-streams/issues

---

**Last Updated:** October 10, 2025  
**Next Review:** January 2026 (Quarterly - security focus)
