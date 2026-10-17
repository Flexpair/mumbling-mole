# Authentication Abstraction Layer

Mumbling Mole uses a provider boundary so application code does not depend directly on the browser authentication SDK. The current implementation is the Netlify Identity adapter.

## Current provider

- `NetlifyIdentityAdapter.js` wraps the Netlify Identity widget.
- `AuthFactory.js` creates the configured provider.
- `credentials-service.js` requests server-side credentials after the server validates the Identity JWT.
- The adapter is configured by `app/config.js` and initialized from `app/index.js`.

The current provider configuration uses the Flexpair identity proxy:

The equivalent non-secret configuration is kept in `app/config.js`; do not copy live deployment configuration or credentials into documentation.

`APIUrl` must point to the identity proxy. Do not replace it with a direct cross-origin `/.netlify/identity/` URL: the proxy supplies the CORS behavior required for login, signup, verification, recovery, and invitation requests.

## Token-hash handling

Netlify Identity puts callback tokens in the URL fragment:

- `#recovery_token=...`
- `#confirmation_token=...`
- `#invite_token=...`

The widget script is deferred and can process a hash before the application has initialized the adapter. `app/index.html` therefore saves an Identity hash in `window.__savedIdentityHash` and removes it from the visible URL. `NetlifyIdentityAdapter.init()` restores the saved hash immediately before widget initialization. The application also checks both the live hash and the saved hash before opening another authentication view.

This keeps recovery, confirmation, and invitation flows on the configured identity proxy and prevents the token from being consumed by an unconfigured widget.

## Provider API

All providers implement the `AuthProvider` interface.

### Initialization and identity

- `async init(config)`
- `async getCurrentUser()`
- `currentUser()`
- `isAuthenticated()`
- `getProviderName()`

### User actions

- `async login(email, password)`
- `async logout()`
- `async signup(email, password, metadata)`
- `async updateUser(updates)`
- `async refreshToken()`
- `async requestPasswordReset(email)`

### UI and events

- `open(view)` / `async openAuth(view)`
- `close()` / `async closeAuth()`
- `on(event, callback)`
- `off(event, callback)`

Supported events are `login`, `logout`, `signup`, `error`, and `close`. Event listeners may be registered before `init()`; the adapter attaches them once initialization completes.

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

## Local and browser tests

The Playwright configuration loads `.env.test` for the local test account and runs against `https://local.flexpair.app` by default. Keep that file untracked and do not copy passwords, tokens, or other credential values into this README, test output, or issue comments.

Run the authentication browser test with:

```bash
npm run test:auth
```

The Python auth-server tests can be run independently with:

```bash
npm run test:python
```

## Troubleshooting

### Identity requests return 404, 501, or CORS errors

Check that `APIUrl` is the identity proxy and that the browser is using the current application configuration. A direct cross-origin Netlify Identity endpoint is not the supported request path.

### A recovery or invitation link opens the wrong view

Check that the early script in `app/index.html` stores the hash and that `hasIdentityTokenInHash()` checks both the live hash and `window.__savedIdentityHash`. The signup view must not replace a token-triggered Identity view.

### Credentials are not returned after login

The server-side credential endpoint requires a valid Identity JWT. Check the authentication-service logs and the configured allowed origins, but do not log or publish the JWT or any returned credential values.

## Adding another provider

1. Extend `AuthProvider` in a new adapter.
2. Implement the provider API and event behavior.
3. Register the adapter in `AuthFactory.js`.
4. Add non-secret configuration to `app/config.js`.
5. Add unit and browser coverage.
6. Update this document without including credential values.
