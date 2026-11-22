import sys
import threading
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from mumble_auth import MumbleAuthenticator, MumbleIdentityRegistry, MumbleSessionStore, MurmurIceAuthenticator

try:
    import Ice
except ImportError:
    Ice = None

SLICE_PATH = Path(__file__).with_name('MumbleServer.ice')


@unittest.skipUnless(Ice is not None and SLICE_PATH.is_file(), 'zeroc-ice and MumbleServer.ice are required')
class TestMurmurIceIntegration(unittest.TestCase):
    def test_authenticator_slice_signatures_and_return_values(self):
        slice_dir = Ice.getSliceDir()
        include = f'-I{slice_dir} ' if slice_dir else ''
        Ice.loadSlice(f'{include}{SLICE_PATH}')
        import MumbleServer

        communicator = Ice.initialize()
        adapter = communicator.createObjectAdapterWithEndpoints(
            'FakeMurmur', 'tcp -h 127.0.0.1 -p 0'
        )
        attached = threading.Event()

        class FakeServer(MumbleServer.Server):
            def id(self, current):
                return 1

            def setAuthenticator(self, authenticator_proxy, current):
                self.authenticator_proxy = authenticator_proxy
                attached.set()

        server = FakeServer()
        server_identity = Ice.stringToIdentity('FakeServer')
        server_proxy = MumbleServer.ServerPrx.uncheckedCast(adapter.add(server, server_identity))

        class FakeMeta(MumbleServer.Meta):
            def getBootedServers(self, current):
                return [server_proxy]

        meta_identity = Ice.stringToIdentity('FakeMeta')
        adapter.add(FakeMeta(), meta_identity)
        adapter.activate()
        meta_proxy = MumbleServer.MetaPrx.uncheckedCast(adapter.createProxy(meta_identity))
        ready = threading.Event()
        identities = MumbleIdentityRegistry(':memory:')
        sessions = MumbleSessionStore()
        identity = identities.get_or_create('integration-subject', 'Integration User')
        authenticator = MurmurIceAuthenticator(
            MumbleAuthenticator(identities, sessions),
            meta_proxy.ice_toString(),
            'integration-secret',
            'tcp -h 127.0.0.1 -p 0',
            ready,
        )

        try:
            authenticator.start()
            self.assertTrue(attached.wait(5), 'Murmur authenticator was not attached')
            self.assertTrue(ready.wait(5), 'Murmur authenticator was not ready')
            token = sessions.issue(identity)
            self.assertEqual(
                server.authenticator_proxy.authenticate(identity.username, token, [], '', False),
                (identity.user_id, identity.username, []),
            )
            self.assertEqual(
                server.authenticator_proxy.authenticate(identity.username, 'invalid-token', [], '', False),
                (-1, '', []),
            )
            self.assertEqual(
                server.authenticator_proxy.authenticate('Unknown User', 'invalid-token', [], '', False),
                (-2, '', []),
            )
            self.assertEqual(server.authenticator_proxy.idToTexture(identity.user_id), b'')
        finally:
            authenticator.stop()
            adapter.destroy()
            communicator.destroy()


if __name__ == '__main__':
    unittest.main()
