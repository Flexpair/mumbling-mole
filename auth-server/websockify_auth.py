import ipaddress
import os
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from websockify.auth_plugins import AuthenticationError, BasePlugin


TRUSTED_PROXIES = tuple(
    ipaddress.ip_network(value.strip(), strict=False)
    for value in os.environ.get('TRUSTED_PROXIES', '').split(',')
    if value.strip()
)

AUTHENTICATION_REQUIRED_MESSAGE = 'WebSocket authentication required'
AUTHORIZATION_UNAVAILABLE_MESSAGE = 'WebSocket authorization unavailable'
AUTHORIZATION_DENIED_MESSAGE = 'WebSocket authorization denied'


class MumbleTokenAuth(BasePlugin):
    protocol_prefix = 'mumble-auth.'

    def authenticate(self, headers, target_host, target_port):
        protocols = [
            protocol.strip()
            for protocol in headers.get('Sec-WebSocket-Protocol', '').split(',')
        ]
        tokens = [
            protocol[len(self.protocol_prefix):]
            for protocol in protocols
            if protocol.startswith(self.protocol_prefix)
        ]
        if len(tokens) != 1 or not tokens[0]:
            raise AuthenticationError(
                response_code=401,
                response_msg=AUTHENTICATION_REQUIRED_MESSAGE,
            )

        peer_ip = headers.get('X-Websockify-Peer-IP')
        try:
            peer_address = ipaddress.ip_address(peer_ip)
        except (TypeError, ValueError):
            raise AuthenticationError(
                response_code=503,
                response_msg=AUTHORIZATION_UNAVAILABLE_MESSAGE,
            )

        request_headers = {'Authorization': 'Bearer ' + tokens[0]}
        forwarded_for = headers.get('X-Forwarded-For')
        if (
            forwarded_for
            and len(forwarded_for) <= 256
            and any(peer_address in network for network in TRUSTED_PROXIES)
        ):
            request_headers['X-Forwarded-For'] = forwarded_for
        else:
            request_headers['X-Forwarded-For'] = str(peer_address)

        request = Request(self.source, headers=request_headers, method='POST')
        try:
            with urlopen(request, timeout=5) as response:
                if response.status != 200:
                    raise AuthenticationError(
                        response_code=503,
                        response_msg=AUTHORIZATION_UNAVAILABLE_MESSAGE,
                    )
        except HTTPError as error:
            status = error.code if error.code in {401, 403, 429} else 503
            raise AuthenticationError(
                response_code=status,
                response_msg=AUTHORIZATION_DENIED_MESSAGE,
            ) from error
        except OSError as error:
            raise AuthenticationError(
                response_code=503,
                response_msg=AUTHORIZATION_UNAVAILABLE_MESSAGE,
            ) from error
