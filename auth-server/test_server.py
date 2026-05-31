#!/usr/bin/env python3
"""
Unit tests for auth-server/server.py

Run with: python3 -m pytest auth-server/test_server.py -v
Or standalone: python3 auth-server/test_server.py
"""

import unittest
from time import time

# Import functions from server module
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from server import (
    get_nested_property,
    get_guacamole_user,
    hash_email,
    rate_limiter,
    generate_secure_password,
)


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
        self.assertTrue(rate_limiter.check('192.168.1.1'))

    def test_allows_multiple_requests_under_limit(self):
        for _ in range(rate_limiter.max_requests - 1):
            self.assertTrue(rate_limiter.check('192.168.1.2'))

    def test_blocks_after_limit(self):
        for _ in range(rate_limiter.max_requests):
            rate_limiter.check('192.168.1.3')
        self.assertFalse(rate_limiter.check('192.168.1.3'))

    def test_different_ips_independent(self):
        for _ in range(rate_limiter.max_requests):
            rate_limiter.check('192.168.1.4')
        # Different IP should still be allowed
        self.assertTrue(rate_limiter.check('192.168.1.5'))

    def test_old_requests_expire(self):
        # Fill up rate limit
        for _ in range(rate_limiter.max_requests):
            rate_limiter.check('192.168.1.6')
        
        # Simulate time passing
        old_time = time() - rate_limiter.window - 1
        rate_limiter.store['192.168.1.6'] = [old_time] * rate_limiter.max_requests
        
        # Should be allowed again
        self.assertTrue(rate_limiter.check('192.168.1.6'))


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


if __name__ == '__main__':
    unittest.main(verbosity=2)
