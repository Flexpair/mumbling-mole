#!/usr/bin/env python3
"""
Auth Server for Mumble Web Client (Python version)

Validates Netlify Identity JWT tokens and returns server credentials.
Zero additional dependencies - uses only Python stdlib.
"""

import hashlib
import http.server
import json
import os
import secrets
import socketserver
import threading
import time as time_mod
import urllib.request
import urllib.error
from collections import defaultdict
from time import time
from typing import Any, Optional
from urllib.parse import urlsplit

PORT = int(os.environ.get('AUTH_SERVER_PORT', 8082))
# Binding to 0.0.0.0 is intentional - server runs in container behind nginx
HOST = os.environ.get('AUTH_SERVER_HOST', '0.0.0.0')  # nosec B104

def generate_secure_password(length: int = 32) -> str:
    """Generate a cryptographically secure URL-safe password.
    
    Args:
        length: Desired output length (not byte count). The function generates
                more bytes than needed and slices to exact length.
    """
    return secrets.token_urlsafe(length)[:length]


MUMBLE_PASSWORD = os.environ.get('MUMBLE_PASSWORD') or generate_secure_password(32)
GUACAMOLE_PASSWORDS = {
    'admin': os.environ.get('GUAC_ADMIN_PASSWORD') or MUMBLE_PASSWORD,
    'editor': os.environ.get('GUAC_EDITOR_PASSWORD') or MUMBLE_PASSWORD,
    'watcher': os.environ.get('GUAC_WATCHER_PASSWORD') or MUMBLE_PASSWORD
}

AUTH_PROVIDER = os.environ.get('AUTH_PROVIDER', 'netlify')
AUTH_PROVIDERS = {
    'netlify': {
        'userEndpoint': os.environ.get('NETLIFY_IDENTITY_URL', 'https://welcome.flexpair.com/identity-proxy'),
        'rolesClaim': 'app_metadata.roles'
    },
    'supabase': {
        'userEndpoint': f"{os.environ.get('SUPABASE_URL')}/auth/v1" if os.environ.get('SUPABASE_URL') else None,
        'rolesClaim': 'user_metadata.roles'
    },
    'auth0': {
        'userEndpoint': f"https://{os.environ.get('AUTH0_DOMAIN')}" if os.environ.get('AUTH0_DOMAIN') else None,
        'rolesClaim': 'https://flexpair.com/roles'
    }
}

class RateLimiter:
    """Manages rate limiting with thread-safe timestamp tracking."""
    def __init__(self, window_seconds: int = 15 * 60, max_requests: int = 30):
        self.store: dict = defaultdict(list)
        self.window = window_seconds
        self.max_requests = max_requests
        self.last_cleanup = time()
        self.cleanup_interval = min(window_seconds, 60)
        self.lock = threading.Lock()

    def check(self, client_ip: str) -> bool:
        """Check if client has exceeded rate limit. Returns True if allowed."""
        now = time()
        with self.lock:
            if now - self.last_cleanup >= self.cleanup_interval:
                self._cleanup_unsafe(now)
                self.last_cleanup = now

            # Clean old entries for this IP
            self.store[client_ip] = [
                timestamp for timestamp in self.store[client_ip]
                if now - timestamp < self.window
            ]
            
            if len(self.store[client_ip]) >= self.max_requests:
                return False
                
            self.store[client_ip].append(now)
            return True

    def cleanup(self):
        """Periodically remove empty IPs to prevent memory leaks."""
        with self.lock:
            now = time()
            self._cleanup_unsafe(now)
            self.last_cleanup = now

    def _cleanup_unsafe(self, now: float):
        expired_ips = []
        for ip, timestamps in self.store.items():
            active_timestamps = [
                timestamp for timestamp in self.store[ip]
                if now - timestamp < self.window
            ]
            if active_timestamps:
                self.store[ip] = active_timestamps
            else:
                expired_ips.append(ip)

        for ip in expired_ips:
            del self.store[ip]

# Initialize global rate limiter
rate_limiter = RateLimiter()


def _normalize_origin(origin: Optional[str]) -> Optional[str]:
    """Return a canonical HTTP origin, rejecting paths and credentials."""
    if not isinstance(origin, str):
        return None

    try:
        parsed = urlsplit(origin.strip())
        port = parsed.port
    except ValueError:
        return None
    if (
        parsed.scheme.lower() not in {'http', 'https'}
        or not parsed.netloc
        or parsed.hostname is None
        or parsed.path not in {'', '/'}
        or parsed.query
        or parsed.fragment
        or parsed.username is not None
        or parsed.password is not None
    ):
        return None

    hostname = parsed.hostname.lower()
    if ':' in hostname:
        hostname = f'[{hostname}]'
    if port is not None:
        hostname = f'{hostname}:{port}'
    return f'{parsed.scheme.lower()}://{hostname}'


def _get_cors_origin(origin: Optional[str]) -> Optional[str]:
    """Return an allowed origin from AUTH_ALLOWED_ORIGINS, never a wildcard."""
    normalized_origin = _normalize_origin(origin)
    if normalized_origin is None:
        return None

    configured_origins = {
        normalized
        for configured in os.environ.get('AUTH_ALLOWED_ORIGINS', '').split(',')
        if (normalized := _normalize_origin(configured)) is not None
    }
    return normalized_origin if normalized_origin in configured_origins else None


def _get_cors_headers(origin: Optional[str]) -> dict[str, str]:
    """Build CORS headers for an explicitly configured origin."""
    allowed_origin = _get_cors_origin(origin)
    headers = {'Vary': 'Origin'}
    if allowed_origin is not None:
        headers.update({
            'Access-Control-Allow-Origin': allowed_origin,
            'Access-Control-Allow-Headers': 'Authorization, Content-Type',
            'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        })
    return headers


def get_nested_property(obj: dict, path: str) -> Any:
    """Extract nested property using dot notation (e.g., 'app_metadata.roles')."""
    result: Any = obj
    for part in path.split('.'):
        if isinstance(result, dict):
            result = result.get(part)
        else:
            return None
    return result


def get_guacamole_user(roles: Any) -> str:
    """Determine Guacamole user from roles."""
    if not roles or not isinstance(roles, list):
        return 'watcher'
    if 'admin' in roles:
        return 'admin'
    if 'edit' in roles:
        return 'editor'
    return 'watcher'


def _is_valid_url_scheme(url: str) -> bool:
    """Validate URL scheme for security (OWASP A10 SSRF prevention).
    
    Only https:// is allowed by default. http:// requires AUTH_ALLOW_HTTP=true.
    """
    if url.startswith('https://'):
        return True
    if url.startswith('http://'):
        return os.environ.get('AUTH_ALLOW_HTTP', '').lower() == 'true'
    return False



def _execute_auth_request(url: str, token: str) -> Optional[dict]:
    """Execute the HTTP request to the auth provider with retry logic."""
    max_retries = 3
    base_delay = 0.5

    req = urllib.request.Request(
        url,
        headers={
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    )

    for attempt in range(max_retries):
        try:
            return _make_single_request(req)
        except urllib.error.HTTPError as e:
            print(f'[AUTH] Token validation failed: {e.code}')
            return None
        except urllib.error.URLError as e:
            print(f'[AUTH] Token validation network error on attempt {attempt + 1}: {e.reason}')
        except (json.JSONDecodeError, OSError) as e:
            print(f'[AUTH] Token validation error on attempt {attempt + 1}: {e}')

        if attempt == max_retries - 1:
            return None
        time_mod.sleep(base_delay * (2 ** attempt))
    
    return None


def _make_single_request(req: urllib.request.Request) -> Optional[dict]:
    """Helper to perform a single urlopen request and parse JSON."""
    # URL scheme validated by _is_valid_url_scheme(), safe to use urlopen
    # nosemgrep: python.lang.security.audit.dynamic-urllib-use-detected.dynamic-urllib-use-detected, python_urlopen_rule-urllib-urlopen
    with urllib.request.urlopen(req, timeout=10) as response:  # nosec B310
        if response.status != 200:
            print(f'[AUTH] Token validation failed: {response.status}')
            return None
        return json.loads(response.read().decode('utf-8'))



def validate_token(token: str, provider_config: dict) -> Optional[dict]:
    """Validate JWT by calling the auth provider's user endpoint."""
    endpoint = provider_config.get('userEndpoint')
    if not endpoint:
        print('[AUTH] Provider endpoint not configured')
        return None

    url = f"{endpoint}/user"
    if not _is_valid_url_scheme(url):
        print(f'[AUTH] Invalid URL scheme, must be https (http requires AUTH_ALLOW_HTTP=true): {url[:50]}')
        return None


    return _execute_auth_request(url, token)



def hash_email(email: Optional[str]) -> str:
    """Hash email for privacy-compliant logging (GDPR/CCPA)."""
    if not email:
        return 'unknown'
    return hashlib.sha256(email.encode()).hexdigest()[:8]





def _extract_token(auth_header: str) -> Optional[str]:
    """Extract and validate token from Authorization header."""
    if not auth_header.startswith('Bearer '):
        return None
    token = auth_header[7:].strip()
    return token if token else None


def _extract_roles(user: dict, roles_claim: str) -> list:
    """Extract roles from user object, ensuring list format."""
    raw_roles = get_nested_property(user, roles_claim)
    if isinstance(raw_roles, list):
        return raw_roles
    if raw_roles:
        return [str(raw_roles)]
    return []


class AuthHandler(http.server.BaseHTTPRequestHandler):
    """HTTP request handler for auth endpoints."""

    def log_message(self, fmt, *args):  # pylint: disable=arguments-differ
        """Override to use custom log format."""
        print(f'[AUTH] {self.address_string()} - {fmt % args}')

    def send_json(self, status: int, data: dict):
        """Send JSON response with security and CORS headers."""
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        # Security headers (OWASP recommendations)
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'DENY')
        self.send_header('X-XSS-Protection', '1; mode=block')
        self._send_cors_headers()
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def _send_cors_headers(self):
        """Send CORS headers only for an explicitly configured origin."""
        for name, value in _get_cors_headers(self.headers.get('Origin')).items():
            self.send_header(name, value)

    def do_OPTIONS(self):
        """Handle CORS preflight requests."""
        self.send_response(204)
        self._send_cors_headers()
        self.end_headers()

    def do_GET(self):
        """Handle GET requests (health check only)."""
        if self.path == '/api/health':
            self.send_json(200, {'status': 'ok', 'provider': AUTH_PROVIDER})
        else:
            self.send_json(404, {'error': 'Not found'})

    def _check_rate_limit(self) -> bool:
        client_ip = self.client_address[0]
        if not rate_limiter.check(client_ip):
            self.send_json(429, {'error': 'Too many authentication attempts, please try again later'})
            return False
        return True

    def _get_token_from_header(self) -> Optional[str]:
        auth_header = self.headers.get('Authorization', '')
        token = _extract_token(auth_header)
        if not token:
            self.send_json(401, {'error': 'Missing authorization header'})
            return None
        return token

    def do_POST(self):
        """Handle POST requests (credentials endpoint)."""
        if self.path != '/api/credentials':
            self.send_json(404, {'error': 'Not found'})
            return


        if not self._check_rate_limit():

            return

        token = self._get_token_from_header()
        if not token:
            return

        provider_config = AUTH_PROVIDERS.get(AUTH_PROVIDER)
        if not provider_config:
            print(f'[AUTH] Unknown provider: {AUTH_PROVIDER}')
            self.send_json(500, {'error': 'Auth provider misconfigured'})
            return

        user = validate_token(token, provider_config)
        if not user:
            self.send_json(401, {'error': 'Invalid or expired token'})
            return

        roles = _extract_roles(user, provider_config['rolesClaim'])
        guacamole_user = get_guacamole_user(roles)

        print(
            f"[AUTH] Credentials issued for user:{hash_email(user.get('email'))} "
            f"(roles: {', '.join(map(str, roles))})"
        )

        self.send_json(200, {
            'mumblePassword': MUMBLE_PASSWORD,
            'guacamoleUser': guacamole_user,
            'guacamolePassword': GUACAMOLE_PASSWORDS[guacamole_user]
        })


class ThreadedHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    """HTTP server with threading support for concurrent requests."""
    allow_reuse_address = True
    daemon_threads = True


def main():
    print(f'[AUTH] Server listening on {HOST}:{PORT}')
    print(f'[AUTH] Provider: {AUTH_PROVIDER}')
    print(f"[AUTH] Mumble password configured: {'yes' if MUMBLE_PASSWORD else 'no'}")

    server = ThreadedHTTPServer((HOST, PORT), AuthHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\n[AUTH] Shutting down...')
    finally:
        server.shutdown()
        server.server_close()


if __name__ == '__main__':
    main()
