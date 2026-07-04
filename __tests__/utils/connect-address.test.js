import { resolveConnectAddress } from '../../app/utils/connect-address.js';

describe('resolveConnectAddress', () => {
  describe('no query override (regression: trust configured defaults)', () => {
    it('uses the operator-configured default when no query param is present', () => {
      const result = resolveConnectAddress(null, 'voice.example.com', ['app.example.com']);

      expect(result).toEqual({ address: 'voice.example.com', rejected: false });
    });

    it('trusts a default address even when it differs from the allowlist/hostname', () => {
      // Regression: a deployment can point at a dedicated Mumble host that is
      // NOT the page's own hostname and has no `allowedServerHosts` configured.
      // This must still work - only the URL query param is untrusted, not the
      // operator-configured default.
      const result = resolveConnectAddress(undefined, 'voice.example.com', ['app.example.com']);

      expect(result).toEqual({ address: 'voice.example.com', rejected: false });
    });

    it('returns no address when neither a query param nor a default is set', () => {
      const result = resolveConnectAddress('', undefined, ['app.example.com']);

      expect(result).toEqual({ address: undefined, rejected: false });
    });
  });

  describe('query override matches the allowlist', () => {
    it('accepts a query address that is in the allowlist', () => {
      const result = resolveConnectAddress('app.example.com', 'voice.example.com', ['app.example.com']);

      expect(result).toEqual({ address: 'app.example.com', rejected: false });
    });

    it('accepts a query address matching the page hostname fallback allowlist', () => {
      const result = resolveConnectAddress('mumble.local', undefined, ['mumble.local']);

      expect(result).toEqual({ address: 'mumble.local', rejected: false });
    });
  });

  describe('query override rejected (security fix: connection hijacking / CWE-346)', () => {
    it('rejects an attacker-crafted address not in the allowlist', () => {
      const result = resolveConnectAddress('evil.attacker.com', 'voice.example.com', ['app.example.com']);

      expect(result).toEqual({ address: undefined, rejected: true });
    });

    it('does not fall back to the configured default when the query override is rejected', () => {
      const result = resolveConnectAddress('evil.attacker.com', 'voice.example.com', ['app.example.com']);

      expect(result.address).toBeUndefined();
    });

    it('rejects when no allowlist matches and no allowedServerHosts is configured', () => {
      const result = resolveConnectAddress('evil.attacker.com', undefined, ['app.example.com']);

      expect(result).toEqual({ address: undefined, rejected: true });
    });
  });
});
