export function handleServerSync(client, payload) {
  // This packet finishes the initialization phase
  const maxBandwidth = payload.maxBandwidth;
  client.self = client._userById[payload.session];
  client.maxBandwidth = maxBandwidth;
  client.welcomeMessage = payload.welcomeText;
  
  // Emit maxBandwidth change
  if (maxBandwidth !== undefined) {
    client.emit('maxBandwidthChange', maxBandwidth);
  }

  // Make sure we send regular ping packets to not get disconnected
  client._pinger = setInterval(() => {
    if (client._inFlightDataPings >= client._maxInFlightDataPings) {
      client._error('timeout');
      return;
    }
    const dataStats = client._dataStats.getAll();
    const voiceStats = client._voiceStats.getAll();
    const timestamp = Date.now();
    const pingPayload = {
      timestamp: timestamp
    };
    if (dataStats) {
      pingPayload.tcpPackets = dataStats.n;
      pingPayload.tcpPingAvg = dataStats.mean;
      pingPayload.tcpPingVar = dataStats.variance;
    }
    if (voiceStats) {
      pingPayload.udpPackets = voiceStats.n;
      pingPayload.udpPingAvg = voiceStats.mean;
      pingPayload.udpPingVar = voiceStats.variance;
    }
    client._send({
      name: 'Ping',
      payload: pingPayload
    });
    client._inFlightDataPings++;
  }, client._dataPingInterval);

  // We are now connected
  client.emit('connected');
}

export function handlePing(client, payload) {
  if (client._inFlightDataPings <= 0) {
    console.warn('Got unexpected ping message:', payload);
    return;
  }
  client._inFlightDataPings--;

  const now = Date.now();
  // Handle both Long objects and plain numbers
  const timestamp = payload.timestamp?.toNumber ? payload.timestamp.toNumber() : payload.timestamp;
  const duration = now - timestamp;
  client._dataStats.update(duration);
  client.emit('dataPing', duration);
}
