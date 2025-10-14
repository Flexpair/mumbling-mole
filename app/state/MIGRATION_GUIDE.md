# Migration Guide: GlobalBindings → AppState

## Overview

This guide explains how to complete the migration from the monolithic `GlobalBindings` class to the new modular `AppState` architecture.

## What Has Been Done ✅

1. **Created 7 State Modules** in `app/state/`:
   - `ConnectionState.js` - Server connection management (133 lines)
   - `AudioState.js` - Audio context & beeper (264 lines)
   - `VoiceState.js` - Voice handler & loopback (107 lines)
   - `UIState.js` - UI state & modals (77 lines)
   - `UserState.js` - User management (225 lines)
   - `ChannelState.js` - Channel tree (145 lines)
   - `AppState.js` - Main coordinator (518 lines)

2. **Created Documentation**:
   - `README.md` - Architecture & API reference
   - `REFACTORING_SUMMARY.md` - Project overview
   - `ARCHITECTURE.md` - Visual diagrams
   - `MIGRATION_GUIDE.md` - This file

3. **Backward Compatibility**:
   - `AppState` exposes same API as `GlobalBindings`
   - All properties accessible via getters
   - All methods delegated to appropriate modules

## What Remains To Do ⏳

### Step 1: Update `app/index.js`

The `app/index.js` file needs minimal changes:

#### Before:
```javascript
class GlobalBindings {
  constructor(config) {
    // ... 1785 lines ...
  }
}

var ui = new GlobalBindings(window.mumbleWebConfig);
```

#### After:
```javascript
import AppState from "./state/AppState";

// Remove the entire GlobalBindings class definition
// (it's been replaced by the modules in app/state/)

var ui = new AppState(window.mumbleWebConfig, log);
```

#### Detailed Changes:

1. **Add import at top of file** (after other imports):
```javascript
import AppState from "./state/AppState";
```

2. **Find the `class GlobalBindings` definition** (starts around line 474):
```javascript
class GlobalBindings {
  constructor(config) {
    // ... entire class ...
  }
}
```

3. **Delete the entire GlobalBindings class** (from `class GlobalBindings {` to the closing `}`)

4. **Update the instantiation** (around line 1666):
```javascript
// OLD:
var ui = new GlobalBindings(window.mumbleWebConfig);

// NEW:
var ui = new AppState(window.mumbleWebConfig, log);
```

5. **Keep everything else**:
   - `ConnectDialog` class - stays as-is
   - `ConnectErrorDialog` class - stays as-is  
   - `SampleRateWarningDialog` class - stays as-is
   - `GuacamoleFrame` class - stays as-is
   - `ConnectionInfo` class - stays as-is
   - `Settings` class - stays as-is
   - `SettingsDialog` class - stays as-is
   - Helper functions - stay as-is
   - `initializeUI()` function - stays as-is
   - `main()` function - stays as-is

### Step 2: Wire Up Dependencies

Some classes need to be attached to the `AppState` instance:

In `app/index.js`, after creating the `ui` instance, add:

```javascript
var ui = new AppState(window.mumbleWebConfig, log);

// Initialize dependent objects
ui.settings = new Settings(window.mumbleWebConfig.settings);
ui.connectDialog = new ConnectDialog();
ui.connectErrorDialog = new ConnectErrorDialog(ui.connectDialog);
ui.sampleRateWarningDialog = new SampleRateWarningDialog(ui);
ui.guacamoleFrame = new GuacamoleFrame();
ui.connectionInfo = new ConnectionInfo(ui);

// Initialize auth
const authConfig = window.mumbleWebConfig?.auth || { provider: 'netlify' };
ui.auth = AuthFactory.create(authConfig);
ui.netlifyIdentity = ui.auth; // Backward compatibility
```

### Step 3: Verify Knockout Bindings

The `app/index.html` file should **not need changes** because `AppState` exposes the same properties and methods as `GlobalBindings`.

However, verify these bindings still work:

#### Connection State:
```html
<span data-bind="text: remoteHost"></span>
<span data-bind="text: remotePort"></span>
<div data-bind="visible: connected()"></div>
```

#### Audio State:
```html
<button data-bind="click: startBeep, enable: beeperReady"></button>
<button data-bind="click: stopBeep"></button>
<div data-bind="visible: audioLockActive"></div>
<div data-bind="visible: micPermissionDenied"></div>
```

#### Voice State:
```html
<div data-bind="visible: isLoopbackMode"></div>
<div data-bind="visible: voiceHandlerReady"></div>
```

#### UI State:
```html
<input data-bind="value: messageBox"></input>
<button data-bind="click: submitMessageBox"></button>
<div data-bind="with: settingsDialog"></div>
```

#### User State:
```html
<div data-bind="with: thisUser"></div>
<button data-bind="click: function() { requestMute(thisUser()); }"></button>
<button data-bind="click: function() { requestDeaf(thisUser()); }"></button>
```

#### Channel State:
```html
<div data-bind="with: root"></div>
```

All these should work without modification because `AppState` uses getters to expose the same properties.

### Step 4: Test the Changes

Run the test suite to verify everything works:

```bash
# Fast validation (audio system + e2e + audit)
npm run test:quick

# Full test suite
npm run test

# Individual tests
npm run test:audio:system  # Offline validation
npm run test:e2e           # WebSocket smoke test
npm run test:audio         # Live roundtrip test
```

### Step 5: Manual Testing

Test these features manually:

#### Connection Flow:
1. Open the app
2. Log in with Netlify Identity
3. Connect to a Mumble server
4. Verify connection succeeds
5. Verify channel tree appears
6. Verify user list appears

#### Audio Features:
1. Test microphone permission request
2. Test mute/unmute
3. Test deaf/undeaf
4. Test voice transmission (talk in channel)
5. Test receiving voice from others
6. Test beeper (if available)

#### Loopback Mode:
1. Click "Test" button
2. Verify loopback mode activates
3. Test voice echo
4. Test beeper latency measurement
5. Switch back to normal mode

#### UI Features:
1. Select channels
2. Select users
3. Send messages
4. Open settings dialog
5. Change settings
6. Apply settings

### Step 6: Troubleshooting

If something doesn't work:

#### Issue: Property not found
**Error:** `Cannot read property 'X' of undefined`

**Solution:** Check if the property is exposed in `AppState` via getter:
```javascript
// In AppState.js, add:
get propertyName() { return this.module.propertyName; }
```

#### Issue: Method not found
**Error:** `ui.methodName is not a function`

**Solution:** Check if the method is delegated in `AppState`:
```javascript
// In AppState.js, add:
methodName(...args) { return this.module.methodName(...args); }
```

#### Issue: Observable not updating
**Error:** UI doesn't react to changes

**Solution:** Verify the property is a Knockout observable:
```javascript
// In the module, ensure:
this.propertyName = ko.observable(initialValue);

// Not:
this.propertyName = initialValue;
```

#### Issue: Missing context menu
**Error:** Context menu doesn't open

**Solution:** Implement `_openContextMenu` in `AppState`:
```javascript
_openContextMenu(event, menu, ui) {
  // Copy implementation from old GlobalBindings
}
```

#### Issue: Settings not persisting
**Error:** Settings reset on reload

**Solution:** Verify `Settings` class is attached:
```javascript
ui.settings = new Settings(window.mumbleWebConfig.settings);
```

## Rollback Plan

If issues arise and you need to rollback:

1. **Revert `app/index.js` changes**:
   - Remove `import AppState` line
   - Restore `class GlobalBindings` definition
   - Change `new AppState(...)` back to `new GlobalBindings(...)`

2. **Keep the new modules**:
   - The `app/state/` directory can remain
   - It doesn't affect the old code
   - You can retry migration later

3. **Run tests to verify**:
   - `npm run test:quick`
   - Manual testing

## Success Checklist

- [ ] `app/index.js` imports `AppState`
- [ ] `class GlobalBindings` removed from `app/index.js`
- [ ] `ui` instantiated as `new AppState(...)`
- [ ] Dependencies wired up (settings, dialogs, auth)
- [ ] `npm run test:quick` passes
- [ ] Manual testing passes
- [ ] No regressions observed
- [ ] Code committed to git

## Benefits After Migration

✅ **Separation of Concerns** - Each module has one responsibility
✅ **Easier to Test** - Modules can be tested independently  
✅ **Better Organization** - Related code is grouped together
✅ **Reduced Coupling** - Clean interfaces between modules
✅ **Maintainability** - Changes isolated to relevant modules
✅ **Backward Compatible** - Existing code works unchanged

## Next Steps After Migration

Once the migration is complete and stable:

1. **Add Unit Tests** - Test each module in isolation
2. **Extract More Classes** - Convert dialogs to modules
3. **Add Type Safety** - JSDoc or TypeScript types
4. **Refactor Subscriptions** - Use event bus pattern
5. **Update Documentation** - Reflect new architecture

## Getting Help

If you encounter issues during migration:

1. **Check Documentation**:
   - `app/state/README.md` - API reference
   - `app/state/ARCHITECTURE.md` - Visual diagrams
   - `app/state/REFACTORING_SUMMARY.md` - Project overview

2. **Compare Implementations**:
   - Look at old `GlobalBindings` code
   - Find equivalent in new modules
   - Ensure delegation is correct

3. **Debug Systematically**:
   - Check browser console for errors
   - Use debugger to trace execution
   - Verify observables are updating
   - Check Knockout bindings

4. **Test Incrementally**:
   - Don't change everything at once
   - Test after each small change
   - Keep git commits small and focused

## Conclusion

The migration is straightforward because `AppState` was designed for backward compatibility. The main work is:

1. Remove old `GlobalBindings` class
2. Import and instantiate `AppState`
3. Wire up dependencies
4. Test thoroughly

The new architecture provides a solid foundation for future development while maintaining full compatibility with existing code.
