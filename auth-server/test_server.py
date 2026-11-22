#!/usr/bin/env python3
"""
Unit tests for auth-server/server.py

Run with: python3 -m pytest auth-server/test_server.py -v
Or standalone: python3 auth-server/test_server.py
"""

import json
import ipaddress
import queue
import socket
import socketserver
import sqlite3
import threading
import time as time_mod
import tempfile
import unittest
import urllib.error
from email.message import Message
from time import time
from types import SimpleNamespace
from unittest.mock import patch, MagicMock

# Import functions from server module
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.update({
    'GUAC_ADMIN_PASSWORD': 'test-guac-admin-password',
    'GUAC_EDITOR_PASSWORD': 'test-guac-editor-password',
    'GUAC_WATCHER_PASSWORD': 'test-guac-watcher-password',
    'TRUSTED_PROXIES': '127.0.0.1',
    'MUMBLE_IDENTITY_DB': ':memory:',
})

from server import (
    AuthHandler,
    RateLimiter,
    ThreadedHTTPServer,
    _parse_trusted_proxies,
    _resolve_client_ip,
    _get_cors_headers,
    _get_cors_origin,
    _is_valid_provider_url,
    _normalize_origin,
    get_nested_property,
    get_guacamole_user,
    hash_email,
    rate_limiter,
    MUMBLE_IDENTITIES,
    MUMBLE_SESSIONS,
    MURMUR_AUTHENTICATOR_READY,
    generate_secure_password,
    _execute_auth_request,
    _DeadlineReader,
    validate_token,
)
from mumble_auth import (
    MumbleAuthenticator,
    MumbleIdentityRegistry,
    MumbleSessionStore,
    MurmurIceAuthenticator,
)


def import_server_with_environment(environment):
    """Reload server.py with a controlled environment for startup tests."""
    module_name = 'server'
    original_module = sys.modules.pop(module_name, None)
    original_environment = os.environ.copy()
    try:
        os.environ.clear()
        os.environ.update(environment)
        os.environ.setdefault('MUMBLE_IDENTITY_DB', ':memory:')
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
        self.assertIsNone(get_guacamole_user([]))

    def test_none_roles(self):
        self.assertIsNone(get_guacamole_user(None))

    def test_admin_priority(self):
        """Admin should take priority over other roles."""
        self.assertEqual(get_guacamole_user(['edit', 'admin', 'watch']), 'admin')

    def test_edit_priority_over_watch(self):
        self.assertEqual(get_guacamole_user(['watch', 'edit']), 'editor')

    def test_unknown_roles(self):
        self.assertIsNone(get_guacamole_user(['unknown', 'guest']))

    def test_not_a_list(self):
        self.assertIsNone(get_guacamole_user('admin'))


class TestMumbleIdentityAuthentication(unittest.TestCase):
    def setUp(self):
        self.identities = MumbleIdentityRegistry(':memory:')
        self.clock_value = 100
        self.sessions = MumbleSessionStore(
            ttl_seconds=60,
            clock=lambda: self.clock_value,
        )
        self.authenticator = MumbleAuthenticator(self.identities, self.sessions)
        self.identity = self.identities.get_or_create(
            'identity-1',
            'Authenticated Person',
        )

    def test_identity_username_is_stable_and_not_client_supplied(self):
        expected = self.identities.get_or_create('identity-1', 'Changed Name')
        self.assertEqual(expected, self.identity)
        self.assertEqual(self.identity.username, 'Authenticated (3ff34ed40e9ac98f)')
        self.assertNotEqual(
            self.identities.get_or_create('identity-2', 'Authenticated Person').username,
            self.identity.username,
        )

    def test_identity_username_preserves_unicode_letters_and_ignores_invalid_metadata(self):
        identity = self.identities.get_or_create('identity-2', 'Jürgen ☃')
        self.assertTrue(identity.username.startswith('Jürgen ('))
        self.assertTrue(
            self.identities.get_or_create('identity-3', ['not', 'a', 'name']).username.startswith('user (')
        )

    def test_identity_username_lookup_uses_unicode_casefold(self):
        identity = self.identities.get_or_create('identity-unicode', 'Jürgen')

        self.assertEqual(
            self.identities.get_by_username(identity.username),
            identity,
        )
        self.assertEqual(
            self.identities.get_by_username(
                identity.username.replace('Jürgen', 'JÜRGEN')
            ),
            identity,
        )

    def test_unicode_case_variant_requires_registered_token(self):
        identity = self.identities.get_or_create('identity-unicode', 'Jürgen')

        self.assertEqual(
            self.authenticator.authenticate(
                identity.username.replace('Jürgen', 'JÜRGEN'),
                'invalid-token',
            ),
            -1,
        )

        valid_token = self.sessions.issue(identity)
        self.assertEqual(
            self.authenticator.authenticate(
                identity.username.replace('Jürgen', 'JÜRGEN'),
                valid_token,
            ),
            identity,
        )

    def test_identity_registry_persists_numeric_user_ids(self):
        with tempfile.TemporaryDirectory() as directory:
            path = os.path.join(directory, 'identities.sqlite3')
            first = MumbleIdentityRegistry(path)
            identity = first.get_or_create('identity-1', 'Authenticated Person')
            second = MumbleIdentityRegistry(path)
            self.assertEqual(second.get_by_id(identity.user_id), identity)
            self.assertEqual(second.get_by_username(identity.username), identity)

    def test_identity_registry_migrates_unicode_username_keys(self):
        with tempfile.TemporaryDirectory() as directory:
            path = os.path.join(directory, 'identities.sqlite3')
            database = sqlite3.connect(path)
            database.execute(
                'CREATE TABLE identities ('
                'user_id INTEGER PRIMARY KEY AUTOINCREMENT, '
                'subject TEXT NOT NULL UNIQUE, '
                'username TEXT NOT NULL COLLATE NOCASE UNIQUE)'
            )
            database.execute(
                'INSERT INTO identities (subject, username) VALUES (?, ?)',
                ('identity-1', 'Jürgen (1234567890123456)'),
            )
            database.execute(
                'INSERT INTO identities (subject, username) VALUES (?, ?)',
                ('identity-2', 'JÜRGEN (1234567890123456)'),
            )
            database.commit()
            database.close()

            migrated = MumbleIdentityRegistry(path)
            identity = migrated.get_by_username('Jürgen (1234567890123456)')
            self.assertIsNotNone(identity)
            self.assertIsNotNone(
                migrated.get_by_username('JÜRGEN (1234567890123456)')
            )

    def test_identity_username_collision_is_disambiguated(self):
        with patch('mumble_auth.get_mumble_username', return_value='Authenticated (1234567890123456)'):
            identities = [self.identities.get_or_create(f'collision-{i}') for i in range(5)]
            self.assertEqual(len({identity.username for identity in identities}), 5)
            self.assertTrue(all(len(identity.username) <= 32 for identity in identities))
            self.assertEqual(self.identities.get_or_create('collision-1'), identities[1])
            with self.assertRaisesRegex(ValueError, 'Identity username collision'):
                self.identities.get_or_create('collision-5')

    def test_identity_username_collision_creates_distinct_usernames(self):
        with patch('mumble_auth.get_mumble_username', return_value='Shared Name (1234567890123456)'):
            first = self.identities.get_or_create('first-subject')
            second = self.identities.get_or_create('second-subject')

        self.assertNotEqual(first.username, second.username)

    def test_session_token_authenticates_only_its_assigned_username_once(self):
        token = self.sessions.issue(self.identity)

        self.assertEqual(self.authenticator.authenticate('Another User', token), -1)
        self.assertEqual(self.authenticator.authenticate(self.identity.username, token), -1)

        valid_token = self.sessions.issue(self.identity)
        self.assertEqual(
            self.authenticator.authenticate(self.identity.username, valid_token),
            self.identity,
        )
        self.assertEqual(
            self.authenticator.authenticate(self.identity.username, valid_token),
            -1,
        )

    def test_expired_session_token_is_rejected(self):
        token = self.sessions.issue(self.identity)
        self.clock_value += 61

        self.assertEqual(
            self.authenticator.authenticate(self.identity.username, token),
            -1,
        )

    def test_unknown_username_falls_through_to_murmur_database_authentication(self):
        self.assertEqual(
            self.authenticator.authenticate('Unknown User', 'invalid-token'),
            -2,
        )

    def test_identity_requires_nonempty_bounded_subject(self):
        for subject in ('', 'x' * 513, None):
            with self.subTest(subject=subject):
                with self.assertRaises(ValueError):
                    self.identities.get_or_create(subject)


class TestMurmurIceAuthenticator(unittest.TestCase):
    def _build_authenticator(self, meta_proxy_class, slice_dir='/tmp'):
        adapter = MagicMock()
        communicator = MagicMock()
        communicator.createObjectAdapterWithEndpoints.return_value = adapter
        fake_ice = SimpleNamespace(
            loadSlice=MagicMock(),
            getSliceDir=MagicMock(return_value=slice_dir),
            initialize=MagicMock(return_value=communicator),
            stringToIdentity=MagicMock(side_effect=lambda identity: identity),
        )
        fake_mumble_server = SimpleNamespace(
            ServerAuthenticator=object,
            ServerAuthenticatorPrx=SimpleNamespace(uncheckedCast=MagicMock(side_effect=lambda proxy: proxy)),
            MetaPrx=meta_proxy_class,
        )
        ready = MagicMock()
        authenticator = MurmurIceAuthenticator(
            MumbleAuthenticator(
                MumbleIdentityRegistry(':memory:'),
                MumbleSessionStore(),
            ),
            'Meta:tcp -h murmur -p 6502',
            'ice-secret',
            'tcp -h mumble -p 6503',
            ready,
        )
        self._stop_after_second_wait(authenticator)
        return SimpleNamespace(
            authenticator=authenticator,
            fake_ice=fake_ice,
            fake_mumble_server=fake_mumble_server,
            ready=ready,
        )

    @staticmethod
    def _stop_after_second_wait(authenticator):
        wait_count = 0

        def wait_for_retry(timeout):
            nonlocal wait_count
            wait_count += 1
            if wait_count == 2:
                authenticator._stop.set()
                return True
            return False

        authenticator._stop.wait = wait_for_retry

    def test_meta_checked_cast_retries_until_murmur_is_available(self):
        mumble_server = MagicMock()
        meta = MagicMock()
        meta.getBootedServers.return_value = [mumble_server]
        meta_proxy_class = SimpleNamespace(
            checkedCast=MagicMock(side_effect=[
                RuntimeError('Murmur is starting: ice-secret Meta:tcp -h murmur -p 6502 tcp -h mumble -p 6503'),
                meta,
            ])
        )
        fixture = self._build_authenticator(meta_proxy_class, slice_dir='/tmp')

        with patch('builtins.print') as mock_print, patch.dict(
            sys.modules,
            {'Ice': fixture.fake_ice, 'MumbleServer': fixture.fake_mumble_server},
        ):
            fixture.authenticator._serve()

        mock_print.assert_called_once_with(
            '[AUTH] Murmur authenticator unavailable; retrying '
            '(RuntimeError: Murmur is starting: [redacted] [redacted] [redacted])'
        )
        self.assertEqual(meta_proxy_class.checkedCast.call_count, 2)
        mumble_server.setAuthenticator.assert_called_once()
        fixture.ready.set.assert_called_once()
        self.assertEqual(fixture.ready.clear.call_count, 2)

    def test_server_authenticator_is_refreshed_across_successful_retries(self):
        mumble_server = MagicMock()
        mumble_server.id.return_value = 1
        restarted_server = MagicMock()
        restarted_server.id.return_value = 1
        meta = MagicMock()
        meta.getBootedServers.side_effect = [[mumble_server], [restarted_server]]
        meta_proxy_class = SimpleNamespace(checkedCast=MagicMock(return_value=meta))
        fixture = self._build_authenticator(meta_proxy_class, slice_dir=None)

        with patch.dict(
            sys.modules,
            {'Ice': fixture.fake_ice, 'MumbleServer': fixture.fake_mumble_server},
        ):
            fixture.authenticator._serve()

        fixture.fake_ice.loadSlice.assert_called_once_with(
                '/usr/local/share/mumble/MumbleServer.ice'
        )
        self.assertEqual(meta_proxy_class.checkedCast.call_count, 2)
        mumble_server.setAuthenticator.assert_called_once()
        restarted_server.setAuthenticator.assert_called_once()
        self.assertEqual(fixture.ready.set.call_count, 2)
        fixture.ready.clear.assert_called_once()


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


class TestThreadedHTTPServer(unittest.TestCase):
    def setUp(self):
        finished = self.finished = queue.Queue()

        class TestServer(ThreadedHTTPServer):
            max_concurrent_requests = 1
            request_timeout = 0.1

            def process_request_thread(self, request, client_address):
                try:
                    super().process_request_thread(request, client_address)
                finally:
                    finished.put(None)

        self.server = TestServer(('127.0.0.1', 0), AuthHandler, bind_and_activate=False)
        self.addCleanup(self.server.server_close)

    def socket_pair(self):
        client, request = socket.socketpair()
        client.settimeout(2)
        self.addCleanup(client.close)
        self.addCleanup(request.close)
        return client, request

    def submit(self, request):
        self.server.process_request(request, ('127.0.0.1', 12345))

    def assert_health_request_succeeds(self):
        client, request = self.socket_pair()
        client.sendall(b'GET /api/health HTTP/1.0\r\n\r\n')
        self.submit(request)
        self.assertTrue(client.recv(4096).startswith(b'HTTP/1.0 200 OK\r\n'))
        self.finished.get(timeout=2)

    def test_incomplete_headers_time_out_and_release_capacity(self):
        client, request = self.socket_pair()
        client.sendall(b'GET /api/health HTTP/1.1\r\nHost: example\r\n')
        self.submit(request)

        self.assertEqual(client.recv(4096), b'')
        self.finished.get(timeout=2)
        self.assert_health_request_succeeds()

    def test_http_09_request_is_rejected(self):
        client, request = self.socket_pair()
        client.sendall(b'GET /api/health\r\n\r\n')
        self.submit(request)

        response = client.recv(4096)
        self.assertIn(b'HTTP/1.x required', response)
        self.finished.get(timeout=2)
        self.assert_health_request_succeeds()

    def test_disconnected_incomplete_requests_release_capacity_immediately(self):
        self.server.request_timeout = 2
        prefixes = (
            b'',
            b'GET /api/health',
            b'GET /api/health HTTP/1.1\r\nHost: example',
        )
        for prefix in prefixes:
            with self.subTest(prefix=prefix):
                client, request = self.socket_pair()
                self.addCleanup(client.close)
                if prefix:
                    client.sendall(prefix)
                self.submit(request)
                client.shutdown(socket.SHUT_WR)

                self.finished.get(timeout=0.5)
                self.assert_health_request_succeeds()

    def test_slow_progress_times_out_during_request_line_and_headers(self):
        self.server.request_timeout = 0.4
        for prefix in (b'GET /api/', b'GET /api/health HTTP/1.1\r\nHost: '):
            with self.subTest(prefix=prefix):
                client, request = self.socket_pair()
                client.sendall(prefix)
                started = time_mod.monotonic()
                self.submit(request)
                stop = threading.Event()
                sent_at = [started]

                def send_slowly():
                    while not stop.wait(0.03):
                        try:
                            client.sendall(b'a')
                            sent_at.append(time_mod.monotonic())
                        except OSError:
                            return

                sender = threading.Thread(target=send_slowly, daemon=True)
                sender.start()
                completed = False
                try:
                    self.finished.get(timeout=3)
                    completed = True
                    elapsed = time_mod.monotonic() - started
                    self.assertGreaterEqual(elapsed, 0.3)
                    self.assertLess(elapsed, 2.5)
                    self.assertGreaterEqual(len(sent_at), 4)
                    self.assertTrue(all(
                        later - earlier < self.server.request_timeout
                        for earlier, later in zip(sent_at, sent_at[1:])
                    ))
                    self.assertEqual(client.recv(4096), b'')
                    self.assert_health_request_succeeds()
                finally:
                    stop.set()
                    sender.join(timeout=1)
                    if not completed:
                        self.finished.get(timeout=2)

    def test_timeout_setup_failure_closes_request_and_releases_capacity(self):
        request = MagicMock()
        request.settimeout.side_effect = OSError('timeout setup failed')
        self.assertTrue(self.server._request_slots.acquire(blocking=False))

        with patch.object(self.server, 'shutdown_request') as shutdown:
            with self.assertRaisesRegex(OSError, 'timeout setup failed'):
                self.server.process_request_thread(request, ('127.0.0.1', 12345))

        shutdown.assert_called_once_with(request)
        self.finished.get(timeout=2)
        self.assert_health_request_succeeds()

    def test_handler_base_exception_shuts_down_once_and_releases_capacity(self):
        class HandlerFailure(BaseException):
            pass

        request = MagicMock()
        self.assertTrue(self.server._request_slots.acquire(blocking=False))

        with patch.object(self.server, 'finish_request', side_effect=HandlerFailure):
            with patch.object(self.server, 'shutdown_request') as shutdown:
                with self.assertRaises(HandlerFailure):
                    self.server.process_request_thread(request, ('127.0.0.1', 12345))

        shutdown.assert_called_once_with(request)
        self.finished.get(timeout=2)
        self.assertTrue(self.server._request_slots.acquire(blocking=False))
        self.server._request_slots.release()

    def test_overload_receives_503_and_capacity_recovers(self):
        stalled_client, stalled_request = self.socket_pair()
        stalled_client.sendall(b'GET /api/health HTTP/1.1\r\nHost: example\r\n')
        self.submit(stalled_request)

        client, request = self.socket_pair()
        client.sendall(b'GET /api/health HTTP/1.0\r\n\r\n')
        self.submit(request)
        expected_response = (
            b'HTTP/1.1 503 Service Unavailable\r\n'
            b'Connection: close\r\nContent-Length: 0\r\n\r\n'
        )
        response = b''
        while len(response) < len(expected_response):
            chunk = client.recv(len(expected_response) - len(response))
            if not chunk:
                break
            response += chunk
        self.assertEqual(response, expected_response)

        # Closing with unread request bytes can yield a reset on Linux and EOF on macOS.
        try:
            self.assertEqual(client.recv(4096), b'')
        except ConnectionResetError:
            pass

        stalled_client.sendall(b'\r\n')
        self.assertTrue(stalled_client.recv(4096).startswith(b'HTTP/1.0 200 OK\r\n'))
        self.finished.get(timeout=2)
        self.assert_health_request_succeeds()

    @patch('server.urllib.request.build_opener')
    def test_provider_timeout_releases_request_slot(self, mock_build_opener):
        MURMUR_AUTHENTICATOR_READY.set()
        self.addCleanup(MURMUR_AUTHENTICATOR_READY.clear)
        self.server.request_timeout = 0.1
        mock_opener = MagicMock()

        def timeout_after_budget(req, timeout):
            time_mod.sleep(timeout)
            raise socket.timeout('provider request timed out')

        mock_opener.open.side_effect = timeout_after_budget
        mock_build_opener.return_value = mock_opener
        client, request = self.socket_pair()
        client.sendall(
            b'POST /api/credentials HTTP/1.1\r\n'
            b'Host: example\r\n'
            b'Authorization: ' + b'B' + b'earer test\r\n'
            b'Content-Length: 0\r\n\r\n'
        )

        started = time_mod.monotonic()
        self.submit(request)
        self.finished.get(timeout=1)

        self.assertLess(time_mod.monotonic() - started, 0.5)
        mock_opener.open.assert_called_once()
        self.assertEqual(client.recv(4096), b'')
        self.assert_health_request_succeeds()

    def test_failed_thread_start_releases_capacity(self):
        _, request = self.socket_pair()
        with patch.object(socketserver.ThreadingMixIn, 'process_request', side_effect=RuntimeError('start failed')):
            with self.assertRaisesRegex(RuntimeError, 'start failed'):
                self.submit(request)

        self.assert_health_request_succeeds()


class TestCredentialRateLimitOrdering(unittest.TestCase):
    """Requests without credentials must not consume authentication budget."""

    def setUp(self):
        rate_limiter.store.clear()
        MUMBLE_SESSIONS._sessions.clear()
        MURMUR_AUTHENTICATOR_READY.set()
        self.addCleanup(MURMUR_AUTHENTICATOR_READY.clear)

    @staticmethod
    def _handler(authorization=None):
        handler = AuthHandler.__new__(AuthHandler)
        handler.path = '/api/credentials'
        handler.client_address = ('203.0.113.10', 12345)
        handler.headers = Message()
        if authorization is not None:
            handler.headers['Authorization'] = authorization
        handler.send_json = MagicMock()
        return handler

    def test_missing_authorization_does_not_consume_rate_limit(self):
        for _ in range(rate_limiter.max_requests + 5):
            handler = self._handler()
            handler.do_POST()
            handler.send_json.assert_called_once_with(
                401, {'error': 'Missing authorization header'}
            )

        self.assertNotIn('203.0.113.10', rate_limiter.store)

    def test_empty_bearer_token_does_not_consume_rate_limit(self):
        handler = self._handler('Bearer   ')
        handler.do_POST()

        handler.send_json.assert_called_once_with(
            401, {'error': 'Missing authorization header'}
        )
        self.assertNotIn('203.0.113.10', rate_limiter.store)

    @patch('server.validate_token', return_value=None)
    def test_rotating_tokens_share_client_ip_limit(self, _mock_validate):
        for index in range(rate_limiter.max_requests):
            handler = self._handler(f'Bearer invalid-{index}')
            handler.do_POST()
            handler.send_json.assert_called_once_with(
                401, {'error': 'Invalid or expired token'}
            )

        blocked_handler = self._handler('Bearer another-invalid-token')
        blocked_handler.do_POST()
        blocked_handler.send_json.assert_called_once_with(
            429,
            {'error': 'Too many authentication attempts, please try again later'},
        )

    @patch('server.validate_token', return_value=None)
    @patch('server.TRUSTED_PROXIES', ())
    def test_spoofed_forwarded_ip_does_not_bypass_limit(self, _mock_validate):
        for index in range(rate_limiter.max_requests):
            handler = self._handler(f'Bearer invalid-{index}')
            handler.headers['X-Forwarded-For'] = f'203.0.113.{index + 1}'
            handler.do_POST()

        blocked_handler = self._handler('Bearer final-invalid-token')
        blocked_handler.headers['X-Forwarded-For'] = '192.0.2.99'
        blocked_handler.do_POST()
        blocked_handler.send_json.assert_called_once_with(
            429,
            {'error': 'Too many authentication attempts, please try again later'},
        )

    @patch('server.validate_token', return_value=None)
    @patch('server.TRUSTED_PROXIES', ())
    def test_different_direct_clients_have_independent_limits(self, _mock_validate):
        for index in range(rate_limiter.max_requests):
            handler = self._handler(f'Bearer invalid-{index}')
            handler.do_POST()

        other_client = self._handler('Bearer invalid-other-client')
        other_client.client_address = ('203.0.113.11', 12345)
        other_client.do_POST()
        other_client.send_json.assert_called_once_with(
            401, {'error': 'Invalid or expired token'}
        )

    @patch('server.validate_token', return_value=None)
    @patch(
        'server.TRUSTED_PROXIES',
        _parse_trusted_proxies('172.18.0.7/32'),
    )
    def test_forwarded_clients_have_independent_limits(self, _mock_validate):
        for index in range(rate_limiter.max_requests):
            handler = self._handler(f'Bearer invalid-{index}')
            handler.client_address = ('172.18.0.7', 12345)
            handler.headers['X-Forwarded-For'] = '203.0.113.10'
            handler.do_POST()

        other_client = self._handler('Bearer invalid-other-client')
        other_client.client_address = ('172.18.0.7', 12345)
        other_client.headers['X-Forwarded-For'] = '203.0.113.11'
        other_client.do_POST()
        other_client.send_json.assert_called_once_with(
            401, {'error': 'Invalid or expired token'}
        )

    @patch('server.validate_token', return_value=None)
    @patch(
        'server.TRUSTED_PROXIES',
        _parse_trusted_proxies('172.18.0.7/32, 10.0.0.0/8'),
    )
    def test_fully_trusted_forwarded_clients_have_independent_limits(
        self, _mock_validate
    ):
        for index in range(rate_limiter.max_requests):
            handler = self._handler(f'Bearer invalid-{index}')
            handler.client_address = ('172.18.0.7', 12345)
            handler.headers['X-Forwarded-For'] = '10.0.0.21, 10.0.0.4'
            handler.do_POST()

        other_client = self._handler('Bearer invalid-other-client')
        other_client.client_address = ('172.18.0.7', 12345)
        other_client.headers['X-Forwarded-For'] = '10.0.0.22, 10.0.0.4'
        other_client.do_POST()
        other_client.send_json.assert_called_once_with(
            401, {'error': 'Invalid or expired token'}
        )

    @patch('server.validate_token', return_value=None)
    @patch(
        'server.TRUSTED_PROXIES',
        _parse_trusted_proxies('172.18.0.7/32, 10.0.0.0/8'),
    )
    def test_malformed_forwarded_prefix_does_not_collapse_client_limits(
        self, _mock_validate
    ):
        for index in range(rate_limiter.max_requests):
            handler = self._handler(f'Bearer invalid-{index}')
            handler.client_address = ('172.18.0.7', 12345)
            handler.headers['X-Forwarded-For'] = (
                'not-an-ip, 203.0.113.10, 10.0.0.4'
            )
            handler.do_POST()

        other_client = self._handler('Bearer invalid-other-client')
        other_client.client_address = ('172.18.0.7', 12345)
        other_client.headers['X-Forwarded-For'] = (
            'not-an-ip, 203.0.113.11, 10.0.0.4'
        )
        other_client.do_POST()
        other_client.send_json.assert_called_once_with(
            401, {'error': 'Invalid or expired token'}
        )


class TestClientIpResolution(unittest.TestCase):
    """Forwarded addresses are accepted only from explicit trusted proxies."""

    def test_untrusted_peer_cannot_spoof_forwarded_address(self):
        self.assertEqual(
            _resolve_client_ip(
                '198.51.100.20', '203.0.113.8', _parse_trusted_proxies('172.18.0.7/32')
            ),
            '198.51.100.20',
        )

    def test_trusted_proxy_uses_forwarded_client_address(self):
        self.assertEqual(
            _resolve_client_ip(
                '172.18.0.7', '203.0.113.8', _parse_trusted_proxies('172.18.0.7/32')
            ),
            '203.0.113.8',
        )

    def test_trusted_proxy_walks_chain_from_right_to_left(self):
        trusted = _parse_trusted_proxies('172.18.0.7/32, 10.0.0.0/8')
        self.assertEqual(
            _resolve_client_ip('172.18.0.7', '203.0.113.8, 10.0.0.4', trusted),
            '203.0.113.8',
        )

    def test_fully_trusted_chain_uses_leftmost_address(self):
        trusted = _parse_trusted_proxies('172.18.0.7/32, 10.0.0.0/8')
        self.assertEqual(
            _resolve_client_ip('172.18.0.7', '10.0.0.21, 10.0.0.4', trusted),
            '10.0.0.21',
        )

    def test_malformed_prefix_is_ignored_after_untrusted_hop(self):
        trusted = _parse_trusted_proxies('172.18.0.7/32, 10.0.0.0/8')
        self.assertEqual(
            _resolve_client_ip(
                '172.18.0.7', 'not-an-ip, 203.0.113.8, 10.0.0.4', trusted
            ),
            '203.0.113.8',
        )

    def test_malformed_trusted_suffix_falls_back_to_peer(self):
        trusted = _parse_trusted_proxies('172.18.0.7/32, 10.0.0.0/8')
        self.assertEqual(
            _resolve_client_ip(
                '172.18.0.7', '203.0.113.8, not-an-ip, 10.0.0.4', trusted
            ),
            '172.18.0.7',
        )

    def test_malformed_forwarded_chain_falls_back_to_peer(self):
        self.assertEqual(
            _resolve_client_ip(
                '172.18.0.7', 'not-an-ip', _parse_trusted_proxies('172.18.0.7/32')
            ),
            '172.18.0.7',
        )

    def test_ipv6_proxy_and_client_are_supported(self):
        self.assertEqual(
            _resolve_client_ip(
                '2001:db8::7',
                '2001:db8:1::5',
                _parse_trusted_proxies('2001:db8::7/128'),
            ),
            '2001:db8:1::5',
        )


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

    def setUp(self):
        MURMUR_AUTHENTICATOR_READY.set()
        self.addCleanup(MURMUR_AUTHENTICATOR_READY.clear)

    def test_netlify_provider_configured(self):
        from server import AUTH_PROVIDERS
        self.assertIn('netlify', AUTH_PROVIDERS)
        self.assertIsNotNone(AUTH_PROVIDERS['netlify']['userEndpoint'])
        self.assertEqual(AUTH_PROVIDERS['netlify']['subjectClaim'], 'id')
        self.assertEqual(AUTH_PROVIDERS['netlify']['rolesClaim'], 'app_metadata.roles')

    def test_all_providers_configure_display_name_claims(self):
        from server import AUTH_PROVIDERS

        self.assertEqual(AUTH_PROVIDERS['netlify']['displayNameClaim'], 'user_metadata.full_name')
        self.assertEqual(AUTH_PROVIDERS['supabase']['displayNameClaim'], 'user_metadata.full_name')
        self.assertEqual(AUTH_PROVIDERS['auth0']['displayNameClaim'], 'name')

    def test_supabase_provider_placeholder(self):
        from server import AUTH_PROVIDERS
        self.assertIn('supabase', AUTH_PROVIDERS)
        self.assertEqual(AUTH_PROVIDERS['supabase']['subjectClaim'], 'id')
        self.assertEqual(AUTH_PROVIDERS['supabase']['rolesClaim'], 'app_metadata.roles')

    @patch('server.validate_token')
    def test_netlify_credentials_use_stable_id_claim(self, mock_validate):
        mock_validate.return_value = {
            'id': 'netlify-identity-123',
            'app_metadata': {'roles': ['watch']},
            'user_metadata': {'full_name': 'Netlify User'},
        }
        handler = TestCredentialRateLimitOrdering._handler('Bearer ' + 'unit-test-token')

        handler.do_POST()

        response = handler.send_json.call_args.args
        self.assertEqual(response[0], 200)
        self.assertTrue(response[1]['mumbleUsername'].startswith('Netlify User ('))

    @patch('server.AUTH_PROVIDER', 'supabase')
    @patch('server.validate_token')
    def test_supabase_credentials_ignore_user_controlled_roles(self, mock_validate):
        from server import GUACAMOLE_PASSWORDS

        for app_roles, user_roles, expected_user in (
            (['watch'], ['admin'], 'watcher'),
            (['edit'], ['admin'], 'editor'),
            (['admin'], ['watch'], 'admin'),
        ):
            with self.subTest(app_roles=app_roles, user_roles=user_roles):
                rate_limiter.store.clear()
                mock_validate.return_value = {
                    'id': f'identity-{expected_user}',
                    'app_metadata': {'roles': app_roles},
                    'user_metadata': {'roles': user_roles},
                }
                handler = TestCredentialRateLimitOrdering._handler('Bearer token')
                handler.do_POST()
                response = handler.send_json.call_args.args
                self.assertEqual(response[0], 200)
                self.assertNotEqual(response[1]['mumblePassword'], 'test-mumble-password')
                self.assertTrue(response[1]['mumbleUsername'])
                self.assertEqual(response[1]['guacamoleUser'], expected_user)
                self.assertEqual(response[1]['guacamolePassword'], GUACAMOLE_PASSWORDS[expected_user])

    def test_credentials_fail_closed_when_murmur_authenticator_is_unavailable(self):
        MURMUR_AUTHENTICATOR_READY.clear()
        handler = TestCredentialRateLimitOrdering._handler('Bearer ' + 'unit-test-token')

        handler.do_POST()

        handler.send_json.assert_called_once_with(
            503, {'error': 'Mumble authentication is unavailable'}
        )

    @patch('server.validate_token')
    def test_credentials_require_a_stable_identity_subject(self, mock_validate):
        mock_validate.return_value = {
            'app_metadata': {'roles': ['watch']},
            'user_metadata': {'full_name': 'Test User'},
        }
        handler = TestCredentialRateLimitOrdering._handler('Bearer ' + 'unit-test-token')

        handler.do_POST()

        handler.send_json.assert_called_once_with(401, {'error': 'Invalid identity'})

    @patch('server.AUTH_PROVIDER', 'supabase')
    @patch('server.validate_token')
    def test_supabase_credentials_require_an_explicit_application_role(self, mock_validate):
        for app_metadata in ({}, {'roles': []}, {'roles': ['unknown', 'guest']}):
            with self.subTest(app_metadata=app_metadata):
                rate_limiter.store.clear()
                mock_validate.return_value = {
                    'app_metadata': app_metadata,
                    'user_metadata': {'roles': ['admin']},
                }
                handler = TestCredentialRateLimitOrdering._handler(
                    'Bearer ' + 'unit-test-token'
                )
                handler.do_POST()
                handler.send_json.assert_called_once_with(
                    403, {'error': 'User is not authorized'}
                )

    def test_auth0_provider_placeholder(self):
        from server import AUTH_PROVIDERS
        self.assertIn('auth0', AUTH_PROVIDERS)
        self.assertEqual(AUTH_PROVIDERS['auth0']['subjectClaim'], 'sub')
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
            'https://welcome.flexpair.com/identity-proxy/user', 'token', None
        )


class TestCredentialGeneration(unittest.TestCase):
    """Tests for credential configuration."""

    def test_auth_server_does_not_configure_a_shared_mumble_password(self):
        import server
        self.assertFalse(hasattr(server, 'MUMBLE_PASSWORD'))

    def test_guacamole_passwords_exist(self):
        from server import GUACAMOLE_PASSWORDS
        self.assertIn('admin', GUACAMOLE_PASSWORDS)
        self.assertIn('editor', GUACAMOLE_PASSWORDS)
        self.assertIn('watcher', GUACAMOLE_PASSWORDS)

    def test_server_does_not_require_a_shared_mumble_password(self):
        module = import_server_with_environment({
            'GUAC_ADMIN_PASSWORD': 'admin-password',
            'GUAC_EDITOR_PASSWORD': 'editor-password',
            'GUAC_WATCHER_PASSWORD': 'watcher-password',
            'TRUSTED_PROXIES': '127.0.0.1',
        })
        self.assertFalse(hasattr(module, 'MUMBLE_PASSWORD'))

    def test_server_requires_every_guacamole_password(self):
        for missing_name in (
            'GUAC_ADMIN_PASSWORD',
            'GUAC_EDITOR_PASSWORD',
            'GUAC_WATCHER_PASSWORD',
        ):
            with self.subTest(missing_name=missing_name):
                environment = {
                    'GUAC_ADMIN_PASSWORD': 'admin-password',
                    'GUAC_EDITOR_PASSWORD': 'editor-password',
                    'GUAC_WATCHER_PASSWORD': 'watcher-password',
                    'TRUSTED_PROXIES': '127.0.0.1',
                }
                environment[missing_name] = ''
                with self.assertRaisesRegex(RuntimeError, f'{missing_name} must be configured'):
                    import_server_with_environment(environment)

    def test_guacamole_passwords_never_fall_back_to_mumble_password(self):
        module = import_server_with_environment({
            'GUAC_ADMIN_PASSWORD': 'admin-password',
            'GUAC_EDITOR_PASSWORD': 'editor-password',
            'GUAC_WATCHER_PASSWORD': 'watcher-password',
            'TRUSTED_PROXIES': '127.0.0.1',
        })
        self.assertEqual(module.GUACAMOLE_PASSWORDS, {
            'admin': 'admin-password',
            'editor': 'editor-password',
            'watcher': 'watcher-password',
        })

    def test_server_rejects_duplicate_guacamole_passwords(self):
        with self.assertRaisesRegex(RuntimeError, 'Guacamole role passwords must be distinct'):
            import_server_with_environment({
                'GUAC_ADMIN_PASSWORD': 'same-password',
                'GUAC_EDITOR_PASSWORD': 'same-password',
                'GUAC_WATCHER_PASSWORD': 'watcher-password',
                'TRUSTED_PROXIES': '127.0.0.1',
            })


class TestTrustedProxyConfiguration(unittest.TestCase):
    def setUp(self):
        self.environment = {
            'GUAC_ADMIN_PASSWORD': 'admin-password',
            'GUAC_EDITOR_PASSWORD': 'editor-password',
            'GUAC_WATCHER_PASSWORD': 'watcher-password',
        }

    def test_server_requires_trusted_proxies(self):
        for value in (None, '', ' \t\n ', ' , , '):
            with self.subTest(value=value):
                environment = self.environment.copy()
                if value is not None:
                    environment['TRUSTED_PROXIES'] = value
                with self.assertRaisesRegex(RuntimeError, 'TRUSTED_PROXIES must be configured'):
                    import_server_with_environment(environment)

    def test_server_rejects_invalid_trusted_proxy(self):
        with self.assertRaises(ValueError):
            import_server_with_environment({**self.environment, 'TRUSTED_PROXIES': 'foo'})

    def test_server_parses_trusted_proxies(self):
        for value, expected in (
            ('192.0.2.1', ('192.0.2.1/32',)),
            ('192.0.2.0/24', ('192.0.2.0/24',)),
            ('192.0.2.1, 2001:db8::/32', ('192.0.2.1/32', '2001:db8::/32')),
        ):
            with self.subTest(value=value):
                module = import_server_with_environment({**self.environment, 'TRUSTED_PROXIES': value})
                self.assertEqual(module.TRUSTED_PROXIES, tuple(map(ipaddress.ip_network, expected)))


class TestExecuteAuthRequest(unittest.TestCase):
    """Tests for _execute_auth_request retry/error handling."""

    def _mock_response(self, status=200, body=b'{"ok": true}'):
        response = MagicMock()
        response.status = status
        response.fp = None
        response.read1.side_effect = [
            body[index:index + 4096] for index in range(0, len(body), 4096)
        ] + [b'']
        response.__enter__.return_value = response
        response.__exit__.return_value = False
        return response

    @patch('server.urllib.request.build_opener')
    def test_success_on_first_attempt(self, mock_build_opener):
        mock_opener = MagicMock()
        mock_opener.open.return_value = self._mock_response()
        mock_build_opener.return_value = mock_opener
        result = _execute_auth_request('https://example.com', 'token')
        self.assertEqual(result, {'ok': True})
        self.assertEqual(mock_opener.open.call_count, 1)
        redirect_handler = mock_build_opener.call_args.args[0]
        self.assertEqual(type(redirect_handler).__name__, '_NoRedirectHandler')
        self.assertIsNone(
            redirect_handler.redirect_request(None, None, 302, 'Found', {}, 'https://example.com')
        )

    @patch('server.urllib.request.build_opener')
    def test_http_error_returns_none_immediately(self, mock_build_opener):
        mock_opener = MagicMock()
        mock_opener.open.side_effect = urllib.error.HTTPError(
            'https://example.com', 401, 'Unauthorized', {}, None
        )
        mock_build_opener.return_value = mock_opener
        result = _execute_auth_request('https://example.com', 'token')
        self.assertIsNone(result)
        self.assertEqual(mock_opener.open.call_count, 1)

    @patch('server.time_mod.sleep', return_value=None)
    @patch('server.urllib.request.build_opener')
    def test_url_error_retries_then_succeeds(self, mock_build_opener, mock_sleep):
        mock_opener = MagicMock()
        mock_opener.open.side_effect = [
            urllib.error.URLError('network down'),
            self._mock_response(),
        ]
        mock_build_opener.return_value = mock_opener
        result = _execute_auth_request('https://example.com', 'token')
        self.assertEqual(result, {'ok': True})
        self.assertEqual(mock_opener.open.call_count, 2)
        self.assertEqual(mock_sleep.call_count, 1)

    @patch('server.time_mod.sleep', return_value=None)
    @patch('server.urllib.request.build_opener')
    def test_exhausted_retries_returns_none(self, mock_build_opener, mock_sleep):
        mock_opener = MagicMock()
        mock_opener.open.side_effect = urllib.error.URLError('network down')
        mock_build_opener.return_value = mock_opener
        result = _execute_auth_request('https://example.com', 'token')
        self.assertIsNone(result)
        self.assertEqual(mock_opener.open.call_count, 3)

    def test_retry_delay_stops_at_absolute_deadline(self):
        now = [5.0]
        mock_opener = MagicMock()
        mock_opener.open.side_effect = urllib.error.URLError('network down')

        with patch('server.time_mod.monotonic', side_effect=lambda: now[0]):
            with patch(
                'server.time_mod.sleep',
                side_effect=lambda delay: now.__setitem__(0, now[0] + delay),
            ) as mock_sleep:
                with patch(
                    'server.urllib.request.build_opener', return_value=mock_opener
                ):
                    result = _execute_auth_request(
                        'https://example.com', 'token', deadline=5.2
                    )

        self.assertIsNone(result)
        self.assertEqual(mock_opener.open.call_count, 1)
        self.assertAlmostEqual(mock_opener.open.call_args.kwargs['timeout'], 0.2)
        self.assertAlmostEqual(mock_sleep.call_args.args[0], 0.2)
        self.assertEqual(mock_sleep.call_count, 1)

    def test_provider_response_reads_use_remaining_deadline(self):
        now = [10.0]
        response = self._mock_response()
        response_socket = MagicMock()
        response.fp = SimpleNamespace(
            fp=SimpleNamespace(raw=SimpleNamespace(_sock=response_socket))
        )
        mock_opener = MagicMock()
        mock_opener.open.return_value = response

        with patch('server.time_mod.monotonic', side_effect=lambda: now[0]):
            with patch(
                'server.urllib.request.build_opener', return_value=mock_opener
            ):
                result = _execute_auth_request(
                    'https://example.com', 'token', deadline=12.0
                )

        self.assertEqual(result, {'ok': True})
        mock_opener.open.assert_called_once()
        self.assertEqual(mock_opener.open.call_args.kwargs['timeout'], 2.0)
        self.assertTrue(response_socket.settimeout.called)
        self.assertTrue(all(
            call.args == (2.0,) for call in response_socket.settimeout.call_args_list
        ))

    def test_provider_response_read_stops_when_deadline_expires(self):
        now = [10.0]
        response = self._mock_response()
        response_socket = MagicMock()
        response.fp = SimpleNamespace(
            fp=SimpleNamespace(raw=SimpleNamespace(_sock=response_socket))
        )

        def delayed_read(size):
            now[0] += 0.6
            return b'{'

        response.read1.side_effect = delayed_read
        mock_opener = MagicMock()
        mock_opener.open.return_value = response

        with patch('server.time_mod.monotonic', side_effect=lambda: now[0]):
            with patch(
                'server.urllib.request.build_opener', return_value=mock_opener
            ):
                result = _execute_auth_request(
                    'https://example.com', 'token', deadline=11.0
                )

        self.assertIsNone(result)
        self.assertEqual(response.read1.call_count, 2)
        self.assertTrue(all(
            call.args == (4096,) for call in response.read1.call_args_list
        ))
        timeouts = [
            call.args[0] for call in response_socket.settimeout.call_args_list
        ]
        self.assertEqual(len(timeouts), 2)
        self.assertAlmostEqual(timeouts[0], 1.0)
        self.assertAlmostEqual(timeouts[1], 0.4)

    def test_expired_deadline_suppresses_response_write(self):
        handler = AuthHandler.__new__(AuthHandler)
        handler.rfile = _DeadlineReader(MagicMock(), MagicMock(), timeout=1)
        handler.rfile.deadline = 1.0
        handler.request = MagicMock()
        handler.close_connection = False
        handler.send_response = MagicMock()

        with patch('server.time_mod.monotonic', return_value=2.0):
            handler.send_json(200, {'status': 'ok'})

        handler.send_response.assert_not_called()
        handler.request.settimeout.assert_not_called()
        self.assertTrue(handler.close_connection)

    @patch('server.urllib.request.build_opener')
    def test_non_200_status_returns_none(self, mock_build_opener):
        mock_opener = MagicMock()
        mock_opener.open.return_value = self._mock_response(status=500, body=b'')
        mock_build_opener.return_value = mock_opener
        result = _execute_auth_request('https://example.com', 'token')
        self.assertIsNone(result)

if __name__ == '__main__':
    unittest.main(verbosity=2)
