# Mumbling Mole Documentation

This directory contains planning documents, migration guides, and architectural decisions for the Mumbling Mole project.

---

## 📋 Current Documentation

### Critical/Active

- **[NETLIFY_IDENTITY_MIGRATION_PLAN.md](./NETLIFY_IDENTITY_MIGRATION_PLAN.md)** 🚨  
  **Status:** Active Planning  
  Complete migration plan for moving from deprecated Netlify Identity to Supabase Auth. Includes timeline, implementation details, and code examples.  
  **Timeline:** Q1-Q2 2026 (15 weeks)  
  **Priority:** P2 - High

---

## 🔗 Related Documentation

### Root Level
- [TECHNICAL_DEBT_ANALYSIS.md](../TECHNICAL_DEBT_ANALYSIS.md) - Comprehensive technical debt inventory
- [TESTING.md](../TESTING.md) - Testing strategy and procedures
- [AUDIO_DEBUG_GUIDE.md](../AUDIO_DEBUG_GUIDE.md) - Production audio debugging guide
- [LOOPBACK_TEST_COVERAGE.md](../LOOPBACK_TEST_COVERAGE.md) - Audio loopback testing documentation

### Vendor Documentation
- [vendors/README.md](../vendors/README.md) - Overview of all vendored dependencies
- [vendors/netlify-identity-widget/VENDOR_STATUS.md](../vendors/netlify-identity-widget/VENDOR_STATUS.md) - Deprecation notice and current status
- [vendors/mumble-client/FORK_RATIONALE.md](../vendors/mumble-client/FORK_RATIONALE.md) - Fork analysis
- [vendors/mumble-streams/FORK_RATIONALE.md](../vendors/mumble-streams/FORK_RATIONALE.md) - Security fork rationale
- [vendors/web-audio-buffer-queue/FORK_RATIONALE.md](../vendors/web-audio-buffer-queue/FORK_RATIONALE.md) - Refactored fork analysis

---

## 📊 Documentation Status

| Document | Status | Last Updated | Next Review |
|----------|--------|--------------|-------------|
| NETLIFY_IDENTITY_MIGRATION_PLAN.md | 📝 Draft | Oct 11, 2025 | Nov 1, 2025 |

---

## 🎯 Upcoming Documentation Needs

- [ ] Auth abstraction layer design document
- [ ] Supabase integration architecture
- [ ] User migration runbook
- [ ] Post-migration monitoring guide

---

**Maintained by:** Flexpair Team  
**Last Updated:** October 11, 2025
