# Netlify Identity Migration Plan

**Status:** 🚨 **URGENT - Netlify Identity is Deprecated**  
**Created:** October 11, 2025  
**Timeline:** Q1-Q2 2026 (6 month migration window)  
**Priority:** P2 (High - Plan now, execute within 6 months)

---

## Executive Summary

Netlify officially deprecated Netlify Identity service and the underlying GoTrue API. While existing sites continue to function with security fixes, no new features or bug fixes will be implemented. We must migrate to an alternative authentication provider.

### Official Deprecation Notice

From [Netlify Docs](https://docs.netlify.com/manage/security/secure-access-to-sites/identity/overview/):

> **Netlify Identity service and the underlying GoTrue API are deprecated.** While Identity and GoTrue continue to function for sites that currently have them enabled, new Identity or GoTrue configurations are not recommended. While we will keep fixing any major security issues that arise, we will no longer fix bugs in the functionality of Identity or GoTrue.

**Netlify's Recommendations:**
- **For authentication:** Auth0
- **For GoTrue API alternative:** Supabase Auth (actively maintained fork of GoTrue)

---

## Current Implementation

### Architecture Overview

```
Mumbling Mole App
│
├── app/index.js (GlobalBindings)
│   └── window.netlifyIdentity (global object)
│       ├── init()
│       ├── open()
│       ├── currentUser()
│       ├── on('login', ...)
│       ├── on('logout', ...)
│       └── logout()
│
├── app/index.html
│   └── <script src="vendors/netlify-identity-widget/releases/v1.9.2/netlify-identity-widget.js">
│
└── Guacamole Integration
    └── Gated behind authentication
```

### Current Usage Points

1. **User Authentication** (`app/index.js`)
   ```javascript
   this.netlifyIdentity = window.netlifyIdentity;
   netlifyIdentity.init();
   netlifyIdentity.on('login', user => { ... });
   netlifyIdentity.on('logout', () => { ... });
   ```

2. **User Data Access**
   ```javascript
   const user = netlifyIdentity.currentUser();
   // Access: user.email, user.user_metadata, user.app_metadata
   ```

3. **Guacamole Access Control**
   - Guacamole iframe only shown to authenticated users
   - User credentials potentially passed to Guacamole

4. **UI State Management**
   - Login/logout buttons
   - User profile display
   - Protected content visibility

### Dependencies

- **Vendored Package:** `vendors/netlify-identity-widget` (v1.9.2, July 2021)
- **Service Dependency:** Netlify Identity backend API
- **Infrastructure:** Netlify hosting (required for Identity service)

---

## Migration Options Analysis

### Option 1: Supabase Auth ⭐ **RECOMMENDED**

**Why Recommended:**
- Open source fork of GoTrue (same underlying tech as Netlify Identity)
- API compatibility makes migration easier
- Active development and community
- Self-hostable option available
- Free tier generous (50,000 MAU)

**Pros:**
- Minimal code changes (similar API to GoTrue)
- Can self-host for full control
- Excellent documentation
- Built-in database integration (bonus)
- Active security updates

**Cons:**
- Need to migrate existing users
- Requires Supabase account/project
- Learning curve for Supabase platform

**Cost:**
- Free tier: Up to 50,000 monthly active users
- Pro: $25/month (100,000 MAU)
- Self-hosted: Infrastructure costs only

**Migration Complexity:** ⭐⭐⭐ (Medium)

---

### Option 2: Auth0

**Why Consider:**
- Netlify's official recommendation
- Enterprise-grade authentication
- Extensive features (MFA, social login, etc.)
- Strong security reputation

**Pros:**
- Industry standard
- Comprehensive features
- Excellent documentation
- Large community

**Cons:**
- More complex than needed for our use case
- Higher cost at scale
- Heavier SDK (larger bundle size)
- Significant code changes required

**Cost:**
- Free tier: Up to 7,500 active users
- Essentials: $35/month (500 MAU, then $0.07/user)
- More expensive than Supabase at scale

**Migration Complexity:** ⭐⭐⭐⭐ (High - different API paradigm)

---

### Option 3: Clerk

**Why Consider:**
- Modern developer experience
- Beautiful pre-built UI components
- Good React integration
- Includes user management dashboard

**Pros:**
- Excellent DX
- Beautiful default UI
- Good documentation
- Growing community

**Cons:**
- Relatively new (less mature)
- More opinionated
- Smaller ecosystem
- Cost can grow quickly

**Cost:**
- Free tier: Up to 10,000 MAU
- Pro: $25/month (then $0.02/MAU)
- Competitive pricing

**Migration Complexity:** ⭐⭐⭐⭐ (High - different architecture)

---

### Option 4: Self-Hosted GoTrue

**Why Consider:**
- Same tech as Netlify Identity (GoTrue)
- Full control
- No vendor lock-in

**Pros:**
- No migration of auth logic (same API)
- Full control
- No ongoing service costs

**Cons:**
- Must maintain infrastructure
- Security responsibility on us
- Need to handle scaling
- No managed service support

**Cost:**
- Infrastructure only (~$10-50/month for small scale)

**Migration Complexity:** ⭐⭐ (Low code changes, High ops burden)

---

### Option 5: Firebase Authentication

**Why Consider:**
- Backed by Google
- Generous free tier
- Good documentation
- Wide adoption

**Pros:**
- Reliable infrastructure
- Good free tier
- Easy social login integration
- Well documented

**Cons:**
- Google lock-in
- Different API paradigm
- Heavier client SDK
- Less control over user data

**Cost:**
- Free tier: 50,000 MAU
- Pay as you go after that

**Migration Complexity:** ⭐⭐⭐⭐ (High - different API)

---

## Recommended Migration Path: Supabase Auth

### Phase 1: Planning & Setup (2 weeks)

**Weeks 1-2:**
- [ ] Create Supabase project
- [ ] Review Supabase Auth documentation
- [ ] Design auth abstraction layer
- [ ] Plan user data migration strategy
- [ ] Create development/staging environments

**Deliverables:**
- Supabase project configured
- Auth abstraction interface designed
- Migration strategy document

---

### Phase 2: Create Auth Abstraction Layer (2 weeks)

**Weeks 3-4:**

Create provider-agnostic auth interface:

```javascript
// app/auth/AuthProvider.js (NEW)
/**
 * Abstract authentication provider interface
 * Allows swapping auth backends without changing app code
 */
class AuthProvider {
  async init() {}
  async login(email, password) {}
  async signup(email, password, metadata) {}
  async logout() {}
  async getCurrentUser() {}
  async updateUser(updates) {}
  async resetPassword(email) {}
  on(event, callback) {}
  off(event, callback) {}
}

export default AuthProvider;
```

Implement Netlify Identity adapter (maintain current functionality):

```javascript
// app/auth/NetlifyIdentityAdapter.js (NEW)
import AuthProvider from './AuthProvider.js';

class NetlifyIdentityAdapter extends AuthProvider {
  constructor() {
    super();
    this.provider = window.netlifyIdentity;
  }
  
  async init() {
    return this.provider.init();
  }
  
  async login(email, password) {
    return new Promise((resolve, reject) => {
      this.provider.open('login');
      this.provider.on('login', user => resolve(user));
      this.provider.on('error', err => reject(err));
    });
  }
  
  async getCurrentUser() {
    return this.provider.currentUser();
  }
  
  on(event, callback) {
    return this.provider.on(event, callback);
  }
  
  // ... implement all methods
}

export default NetlifyIdentityAdapter;
```

**Deliverables:**
- `AuthProvider` base class
- `NetlifyIdentityAdapter` implementation
- Unit tests for adapter

---

### Phase 3: Refactor App to Use Abstraction (2 weeks)

**Weeks 5-6:**

Update `app/index.js`:

```javascript
// OLD (current):
if (window.netlifyIdentity && typeof window.netlifyIdentity.init === "function") {
  this.netlifyIdentity = window.netlifyIdentity;
} else {
  this.netlifyIdentity = { /* fallback */ };
}

// NEW (with abstraction):
import NetlifyIdentityAdapter from './auth/NetlifyIdentityAdapter.js';

this.authProvider = new NetlifyIdentityAdapter();
this.authProvider.init();

this.authProvider.on('login', user => {
  // existing login logic
});
```

**Tasks:**
- [ ] Replace all `netlifyIdentity` references with `authProvider`
- [ ] Update UI bindings
- [ ] Test all authentication flows
- [ ] Ensure backward compatibility

**Deliverables:**
- App uses auth abstraction
- All tests passing
- No functional changes (transparent refactor)

---

### Phase 4: Implement Supabase Adapter (3 weeks)

**Weeks 7-9:**

```javascript
// app/auth/SupabaseAuthAdapter.js (NEW)
import { createClient } from '@supabase/supabase-js';
import AuthProvider from './AuthProvider.js';

class SupabaseAuthAdapter extends AuthProvider {
  constructor(supabaseUrl, supabaseKey) {
    super();
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.user = null;
    this.listeners = {};
  }
  
  async init() {
    // Get initial session
    const { data: { session } } = await this.supabase.auth.getSession();
    this.user = session?.user || null;
    
    // Subscribe to auth changes
    this.supabase.auth.onAuthStateChange((event, session) => {
      this.user = session?.user || null;
      
      if (event === 'SIGNED_IN') {
        this._emit('login', this.user);
      } else if (event === 'SIGNED_OUT') {
        this._emit('logout');
      }
    });
  }
  
  async login(email, password) {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) throw error;
    this.user = data.user;
    return this.user;
  }
  
  async signup(email, password, metadata) {
    const { data, error } = await this.supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata // user_metadata
      }
    });
    
    if (error) throw error;
    this.user = data.user;
    return this.user;
  }
  
  async logout() {
    const { error } = await this.supabase.auth.signOut();
    if (error) throw error;
    this.user = null;
  }
  
  async getCurrentUser() {
    return this.user;
  }
  
  async updateUser(updates) {
    const { data, error } = await this.supabase.auth.updateUser({
      data: updates
    });
    
    if (error) throw error;
    this.user = data.user;
    return this.user;
  }
  
  async resetPassword(email) {
    const { error } = await this.supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
  }
  
  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }
  
  off(event, callback) {
    if (!this.listeners[event]) return;
    
    if (callback) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    } else {
      this.listeners[event] = [];
    }
  }
  
  _emit(event, data) {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach(callback => callback(data));
  }
}

export default SupabaseAuthAdapter;
```

**Configuration:**

```javascript
// app/config.js updates
module.exports = {
  // ... existing config
  
  auth: {
    provider: 'supabase', // or 'netlify' during transition
    supabase: {
      url: process.env.SUPABASE_URL || 'https://your-project.supabase.co',
      anonKey: process.env.SUPABASE_ANON_KEY || 'your-anon-key'
    }
  }
};
```

**Tasks:**
- [ ] Install `@supabase/supabase-js` package
- [ ] Implement SupabaseAuthAdapter
- [ ] Add configuration for provider selection
- [ ] Create Supabase UI components (or use Supabase UI library)
- [ ] Test in development environment

**Deliverables:**
- Working Supabase authentication
- Config-based provider selection
- Tests for Supabase adapter

---

### Phase 5: User Data Migration (2 weeks)

**Weeks 10-11:**

**Export from Netlify Identity:**
1. Contact Netlify Support for user export (CSV/JSON)
2. Export format typically includes:
   - Email
   - User metadata
   - App metadata
   - Created date
   - Last sign in

**Import to Supabase:**

```javascript
// scripts/migrate-users.js (NEW)
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Service role for admin operations
);

async function migrateUsers() {
  const netlifyUsers = JSON.parse(fs.readFileSync('./netlify-users.json'));
  
  for (const user of netlifyUsers) {
    try {
      // Create user in Supabase
      const { data, error } = await supabase.auth.admin.createUser({
        email: user.email,
        email_confirm: true, // Auto-confirm migrated users
        user_metadata: user.user_metadata,
        app_metadata: user.app_metadata
      });
      
      if (error) {
        console.error(`Failed to migrate ${user.email}:`, error);
      } else {
        console.log(`Migrated ${user.email}`);
      }
    } catch (err) {
      console.error(`Error migrating ${user.email}:`, err);
    }
  }
}

migrateUsers();
```

**Migration Strategy:**
- [ ] Export users from Netlify Identity (contact support)
- [ ] Create migration script
- [ ] Test migration with subset of users
- [ ] Plan migration timing (low-traffic window)
- [ ] Prepare rollback plan

**User Communication:**
- [ ] Notify users of upcoming auth system change
- [ ] Password reset will be required (security best practice)
- [ ] Provide migration timeline

**Deliverables:**
- User migration script
- Tested migration process
- Communication plan

---

### Phase 6: Parallel Operation (2 weeks)

**Weeks 12-13:**

Support both auth providers during transition:

```javascript
// app/auth/AuthFactory.js (NEW)
import NetlifyIdentityAdapter from './NetlifyIdentityAdapter.js';
import SupabaseAuthAdapter from './SupabaseAuthAdapter.js';
import config from '../config.js';

class AuthFactory {
  static create() {
    switch (config.auth.provider) {
      case 'supabase':
        return new SupabaseAuthAdapter(
          config.auth.supabase.url,
          config.auth.supabase.anonKey
        );
      
      case 'netlify':
      default:
        return new NetlifyIdentityAdapter();
    }
  }
}

export default AuthFactory;
```

**Tasks:**
- [ ] Deploy with Supabase enabled for beta testers
- [ ] Monitor error rates and issues
- [ ] Collect user feedback
- [ ] Fix issues discovered

**Deliverables:**
- Production deployment with both providers
- Monitoring dashboard
- Issue tracking

---

### Phase 7: Cutover & Cleanup (2 weeks)

**Weeks 14-15:**

**Cutover Plan:**
1. **Week 14 Day 1:** Switch default to Supabase
2. **Week 14 Days 2-7:** Monitor closely, be ready to rollback
3. **Week 15:** If stable, remove Netlify Identity code

**Cleanup Tasks:**
- [ ] Switch default auth provider to Supabase
- [ ] Monitor production for issues
- [ ] After 1 week stable: Remove Netlify Identity adapter
- [ ] Remove netlify-identity-widget from vendors/
- [ ] Update documentation
- [ ] Remove Netlify Identity configuration

**Rollback Plan:**
If issues arise:
```javascript
// Quick rollback: change config
auth: {
  provider: 'netlify', // Switch back
}
```

**Deliverables:**
- Production running on Supabase
- Netlify Identity code removed (if successful)
- Updated documentation

---

## Testing Strategy

### Unit Tests
```javascript
// test/auth/SupabaseAuthAdapter.test.js
describe('SupabaseAuthAdapter', () => {
  it('should initialize and get session', async () => {
    const adapter = new SupabaseAuthAdapter(url, key);
    await adapter.init();
    expect(adapter.supabase).toBeDefined();
  });
  
  it('should handle login', async () => {
    const adapter = new SupabaseAuthAdapter(url, key);
    const user = await adapter.login('test@example.com', 'password');
    expect(user.email).toBe('test@example.com');
  });
  
  // ... more tests
});
```

### Integration Tests
- [ ] End-to-end login flow
- [ ] Logout flow
- [ ] Session persistence across page reloads
- [ ] Protected routes work correctly
- [ ] User metadata accessible

### User Acceptance Testing
- [ ] Beta test with 5-10 users
- [ ] Test on multiple browsers
- [ ] Test mobile experience
- [ ] Verify email flows (signup, password reset)

---

## Security Considerations

### During Migration
1. **Password Security:**
   - Cannot migrate passwords (hashed differently)
   - Require password reset for all users
   - Send secure reset emails

2. **Session Management:**
   - Invalidate old Netlify sessions on cutover
   - Implement proper JWT validation
   - Set appropriate session timeouts

3. **Data Privacy:**
   - Ensure user data encrypted in transit
   - Verify GDPR compliance in new provider
   - Update privacy policy

### Post-Migration
1. **Enable MFA** (if supported by chosen provider)
2. **Implement rate limiting** on auth endpoints
3. **Monitor for suspicious auth activity**
4. **Regular security audits**

---

## Rollback Strategy

### If Migration Fails

**Immediate Rollback (< 24 hours):**
```bash
# Change config to use Netlify
sed -i "s/provider: 'supabase'/provider: 'netlify'/" app/config.js
npm run build
# Deploy
```

**Data Rollback:**
- Keep Netlify Identity enabled for 30 days post-cutover
- Don't delete Netlify Identity data until fully stable
- Maintain parallel operation capability for 1 month

**Communication Plan:**
- Notify users immediately if rollback occurs
- Explain reason and new timeline
- Maintain trust through transparency

---

## Cost Analysis

### Current (Netlify Identity)
- **Cost:** Included with Netlify hosting
- **User Limit:** Unknown (generous)
- **Risk:** Deprecated, no bug fixes

### After Migration (Supabase)

**Estimated Usage:**
- Assumption: 1,000 monthly active users (Year 1)

**Supabase Free Tier:**
- 50,000 MAU - **FREE**
- Covers us for significant growth

**If We Exceed Free Tier:**
- Pro Plan: $25/month (100,000 MAU)
- Still very cost-effective

**5-Year Total Cost:**
- Years 1-2: $0 (free tier)
- Years 3-5: $300/year ($25/month)
- **Total: ~$900** (vs unknown with deprecated service)

---

## Success Metrics

### Migration Success Criteria
- [ ] Zero data loss during migration
- [ ] < 1% user complaints about auth
- [ ] Auth response time < 500ms (p95)
- [ ] 99.9% uptime post-migration
- [ ] All existing functionality works

### Post-Migration KPIs
- **Authentication Success Rate:** > 99%
- **Login Time:** < 2 seconds
- **Session Persistence:** 100%
- **User Satisfaction:** > 4/5 stars

---

## Timeline Summary

| Phase | Duration | Weeks | Status |
|-------|----------|-------|--------|
| 1. Planning & Setup | 2 weeks | 1-2 | ⏳ Not Started |
| 2. Auth Abstraction Layer | 2 weeks | 3-4 | ⏳ Not Started |
| 3. Refactor App | 2 weeks | 5-6 | ⏳ Not Started |
| 4. Supabase Implementation | 3 weeks | 7-9 | ⏳ Not Started |
| 5. User Migration | 2 weeks | 10-11 | ⏳ Not Started |
| 6. Parallel Operation | 2 weeks | 12-13 | ⏳ Not Started |
| 7. Cutover & Cleanup | 2 weeks | 14-15 | ⏳ Not Started |
| **TOTAL** | **15 weeks** | **~4 months** | |

**Target Completion:** End of Q1 2026 (March 2026)

---

## Action Items (Next Steps)

### Immediate (This Week)
- [x] Document migration plan (this document)
- [ ] Review and approve migration approach
- [ ] Create Supabase account and test project
- [ ] Schedule kickoff meeting

### Next 2 Weeks
- [ ] Finalize Supabase project setup
- [ ] Design auth abstraction interface
- [ ] Get team buy-in on timeline
- [ ] Allocate development resources

### Month 1
- [ ] Implement auth abstraction layer
- [ ] Create Netlify Identity adapter
- [ ] Refactor app to use abstraction

---

## Alternatives Considered & Rejected

### Why Not Auth0?
- **Cost:** More expensive at scale
- **Complexity:** Overkill for our use case
- **Bundle Size:** Heavier SDK than needed

### Why Not Self-Hosted GoTrue?
- **Ops Burden:** Don't want to maintain auth infrastructure
- **Security Risk:** Auth is critical, prefer managed service
- **Time:** Would delay migration significantly

### Why Not Stay on Netlify Identity?
- **Deprecated:** No bug fixes, only security patches
- **Risk:** Could be shut down entirely
- **Uncertainty:** Unknown long-term viability

---

## Resources & Documentation

### Supabase Auth Docs
- [Supabase Auth Overview](https://supabase.com/docs/guides/auth)
- [Auth Helpers](https://supabase.com/docs/guides/auth/auth-helpers)
- [Migration from Other Providers](https://supabase.com/docs/guides/auth/auth-migration)

### Netlify Identity
- [Deprecation Notice](https://docs.netlify.com/manage/security/secure-access-to-sites/identity/overview/)
- [Current Implementation](https://github.com/netlify/netlify-identity-widget)

### Internal Docs
- [TECHNICAL_DEBT_ANALYSIS.md](../TECHNICAL_DEBT_ANALYSIS.md) - Item #19
- [vendors/netlify-identity-widget/VENDOR_STATUS.md](../vendors/netlify-identity-widget/VENDOR_STATUS.md)

---

## Questions & Decisions Needed

### Open Questions
1. **User Communication:** When and how to notify existing users?
2. **Password Reset:** Force password reset for all users or allow optional?
3. **Branding:** Use Supabase default UI or build custom?
4. **Social Login:** Should we add Google/GitHub OAuth during migration?

### Decisions Required
- [ ] Approve migration to Supabase (vs other options)
- [ ] Approve 4-month timeline
- [ ] Approve budget (Supabase Pro if needed: $25/month)
- [ ] Assign development team

---

## Contacts & Stakeholders

**Project Owner:** TBD  
**Technical Lead:** TBD  
**Migration Team:** TBD

**External:**
- Netlify Support (for user export)
- Supabase Support (for migration assistance)

---

**Document Status:** 📝 Draft  
**Last Updated:** October 11, 2025  
**Next Review:** November 1, 2025
