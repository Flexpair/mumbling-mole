# Authentication Abstraction Layer

This directory contains the authentication abstraction layer for Mumbling Mole. The abstraction allows switching between different authentication providers (Netlify Identity, Supabase, Auth0, etc.) without changing application code.

## 🎯 Purpose

**Problem:** Netlify Identity is deprecated. We need to migrate to a new auth provider.

**Solution:** Create an abstraction layer that:
- Defines a common interface for all auth providers
- Wraps current Netlify Identity implementation
- Allows evaluating and switching providers easily
- Maintains backward compatibility during migration

## 📁 Files

### Core Abstraction

- **`AuthProvider.js`** - Abstract base class defining the auth interface
  - All auth providers must implement this interface
  - Ensures consistent API across providers

- **`AuthFactory.js`** - Factory for creating auth provider instances
  - Reads config to determine which provider to use
  - Allows switching providers via configuration

### Adapters

- **`NetlifyIdentityAdapter.js`** - Wraps Netlify Identity (current provider)
  - Implements AuthProvider interface
  - Maintains backward compatibility
  - Status: ✅ Implemented

- **`MockAuthAdapter.js`** - Mock auth for testing
  - No real authentication
  - Useful for automated tests
  - Status: ✅ Implemented

### Future Adapters (To Be Implemented)

- **`SupabaseAuthAdapter.js`** - Supabase Auth integration
- **`Auth0Adapter.js`** - Auth0 integration
- **`FirebaseAuthAdapter.js`** - Firebase Auth integration

## 🚀 Usage

### Basic Usage

```javascript
// app/index.js
import AuthFactory from './auth/AuthFactory.js';

// Create auth provider (reads from config.js)
const auth = AuthFactory.create();

// Initialize
await auth.init();

// Listen for events
auth.on('login', user => {
  console.log('User logged in:', user.email);
});

auth.on('logout', () => {
  console.log('User logged out');
});

// Get current user
const user = await auth.getCurrentUser();

// Open login UI
await auth.openAuth('login');

// Logout
await auth.logout();
```

### Configuration

In `app/config.js`:

```javascript
module.exports = {
  // ... other config
  
  auth: {
    // Current provider
    provider: 'netlify',
    
    // Provider-specific options (for future providers)
    options: {}
  }
};
```

### Switching Providers

To switch from Netlify Identity to Supabase:

```javascript
// 1. Update config.js
auth: {
  provider: 'supabase',
  options: {
    url: 'https://your-project.supabase.co',
    anonKey: 'your-anon-key'
  }
}

// 2. That's it! App code doesn't change.
```

## 🔌 AuthProvider Interface

All auth providers must implement these methods:

### Initialization
- `async init()` - Initialize the auth system

### User Management
- `async getCurrentUser()` - Get currently authenticated user
- `async isAuthenticated()` - Check if user is logged in

### Authentication Actions
- `async openAuth(view)` - Open login/signup UI
- `async closeAuth()` - Close auth UI
- `async login(email, password)` - Log in user
- `async signup(email, password, metadata)` - Create new user
- `async logout()` - Log out current user

### User Updates
- `async updateUser(updates)` - Update user metadata
- `async requestPasswordReset(email)` - Send password reset email
- `async refreshToken()` - Refresh JWT token

### Events
- `on(event, callback)` - Register event listener
- `off(event, callback)` - Unregister event listener

### Standard Events
- `'init'` - Auth system initialized
- `'login'` - User logged in
- `'logout'` - User logged out
- `'error'` - Error occurred
- `'open'` - Auth UI opened
- `'close'` - Auth UI closed

## 🧪 Testing

### Using Mock Adapter

```javascript
import MockAuthAdapter from './auth/MockAuthAdapter.js';

// Create mock auth
const auth = new MockAuthAdapter({
  autoLogin: true,  // Auto-login on init
  autoLoginDelay: 0 // No delay
});

await auth.init();

// Test users available:
// - test@example.com / password123
// - admin@example.com / admin123
// - user@example.com / user123

await auth.login('test@example.com', 'password123');
const user = await auth.getCurrentUser();
console.log(user); // Mock user object
```

## 📝 Migration Roadmap

### Phase 1: Abstraction (Current) ✅
- [x] Create AuthProvider interface
- [x] Create NetlifyIdentityAdapter
- [x] Create MockAuthAdapter
- [x] Create AuthFactory

### Phase 2: Integration (Next)
- [ ] Update app/index.js to use AuthFactory
- [ ] Replace all `netlifyIdentity` calls with `auth`
- [ ] Test with NetlifyIdentityAdapter (no functional changes)

### Phase 3: Evaluation
- [ ] Research Supabase Auth
- [ ] Research Auth0
- [ ] Research Firebase Auth
- [ ] Compare features, pricing, migration effort
- [ ] Make decision on target provider

### Phase 4: Implementation
- [ ] Implement chosen adapter (e.g., SupabaseAuthAdapter)
- [ ] Test in development environment
- [ ] Create user migration script

### Phase 5: Migration
- [ ] Run in parallel (both providers)
- [ ] Migrate users
- [ ] Switch default provider
- [ ] Monitor for issues
- [ ] Remove Netlify Identity adapter

## 🔍 Provider Comparison

### Current: Netlify Identity
- ✅ Currently working
- ❌ **Deprecated** (security fixes only)
- ❌ No bug fixes
- ⚠️ Could be shut down

### Option 1: Supabase Auth ⭐ Recommended
- ✅ Open source GoTrue fork
- ✅ Similar API to Netlify Identity
- ✅ Active development
- ✅ Self-hostable
- ✅ Free tier: 50,000 MAU
- ✅ Easy migration

### Option 2: Auth0
- ✅ Enterprise-grade
- ✅ Netlify's recommendation
- ⚠️ More expensive
- ⚠️ More complex
- ⚠️ Larger bundle size

### Option 3: Firebase Auth
- ✅ Backed by Google
- ✅ Good free tier
- ⚠️ Google lock-in
- ⚠️ Different API

## 📚 Resources

- [Migration Plan](../../docs/NETLIFY_IDENTITY_MIGRATION_PLAN.md) - Complete migration strategy
- [Technical Debt Analysis](../../TECHNICAL_DEBT_ANALYSIS.md#19-netlify-identity-integration-is-hardcoded) - Item #19
- [Vendor Status](../../vendors/netlify-identity-widget/VENDOR_STATUS.md) - Deprecation notice

## 🤝 Contributing

### Adding a New Provider

1. Create adapter file: `app/auth/YourProviderAdapter.js`
2. Extend `AuthProvider` class
3. Implement all required methods
4. Add to `AuthFactory.getSupportedProviders()`
5. Add factory case in `AuthFactory.create()`
6. Update this README
7. Test thoroughly

### Example Template

```javascript
import AuthProvider from './AuthProvider.js';

class YourProviderAdapter extends AuthProvider {
  constructor(options) {
    super();
    // Initialize provider
  }

  async init() {
    // Implement initialization
  }

  async getCurrentUser() {
    // Implement get current user
  }

  // ... implement all other methods
}

export default YourProviderAdapter;
```

## ❓ Questions?

See the full migration plan: [docs/NETLIFY_IDENTITY_MIGRATION_PLAN.md](../../docs/NETLIFY_IDENTITY_MIGRATION_PLAN.md)

---

**Status:** 🚧 Phase 1 Complete - Ready for Phase 2 (App Integration)  
**Last Updated:** October 11, 2025
