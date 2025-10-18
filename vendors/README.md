# Vendored Dependencies Overview

This directory contains four vendored dependencies used by Mumbling Mole. Each has been analyzed and documented with rationale for vendoring and maintenance strategies.

---

## Quick Reference

| Package | Type | Upstream Version | Our Version | Status | Priority |
|---------|------|-----------------|-------------|--------|----------|
| **mumble-client** | Fork | v1.3.0 | v1.4.1 | 🟡 Modified | High |
| **mumble-streams** | Fork | v0.0.4 | v0.0.5 | 🔴 Security Fork | Critical |
| **web-audio-buffer-queue** | Fork | v1.1.0 | v1.1.1 | 🟡 Refactored | Medium |
| **netlify-identity-widget** | Vendored | v1.9.2 | v1.9.2 | 🟢 Unmodified | Low |

### Status Legend
- 🔴 **Security Fork** - Contains critical security fixes not in upstream
- 🟡 **Modified Fork** - Has functional or structural changes
- 🟢 **Unmodified** - Exact copy of upstream release

### Priority Legend
- **Critical** - Security-sensitive, frequent monitoring required
- **High** - Core functionality, quarterly sync recommended
- **Medium** - Stable code, annual review sufficient
- **Low** - Rarely changes, monitor for major versions

---

## Documentation Index

Each vendored dependency has detailed documentation:

### 📁 mumble-client/
- **[FORK_RATIONALE.md](mumble-client/FORK_RATIONALE.md)** - Full analysis of fork changes
- **Key Points:**
  - Babel 6 → 7 upgrade for modern browser support
  - Formatting-only source changes (functionally identical)
  - Dependency version updates (promise, drop-stream)
  - Build process integrated with Mumbling Mole

### 📁 mumble-streams/
- **[FORK_RATIONALE.md](mumble-streams/FORK_RATIONALE.md)** - Critical security fork analysis
- **Key Points:**
  - ⚠️ **ProtobufJS v5 → v7** (upstream uses deprecated, vulnerable v5)
  - Security fixes for CVE-2023-36665 and DoS vulnerabilities
  - API migration required for ProtobufJS compatibility
  - **DO NOT sync with upstream** without careful review

### 📁 web-audio-buffer-queue/
- **[FORK_RATIONALE.md](web-audio-buffer-queue/FORK_RATIONALE.md)** - Refactored fork analysis
- **Key Points:**
  - Removed `audio-context` polyfill dependency (~15KB savings)
  - Pre-compiled distribution (no build step needed)
  - Native AudioContext detection for modern browsers
  - Internal refactoring for better performance

### 📁 netlify-identity-widget/
- **[VENDOR_STATUS.md](netlify-identity-widget/VENDOR_STATUS.md)** - Unmodified vendor documentation
- **Key Points:**
  - Exact copy of upstream v1.9.2 release
  - No modifications or fork
  - Uses pre-built bundle from `releases/` directory
  - Standard quarterly update check recommended

---

## Maintenance Summary

### 🔴 Immediate Action Required

**mumble-streams:**
- Monitor ProtobufJS security advisories
- Update to latest v7.x when patches released
- **Never** sync blindly with upstream (uses vulnerable v5)

### 🟡 Regular Maintenance (Quarterly)

**mumble-client:**
- Review upstream for bug fixes
- Test integration after updates
- Track upstream version in documentation

**web-audio-buffer-queue:**
- Monitor for critical fixes (low likelihood - stable)
- Check dependency security (only `extend`)

**netlify-identity-widget:**
- Check for new releases
- Update when security fixes or beneficial features released

### Update Schedule

```
January:   All packages (quarterly review)
April:     All packages (quarterly review)
July:      All packages (quarterly review)
October:   All packages (quarterly review)

Ad-hoc:    Security advisories (immediate response)
```

---

## Common Sync Process

### 1. Check Upstream
```bash
cd vendors/<package-name>

# Add upstream remote (first time only)
git remote add upstream <upstream-repo-url>

# Fetch latest
git fetch upstream

# Review changes
git log HEAD..upstream/master --oneline
git diff HEAD..upstream/master
```

### 2. Evaluate Changes
- Security fixes → Apply immediately
- Bug fixes → Test and apply
- Features → Evaluate need
- Breaking changes → Careful review required

### 3. Apply Updates
```bash
# Option A: Merge (if compatible)
git merge upstream/master

# Option B: Cherry-pick (selective)
git cherry-pick <commit-hash>

# Option C: Manual (if conflicts or refactored)
# Apply changes manually to modified files
```

### 4. Test Integration
```bash
# Build vendored package (if needed)
npm run build:vendor:mumble-client  # for mumble-client only

# Test in Mumbling Mole
cd ../..
npm run build
npm run test:audio:system
npm run test:e2e
npm run test:audio
```

### 5. Update Documentation
```bash
# Update FORK_RATIONALE.md or VENDOR_STATUS.md
# - New version numbers
# - Sync date
# - Changes applied
# - Breaking changes noted
```

---

## Dependency Relationships

### Dependency Tree
```
Mumbling Mole
│
├── app/worker-client.js
│   └── mumble-client (vendors/mumble-client)
│       └── mumble-streams (vendors/mumble-streams)
│           └── protobufjs@7.2.6 (node_modules)
│
├── app/index.js
│   ├── web-audio-buffer-queue (vendors/web-audio-buffer-queue)
│   │   └── extend@3.0.0 (node_modules)
│   │
│   └── netlify-identity-widget (vendors/netlify-identity-widget)
│       └── window.netlifyIdentity (global)
```

### Build Order
1. **mumble-streams** - No build needed (pre-compiled lib/)
2. **mumble-client** - Babel transpile src/ → lib/
   ```bash
   npm run build:vendor:mumble-client
   ```
3. **web-audio-buffer-queue** - No build needed (pre-compiled lib/)
4. **netlify-identity-widget** - No build needed (pre-built bundle)

---

## Security Considerations

### High-Risk Dependencies

**mumble-streams (Critical):**
- Uses ProtobufJS (complex parser, potential attack surface)
- Handles untrusted network data (Mumble protocol)
- **Mitigation:** Keep ProtobufJS v7 up to date, monitor CVEs

**netlify-identity-widget (Medium):**
- Handles authentication credentials
- Communicates with external service
- **Mitigation:** Regular updates, use official releases only

### Security Monitoring

**Automated:**
- Enable GitHub Security Advisories for this repo
- Use `npm audit` in CI/CD
- Dependabot for npm dependencies

**Manual:**
- Subscribe to upstream repository releases
- Monitor security mailing lists
- Review CVE databases quarterly

---

## Migration Paths

### Option 1: Publish Forks to NPM
Pros:
- Standard dependency management
- Semantic versioning
- Automated updates via Renovate

Cons:
- Publishing overhead
- Namespace management (@flexpair/...)

### Option 2: Git Submodules
Pros:
- Direct upstream tracking
- Clear version pinning

Cons:
- Complex workflow
- Submodule pitfalls

### Option 3: Keep Current (Recommended)
Pros:
- Simple, works well
- Full control
- No external dependencies

Cons:
- Manual sync process
- Documentation overhead

**Current Approach:** Option 3 (Keep vendoring with manual sync)

---

## Build Integration

### Webpack Configuration
```javascript
// webpack.config.js
resolve: {
  alias: {
    'mumble-client': path.resolve(__dirname, 'vendors/mumble-client'),
    'mumble-streams': path.resolve(__dirname, 'vendors/mumble-streams'),
    'web-audio-buffer-queue': path.resolve(__dirname, 'vendors/web-audio-buffer-queue')
  }
}
```

### Package.json
```json
{
  "dependencies": {
    "mumble-client": "file:vendors/mumble-client",
    "mumble-streams": "file:vendors/mumble-streams",
    "web-audio-buffer-queue": "file:vendors/web-audio-buffer-queue",
    "netlify-identity-widget": "file:vendors/netlify-identity-widget"
  }
}
```

---

## Testing Checklist

After updating any vendored dependency:

### Build Tests
- [ ] `npm run build` succeeds
- [ ] No webpack errors or warnings
- [ ] Bundle size within expected range

### System Tests
- [ ] `npm run test:audio:system` passes
  - Validates mumble-client imports
  - Checks codec availability
  - Verifies worker scripts

### Integration Tests
- [ ] `npm run test:e2e` passes
  - WebSocket connection works
  - Data stream functional (mumble-streams)

### Audio Tests
- [ ] `npm run test:audio` passes
  - Voice encoding/decoding works
  - Buffer queue functional (web-audio-buffer-queue)

### Auth Tests (Manual)
- [ ] Login modal opens (netlify-identity-widget)
- [ ] User can authenticate
- [ ] User metadata accessible

---

## Troubleshooting

### Build Fails After Update

**Symptom:** Babel compilation errors in mumble-client

**Fix:**
```bash
rm -rf vendors/mumble-client/lib
npm run build:vendor:mumble-client
```

### Import Errors

**Symptom:** Cannot find module errors

**Fix:**
```bash
# Reinstall file: protocol dependencies
rm -rf node_modules
npm install
```

### Protocol Errors

**Symptom:** WebSocket connection fails, protocol mismatch

**Fix:**
- Check mumble-streams changes
- Verify ProtobufJS compatibility
- Review upstream protocol changes
- Test against known-good Mumble server

### Audio Playback Issues

**Symptom:** No audio or distorted audio

**Fix:**
- Check web-audio-buffer-queue changes
- Verify AudioContext compatibility
- Test buffer queue in isolation

---

## Contributing

### Reporting Issues

**For vendored package issues:**
1. Verify issue exists in our fork
2. Check if issue exists in upstream
3. If upstream issue: Report there first
4. If fork-specific: Document in our issue tracker

**For upstream issues:**
- Link to upstream issue in our docs
- Monitor for upstream fixes
- Apply fix when available

### Making Changes

**Before modifying any vendored package:**
1. Document rationale in FORK_RATIONALE.md
2. Consider upstream PR instead of fork change
3. Test thoroughly
4. Update version number (patch bump)

---

## References

- **Mumbling Mole Documentation:** `/README.md`
- **Build System:** `/build-esbuild.mjs`
- **Testing Guide:** `/tests/README.md`

---

**Last Updated:** October 18, 2025  
**Maintained By:** Flexpair Team  
**Next Review:** January 2026
