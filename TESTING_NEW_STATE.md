# Testing the New AppState Architecture

## Overview

The new modular state architecture can be tested alongside the existing GlobalBindings implementation using a feature flag. This allows safe testing without breaking existing functionality.

## Feature Flag

The feature flag `USE_NEW_STATE_ARCHITECTURE` controls which architecture is used:

- **`false` (default)**: Uses legacy `GlobalBindings` (1785 lines, god object)
- **`true`**: Uses new modular `AppState` architecture (7 focused modules)

## How to Test

### Option 1: Using the Test Script (Recommended)

```bash
# Test with new architecture
./test-new-state.sh

# Optional: specify Mumble server
MUMBLE_SERVER=your-server:64738 ./test-new-state.sh
```

This script:
- Sets `USE_NEW_STATE_ARCHITECTURE=true`
- Builds with development mode
- Starts the dev server
- Opens the app in your browser

### Option 2: Manual Environment Variable

```bash
# Set the flag and build
USE_NEW_STATE_ARCHITECTURE=true npm run build

# Or in dev mode
USE_NEW_STATE_ARCHITECTURE=true WEBPACK_MODE=development ./smart-build.sh
```

### Option 3: Browser Console Override

You can switch architectures at runtime by setting the flag before the page loads:

```javascript
// In browser console, BEFORE page loads:
window.USE_NEW_STATE_ARCHITECTURE = true;
location.reload();
```

Or add to URL:
```
http://localhost:8080/?newstate=true
```

(Note: This requires a small code change to read from URL params)

## What to Test

### 1. Connection Flow
- [ ] Netlify Identity login
- [ ] Connect to Mumble server
- [ ] Connection succeeds
- [ ] Channel tree displays correctly
- [ ] User list displays correctly
- [ ] Disconnect works

### 2. Audio Features
- [ ] Microphone permission request
- [ ] Mute/unmute button works
- [ ] Deaf/undeaf button works
- [ ] Voice transmission (talk in channel)
- [ ] Receiving voice from others
- [ ] Audio sample rate check
- [ ] Audio lock states

### 3. Loopback Mode
- [ ] Click "Test" button
- [ ] Loopback mode activates
- [ ] Voice echo works
- [ ] Beeper button appears
- [ ] Beeper latency test works
- [ ] Switch back to normal mode

### 4. UI Features
- [ ] Select channels
- [ ] Select users
- [ ] Send messages to channel
- [ ] Send messages to user
- [ ] Open settings dialog
- [ ] Change settings
- [ ] Apply settings
- [ ] Settings persist after reload

### 5. Guacamole Integration
- [ ] Connect with appropriate role
- [ ] Guacamole iframe appears (if authorized)
- [ ] Guacamole loads correctly
- [ ] Switch between Mumble and Guacamole

## Verification Checklist

### Console Messages

When the new architecture is active, you should see:
```
[STATE] Using new modular AppState architecture
```

When the old architecture is active, you should see:
```
[STATE] Using legacy GlobalBindings architecture
```

### No Errors

Check browser console for:
- ❌ No JavaScript errors
- ❌ No undefined property warnings
- ❌ No observable subscription errors
- ❌ No Knockout binding errors

### Functionality Parity

Everything should work **identically** to the old architecture:
- Same UI behavior
- Same connection flow
- Same audio features
- Same settings
- Same error handling

## Troubleshooting

### Issue: "Cannot read property X of undefined"

**Cause**: Property not exposed by AppState

**Fix**: Check if getter is defined in `app/state/AppState.js`:
```javascript
get propertyName() { return this.module.propertyName; }
```

### Issue: "ui.methodName is not a function"

**Cause**: Method not delegated by AppState

**Fix**: Check if method is defined in `app/state/AppState.js`:
```javascript
methodName(...args) { return this.module.methodName(...args); }
```

### Issue: Observable not updating

**Cause**: Property is not a Knockout observable

**Fix**: Ensure property is defined as observable in module:
```javascript
this.propertyName = ko.observable(initialValue);
```

### Issue: Build fails

**Cause**: Missing dependencies or syntax error

**Fix**: 
```bash
# Clean rebuild
rm -rf dist/
npm run build
```

### Issue: Page is blank

**Cause**: JavaScript error preventing app initialization

**Fix**:
1. Check browser console for errors
2. Look for missing imports
3. Verify all module files exist
4. Check file paths in imports

## Comparing Architectures

### Running Side-by-Side Tests

1. **Test with old architecture:**
```bash
# Default - uses GlobalBindings
npm run build
./start-dev-server.sh
# Test all features, note any issues
```

2. **Test with new architecture:**
```bash
# New - uses AppState
USE_NEW_STATE_ARCHITECTURE=true npm run build
./start-dev-server.sh
# Test same features, compare behavior
```

### Expected Differences

**None!** The new architecture should be 100% functionally identical to the old one.

If you find differences, that's a bug that needs to be fixed.

## Performance Testing

### Memory Usage

Monitor memory usage in browser DevTools:

```javascript
// In console
window.mumbleUi  // Check object structure
```

The new architecture may use slightly more memory due to module objects, but should be negligible.

### Startup Time

Both should have similar startup times. The new architecture adds minimal overhead.

## Automated Tests

Run the existing test suite with both architectures:

### Old Architecture (default)
```bash
npm run test:quick
npm run test:audio:system
npm run test:e2e
```

### New Architecture
```bash
USE_NEW_STATE_ARCHITECTURE=true npm run test:quick
USE_NEW_STATE_ARCHITECTURE=true npm run test:audio:system
USE_NEW_STATE_ARCHITECTURE=true npm run test:e2e
```

**All tests should pass with both architectures.**

## Reporting Issues

If you find issues with the new architecture:

1. **Document the issue:**
   - What feature doesn't work?
   - What error appears in console?
   - Steps to reproduce

2. **Verify it's architecture-specific:**
   - Test with old architecture
   - Confirm it works with GlobalBindings
   - Confirm it fails with AppState

3. **Check the logs:**
   - Browser console
   - Network tab
   - Application tab (localStorage, etc.)

4. **File a detailed bug report:**
   - Include console errors
   - Include steps to reproduce
   - Include expected vs actual behavior

## Success Criteria

The new architecture is ready for production when:

- ✅ All manual tests pass
- ✅ All automated tests pass
- ✅ No console errors
- ✅ No functional differences from old architecture
- ✅ Performance is acceptable
- ✅ Code is cleaner and more maintainable

## Migration Timeline

### Phase 1: Feature Flag Testing (Current)
- Both architectures coexist
- Default is old architecture
- New architecture tested thoroughly
- Issues identified and fixed

### Phase 2: Default Switch
- Make new architecture the default
- Keep old architecture as fallback
- Monitor for issues

### Phase 3: Deprecation
- Announce old architecture will be removed
- Give time for final testing
- Document any remaining issues

### Phase 4: Removal
- Remove GlobalBindings class
- Remove feature flag
- Clean up code
- Update documentation

## Additional Resources

- [Architecture Documentation](./app/state/README.md)
- [Migration Guide](./app/state/MIGRATION_GUIDE.md)
- [Quick Reference](./app/state/QUICK_REFERENCE.md)
- [Refactoring Summary](./app/state/REFACTORING_SUMMARY.md)
