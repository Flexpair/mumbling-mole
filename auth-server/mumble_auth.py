import hashlib
import hmac
import os
import secrets
import sqlite3
import threading
import time
import unicodedata
from pathlib import Path
from typing import NamedTuple, Optional

MUMBLE_USER_ID_OFFSET = 1_000_000_000


class MumbleIdentity(NamedTuple):
    user_id: int
    username: str


def _unicode_casefold(value: str) -> str:
    return unicodedata.normalize('NFC', value).casefold()


class MumbleIdentityRegistry:
    def __init__(self, database_path: str):
        if database_path != ':memory:':
            Path(database_path).parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._database = sqlite3.connect(database_path, check_same_thread=False)
        table = self._database.execute(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'identities'"
        ).fetchone()
        if not table:
            self._database.execute(
                'CREATE TABLE identities ('
                'user_id INTEGER PRIMARY KEY AUTOINCREMENT, '
                'subject TEXT NOT NULL UNIQUE, '
                'username TEXT NOT NULL UNIQUE, '
                'username_key TEXT NOT NULL UNIQUE)'
            )
        else:
            columns = {
                row[1]
                for row in self._database.execute('PRAGMA table_info(identities)')
            }
            if 'username_key' not in columns:
                self._migrate_username_keys()
        self._database.commit()

    def _migrate_username_keys(self) -> None:
        self._database.execute('ALTER TABLE identities RENAME TO identities_legacy')
        self._database.execute(
            'CREATE TABLE identities ('
            'user_id INTEGER PRIMARY KEY AUTOINCREMENT, '
            'subject TEXT NOT NULL UNIQUE, '
            'username TEXT NOT NULL UNIQUE, '
            'username_key TEXT NOT NULL UNIQUE)'
        )
        used_keys = set()
        used_usernames = set()
        rows = self._database.execute(
            'SELECT user_id, subject, username FROM identities_legacy '
            'ORDER BY user_id'
        ).fetchall()
        for user_id, subject, username in rows:
            key = _unicode_casefold(username)
            candidate = username
            attempt = 2
            while candidate in used_usernames or key in used_keys:
                candidate = f'{username.removesuffix(")")[:29]}-{attempt})'
                key = _unicode_casefold(candidate)
                attempt += 1
            self._database.execute(
                'INSERT INTO identities '
                '(user_id, subject, username, username_key) VALUES (?, ?, ?, ?)',
                (user_id, subject, candidate, key),
            )
            used_keys.add(key)
            used_usernames.add(candidate)
        self._database.execute('DROP TABLE identities_legacy')

    def get_or_create(self, subject: str, display_name: Optional[str] = None) -> MumbleIdentity:
        if not isinstance(subject, str) or not subject or len(subject) > 512:
            raise ValueError('A stable identity subject is required')

        with self._lock:
            row = self._database.execute(
                'SELECT user_id, username FROM identities WHERE subject = ?',
                (subject,),
            ).fetchone()
            if row:
                return MumbleIdentity(row[0] + MUMBLE_USER_ID_OFFSET, row[1])

            base_username = get_mumble_username(subject, display_name)
            for attempt in range(1, 6):
                username = base_username if attempt == 1 else f'{base_username.removesuffix(")")[:29]}-{attempt})'
                try:
                    cursor = self._database.execute(
                        'INSERT INTO identities (subject, username, username_key) '
                        'VALUES (?, ?, ?)',
                        (subject, username, _unicode_casefold(username)),
                    )
                    self._database.commit()
                    return MumbleIdentity(cursor.lastrowid + MUMBLE_USER_ID_OFFSET, username)
                except sqlite3.IntegrityError:
                    self._database.rollback()
                    row = self._database.execute(
                        'SELECT user_id, username FROM identities WHERE subject = ?',
                        (subject,),
                    ).fetchone()
                    if row:
                        return MumbleIdentity(row[0] + MUMBLE_USER_ID_OFFSET, row[1])
                    collision = self._database.execute(
                        'SELECT 1 FROM identities WHERE username_key = ?',
                        (_unicode_casefold(username),),
                    ).fetchone()
                    if not collision:
                        raise
            raise ValueError('Identity username collision')

    def get_by_id(self, user_id: int) -> Optional[MumbleIdentity]:
        registry_id = user_id - MUMBLE_USER_ID_OFFSET
        if registry_id <= 0:
            return None
        with self._lock:
            row = self._database.execute(
                'SELECT user_id, username FROM identities WHERE user_id = ?',
                (registry_id,),
            ).fetchone()
        return MumbleIdentity(row[0] + MUMBLE_USER_ID_OFFSET, row[1]) if row else None

    def get_by_username(self, username: str) -> Optional[MumbleIdentity]:
        with self._lock:
            row = self._database.execute(
                'SELECT user_id, username FROM identities WHERE username_key = ?',
                (_unicode_casefold(username),),
            ).fetchone()
        return MumbleIdentity(row[0] + MUMBLE_USER_ID_OFFSET, row[1]) if row else None


def get_mumble_username(subject: str, display_name: Optional[str] = None) -> str:
    display_value = display_name[:256] if isinstance(display_name, str) else ''
    display_value = unicodedata.normalize('NFC', display_value)
    display = ''.join(
        character for character in display_value
        if character.isalnum() or character in ' _.-'
    ).strip()
    display = display[:13].strip() or 'user'
    suffix = hashlib.sha256(subject.encode('utf-8')).hexdigest()[:16]
    return f'{display} ({suffix})'


class MumbleSessionStore:
    def __init__(self, ttl_seconds: int = 60, max_sessions: int = 10000, clock=time.monotonic):
        self._ttl_seconds = ttl_seconds
        self._max_sessions = max_sessions
        self._clock = clock
        self._lock = threading.Lock()
        self._sessions = {}

    def issue(self, identity: MumbleIdentity) -> str:
        now = self._clock()
        with self._lock:
            self._remove_expired(now)
            if len(self._sessions) >= self._max_sessions:
                raise RuntimeError('Mumble session capacity reached')
            token = secrets.token_urlsafe(32)
            self._sessions[token] = (identity, now + self._ttl_seconds)
            return token

    def consume(self, username: str, token: str) -> tuple[Optional[MumbleIdentity], bool]:
        if not isinstance(username, str) or not isinstance(token, str):
            return None, False
        now = self._clock()
        with self._lock:
            session = self._sessions.pop(token, None)
            if session is None:
                return None, False
            identity, expires_at = session
            if expires_at <= now or not hmac.compare_digest(
                _unicode_casefold(username).encode('utf-8'),
                _unicode_casefold(identity.username).encode('utf-8'),
            ):
                return None, True
            return identity, True

    def _remove_expired(self, now: float) -> None:
        expired = [
            token
            for token, (_, expires_at) in self._sessions.items()
            if expires_at <= now
        ]
        for token in expired:
            del self._sessions[token]


class MumbleAuthenticator:
    def __init__(self, identities: MumbleIdentityRegistry, sessions: MumbleSessionStore):
        self._identities = identities
        self._sessions = sessions

    def authenticate(self, username: str, password: str) -> MumbleIdentity | int:
        identity, token_was_issued = self._sessions.consume(username, password)
        if identity:
            return identity
        if token_was_issued or self._identities.get_by_username(username):
            return -1
        return -2

    def get_by_id(self, user_id: int) -> Optional[MumbleIdentity]:
        return self._identities.get_by_id(user_id)

    def get_by_username(self, username: str) -> Optional[MumbleIdentity]:
        return self._identities.get_by_username(username)


def _build_servant(authenticator, mumble_server_module):
    class Servant(mumble_server_module.ServerAuthenticator):
        def __init__(self):
            self.authenticator = authenticator

        def authenticate(self, name, password, certificates, certificate_hash, certificate_strong, current):
            result = self.authenticator.authenticate(name, password)
            if isinstance(result, int):
                return result, '', []
            identity = result
            return identity.user_id, identity.username, []

        def getInfo(self, user_id, current):
            return False, {}

        def nameToId(self, name, current):
            identity = self.authenticator.get_by_username(name)
            return identity.user_id if identity else -2

        def idToName(self, user_id, current):
            identity = self.authenticator.get_by_id(user_id)
            return identity.username if identity else ''

        def idToTexture(self, user_id, current):
            return b''

    return Servant


class MurmurIceAuthenticator:
    def __init__(
        self,
        authenticator: MumbleAuthenticator,
        endpoint: str,
        secret: str,
        callback_endpoint: str,
        ready: threading.Event,
    ):
        self._authenticator = authenticator
        self._endpoint = endpoint
        self._secret = secret
        self._callback_endpoint = callback_endpoint
        self._ready = ready
        self._stop = threading.Event()
        self._thread = None

    def start(self) -> None:
        self._thread = threading.Thread(target=self._serve, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=5)

    def _serve(self) -> None:
        import Ice

        slice_path = Path('/usr/local/share/mumble/MumbleServer.ice')
        slice_dir = Ice.getSliceDir()
        include = f'-I{slice_dir} ' if slice_dir else ''
        Ice.loadSlice(f'{include}{slice_path}')
        import MumbleServer

        communicator = Ice.initialize()
        adapter = communicator.createObjectAdapterWithEndpoints(
            'MumbleAuthenticator', self._callback_endpoint
        )
        servant = _build_servant(self._authenticator, MumbleServer)()
        adapter.add(servant, Ice.stringToIdentity('MumbleAuthenticator'))
        adapter.activate()
        callback = MumbleServer.ServerAuthenticatorPrx.uncheckedCast(
            adapter.createProxy(Ice.stringToIdentity('MumbleAuthenticator'))
        )
        meta_proxy = communicator.stringToProxy(self._endpoint)
        context = {'secret': self._secret}

        try:
            while not self._stop.is_set():
                try:
                    self._attach_authenticator(MumbleServer, meta_proxy, callback, context)
                except Exception as error:
                    self._ready.clear()
                    print(
                        f'[AUTH] Murmur authenticator unavailable; retrying '
                        f'({type(error).__name__}: {self._redact(str(error))})'
                    )
                self._stop.wait(2)
        finally:
            self._ready.clear()
            adapter.destroy()
            communicator.destroy()

    def _attach_authenticator(self, mumble_server_module, meta_proxy, callback, context) -> None:
        meta = mumble_server_module.MetaPrx.checkedCast(meta_proxy)
        if meta is None:
            raise RuntimeError('Murmur Meta proxy unavailable')
        servers = meta.getBootedServers(context)
        for server in servers:
            server.setAuthenticator(callback, context)
        if servers:
            self._ready.set()
        else:
            self._ready.clear()

    def _redact(self, message: str) -> str:
        for sensitive in (self._secret, self._endpoint, self._callback_endpoint):
            if sensitive:
                message = message.replace(sensitive, '[redacted]')
        return message


def create_mumble_authenticator(
    identities: MumbleIdentityRegistry,
    sessions: MumbleSessionStore,
    ready: threading.Event,
) -> MurmurIceAuthenticator:
    endpoint = os.environ.get('MURMUR_ICE_ENDPOINT', '').strip()
    secret = os.environ.get('MURMUR_ICE_SECRET', '')
    callback_endpoint = os.environ.get('MURMUR_AUTH_CALLBACK_ENDPOINT', '').strip()
    if not endpoint or not secret or not callback_endpoint:
        raise RuntimeError('Murmur ICE endpoint, secret, and callback endpoint must be configured')
    return MurmurIceAuthenticator(
        MumbleAuthenticator(identities, sessions),
        endpoint,
        secret,
        callback_endpoint,
        ready,
    )
