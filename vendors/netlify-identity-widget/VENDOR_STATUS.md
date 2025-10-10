# Netlify-Identity-Widget Vendor Status

## Overview
This is the official Netlify Identity Widget vendored for use in the Mumbling Mole project.

**Upstream Repository:** https://github.com/netlify/netlify-identity-widget  
**Vendor Type:** Unmodified upstream copy  
**Upstream Version:** v1.9.2  
**Vendored Version:** v1.9.2  
**Last Sync Date:** Unknown (vendored as-is)

---

## Why This is Vendored (Not Forked)

### Reasons for Vendoring

1. **Build Output Only**
   - Upstream distributes pre-built bundle: `build/netlify-identity.js`
   - No source modifications needed
   - Vendoring avoids CDN dependency for offline development

2. **Zero Modifications**
   - ❌ **No code changes**
   - ❌ **No build process changes**
   - ❌ **No dependency updates**
   - ✅ **Exact copy of upstream release**

3. **Deterministic Builds**
   - Using vendored copy ensures reproducible builds
   - No risk of CDN changes or downtime
   - Version locked to specific release

### Why Not Use NPM or CDN?

**Option: NPM Package**
```json
// Could use:
"dependencies": {
  "netlify-identity-widget": "^1.9.2"
}
```
- ❌ Requires build step or bundler integration
- ❌ Adds to node_modules bloat
- ✅ **Vendored instead:** Direct access to pre-built file

**Option: CDN Link**
```html
<!-- Could use: -->
<script src="https://identity.netlify.com/v1/netlify-identity-widget.js"></script>
```
- ❌ External dependency (breaks offline development)
- ❌ CDN availability risk
- ❌ Potential for unexpected updates
- ✅ **Vendored instead:** Local, reliable access

---

## Vendored Files

### Package Structure
```
vendors/netlify-identity-widget/
├── package.json           # Minimal metadata (name, version, main)
├── CHANGELOG.md           # Upstream changelog
├── CODE_OF_CONDUCT.md     # Upstream code of conduct
├── CONTRIBUTING.md        # Upstream contribution guide
├── LICENSE               # ISC License
├── README.md             # Upstream documentation
├── RELEASE.md            # Upstream release process
├── renovate.json         # Renovate config (unused)
├── releases/             # Pre-built distributions
│   └── v1.9.2/
│       └── netlify-identity.js  # Main file used
└── src/                  # Source code (not used directly)
    └── ...               # Full source tree
```

### Used Files
Only these files are actually used by Mumbling Mole:

```
✅ releases/v1.9.2/netlify-identity.js  # Loaded via <script> tag
✅ package.json                          # Version reference
```

### Unused Files (Kept for Reference)
```
ℹ️ src/                  # Source code (could rebuild if needed)
ℹ️ CHANGELOG.md          # Version history
ℹ️ README.md             # Documentation
📄 Other docs             # Contributing, license, etc.
```

---

## Integration with Mumbling Mole

### HTML Script Tag
```html
<!-- app/index.html -->
<script src="vendors/netlify-identity-widget/releases/v1.9.2/netlify-identity.js"></script>
```

### JavaScript Usage
```javascript
// app/index.js
if (window.netlifyIdentity && typeof window.netlifyIdentity.init === "function") {
  this.netlifyIdentity = window.netlifyIdentity;
} else {
  // Fallback if widget fails to load
  this.netlifyIdentity = {
    init: () => {},
    open: () => {},
    on: () => {},
    currentUser: () => null,
    logout: () => {},
    close: () => {},
  };
}
```

### Global API Used
```javascript
netlifyIdentity.init()                    // Initialize widget
netlifyIdentity.currentUser()             // Get logged-in user
netlifyIdentity.open('login')             // Open login modal
netlifyIdentity.on('login', callback)     // Event listener
netlifyIdentity.logout()                  // Log out user
```

---

## Upstream Package Details

### Full package.json (Upstream)
```json
{
  "name": "netlify-identity-widget",
  "description": "Netlify Identity widget for easy integration",
  "version": "1.9.2",
  "author": "Matt Biilmann <matt@netlify.com>",
  "bugs": {
    "url": "https://github.com/netlify/netlify-identity-widget/issues"
  },
  "dependencies": {},
  "devDependencies": {
    "@babel/cli": "^7.10.1",
    "@babel/core": "^7.10.2",
    // ... 40+ dev dependencies
  },
  "scripts": {
    "build": "cross-env NODE_ENV=production webpack",
    "dev": "webpack-dev-server --open",
    "test": "jest",
    // ... more scripts
  }
}
```

### Vendored package.json (Minimal)
```json
{
  "name": "netlify-identity-widget",
  "version": "1.9.2",
  "main": "build/netlify-identity.js"
}
```

**Why Minimal:**
- We only use pre-built file, not source
- Don't need build scripts or dev dependencies
- Keep vendor directory lightweight

---

## Version Information

### Current Version: v1.9.2
**Release Date:** Check https://github.com/netlify/netlify-identity-widget/releases/tag/v1.9.2

**Features in v1.9.2:**
- Full authentication flow (signup, login, password recovery)
- Email confirmation
- Role-based access control
- User metadata support
- Customizable UI

**Known Issues:**
- Check upstream issues: https://github.com/netlify/netlify-identity-widget/issues

---

## Update Strategy

### When to Update

**Check for Updates:**
- Quarterly review of upstream releases
- When security advisories are published
- When bugs affect Mumbling Mole functionality

**Update Triggers:**
- 🔴 **Security fixes** - Update immediately
- 🟡 **Bug fixes** - Update in next maintenance cycle
- 🟢 **New features** - Evaluate need, update if beneficial

### Update Process

1. **Check Latest Release**
   ```bash
   # Visit GitHub releases page
   open https://github.com/netlify/netlify-identity-widget/releases
   ```

2. **Download New Version**
   ```bash
   cd vendors/netlify-identity-widget/releases
   mkdir v1.9.3  # or new version
   cd v1.9.3
   curl -L -O https://github.com/netlify/netlify-identity-widget/releases/download/v1.9.3/netlify-identity.js
   ```

3. **Update References**
   ```bash
   # Update package.json version
   # Update HTML script tag path if needed
   ```

4. **Test Integration**
   ```bash
   npm run build
   npm run test
   # Manual testing of auth flows
   ```

5. **Update This Document**
   - Update version numbers
   - Note any breaking changes
   - Update last sync date

---

## Testing

### Upstream Tests
- ✅ Upstream has Jest test suite
- ✅ Maintained by Netlify team
- ℹ️ We don't run upstream tests (use pre-built)

### Integration Testing
```bash
# Build Mumbling Mole
npm run build

# Start dev server
./start-dev-server.sh

# Manual test checklist:
# □ Widget loads without errors
# □ Login modal opens
# □ User can sign up
# □ User can log in
# □ User metadata is accessible
# □ Logout works
```

### Fallback Testing
Verify fallback works if widget fails to load:
```javascript
// Temporarily break script tag, verify app doesn't crash
// Should use fallback mock object
```

---

## Compatibility

### Browser Support
Same as upstream widget:
- Chrome (latest)
- Firefox (latest)
- Safari 10+
- Edge (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

### Netlify Identity Service
Requires:
- Active Netlify site
- Netlify Identity enabled
- Proper site configuration

---

## Known Limitations

### 1. No Offline Mode
- **Issue:** Widget requires network access to Netlify Identity service
- **Impact:** Cannot authenticate offline
- **Workaround:** None (inherent limitation)

### 2. Vendor Lock-in
- **Issue:** Tightly coupled to Netlify Identity service
- **Impact:** Cannot easily migrate to other auth providers
- **Mitigation:** Consider auth abstraction layer (see TECHNICAL_DEBT_ANALYSIS.md)

### 3. Global Window Object
- **Issue:** Widget adds to global scope (`window.netlifyIdentity`)
- **Impact:** Potential naming conflicts
- **Mitigation:** Low risk (unique namespace)

---

## Alternatives Considered

### Option 1: Gotrue-JS (SDK)
```javascript
// Instead of widget, use SDK directly
import GoTrue from 'gotrue-js'
const auth = new GoTrue({
  APIUrl: 'https://yoursite.netlify.app/.netlify/identity',
  audience: '',
  setCookie: true
})
```
- **Pros:** More control, smaller bundle, headless
- **Cons:** Need to build custom UI

### Option 2: Auth0, Firebase Auth, etc.
- **Pros:** More features, better support
- **Cons:** Migration cost, different pricing

### Option 3: Roll Own Auth
- **Pros:** Full control, no vendor lock-in
- **Cons:** Security complexity, maintenance burden

**Current Choice:** Netlify Identity Widget
- ✅ Quick integration
- ✅ Good UI out of box
- ✅ Netlify hosting alignment
- ⚠️ Vendor lock-in acceptable for this project

---

## Documentation Links

- **Official Docs:** https://github.com/netlify/netlify-identity-widget
- **Netlify Identity:** https://docs.netlify.com/visitor-access/identity/
- **GoTrue API:** https://github.com/netlify/gotrue
- **Widget API:** See README.md in this directory

---

## Future Considerations

### Version 2.0 (If Released)
Monitor for major version updates:
- Review breaking changes
- Evaluate migration cost
- Test thoroughly before upgrading

### Alternative Auth Implementation
Consider abstracting auth to support:
- Multiple auth providers
- Self-hosted Mumble deployments
- Offline authentication

See `TECHNICAL_DEBT_ANALYSIS.md` Priority 2, Item #19 for details.

---

## Maintenance Checklist

### Quarterly Review
- [ ] Check for new upstream releases
- [ ] Review open issues affecting Mumbling Mole
- [ ] Verify no security advisories
- [ ] Update if beneficial

### On Each Mumbling Mole Release
- [ ] Verify auth flows work
- [ ] Test role-based access
- [ ] Validate user metadata access

---

## Contacts

**Upstream Maintainer:** Netlify Team  
**Upstream Issues:** https://github.com/netlify/netlify-identity-widget/issues  
**Netlify Support:** https://www.netlify.com/support/

**Mumbling Mole Maintainer:** Flexpair Team  
**Integration Questions:** Open issue in Mumbling Mole repo

---

**Vendor Status:** ✅ **Unmodified Upstream Copy**  
**Last Verified:** October 10, 2025  
**Next Review:** January 2026 (Quarterly)
