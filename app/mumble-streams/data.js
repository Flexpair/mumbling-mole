// Use pre-compiled static protobuf definitions (protobufjs/minimal) instead of dynamic parsing
// This saves ~200KB by avoiding the full protobufjs parser
import { MumbleProto } from './mumble-proto-minimal.js';
import { Transform } from 'node:stream';

const MAX_MESSAGE_SIZE = 16 * 1024 * 1024;
const MAX_FRAME_SIZE = MAX_MESSAGE_SIZE + 6;

const nameById = {
    0: 'Version',
    1: 'UDPTunnel',
    2: 'Authenticate',
    3: 'Ping',
    4: 'Reject',
    5: 'ServerSync',
    6: 'ChannelRemove',
    7: 'ChannelState',
    8: 'UserRemove',
    9: 'UserState',
    10: 'BanList',
    11: 'TextMessage',
    12: 'PermissionDenied',
    13: 'ACL',
    14: 'QueryUsers',
    15: 'CryptSetup',
    16: 'ContextActionModify',
    17: 'ContextAction',
    18: 'UserList',
    19: 'VoiceTarget',
    20: 'PermissionQuery',
    21: 'CodecVersion',
    22: 'UserStats',
    23: 'RequestBlob',
    24: 'ServerConfig',
    25: 'SuggestConfig'
};
const idByName = {};
for (const id in nameById) {
	idByName[nameById[id]] = id;
}

// Use pre-compiled message types from static module
const typeByName = {};
for (const key of Object.keys(nameById)) {
  const name = nameById[key];
  // UDPTunnel is handled specially (raw bytes) in encode/decode, but include
  // a placeholder in typeByName for API compatibility
  if (name === 'UDPTunnel') {
    typeByName[name] = { name: 'UDPTunnel', _isRawBytes: true };
  } else {
    typeByName[name] = MumbleProto[name];
  }
}

function encode(name, payload) {
  const type = typeByName[name];
  if (!type) {
    throw new Error('Unknown message: ' + name);
  }
  const data = payload || {};
  // Static module doesn't have verify(), create message directly
  const message = type.create(data);
  const buffer = type.encode(message).finish();
  return Buffer.from(buffer);
}

function decode(id, payload) {
	const name = nameById[id];
  if (!name) {
    throw new Error('Unknown message id: ' + id);
  }
  const type = typeByName[name];
  if (!type) {
    throw new Error('Unknown message: ' + name);
  }
  const data = payload || Buffer.alloc(0);
	return type.decode(data);
}

class Encoder extends Transform {
  constructor() {
    super({
      writableObjectMode: true
    });
  }

  _transform(chunk, encoding, callback) {
    if (typeof chunk.name !== 'string') {
      return callback(new TypeError('chunk.name is not a string'));
    }
    chunk.payload = chunk.payload || {};

    let data;
    if (chunk.name === 'UDPTunnel') {
      data = chunk.payload;
    } else {
      try {
        data = encode(chunk.name, chunk.payload);
      } catch (e) {
        callback(e);
        return;
      }
    }

    const header = Buffer.allocUnsafe(6);
    header.writeUInt16BE(idByName[chunk.name], 0);
    header.writeUInt32BE(data.length, 2);

    callback(null, Buffer.concat([header, data]));
  }
}

class Decoder extends Transform {
  constructor() {
    super({
      readableObjectMode: true
    });

    this._buffer = Buffer.allocUnsafe(1024);
    this._bufferSize = 0;
  }

  _ensureBufferCapacity(required) {
    if (this._buffer.length >= required) {
      return;
    }

    let capacity = this._buffer.length;
    while (capacity < required) {
      capacity = Math.min(capacity * 2, MAX_FRAME_SIZE);
    }

    const buffer = Buffer.allocUnsafe(capacity);
    this._buffer.copy(buffer, 0, 0, this._bufferSize);
    this._buffer = buffer;
  }

  _transform(chunk, encoding, callback) {
    let chunkOffset = 0;
    while (chunkOffset < chunk.length || this._bufferSize >= 6) {
      if (this._bufferSize < 6) {
        const headerBytes = Math.min(6 - this._bufferSize, chunk.length - chunkOffset);
        if (headerBytes === 0) {
          break;
        }
        this._ensureBufferCapacity(this._bufferSize + headerBytes);
        chunk.copy(this._buffer, this._bufferSize, chunkOffset, chunkOffset + headerBytes);
        this._bufferSize += headerBytes;
        chunkOffset += headerBytes;
        if (this._bufferSize < 6) {
          break;
        }
      }

      const type = this._buffer.readUInt16BE(0);
      const size = this._buffer.readUInt32BE(2);
      if (size > MAX_MESSAGE_SIZE) {
        return callback(new Error('Message size exceeds maximum of ' + MAX_MESSAGE_SIZE + ' bytes'));
      }

      const frameSize = 6 + size;
      const payloadBytes = Math.min(frameSize - this._bufferSize, chunk.length - chunkOffset);
      this._ensureBufferCapacity(this._bufferSize + payloadBytes);
      chunk.copy(this._buffer, this._bufferSize, chunkOffset, chunkOffset + payloadBytes);
      this._bufferSize += payloadBytes;
      chunkOffset += payloadBytes;

      if (this._bufferSize < frameSize) {
        break;
      }

      const typeName = nameById[type];
      const data = this._buffer.subarray(6, frameSize);
      let message;
      if (typeName === 'UDPTunnel') {
        message = Buffer.from(data);
      } else {
        try {
          message = decode(type, data);
        } catch (e) {
          return callback(e);
        }
      }

      this._bufferSize = 0;

      this.push({
        name: typeName,
        payload: message
      });
    }
    callback();
  }
}

export { Encoder, Decoder, typeByName as messages };
export default {
  Encoder,
  Decoder,
  messages: typeByName
};
