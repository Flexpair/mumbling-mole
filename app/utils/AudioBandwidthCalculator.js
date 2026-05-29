export function calcEnforcableBandwidth(bitrate, samplesPerPacket, sendPosition) {
  // IP + UDP + Crypt + Header + SeqNum (VarInt) + Codec Header + Optional Position
  // Codec Header depends on codec:
  //  - Opus is always 4 (just the length as VarInt)
  //  - CELT/Speex depends on frames (10ms) per packet (1 byte each)
  const codecHeaderBytes = Math.max(4, samplesPerPacket / 480);
  const packetBytes = 20 + 8 + 4 + 1 + 4 + codecHeaderBytes + (sendPosition ? 12 : 0);
  const packetsPerSecond = 48000 / samplesPerPacket;
  return Math.round(packetBytes * 8 * packetsPerSecond + bitrate);
}

export function getMaxBitrate(maxBandwidth, samplesPerPacket, sendPosition) {
  const overhead = calcEnforcableBandwidth(0, samplesPerPacket, sendPosition);
  return maxBandwidth - overhead;
}

export function getPreferredBitrate(preferredBitrate, maxBandwidth, samplesPerPacket, sendPosition) {
  if (preferredBitrate) {
    return preferredBitrate;
  }
  // If server doesn't send maxBandwidth, use a reasonable default (40000 bps = 40 kbit/s)
  if (maxBandwidth === undefined) {
    return 40000;
  }
  return getMaxBitrate(maxBandwidth, samplesPerPacket, sendPosition);
}

export function getActualBitrate(preferredBitrate, maxBandwidth, samplesPerPacket, sendPosition) {
  const bitrate = getPreferredBitrate(preferredBitrate, maxBandwidth, samplesPerPacket, sendPosition);
  
  // If server doesn't send maxBandwidth, use preferred bitrate
  if (maxBandwidth === undefined) {
    return bitrate;
  }
  
  const bandwidth = calcEnforcableBandwidth(bitrate, samplesPerPacket, sendPosition);
  if (bandwidth <= maxBandwidth) {
    return bitrate;
  } else {
    return getMaxBitrate(maxBandwidth, samplesPerPacket, sendPosition);
  }
}
