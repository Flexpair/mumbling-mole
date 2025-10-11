# Authentication Abstraction Layer

Provider-agnostic authentication system for mumbling-mole.

## 🎯 Purpose

This authentication abstraction layer provides a unified interface for different authentication providers, enabling seamless migration from Netlify Identity (deprecated) to modern auth services without changing application code.

## ⚠️ Context: Netlify Identity Deprecation

**Official Netlify Statement** (2025):
> "Netlify Identity service and the underlying GoTrue API are deprecated. While Identity and GoTrue continue to function for sites that currently have them enabled, new Identity or GoTrue configurations are not recommended. While we will keep fixing any major security issues that arise, we will no longer fix bugs in the functionality of Identity or GoTrue."

**Netlify's Official Recommendations:**
- For **Netlify Identity replacement**: [Auth0](https://docs.netlify.com/extend/install-and-use/setup-guides/auth0/)
- For **GoTrue replacement**: [Supabase Auth](https://github.com/supabase/auth) (actively maintained fork)

**Source**: https://docs.netlify.com/security/secure-access-to-sites/identity/

## 🚀 Migration Decision: Supabase Auth

After evaluation, **Supabase Auth** has been chosen as the migration target:

### Why Supabase?

✅ **Officially recommended by Netlify** as GoTrue replacement  
✅ **GoTrue-based** - Similar API to Netlify Identity (easier migration)  
✅ **Open source** - No vendor lock-in (MIT license)  
✅ **Active development** - Regular updates and security patches  
✅ **Generous free tier** - 50,000 MAU free forever  
✅ **Similar feature set** - Email, OAuth, MFA, etc.  

### Resources

- **Supabase Auth Docs**: https://supabase.com/docs/guides/auth
- **Pricing**: https://supabase.com/docs/guides/platform/manage-your-usage/monthly-active-users
- **GitHub**: https://github.com/supabase/auth
- **Migration Plan**: See `docs/NETLIFY_IDENTITY_MIGRATION_PLAN.md`

## 📊 Current Implementation Status

### Phase 1: Auth Abstraction Layer ✅ COMPLETE
- ✅ `AuthProvider` base class defining unified interface
- ✅ `NetlifyIdentityAdapter` wrapping current provider
- ✅ `MockAuthAdapter` for testing
- ✅ `AuthFactory` for config-based provider selection
- ✅ Comprehensive test suite

### Phase 2: Application Integration ✅ COMPLETE
- ✅ Integrated into `app/index.js`
- ✅ Added auth config to `config.js`
- ✅ Backward compatibility maintained (`this.netlifyIdentity` alias)
- ✅ Browser-tested and working

### Phase 3: Supabase Evaluation ⏳ PENDING
- ⏳ Create Supabase account
- ⏳ Set up test project
- ⏳ Build prototype `SupabaseAuthAdapter`
- ⏳ Test authentication flows

### Phase 4: Implementation ⏳ PENDING
- ⏳ Implement full `SupabaseAuthAdapter`
- ⏳ Add to `AuthFactory`
- ⏳ Test all auth flows (login, signup, logout, etc.)
- ⏳ Update configuration examples

### Phase 5: Migration ⏳ PENDING (Target: Q1 2026)
- ⏳ Export users from Netlify Identity (contact Netlify Support)
- ⏳ Import users to Supabase
- ⏳ Update production config
- ⏳ Monitor and verify
- ⏳ Deprecate Netlify Identity

## 🛠️ Currently Implemented Providers

### NetlifyIdentityAdapter (Production)

Wraps the existing Netlify Identity widget.

**Status**: Active (deprecated upstream)  
**Config**:
```javascript
{
  provider: 'netlify',
  netlify: {
    APIUrl: 'https://welcome.flexpair.com/identity-proxy',
    locale: 'en',
    logo: false
  }
}
```

**Features**:
- Modal-based authentication
- Email/password login
- OAuth providers (Google, GitHub, etc.)
- User metadata management
- Backward compatible with legacy code

### MockAuthAdapter (Testing)

Fake authentication for testing without real backend.

**Status**: Testing only  
**Config**:
```javascript
{
  provider: 'mock'
}
```

**Features**:
- Pre-loaded test users
- Simulated delays
- Event system testing
- Error simulation
- No backend required

## 📚 Usage Guide

### Basic Setup

```javascript
import AuthFactory from './auth/AuthFactory.js';

// Create auth instance from config
const auth = AuthFactory.create(window.mumbleWebConfig.auth);

// Initialize
await auth.init(window.mumbleWebConfig.auth?.netlify || {});

// Listen for events
auth.on('login', (user) => {
  console.log('User logged in:', user.email);
});

auth.on('logout', () => {
  console.log('User logged out');
});

auth.on('error', (error) => {
  console.error('Auth error:', error);
});

// Get current user (synchronous)
const user = auth.currentUser();

// Or async version
const user = await auth.getCurrentUser();
```

### Configuration

In `app/config.js`:

```javascript
window.mumbleWebConfig = {
  // ... other config
  auth: {
    provider: 'netlify', // 'netlify', 'mock', or 'supabase' (future)
    netlify: {
      APIUrl: 'https://welcome.flexpair.com/identity-proxy',
      locale: 'en',
      logo: false
    },
    // Future Supabase config:
    // supabase: {
    //   url: 'https://your-project.supabase.co',
    //   anonKey: 'your-anon-key'
    // }
  }
};
```

### Application Integration

The auth abstraction is integrated in `app/index.js`:

```javascript
// In GlobalBindings constructor
try {
  this.auth = AuthFactory.create(window.mumbleWebConfig.auth || { provider: 'netlify' });
} catch (error) {
  console.warn('[Auth] Failed to initialize:', error);
  this.auth = AuthFactory.create({ provider: 'mock' });
}

// Backward compatibility
this.netlifyIdentity = this.auth;
```

## 🔌 Provider API Reference

All providers implement the `AuthProvider` base class:

### Initialization
- `async init(config)` - Initialize the auth provider with configuration

### User Management
- `async getCurrentUser()` - Get currently authenticated user (async)
- `currentUser()` - Get currently authenticated user (sync, for backward compatibility)
- `isAuthenticated()` - Check if user is authenticated
- `async login(email, password)` - Log in a user
- `async logout()` - Log out current user
- `async signup(email, password, metadata)` - Sign up new user
- `async updateUser(updates)` - Update user metadata

### UI Methods (Provider-Specific)
- `async openAuth(view)` - Open auth UI modal
- `open(view)` - Open auth UI modal (sync)
- `async closeAuth()` - Close auth UI modal
- `close()` - Close auth UI modal (sync)

### Token Management
- `async refreshToken()` - Refresh JWT token
- `async requestPasswordReset(email)` - Request password reset

### Event System
- `on(event, callback)` - Register event listener
- `off(event, callback)` - Unregister event listener

**Supported Events**: `login`, `logout`, `signup`, `error`, `close`

### Metadata
- `getProviderName()` - Get provider identifier string

## 🧪 Testing

### Automated Test Suite

```bash
# Run all auth abstraction tests
bash scripts/test-auth-abstraction.sh
```

**Tests include**:
- ✅ Provider initialization
- ✅ Login/logout flows
- ✅ User state management
- ✅ Event system
- ✅ Error handling

### Manual Browser Testing

1. Build the project: `npm run build`
2. Start dev server: `./start-dev-server.sh`
3. Open browser console
4. Check auth initialization: `window.mumbleUi.auth`
5. Test authentication flows through UI

### Testing with MockAuthAdapter

```javascript
import MockAuthAdapter from './auth/MockAuthAdapter.js';

const auth = new MockAuthAdapter();
await auth.init();

// Pre-loaded test users
await auth.login({ email: 'test@example.com', password: 'test123' });
await auth.login({ email: 'admin@example.com', password: 'admin123' });

// Test helpers
auth.reset(); // Reset to initial state
auth.simulateError('Test error'); // Trigger error event
```

## 🔄 Adding a New Provider (e.g., Supabase)

### Step 1: Create Adapter

Create `app/auth/SupabaseAuthAdapter.js`:

```javascript
import AuthProvider from './AuthProvider.js';
import { createClient } from '@supabase/supabase-js';

class SupabaseAuthAdapter extends AuthProvider {
  constructor() {
    super();
    this.supabase = null;
    this.currentUserCache = null;
  }

  async init(config) {
    this.supabase = createClient(config.url, config.anonKey);
    
    // Listen to auth state changes
    this.supabase.auth.onAuthStateChange((event, session) => {
      this.currentUserCache = session?.user || null;
      this._emit(event, session?.user);
    });
    
    // Get initial session
    const { data } = await this.supabase.auth.getSession();
    this.currentUserCache = data.session?.user || null;
  }

  async getCurrentUser() {
    return this.currentUserCache;
  }

  currentUser() {
    return this.currentUserCache;
  }

  async login(email, password) {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
    return data.user;
  }

  async logout() {
    const { error } = await this.supabase.auth.signOut();
    if (error) throw error;
  }

  async signup(email, password, metadata = {}) {
    const { data, error } = await this.supabase.auth.signUp({
      email,
      password,
      options: { data: metadata }
    });
    if (error) throw error;
    return data.user;
  }

  isAuthenticated() {
    return !!this.currentUserCache;
  }

  getProviderName() {
    return 'supabase';
  }
}

export default SupabaseAuthAdapter;
```

### Step 2: Register in Factory

Update `app/auth/AuthFactory.js`:

```javascript
import SupabaseAuthAdapter from './SupabaseAuthAdapter.js';

class AuthFactory {
  static create(config = {}) {
    const provider = config.provider || 'netlify';
    
    switch (provider) {
      case 'supabase':
        return new SupabaseAuthAdapter();
      case 'netlify':
        return new NetlifyIdentityAdapter();
      case 'mock':
        return new MockAuthAdapter();
      default:
        throw new Error(`Unknown auth provider: ${provider}`);
    }
  }
  
  static getSupportedProviders() {
    return ['netlify', 'mock', 'supabase'];
  }
}
```

### Step 3: Update Config

Add Supabase config to `app/config.js`:

```javascript
auth: {
  provider: 'supabase',
  supabase: {
    url: 'https://your-project.supabase.co',
    anonKey: 'your-anon-key'
  }
}
```

### Step 4: Test

```bash
npm run build
bash scripts/test-auth-abstraction.sh
```

## 📁 File Structure

```
app/auth/
├── README.md                    # This file
├── AuthProvider.js              # Base class (155 lines)
├── AuthFactory.js               # Provider factory (105 lines)
├── NetlifyIdentityAdapter.js    # Netlify implementation (250 lines)
├── MockAuthAdapter.js           # Testing implementation (334 lines)
└── index.js                     # Central exports (18 lines)

Related files:
├── app/config.js                # Auth configuration
├── app/index.js                 # Application integration
├── docs/NETLIFY_IDENTITY_MIGRATION_PLAN.md  # 15-week migration plan
├── scripts/test-auth-abstraction.sh         # Test suite
└── AUTH_ABSTRACTION_SUMMARY.md             # Implementation summary
```

## 🐛 Troubleshooting

### Auth provider not initializing

**Symptom**: Console error about auth initialization  
**Fix**: Check that `window.mumbleWebConfig.auth` is properly set in config.js

### Netlify Identity 404 errors

**Symptom**: `GET /.netlify/identity/settings 404`  
**Cause**: Config not passed to `netlifyIdentity.init()`  
**Fix**: Ensure `init(config)` method receives and passes config object

### Events not firing

**Symptom**: Event callbacks not called  
**Fix**: Register listeners BEFORE calling auth methods:

```javascript
auth.on('login', handleLogin);  // Register first
await auth.login(email, password);  // Then call
```

### User metadata missing

**Symptom**: `user.user_metadata` is undefined  
**Fix**: Add null checks before accessing:

```javascript
if (user && user.user_metadata && user.user_metadata.full_name) {
  // Safe to use
}
```

## 📈 Migration Timeline

**Current Status**: Phase 2 Complete (October 2025)

**Next Milestones**:
- **November 2025**: Evaluate Supabase, create test project
- **December 2025**: Implement SupabaseAuthAdapter
- **January 2026**: Testing and refinement
- **February 2026**: User migration preparation
- **March 2026**: Production cutover
- **April 2026**: Deprecate Netlify Identity

See `docs/NETLIFY_IDENTITY_MIGRATION_PLAN.md` for detailed 15-week plan.

## 💰 Cost Comparison

| Provider | Free Tier | Paid Plans | Notes |
|----------|-----------|------------|-------|
| **Netlify Identity** | 1,000 MAU | $99/mo (up to 5k MAU) | Deprecated |
| **Supabase Auth** | 50,000 MAU | $25/mo + $0.00325/MAU | Recommended |
| **Auth0** | 7,500 MAU | $35/mo (Essentials) | Enterprise option |
| **Firebase Auth** | 50,000 MAU | Pay-as-you-go | Google ecosystem |

**Current usage**: ~500-1000 MAU  
**Recommendation**: Supabase (free tier sufficient)

## 🔗 External Resources

- **Netlify Deprecation Notice**: https://docs.netlify.com/security/secure-access-to-sites/identity/
- **Supabase Auth Docs**: https://supabase.com/docs/guides/auth
- **Supabase Auth GitHub**: https://github.com/supabase/auth
- **Auth0 Extension Guide**: https://docs.netlify.com/extend/install-and-use/setup-guides/auth0/

## 📝 Contributing

When adding new providers:
1. Extend `AuthProvider` base class
2. Implement all required methods
3. Add synchronous compatibility methods if needed
4. Register in `AuthFactory`
5. Add configuration example
6. Update this README
7. Add tests to test suite

## 📄 License

Same as parent project (mumbling-mole).
