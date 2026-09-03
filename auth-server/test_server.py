#!/usr/bin/env python3
"""
Unit tests for auth-server/server.py

Run with: python3 -m pytest auth-server/test_server.py -v
Or standalone: python3 auth-server/test_server.py
"""

import json
import unittest
import urllib.error
from time import time
from unittest.mock import patch, MagicMock

# Import functions from server module
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('MUMBLE_PASSWORD', 'test-mumble-password')

from server import (
    RateLimiter,
    _get_cors_headers,
    _get_cors_origin,
    _is_valid_provider_url,
    _normalize_origin,
    get_nested_property,
    get_guacamole_user,
    hash_email,
    rate_limiter,
    generate_secure_password,
    _execute_auth_request,
    validate_token,
)


def import_server_with_environment(environment):
    """Reload server.py with a controlled environment for startup tests."""
    module_name = 'server'
    original_module = sys.modules.pop(module_name, None)
    original_environment = os.environ.copy()
    try:
        os.environ.clear()
        os.environ.update(environment)
        return __import__(module_name)
    finally:
        os.environ.clear()
        os.environ.update(original_environment)
        sys.modules.pop(module_name, None)
        if original_module is not None:
            sys.modules[module_name] = original_module


class TestGetNestedProperty(unittest.TestCase):
    """Tests for get_nested_property function."""

    def test_simple_path(self):
        obj = {'name': 'test'}
        self.assertEqual(get_nested_property(obj, 'name'), 'test')

    def test_nested_path(self):
        obj = {'app_metadata': {'roles': ['admin', 'editor']}}
        self.assertEqual(get_nested_property(obj, 'app_metadata.roles'), ['admin', 'editor'])

    def test_deeply_nested(self):
        obj = {'a': {'b': {'c': {'d': 'value'}}}}
        self.assertEqual(get_nested_property(obj, 'a.b.c.d'), 'value')

    def test_missing_key(self):
        obj = {'name': 'test'}
        self.assertIsNone(get_nested_property(obj, 'missing'))

    def test_missing_nested_key(self):
        obj = {'app_metadata': {}}
        self.assertIsNone(get_nested_property(obj, 'app_metadata.roles'))

    def test_empty_object(self):
        self.assertIsNone(get_nested_property({}, 'any.path'))

    def test_none_in_path(self):
        obj = {'app_metadata': None}
        self.assertIsNone(get_nested_property(obj, 'app_metadata.roles'))


class TestGetGuacamoleUser(unittest.TestCase):
    """Tests for get_guacamole_user function."""

    def test_admin_role(self):
        self.assertEqual(get_guacamole_user(['admin']), 'admin')

    def test_edit_role(self):
        self.assertEqual(get_guacamole_user(['edit']), 'editor')

    def test_watch_role(self):
        self.assertEqual(get_guacamole_user(['watch']), 'watcher')

    def test_empty_roles(self):
        self.assertEqual(get_guacamole_user([]), 'watcher')

    def test_none_roles(self):
        self.assertEqual(get_guacamole_user(None), 'watcher')

    def test_admin_priority(self):
        """Admin should take priority over other roles."""
        self.assertEqual(get_guacamole_user(['edit', 'admin', 'watch']), 'admin')

    def test_edit_priority_over_watch(self):
        self.assertEqual(get_guacamole_user(['watch', 'edit']), 'editor')

    def test_unknown_roles(self):
        self.assertEqual(get_guacamole_user(['unknown', 'guest']), 'watcher')

    def test_not_a_list(self):
        self.assertEqual(get_guacamole_user('admin'), 'watcher')


class TestHashEmail(unittest.TestCase):
    """Tests for hash_email function (GDPR/CCPA compliant logging)."""

    def test_hash_email(self):
        result = hash_email('test@example.com')
        self.assertEqual(len(result), 8)
        # Should be consistent
        self.assertEqual(result, hash_email('test@example.com'))

    def test_different_emails_different_hashes(self):
        hash1 = hash_email('user1@example.com')
        hash2 = hash_email('user2@example.com')
        self.assertNotEqual(hash1, hash2)

    def test_empty_email(self):
        self.assertEqual(hash_email(''), 'unknown')

    def test_none_email(self):
        self.assertEqual(hash_email(None), 'unknown')

    def test_hash_is_hex(self):
        result = hash_email('test@example.com')
        # Should be valid hex
        int(result, 16)


class TestGenerateSecurePassword(unittest.TestCase):
    """Tests for generate_secure_password function."""

    def test_default_length(self):
        password = generate_secure_password()
        self.assertEqual(len(password), 32)

    def test_custom_length(self):
        password = generate_secure_password(16)
        self.assertEqual(len(password), 16)

    def test_different_passwords(self):
        p1 = generate_secure_password()
        p2 = generate_secure_password()
        self.assertNotEqual(p1, p2)

    def test_url_safe_characters(self):
        password = generate_secure_password(100)
        # URL-safe base64 only contains alphanumeric, - and _
        for char in password:
            self.assertTrue(char.isalnum() or char in '-_')


class TestRateLimiting(unittest.TestCase):
    """Tests for rate limiting functionality."""

    def setUp(self):
        # Clear rate limit store before each test
        rate_limiter.store.clear()

    def test_allows_first_request(self):
        self.assertTrue(rate_limiter.check('203.0.113.1'))

    def test_allows_multiple_requests_under_limit(self):
        for _ in range(rate_limiter.max_requests - 1):
            self.assertTrue(rate_limiter.check('203.0.113.2'))

    def test_blocks_after_limit(self):
        for _ in range(rate_limiter.max_requests):
            rate_limiter.check('203.0.113.3')
        self.assertFalse(rate_limiter.check('203.0.113.3'))

    def test_different_ips_independent(self):
        for _ in range(rate_limiter.max_requests):
            rate_limiter.check('203.0.113.4')
        # Different IP should still be allowed
        self.assertTrue(rate_limiter.check('203.0.113.5'))

    def test_old_requests_expire(self):
        # Fill up rate limit
        for _ in range(rate_limiter.max_requests):
            rate_limiter.check('203.0.113.6')
        
        # Simulate time passing
        old_time = time() - rate_limiter.window - 1
        rate_limiter.store['203.0.113.6'] = [old_time] * rate_limiter.max_requests
        
        # Should be allowed again
        self.assertTrue(rate_limiter.check('203.0.113.6'))

    def test_cleanup_removes_expired_ips(self):
        limiter = RateLimiter(window_seconds=60, max_requests=1)
        old_time = time() - limiter.window - 1
        limiter.store['203.0.113.7'] = [old_time]
        limiter.last_cleanup = old_time

        self.assertTrue(limiter.check('203.0.113.8'))
        self.assertNotIn('203.0.113.7', limiter.store)


class TestCorsAllowlist(unittest.TestCase):
    """Tests for explicit CORS origin handling."""

    @patch.dict(
        os.environ,
        {
            'AUTH_ALLOWED_ORIGINS': (
                'https://app.example, https://app.example/, *, '
                'https://invalid.example/path, http://localhost:3000'
            )
        },
        clear=False,
    )
    def test_only_explicit_valid_origins_are_allowed(self):
        self.assertEqual(_get_cors_origin('https://app.example'), 'https://app.example')
        self.assertEqual(_get_cors_origin('https://app.example/'), 'https://app.example')
        self.assertEqual(_get_cors_origin('http://localhost:3000'), 'http://localhost:3000')
        self.assertEqual(_normalize_origin('https://[2001:db8::1]:8443'), 'https://[2001:db8::1]:8443')
        self.assertEqual(_normalize_origin('https://app.example:443'), 'https://app.example')
        self.assertIsNone(_get_cors_origin('https://attacker.example'))

    @patch.dict(os.environ, {'AUTH_ALLOWED_ORIGINS': '*'}, clear=False)
    def test_wildcard_origin_is_not_allowed(self):
        self.assertIsNone(_get_cors_origin('https://app.example'))

    def test_origin_paths_credentials_and_non_http_schemes_are_rejected(self):
        for origin in (
            'https://app.example/path',
            'https://user:password@app.example',
            'ftp://app.example',
            'https://[invalid',
            'https://:443',
            'https://app.example:not-a-port',
            'https://app.example:65536',
        ):
            self.assertIsNone(_normalize_origin(origin))

    @patch.dict(os.environ, {'AUTH_ALLOWED_ORIGINS': 'https://app.example'}, clear=False)
    def test_cors_headers_vary_by_origin(self):
        self.assertEqual(
            _get_cors_headers('https://app.example'),
            {
                'Vary': 'Origin',
                'Access-Control-Allow-Origin': 'https://app.example',
                'Access-Control-Allow-Headers': 'Authorization, Content-Type',
                'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
            },
        )
        self.assertEqual(_get_cors_headers('https://attacker.example'), {'Vary': 'Origin'})


class TestAuthProviderConfig(unittest.TestCase):
    """Tests for auth provider configuration."""

    def test_netlify_provider_configured(self):
        from server import AUTH_PROVIDERS
        self.assertIn('netlify', AUTH_PROVIDERS)
        self.assertIsNotNone(AUTH_PROVIDERS['netlify']['userEndpoint'])
        self.assertEqual(AUTH_PROVIDERS['netlify']['rolesClaim'], 'app_metadata.roles')

    def test_supabase_provider_placeholder(self):
        from server import AUTH_PROVIDERS
        self.assertIn('supabase', AUTH_PROVIDERS)
        self.assertEqual(AUTH_PROVIDERS['supabase']['rolesClaim'], 'user_metadata.roles')

    def test_auth0_provider_placeholder(self):
        from server import AUTH_PROVIDERS
        self.assertIn('auth0', AUTH_PROVIDERS)
        self.assertEqual(AUTH_PROVIDERS['auth0']['rolesClaim'], 'https://flexpair.com/roles')


class TestAuthProviderUrlValidation(unittest.TestCase):
    """Tests for provider-specific SSRF protection."""

    def test_netlify_allows_only_expected_host(self):
        from server import AUTH_PROVIDERS
        provider = AUTH_PROVIDERS['netlify']
        self.assertTrue(
            _is_valid_provider_url(
                'https://welcome.flexpair.com/identity-proxy/user', provider
            )
        )
        self.assertFalse(
            _is_valid_provider_url('https://attacker.example/user', provider)
        )

    def test_supabase_requires_project_host(self):
        from server import AUTH_PROVIDERS
        provider = AUTH_PROVIDERS['supabase']
        self.assertTrue(
            _is_valid_provider_url('https://project-ref.supabase.co/auth/v1/user', provider)
        )
        self.assertTrue(
            _is_valid_provider_url('https://project-ref.supabase.in/auth/v1/user', provider)
        )
        self.assertFalse(
            _is_valid_provider_url('https://supabase.co/auth/v1/user', provider)
        )
        self.assertFalse(
            _is_valid_provider_url('https://project-ref.supabase.co.attacker.example/user', provider)
        )

    def test_auth0_allows_standard_regional_domain(self):
        from server import AUTH_PROVIDERS
        provider = AUTH_PROVIDERS['auth0']
        self.assertTrue(_is_valid_provider_url('https://tenant.auth0.com/user', provider))
        self.assertTrue(_is_valid_provider_url('https://tenant.eu.auth0.com/user', provider))
        self.assertFalse(_is_valid_provider_url('https://auth0.com/user', provider))

    def test_provider_url_rejects_private_hosts_credentials_and_ports(self):
        from server import AUTH_PROVIDERS
        provider = AUTH_PROVIDERS['netlify']
        for url in (
            'https://127.0.0.1/user',
            'https://welcome.flexpair.com@127.0.0.1/user',
            'https://welcome.flexpair.com:8443/user',
            'https://welcome.flexpair.com:65536/user',
            'https://welcome.flexpair.com/user?redirect=http://127.0.0.1',
        ):
            self.assertFalse(_is_valid_provider_url(url, provider))

    @patch('server._execute_auth_request')
    def test_validate_token_does_not_request_untrusted_endpoint(self, mock_request):
        provider = {
            'userEndpoint': 'https://attacker.example',
            'allowedHosts': ('welcome.flexpair.com',),
        }
        self.assertIsNone(validate_token('token', provider))
        mock_request.assert_not_called()

    @patch('server._execute_auth_request', return_value={'email': 'user@example.com'})
    def test_validate_token_requests_allowed_endpoint(self, mock_request):
        from server import AUTH_PROVIDERS
        self.assertEqual(
            validate_token('token', AUTH_PROVIDERS['netlify']),
            {'email': 'user@example.com'},
        )
        mock_request.assert_called_once_with(
            'https://welcome.flexpair.com/identity-proxy/user', 'token'
        )


class TestCredentialGeneration(unittest.TestCase):
    """Tests for credential configuration."""

    def test_mumble_password_exists(self):
        from server import MUMBLE_PASSWORD
        self.assertIsNotNone(MUMBLE_PASSWORD)
        self.assertGreater(len(MUMBLE_PASSWORD), 0)

    def test_guacamole_passwords_exist(self):
        from server import GUACAMOLE_PASSWORDS
        self.assertIn('admin', GUACAMOLE_PASSWORDS)
        self.assertIn('editor', GUACAMOLE_PASSWORDS)
        self.assertIn('watcher', GUACAMOLE_PASSWORDS)

    def test_server_requires_mumble_password(self):
        with self.assertRaisesRegex(RuntimeError, 'MUMBLE_PASSWORD must be configured'):
            import_server_with_environment({})


class TestExecuteAuthRequest(unittest.TestCase):
    """Tests for _execute_auth_request retry/error handling."""

    def _mock_response(self, status=200, body=b'{"ok": true}'):
        response = MagicMock()
        response.status = status
        response.read.return_value = body
        response.__enter__.return_value = response
        response.__exit__.return_value = False
        return response

    @patch('server.urllib.request.urlopen')
    def test_success_on_first_attempt(self, mock_urlopen):
        mock_urlopen.return_value = self._mock_response()
        result = _execute_auth_request('https://example.com', 'token')
        self.assertEqual(result, {'ok': True})
        self.assertEqual(mock_urlopen.call_count, 1)

    @patch('server.urllib.request.urlopen')
    def test_http_error_returns_none_immediately(self, mock_urlopen):
        mock_urlopen.side_effect = urllib.error.HTTPError(
            'https://example.com', 401, 'Unauthorized', {}, None
        )
        result = _execute_auth_request('https://example.com', 'token')
        self.assertIsNone(result)
        self.assertEqual(mock_urlopen.call_count, 1)

    @patch('server.time_mod.sleep', return_value=None)
    @patch('server.urllib.request.urlopen')
    def test_url_error_retries_then_succeeds(self, mock_urlopen, mock_sleep):
        mock_urlopen.side_effect = [
            urllib.error.URLError('network down'),
            self._mock_response(),
        ]
        result = _execute_auth_request('https://example.com', 'token')
        self.assertEqual(result, {'ok': True})
        self.assertEqual(mock_urlopen.call_count, 2)
        self.assertEqual(mock_sleep.call_count, 1)

    @patch('server.time_mod.sleep', return_value=None)
    @patch('server.urllib.request.urlopen')
    def test_exhausted_retries_returns_none(self, mock_urlopen, mock_sleep):
        mock_urlopen.side_effect = urllib.error.URLError('network down')
        result = _execute_auth_request('https://example.com', 'token')
        self.assertIsNone(result)
        self.assertEqual(mock_urlopen.call_count, 3)

    @patch('server.urllib.request.urlopen')
    def test_non_200_status_returns_none(self, mock_urlopen):
        mock_urlopen.return_value = self._mock_response(status=500, body=b'')
        result = _execute_auth_request('https://example.com', 'token')
        self.assertIsNone(result)


if __name__ == '__main__':
    unittest.main(verbosity=2)
