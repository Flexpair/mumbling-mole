import { debugLog } from '../../utils/debug-utils.js';

export function handleServerConfig(client, payload) {
  // Server configuration (max message length, max bandwidth, etc.)
  debugLog('[ServerConfig]', {
    maxBandwidth: payload.maxBandwidth,
    maxMessageLength: payload.messageLength,
    maxImageLength: payload.imageMessageLength,
    maxUsers: payload.maxUsers,
    welcomeText: payload.welcomeText,
    allowHtml: payload.allowHtml,
    recordingAllowed: payload.recordingAllowed
  });
}

export function handleCodecVersion(client, payload) {
  // Server codec capabilities announcement
  debugLog('[CodecVersion]', {
    alpha: payload.alpha,
    beta: payload.beta,
    preferAlpha: payload.preferAlpha,
    opus: payload.opus
  });
}

export function handleCryptSetup(client, payload) {
  // UDP encryption setup (not used by WebSocket-based client)
  // Only log if client/server nonce present (indicates encryption handshake)
  if (payload.client_nonce || payload.server_nonce || payload.key) {
    debugLog('[CryptSetup]', 'UDP encryption keys exchanged (not used by WebSocket client)');
  }
}

export function handlePermissionQuery(client, payload) {
  // Server response to permission queries
  debugLog('[PermissionQuery]', {
    channelId: payload.channelId,
    permissions: payload.permissions,
    flush: payload.flush
  });
}

export function handleUserStats(client, payload) {
  // Detailed user statistics (bandwidth, packets, etc.)
  const session = payload.session;
  const user = client._userById[session];
  debugLog('[UserStats]', {
    user: user ? user.name : `session ${session}`,
    version: payload.version,
    certificates: payload.certificates?.length || 0,
    fromClient: payload.fromClient,
    fromServer: payload.fromServer,
    udpPackets: payload.udpPackets,
    tcpPackets: payload.tcpPackets,
    udpPingAvg: payload.udpPingAvg,
    tcpPingAvg: payload.tcpPingAvg,
    onlineSeconds: payload.onlinesecs,
    idleSeconds: payload.idlesecs,
    bandwidth: payload.bandwidth,
    opus: payload.opus,
    strongCertificate: payload.strongCertificate
  });
}

export function handleSuggestConfig(client, payload) {
  // Server suggestions for client configuration
  debugLog('[SuggestConfig]', {
    version: payload.version,
    positional: payload.positional,
    pushToTalk: payload.pushToTalk
  });
}
