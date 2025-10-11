# mumble-client (upgraded to Babel 7 and JS Standard v16)

This module implements the client side of the Mumble protocol for use in both Nodejs and the browser.
It does not enforce any particular transport protocol nor does it provide the audio encoder/decoder.
See [mumble-client-tcp] and [mumble-client-udp] and [mumble-client-codecs-node] for creating a Nodejs based application or
[mumble-client-websocket] and [mumble-client-codecs-browser] for a browser app.

### Usage

Node: All functions that take a Node-style callback as their last argument may also be used without that callback and will then instead return a [Promise].

Most transport modules will have their own MumbleClient factory functions.
Therefore this is only of importance if you do not wish to use any transport module or are implementing your one.
Note that encryption of the data stream has to be done by the transport module while the voice stream is encrypted by this module.
```javascript
var MumbleClient = require('mumble-client')
var client = new MumbleClient({
  username: 'Test',
  password: 'Pass123'
})
// someDuplexStream is used for data transmission and as a voice channel fallback
client.connectDataStream(someDuplexStream, function (err, client) {
  if (err) throw err

  // Connection established
  console.log('Welcome message:', client.welcomeMessage)
  console.log('Actual username:', client.self.username)

  // Optionally connect a potentially lossy, udp-like voice channel
  client.connectVoiceStream(someOtherDuplexStream)
  
  var testChannel = client.getChannel('Test Channel')
  if (testChannel) {
    client.self.setChannel(testChannel)
  }

  client.users.forEach(function (user) {
    console.log('User', user.username, 'is in channel', user.channel.name)
  })
})

// You may then register listeners for the 'voice' event to receive a stream
// of raw PCM frames.
client.on('newUser', function (user) {
  user.on('voice', function (stream) {
    stream.on('data', function (data) {
      // Interleaved IEEE754 32-bit linear PCM with nominal range between -1 and +1
      // May be of zero length which is usually only the case when voice.end is true
      console.log(data.pcm) // Float32Array
      console.log(data.numberOfChannels)
      
      // Target indicates who the user is talking to
      // Can be one of: 'normal', 'whisper', 'shout'
      console.log(data.target)

      // Neither numberOfChannels nor target should normally change during one 
      // transmission however this cannot be guaranteed
    }).on('end', function () {
      // The current voice transmission has ended, stateful decoders have been reset
      // Can be used to disable the 'talking' indicator of this use
      // Because the last packet might get lost due to packet loss, a timer is
      // used to always fire this event. As a result a single transmission might
      // be split when packets are delayed.
      console.log(user.username, 'stopped talking.')
    })
  })
})

// To send audio, pipe your raw PCM samples (as Float32Array or Buffer) at 
// 48kHz into an outgoing stream created with Client#createVoiceStream.
// Any audio piped in the stream while muted, suppressed or not yet connected
// will be silently dropped.
// First argument is the target: 0 is normal talking, 1-31 are voice targets
var voiceStream = client.createVoiceStream(0)
myPcmSource.pipe(voiceStream)
// Make sure the stream is ended when the transmission should end
// For positional audio the Float32Array is wrapped in an object which
// also contains the position:
myPcmSource.on('data', function (chunk) {
  voiceStream.write({
    pcm: chunk,
    x: 1,
    y: 2.5,
    z: 3
  })
})
```

### License
MIT

[mumble-client-tcp]: https://github.com/johni0702/mumble-client-tcp
[mumble-client-udp]: https://github.com/johni0702/mumble-client-udp
[mumble-client-websocket]: https://github.com/johni0702/mumble-client-websocket
[mumble-client-codecs-node]: https://github.com/johni0702/mumble-client-codecs-node
[mumble-client-codecs-browser]: https://github.com/johni0702/mumble-client-codecs-browser
[Promise]: https://github.com/then/promise
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
