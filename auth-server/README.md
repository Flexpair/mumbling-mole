# Authentication server

The auth server validates identity-provider tokens and returns Guacamole credentials plus a short-lived, single-use Mumble session token and stable username derived from the validated identity. It uses the stable `id` claim for Netlify and Supabase user responses, and the OIDC `sub` claim for Auth0. Murmur verifies the username/token pair through its private ICE authenticator; the browser cannot select or override the authenticated Mumble username.

Configure Murmur's ICE interface with a private write secret and provide the matching endpoint, secret, callback endpoint, and persistent SQLite identity database path to this service. The credential endpoint returns `503` until Murmur confirms that the authenticator is attached. Known identity usernames require their matching one-time token; unknown usernames fall through to Murmur's normal authentication. Do not return or expose Murmur's server-wide password through this service.

Session tokens expire after 60 seconds and are consumed on the first authentication attempt, including attempts with a mismatched username. Tokens are held in memory and become invalid when the auth server restarts. Disabling an identity does not terminate an already connected Mumble session; active-session revocation remains tracked in issue #460.

The HTTP API supports HTTP/1.x requests only. HTTP/0.9-style request lines without a version are rejected; incomplete request lines are closed when the client disconnects or the request deadline expires.
