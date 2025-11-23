import { Transform } from 'node:stream';



/**
 * @typedef {('Opus')} Codec
 */

/**
 * The mode of voice transmission.
 * 0 is normal talking.
 * 31 is server loopback.
 * 1-30 when sent from the client is the whisper target.
 * 1-30 when sent from the server: 1 for channel whisper, 2 for direct whisper
 *
 * @typedef {number} VoiceMode
 */

/**
 * Data for a Mumble voice packet.
 * The {@link #source source property} is ignored if this packet is not
 * clientbound otherwise it is required.
 *
 * @typedef {object} VoiceData
 * @property {number} [source] - Session ID of source user
 * @property {VoiceMode} mode - Mode of the voice transmission
 * @property {Codec} codec - Codec used for encoding the voice data
 * @property {number} seqNum - Sequence number of the first voice frame
 * @property {boolean} end - Whether this is the last packet in this transmission
 * @property {Buffer} frames[] - Encoded voice frame
 * @property {object} [position] - Spacial position of the source
 * @property {number} position.x - X coordinate
 * @property {number} position.y - Y coordinate
 * @property {number} position.z - Z coordinate
 */

/**
 * Data for an audio channel ping packet.
 *
 * @typedef {object} PingData
 * @property timestamp The timestamp for this ping packet.
 */


/**
 * Transform stream for encoding {@link VoiceData Mumble voice packets}
 * and {@link PingData audio channel ping packets}.
 *
 * @constructor
 * @constructs Encoder
 * @param {('server'|'client')} dest - Where encoded packets are headed to.
 */
class Encoder extends Transform {
  constructor(dest) {
    if (dest != 'server' && dest != 'client') {
      throw new TypeError('dest has to be either "server" or "client"');
    }

    super({
      writableObjectMode: true
    });

    this._dest = dest;
  }

  _encodePingPacket(chunk) {
    // Header byte + Timestamp
    const buffer = Buffer.alloc(1 + 9);
    let offset = 0;
    offset += buffer.writeUInt8(0x20, offset); // Ping packet header
    offset += toVarint(chunk.timestamp).value.copy(buffer, offset);
    return buffer.slice(0, offset);
  }

  _encodeOpusFrames(chunk, callback) {
    if (chunk.frames.length > 1) {
      return callback(new Error('Opus only supports a single frame per packet'));
    }
    
    const endBit = chunk.end ? 0x2000 : 0;
    let voiceData;
    
    if (chunk.frames.length == 0) {
      voiceData = toVarint(endBit).value;
    } else {
      const frameSize = toVarint(chunk.frames[0].length | endBit);
      voiceData = Buffer.concat([frameSize.value, chunk.frames[0]]);
    }
    
    return { codecId: 4, voiceData };
  }

  _encodeVoiceData(chunk, callback) {
    if (chunk.codec == 'Opus') {
      return this._encodeOpusFrames(chunk, callback);
    } else {
      return callback(new TypeError('Unknown codec: ' + chunk.codec));
    }
  }

  _buildVoicePacket(codecId, chunk, voiceData) {
    // Header byte + Source Session Id + Sequence Number + Voice + Position Data
    const buffer = Buffer.alloc(1 + 9 + 9 + voiceData.length + 3 * 4);
    let offset = 0;
    
    offset += buffer.writeUInt8(codecId << 5 | chunk.mode, offset);
    
    if (this._dest == 'client') {
      offset += toVarint(chunk.source).value.copy(buffer, offset);
    }
    
    offset += toVarint(chunk.seqNum).value.copy(buffer, offset);
    offset += voiceData.copy(buffer, offset);
    
    if (chunk.position) {
      offset += buffer.writeFloatBE(chunk.position.x, offset);
      offset += buffer.writeFloatBE(chunk.position.y, offset);
      offset += buffer.writeFloatBE(chunk.position.z, offset);
    }
    
    return buffer.slice(0, offset);
  }

  _transform(chunk, encoding, callback) {
    // Special case: Ping packets
    if (chunk.timestamp !== undefined) {
      return callback(null, this._encodePingPacket(chunk));
    }

    const result = this._encodeVoiceData(chunk, callback);
    if (!result) return; // Error already sent via callback
    
    const { codecId, voiceData } = result;
    const buffer = this._buildVoicePacket(codecId, chunk, voiceData);
    
    callback(null, buffer);
  }
}

/**
 * Transform stream for decoding {@link VoiceData Mumble voice packets}
 * and {@link PingData audio channel ping packets}.
 *
 * @constructor
 * @constructs Decoder
 * @param {('server'|'client')} orig - Where encoded packets are coming from.
 */
class Decoder extends Transform {
  constructor(orig) {
    if (orig != 'server' && orig != 'client') {
      throw new TypeError('orig has to be either "server" or "client"');
    }

    super({
      readableObjectMode: true
    });

    this._orig = orig;
  }

  _parsePingPacket(chunk) {
    const val = fromVarint(chunk.slice(1));
    if (!val) return { error: 'invalid timestamp' };
    return { packet: { timestamp: val.value } };
  }

  _parseOpusFrames(chunk, offset) {
    const voiceLength = fromVarint(chunk.slice(offset));
    if (!voiceLength) return { error: 'invalid voice length' };
    
    const end = (voiceLength.value & 0x2000) > 0;
    voiceLength.value &= 0x1fff;
    offset += voiceLength.length;
    
    if (chunk.length < offset + voiceLength.value) {
      return { error: 'not enough voice data' };
    }
    
    const voice = chunk.slice(offset, offset + voiceLength.value);
    offset += voiceLength.value;
    
    return {
      frames: voice.length ? [voice] : [],
      end: end,
      codec: 'Opus',
      offset: offset
    };
  }

  _parsePositionalData(chunk, offset) {
    if (chunk.length > offset + 12) {
      return {
        x: chunk.readFloatBE(offset),
        y: chunk.readFloatBE(offset + 4),
        z: chunk.readFloatBE(offset + 8)
      };
    }
    return null;
  }

  _parseVoicePacket(chunk) {
    const packet = {};
    const codecId = chunk[0] >> 5;
    const target = chunk[0] & 0x1f;
    packet.target = ['normal', 'shout', 'whisper'][target] || 'loopback';
    
    let offset = 1;
    
    // Parse source if from server
    if (this._orig === 'server') {
      const source = fromVarint(chunk.slice(offset));
      if (!source) return { error: 'invalid source' };
      offset += source.length;
      packet.source = source.value;
    }
    
    // Parse sequence number
    const sequenceNumber = fromVarint(chunk.slice(offset));
    if (!sequenceNumber) return { error: 'invalid sequence number' };
    offset += sequenceNumber.length;
    packet.seqNum = sequenceNumber.value;
    
    // Parse voice frames by codec
    let voiceResult;
    if (codecId === 4) {
      voiceResult = this._parseOpusFrames(chunk, offset);
    } else {
      this.emit('unknown_codec', codecId);
      return { error: 'unknown codec ' + codecId };
    }
    
    if (voiceResult.error) return voiceResult;
    
    packet.frames = voiceResult.frames;
    packet.end = voiceResult.end;
    packet.codec = voiceResult.codec;
    offset = voiceResult.offset;
    
    // Parse positional data
    const position = this._parsePositionalData(chunk, offset);
    if (position) packet.position = position;
    
    return { packet: packet };
  }

  _transform(chunk, encoding, callback) {
    const reject = (reason) => {
      this.emit('debug', 'Failed to parse voice packet', reason, chunk);
      callback();
    };

    try {
      if (chunk.length === 0) return reject('empty');
      
      const codecId = chunk[0] >> 5;
      const result = (codecId === 1) 
        ? this._parsePingPacket(chunk)
        : this._parseVoicePacket(chunk);
      
      if (result.error) return reject(result.error);
      
      callback(null, result.packet);
    } catch (e) {
      reject(e.message);
    }
  }
}

// Functions below from node-mumble
// https://github.com/Rantanen/node-mumble/blob/master/LICENSE

/**
 * @summary Converts a number to Mumble varint.
 *
 * @see {@link http://mumble-protocol.readthedocs.org/en/latest/voice_data.html#variable-length-integer-encoding}
 *
 * @param {number} i - Integer to convert
 * @returns {Buffer} Varint encoded number
 */
function toVarint(i) {
    const arr = [];
    if (i < 0) {
        i = ~i;
        if (i <= 0x3) { return { value: Buffer.from([0xFC | i]), length: 1 }; }
        arr.push(0xF8);
    }

    if (i < 0x80) {
        arr.push(i);
    } else if (i < 0x4000) {
        arr.push((i >> 8) | 0x80, i & 0xFF);
    } else if (i < 0x200000) {
        arr.push((i >> 16) | 0xC0, (i >> 8) & 0xFF, i & 0xFF);
    } else if (i < 0x10000000) {
        arr.push((i >> 24) | 0xE0, (i >> 16) & 0xFF, (i >> 8) & 0xFF, i & 0xFF);
    } else if (i < 0x100000000) {
        arr.push(0xF0, (i >> 24) & 0xFF, (i >> 16) & 0xFF, (i >> 8) & 0xFF, i & 0xFF);
    } else {
        throw new TypeError('Non-integer values are not supported. (' + i + ')');
    }

    return {
        value: Buffer.from(arr),
        length: arr.length
    };
}

/**
 * @summary Converts a Mumble varint to an integer.
 *
 * @see {@link http://mumble-protocol.readthedocs.org/en/latest/voice_data.html#variable-length-integer-encoding}
 *
 * @param {Buffer} b - Varint to convert
 * @returns {number} Decoded integer
 */
function fromVarint(b) {
    if (b.length == 0) return null;
    let length = 1;
    let i, v = b[0];
    if ((v & 0x80) === 0x00) {
        i = (v & 0x7F);
    } else if ((v & 0xC0) === 0x80) {
        i = (v & 0x3F) << 8 | b[1];
        length = 2;
    } else if ((v & 0xF0) === 0xF0) {
        switch (v & 0xFC) {
        case 0xF0:
            i = b[1] << 24 | b[2] << 16 | b[3] << 8 | b[4];
            length = 5;
            break;
        case 0xF8: {
            const ret = fromVarint(b.slice(1));
            if (!ret) return ret;
            return {
                value: ~ret.value,
                length: 1 + ret.length
            };
        }
        case 0xFC:
            i = v & 0x03;
            i = ~i;
            break;
        default:
            return null;
        }
    } else if ((v & 0xF0) === 0xE0) {
        i = (v & 0x0F) << 24 | b[1] << 16 | b[2] << 8 | b[3];
        length = 4;
    } else if ((v & 0xE0) === 0xC0) {
        i = (v & 0x1F) << 16 | b[1] << 8 | b[2];
        length = 3;
    }

    return {
        value: i,
        length: length
    };
}

export { Encoder, Decoder };
export default {
  Encoder,
  Decoder
};
