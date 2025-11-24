import protobufjs from 'protobufjs';
import { Transform } from 'node:stream';
import mumbleProtoContent from './Mumble.proto';

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

const root = protobufjs.parse(mumbleProtoContent, { alternateCommentMode: true }).root;
const mumbleNamespace = root.lookup('MumbleProto');
if (!mumbleNamespace) {
  throw new Error('Failed to load MumbleProto definitions');
}
const typeByName = {};
for (const key of Object.keys(nameById)) {
  const name = nameById[key];
  typeByName[name] = mumbleNamespace.lookupType(name);
};

function encode(name, payload) {
  const type = typeByName[name];
  if (!type) {
    throw new Error('Unknown message: ' + name);
  }
  const data = payload || {};
  const err = type.verify(data);
  if (err) {
    throw new Error(err);
  }
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

  _transform(chunk, encoding, callback) {
    if (this._buffer.length - this._bufferSize < chunk.length) {
      const oldBuffer = this._buffer;
      this._buffer = Buffer.allocUnsafe(this._bufferSize + chunk.length);
      oldBuffer.copy(this._buffer, 0, 0, this._bufferSize);
    }
    this._bufferSize += chunk.copy(this._buffer, this._bufferSize);

    while (this._bufferSize >= 6) {
      const type = this._buffer.readUInt16BE(0);
      const size = this._buffer.readUInt32BE(2);
      if (this._bufferSize < 6 + size) {
        break;
      }

      const typeName = nameById[type];
      const data = this._buffer.slice(6, 6 + size);
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

      this._buffer.copy(this._buffer, 0, 6 + size, this._bufferSize);
      this._bufferSize -= 6 + size;

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
