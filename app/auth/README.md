# Authentication Abstraction Layer

Provider-agnostic authentication system for mumbling-mole.

## Purpose

This authentication abstraction layer provides a unified interface for different authentication providers. The current production provider is **Netlify Identity**. The abstraction enables future migration to other auth services without changing application code.

## Netlify Identity Status

**Netlify Identity is fully supported.** Although a deprecation was announced in 2025, Netlify reversed that decision in February 2026 after community feedback. Identity remains a first-class Netlify service with ongoing reliability and security updates.

**Source**: https://www.netlify.com/blog/auth0-extension-identity-changes/

Auth0 is available as an alternative for teams needing enterprise features (MFA, SSO), but migration is **not required**.

## Architecture

```
Application code
     |
  AuthProvider interface (common API)
     |
  NetlifyIdentityAdapter (production)
```

### Files

```
app/auth/
  AuthProvider.js              Abstract base class
  NetlifyIdentityAdapter.js    Netlify Identity implementation
  AuthFactory.js               Config-based provider factory
  index.js                     Barrel exports
  credentials-service.js       Server-side credential fetch after JWT validation
  README.md                    This file

Related:
  app/config.js                Auth configuration (APIUrl, locale, logo)
  app/index.html               Widget script + hash-preservation inline script
  app/index.js                 Auth initialization + event wiring
  auth-server/server.py        Server-side JWT validation
```

## Identity Proxy and Hash Token Preservation

### Why the identity-proxy exists

The Netlify Identity widget makes POST requests (login, signup, token verify, etc.) to the GoTrue API. When the app is hosted on a different domain than the Netlify site (`public-playground.flexpair.app` vs `welcome.flexpair.com`), the direct `/.netlify/identity/` endpoints only allow GET via CORS. The proxy at `https://welcome.flexpair.com/identity-proxy` adds the correct CORS headers for all HTTP methods.

### Hash token preservation (recovery, confirmation, invite)

Netlify Identity uses URL hash fragments for callback tokens:
- `#recovery_token=...` (password reset)
- `#confirmation_token=...` (email confirmation)
- `#invite_token=...` (invitation acceptance)

**Problem**: The widget auto-processes these tokens when its script executes (`defer`). At that point, `init()` has not yet been called, so the widget doesn't know the correct API URL. It falls back to `/.netlify/identity/` on the current host, which fails (501/404). The token is consumed and cleared from the URL, so it's lost.

**Solution** (two parts):

1. **`index.html` inline script** (runs before widget loads):
   Detects identity tokens in the hash, saves them to `window.__savedIdentityHash`, and clears the hash via `history.replaceState()`. The widget loads and finds no token.

2. **`NetlifyIdentityAdapter.init()`** (runs after widget loads):
   Restores the saved hash right before calling `netlifyIdentity.init(config)`. The widget's `init()` finds the token and processes it with the correctly configured API URL.

3. **`hasIdentityTokenInHash()` in `index.js`**:
   Checks both the live hash and the stashed `__savedIdentityHash` to decide whether to skip opening the signup modal. Without this, `auth.open("signup")` would override the widget's recovery/confirmation modal.

## Configuration

In `app/config.js`:

```javascript
auth: {
  provider: 'netlify',
  netlify: {
    APIUrl: 'https://welcome.flexpair.com/identity-proxy',
    locale: 'en',
    logo: false
  }
}
```

The `APIUrl` must point to the identity proxy, not the Netlify site directly.

## Provider API Reference

All providers implement the `AuthProvider` base class:

### Initialization
- `async init(config)` — Initialize the auth provider

### User Management
- `async getCurrentUser()` — Get authenticated user (async)
- `currentUser()` — Get authenticated user (sync)
- `isAuthenticated()` — Check auth status
- `async login(email, password)` — Log in
- `async logout()` — Log out
- `async signup(email, password, metadata)` — Sign up
- `async updateUser(updates)` — Update user metadata

### UI Methods
- `open(view)` / `async openAuth(view)` — Open auth modal (`'login'`, `'signup'`, `'recover'`)
- `close()` / `async closeAuth()` — Close auth modal

### Token Management
- `async refreshToken()` — Refresh JWT token
- `async requestPasswordReset(email)` — Open recovery modal

### Event System
- `on(event, callback)` — Register listener (can be called before `init()`)
- `off(event, callback)` — Unregister listener

**Events**: `login`, `logout`, `signup`, `error`, `close`

### Metadata
- `getProviderName()` — Returns `'Netlify Identity'`

## Usage

```javascript
import AuthFactory from './auth/AuthFactory.js';

const auth = AuthFactory.create(window.mumbleWebConfig.auth);
await auth.init(window.mumbleWebConfig.auth?.netlify || {});

auth.on('login', (user) => console.log('Logged in:', user.email));
auth.on('logout', () => console.log('Logged out'));
auth.on('error', (error) => console.error('Auth error:', error));

const user = auth.currentUser();
```

## Adding a New Provider

1. Create `app/auth/YourAdapter.js` extending `AuthProvider`
2. Implement all required methods
3. Register in `AuthFactory.js`
4. Add configuration to `config.js`
5. Update this README
6. Add tests

## Troubleshooting

### `GET /.netlify/identity/settings` 404 or 501

**Cause**: Widget trying to reach identity endpoints on the current host instead of the proxy.
**Fix**: Ensure `init(config)` receives the config with `APIUrl` pointing to the identity-proxy. If this happens during hash token processing, verify the inline script in `index.html` is saving and clearing the hash before the widget loads.

### Recovery/confirmation/invite link shows signup instead of expected modal

**Cause**: `auth.open("signup")` in `index.js` overrides the widget's token-triggered modal.
**Fix**: `hasIdentityTokenInHash()` should return `true` for the token in the URL. Check that the inline script in `index.html` is stashing the hash to `__savedIdentityHash` and that `hasIdentityTokenInHash()` checks both sources.

### Events not firing

Register listeners before calling auth methods. Listeners registered before `init()` are queued and attached automatically.

### CORS errors on identity requests

The direct `/.netlify/identity/` endpoint only allows GET from cross-origin. All auth requests must go through the identity-proxy. Check that `APIUrl` in config points to the proxy.
