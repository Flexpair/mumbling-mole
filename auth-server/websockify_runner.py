from websockify import websocketproxy


class PeerAwareProxyRequestHandler(websocketproxy.ProxyRequestHandler):
    def auth_connection(self):
        self.headers['X-Websockify-Peer-IP'] = self.client_address[0]
        super().auth_connection()


class PeerAwareWebSocketProxy(websocketproxy.WebSocketProxy):
    def __init__(self, *args, **kwargs):
        kwargs['RequestHandlerClass'] = PeerAwareProxyRequestHandler
        super().__init__(*args, **kwargs)


def main():
    websocketproxy.WebSocketProxy = PeerAwareWebSocketProxy
    websocketproxy.websockify_init()


if __name__ == '__main__':
    main()
