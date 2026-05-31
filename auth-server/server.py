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
import urllib.request
import urllib.error
from collections import defaultdict
from time import time, sleep
from typing import Any, Optional

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
        self.lock = threading.Lock()

    def check(self, client_ip: str) -> bool:
        """Check if client has exceeded rate limit. Returns True if allowed."""
        now = time()
        
        with self.lock:
            # Opportunistic cleanup every minute to prevent unbounded memory growth
            if now - self.last_cleanup > 60:
                self._cleanup_unsafe()
                self.last_cleanup = now
                
            # Clean old entries for this IP
            self.store[client_ip] = [t for t in self.store[client_ip] if now - t < self.window]
            
            if len(self.store[client_ip]) >= self.max_requests:
                return False
                
            self.store[client_ip].append(now)
            return True

    def cleanup(self):
        """Periodically remove empty IPs to prevent memory leaks."""
        with self.lock:
            self._cleanup_unsafe()

    def _cleanup_unsafe(self):
        empty_ips = [ip for ip, timestamps in self.store.items() if not timestamps]
        for ip in empty_ips:
            del self.store[ip]

# Initialize global rate limiter
rate_limiter = RateLimiter()


def get_nested_property(obj: dict, path: str) -> Any:
    """Extract nested property using dot notation (e.g., 'app_metadata.roles')."""
    result: Any = obj
    for part in path.split('.'):
        if isinstance(result, dict):
            result = result.get(part)
        else:
            return None
    return result


def get_guacamole_user(roles: list) -> str:
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


def _execute_token_request(url: str, token: str) -> Optional[dict]:
    """Execute a single HTTP request for token validation."""
    req = urllib.request.Request(
        url,
        headers={
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    )
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

    max_retries = 3
    base_delay = 0.5

    for attempt in range(max_retries):
        try:
            return _execute_token_request(url, token)
        except urllib.error.HTTPError as e:
            print(f'[AUTH] Token validation failed: {e.code}')
            if e.code < 500 or attempt == max_retries - 1:
                return None
            sleep(base_delay * (2 ** attempt))
        except json.JSONDecodeError as e:
            print(f'[AUTH] Token validation JSON error: {e}')
            return None  # Fail fast, deterministic error
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            err_details = getattr(e, 'reason', e)
            print(f'[AUTH] Token validation error on attempt {attempt + 1}: {err_details}')
            if attempt == max_retries - 1:
                return None
            sleep(base_delay * (2 ** attempt))
    
    return None


def hash_email(email: str) -> str:
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
        # CORS headers - wildcard is acceptable as this is behind nginx proxy
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'Authorization, Content-Type')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def do_OPTIONS(self):
        """Handle CORS preflight requests."""
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'Authorization, Content-Type')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.end_headers()

    def do_GET(self):
        """Handle GET requests (health check only)."""
        if self.path == '/api/health':
            self.send_json(200, {'status': 'ok', 'provider': AUTH_PROVIDER})
        else:
            self.send_json(404, {'error': 'Not found'})

    def do_POST(self):
        """Handle POST requests (credentials endpoint)."""
        if self.path != '/api/credentials':
            self.send_json(404, {'error': 'Not found'})
            return

        # Rate limiting
        client_ip = self.client_address[0]
        if not rate_limiter.check(client_ip):
            self.send_json(429, {'error': 'Too many authentication attempts, please try again later'})
            return

        # Check authorization header
        auth_header = self.headers.get('Authorization', '')
        token = _extract_token(auth_header)
        if not token:
            self.send_json(401, {'error': 'Missing authorization header'})
            return

        provider_config = AUTH_PROVIDERS.get(AUTH_PROVIDER)

        if not provider_config:
            print(f'[AUTH] Unknown provider: {AUTH_PROVIDER}')
            self.send_json(500, {'error': 'Auth provider misconfigured'})
            return

        # Validate token
        user = validate_token(token, provider_config)
        if not user:
            self.send_json(401, {'error': 'Invalid or expired token'})
            return

        # Extract roles and determine access level
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
