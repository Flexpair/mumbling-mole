# Mumble-Client Fork Rationale

## Overview
This is a fork of [johni0702/mumble-client](https://github.com/johni0702/mumble-client) maintained by Flexpair for use in the Mumbling Mole project.

**Upstream Repository:** https://github.com/johni0702/mumble-client  
**Fork Repository:** https://github.com/jafudi/mumble-client  
**Upstream Version Basis:** v1.3.0  
**Fork Version:** v1.4.1  
**Last Sync Date:** Unknown (no upstream tracking)

---

## Why This Fork Exists

### 1. **Modern Build System Requirements**
- **Upstream:** Uses Babel 6 with deprecated `babel-preset-es2015`
- **Fork:** Upgraded to Babel 7 with `@babel/preset-env` for better browser compatibility
- **Reason:** Babel 6 is no longer maintained and has security vulnerabilities

### 2. **Dependency Management**
- **Upstream:** Uses npm registry dependencies with older versions
  - `mumble-streams: 0.0.4` (from npm)
  - `promise: ^7.1.1`
  - `drop-stream: ^0.1.1`
- **Fork:** Uses vendored and updated dependencies
  - `mumble-streams: file:../mumble-streams` (vendored)
  - `promise: ^8.1.0`
  - `drop-stream: ^1.0.0`
- **Reason:** Need control over the full dependency tree for reproducible builds

### 3. **Build Scripts Removal**
- **Upstream:** Includes build scripts in package.json (`compile`, `prepublish`, `test`)
- **Fork:** Build scripts removed, transpilation handled by parent project's build system
- **Reason:** Integration with Mumbling Mole's unified build process (smart-build.sh)

### 4. **Repository URL Updates**
- **Upstream:** Points to `github.com/johni0702/mumble-client`
- **Fork:** Points to `github.com/jafudi/mumble-client`
- **Reason:** Fork maintenance and issue tracking

---

## Code Differences

### Source Code Changes

All changes in `src/` directory are **formatting-only** (code style modernization):

#### Pattern Changes Applied:
1. **Multi-line formatting** for better readability
   ```javascript
   // Upstream (single line)
   this._data = duplexer(this._dataEncoder, this._dataDecoder, {objectMode: true})
   
   // Fork (multi-line)
   this._data = duplexer(this._dataEncoder, this._dataDecoder, {
     objectMode: true
   })
   ```

2. **Variable declaration modernization**
   ```javascript
   // Upstream
   var voiceStream = through2.obj(...)
   var seqNum = 0
   
   // Fork
   const voiceStream = through2.obj(...)
   let seqNum = 0
   ```

3. **Arrow function formatting**
   ```javascript
   // Upstream
   this._voiceDecoder.on('unknown_codec', codecId =>
     this.emit('unknown_codec', codecId))
   
   // Fork
   this._voiceDecoder.on('unknown_codec', codecId =>
     this.emit('unknown_codec', codecId)
   )
   ```

4. **Method chaining alignment**
   ```javascript
   // Upstream
   voiceStream.pipe(...).on('data', ...).on('end', ...)
   
   // Fork
   voiceStream
     .pipe(...)
     .on('data', ...)
     .on('end', ...)
   ```

### Files Modified
- ✏️ `src/client.js` - Formatting only
- ✏️ `src/user.js` - Formatting only
- ✏️ `src/channel.js` - Formatting only
- ✏️ `src/utils.js` - Formatting only
- 📦 `package.json` - Dependency and metadata updates
- 🔧 `.babelrc` - Upgraded to Babel 7

### Files Added
- `.github/` - GitHub Actions or workflows (if present)

### Files Removed
- DevDependencies removed from package.json (handled by parent project)

---

## Functional Equivalence

**Important:** The fork is **functionally identical** to upstream. All changes are:
- ✅ Code style improvements (no logic changes)
- ✅ Dependency version updates (compatible APIs)
- ✅ Build system modernization (same output)

**No protocol changes, no API changes, no behavior changes.**

---

## Maintenance Strategy

### Current State: ⚠️ **No Active Sync Process**

### Recommended Sync Schedule
1. **Review upstream quarterly** (January, April, July, October)
2. **Cherry-pick security fixes immediately** when discovered
3. **Test compatibility** before merging upstream changes

### Sync Process (Proposed)
```bash
# Add upstream remote (if not already added)
cd vendors/mumble-client
git remote add upstream https://github.com/johni0702/mumble-client.git
git fetch upstream

# Review changes
git log HEAD..upstream/master --oneline

# Merge changes (or cherry-pick specific commits)
git merge upstream/master
# OR
git cherry-pick <commit-hash>

# Resolve conflicts (preserve formatting style)
# Rebuild and test
cd ../..
npm run build:vendor:mumble-client
npm run test:audio:system
```

### Upstream Monitoring
- **GitHub Watch:** Set up notifications for upstream repository
- **Security Alerts:** Enable Dependabot for upstream dependency vulnerabilities
- **Version Tracking:** Document upstream version in this file after each sync

---

## Dependencies

### Direct Dependencies
| Package | Upstream Version | Fork Version | Notes |
|---------|-----------------|--------------|-------|
| drop-stream | ^0.1.1 | ^1.0.0 | Minor update |
| mumble-streams | 0.0.4 (npm) | file:../mumble-streams | Vendored |
| promise | ^7.1.1 | ^8.1.0 | Major update |
| reduplexer | ^1.1.0 | ^1.1.0 | Same |
| remove-value | ^1.0.0 | ^1.0.0 | Same |
| rtimer | ^0.1.0 | ^0.1.0 | Same |
| stats-incremental | - | ^1.2.1 | Added |
| through2 | - | ^4.0.2 | Added |
| websocket-stream | - | ^5.3.0 | Added |
| ws | - | ^8.18.3 | Added |

### Removed DevDependencies
All build-related dependencies removed (handled by parent project):
- `babel-cli`, `babel-preset-es2015`, `chai`, `mocha`, `mocha-standard`, `standard`

---

## Integration with Mumbling Mole

### Build Process
1. **Source files** (`src/*.js`) are **not** directly used by the application
2. **Transpilation** happens via `scripts/build-mumble-client.js`
3. **Output** is written to `lib/` directory (gitignored)
4. **Main entry** is `index.js` which exports from `lib/`

### Build Command
```bash
npm run build:vendor:mumble-client
```

This runs:
```javascript
// scripts/build-mumble-client.js
// Uses Babel 7 to transpile src/*.js → lib/*.js
```

### Usage in Application
```javascript
// app/worker-client.js
import MumbleClient from "mumble-client";
// Resolves to vendors/mumble-client/index.js → lib/client.js
```

---

## Testing

### Upstream Tests
- ❌ Not maintained in fork (devDependencies removed)
- ℹ️ Upstream has mocha tests in `test/` directory

### Integration Testing
- ✅ Tested via Mumbling Mole test suite:
  - `npm run test:audio:system` - Validates mumble-client can be imported
  - `npm run test:e2e` - Tests WebSocket connection
  - `npm run test:audio` - Tests full audio pipeline

---

## Known Issues

1. **No upstream version tracking**
   - Cannot easily determine which upstream commits are included
   - **Fix:** Add git tags or commit notes when syncing

2. **No automated sync**
   - Manual process prone to delays
   - **Fix:** Set up quarterly reminders or Renovate for upstream monitoring

3. **Formatting divergence**
   - Merging upstream changes requires conflict resolution
   - **Fix:** Consider automated formatter (Prettier) with consistent config

---

## Future Considerations

### Option 1: Contribute Back to Upstream
- Submit PR to upgrade upstream to Babel 7
- Get official support for modern build tools
- **Pros:** Community maintenance, no fork divergence
- **Cons:** Upstream may not be actively maintained

### Option 2: Publish as Separate Package
- Publish fork to npm as `@flexpair/mumble-client`
- Use standard npm versioning and updates
- **Pros:** Standard dependency management
- **Cons:** Additional maintenance burden

### Option 3: Inline the Code
- Copy source files directly into Mumbling Mole codebase
- Remove vendor directory entirely
- **Pros:** Full control, no fork maintenance
- **Cons:** Harder to track upstream changes, code duplication

---

## Contacts

**Original Author:** Jonas Herzig <me@johni0702.de>  
**Fork Maintainer:** Flexpair Team  
**Issues:** https://github.com/jafudi/mumble-client/issues

---

**Last Updated:** October 10, 2025  
**Next Review:** January 2026 (Quarterly)
