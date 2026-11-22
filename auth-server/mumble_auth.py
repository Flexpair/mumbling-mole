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


class MumbleIdentityRegistry:
    def __init__(self, database_path: str):
        if database_path != ':memory:':
            Path(database_path).parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._database = sqlite3.connect(database_path, check_same_thread=False)
        self._database.execute(
            'CREATE TABLE IF NOT EXISTS identities ('
            'user_id INTEGER PRIMARY KEY AUTOINCREMENT, '
            'subject TEXT NOT NULL UNIQUE, '
            'username TEXT NOT NULL COLLATE NOCASE UNIQUE)'
        )
        self._database.commit()

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

            username = get_mumble_username(subject, display_name)
            try:
                cursor = self._database.execute(
                    'INSERT INTO identities (subject, username) VALUES (?, ?)',
                    (subject, username),
                )
                self._database.commit()
            except sqlite3.IntegrityError as error:
                self._database.rollback()
                raise ValueError('Identity username collision') from error
            return MumbleIdentity(cursor.lastrowid + MUMBLE_USER_ID_OFFSET, username)

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
                'SELECT user_id, username FROM identities WHERE username = ? COLLATE NOCASE',
                (username,),
            ).fetchone()
        return MumbleIdentity(row[0] + MUMBLE_USER_ID_OFFSET, row[1]) if row else None


def get_mumble_username(subject: str, display_name: Optional[str] = None) -> str:
    display_value = display_name[:256] if isinstance(display_name, str) else ''
    display_value = unicodedata.normalize('NFC', display_value)
    display = ''.join(
        character for character in display_value
        if character.isalnum() or character in ' _.-'
    ).strip()
    display = display[:13].strip()
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
                username.casefold().encode('utf-8'),
                identity.username.casefold().encode('utf-8'),
            ):
                return None, True
            return identity, True

    def _remove_expired(self, now: float) -> None:
        for token, (_, expires_at) in list(self._sessions.items()):
            if expires_at <= now:
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

        slice_path = Path(__file__).with_name('MumbleServer.ice')
        Ice.loadSlice(f'-I{Ice.getSliceDir()} {slice_path}')
        import MumbleServer

        authenticator = self._authenticator

        class Servant(MumbleServer.ServerAuthenticator):
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
                return []

        communicator = Ice.initialize()
        adapter = communicator.createObjectAdapterWithEndpoints(
            'MumbleAuthenticator', self._callback_endpoint
        )
        servant = Servant()
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
                    meta = MumbleServer.MetaPrx.checkedCast(meta_proxy)
                    if meta is None:
                        raise RuntimeError('Murmur Meta proxy unavailable')
                    servers = meta.getBootedServers(context)
                    for server in servers:
                        server.setAuthenticator(callback, context)
                    if servers:
                        self._ready.set()
                    else:
                        self._ready.clear()
                except Exception:
                    self._ready.clear()
                    print('[AUTH] Murmur authenticator unavailable; retrying')
                self._stop.wait(2)
        finally:
            self._ready.clear()
            adapter.destroy()
            communicator.destroy()


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
