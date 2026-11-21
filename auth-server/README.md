# Authentication server

The auth server validates identity-provider tokens and returns the hub's shared Mumble and Guacamole credentials to approved users. Those downstream credentials remain reusable and are not individually revoked when an identity account is disabled or its roles change. Do not treat this token check as user-specific downstream access control; see security finding #29.
