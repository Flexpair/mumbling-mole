// This module is a port of the original CryptState class to Node.js
// The original file can be found at
// https://github.com/mumble-voip/mumble/blob/master/src/CryptState.cpp

// Copyright notice of the original source:
// Copyright 2005-2016 The Mumble Developers. All rights reserved.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file at the root of the
// Mumble source tree or at <https://www.mumble.info/LICENSE>.

import crypto from 'node:crypto';

const BLOCK_SIZE = 16;

function UdpCrypt(stats) {
  this._decryptHistory = new Array(100);
  this._stats = stats || {};
}

UdpCrypt.prototype.getKey = function() { return this._key; };
UdpCrypt.prototype.getDecryptIV = function() { return this._decryptIV; };
UdpCrypt.prototype.getEncryptIV = function() { return this._encryptIV; };
UdpCrypt.prototype.ready = function() {
  return this._key && this._decryptIV && this._encryptIV;
};

UdpCrypt.prototype.setKey = function(key) {
  if (key.length != BLOCK_SIZE) {
    throw new Error('key must be exactly ' + BLOCK_SIZE + ' bytes');
  }
  this._key = key;
};

UdpCrypt.prototype.setDecryptIV = function(decryptIV) {
  if (decryptIV.length != BLOCK_SIZE) {
    throw new Error('decryptIV must be exactly ' + BLOCK_SIZE + ' bytes');
  }
  this._decryptIV = decryptIV;
};

UdpCrypt.prototype.setEncryptIV = function(encryptIV) {
  if (encryptIV.length != BLOCK_SIZE) {
    throw new Error('encryptIV must be exactly ' + BLOCK_SIZE + ' bytes');
  }
  this._encryptIV = encryptIV;
};

UdpCrypt.prototype.generateKey = function(callback) {
  crypto.randomBytes(BLOCK_SIZE * 3, function(err, buf) {
    if (err) {
      callback(err);
    }

    this._key = buf.slice(0, BLOCK_SIZE);
    this._decryptIV = buf.slice(BLOCK_SIZE, BLOCK_SIZE * 2);
    this._encryptIV = buf.slice(BLOCK_SIZE * 2);
    callback();
  }.bind(this));
};

UdpCrypt.prototype.encrypt = function(plainText) {
  // First, increase our IV
  for (let i = 0; i < BLOCK_SIZE; i++) {
    if (++this._encryptIV[i] == 256) {
      this._encryptIV[i] = 0;
    } else {
      break;
    }
  }
  // AES-128-ECB is required by Mumble protocol specification (OCB mode implementation)
  // This is a protocol requirement for compatibility with Mumble servers, not a security choice
  // See: https://github.com/mumble-voip/mumble/blob/master/src/CryptState.cpp
  const cipher = crypto.createCipheriv('AES-128-ECB', this._key, '') // NOSONAR - Protocol requirement
    .setAutoPadding(false);

  const cipherText = Buffer.alloc(plainText.length + 4);
  const tag = ocbEncrypt(plainText, cipherText.slice(4), this._encryptIV,
      cipher.update.bind(cipher));
  cipherText[0] = this._encryptIV[0];
  cipherText[1] = tag[0];
  cipherText[2] = tag[1];
  cipherText[3] = tag[2];
  
  return cipherText;
};

UdpCrypt.prototype._handleIVUpdate = function(ivbyte) {
  if (ivbyte > this._decryptIV[0]) {
    this._decryptIV[0] = ivbyte;
    return true;
  } else if (ivbyte < this._decryptIV[0]) {
    this._decryptIV[0] = ivbyte;
    for (let i = 1; i < BLOCK_SIZE; i++) {
      if (++this._decryptIV[i] == 256) {
        this._decryptIV[i] = 0;
      } else {
        break;
      }
    }
    return true;
  }
  return false;
};

UdpCrypt.prototype._calculateDiff = function(ivbyte) {
  let diff = ivbyte - this._decryptIV[0];
  if (diff > 128) {
    diff = diff - 256;
  } else if (diff < -128) {
    diff = diff + 256;
  }
  return diff;
};

UdpCrypt.prototype._decrementIV = function() {
  for (let i = 0; i < BLOCK_SIZE; i++) {
    if (this._decryptIV[i]-- == -1) {
      this._decryptIV[i] = 255;
    } else {
      break;
    }
  }
};

UdpCrypt.prototype._incrementIV = function() {
  for (let i = 0; i < BLOCK_SIZE; i++) {
    if (++this._decryptIV[i] == 256) {
      this._decryptIV[i] = 0;
    } else {
      break;
    }
  }
};

UdpCrypt.prototype._handleLatePacket = function(ivbyte, withWraparound) {
  const result = { restore: true, lost: -1, late: 1, success: true };
  this._decryptIV[0] = ivbyte;
  if (withWraparound) {
    this._decrementIV();
  }
  return result;
};

UdpCrypt.prototype._handleLostPackets = function(ivbyte, withWraparound) {
  const result = { restore: false, lost: 0, late: 0, success: true };
  
  if (withWraparound) {
    result.lost = 256 - this._decryptIV[0] + ivbyte - 1;
  } else {
    result.lost = ivbyte - this._decryptIV[0] - 1;
  }
  
  this._decryptIV[0] = ivbyte;
  if (withWraparound) {
    this._incrementIV();
  }
  
  return result;
};

UdpCrypt.prototype._handleOutOfOrderPacket = function(ivbyte, saveiv) {
  const diff = this._calculateDiff(ivbyte);
  const isLatePacket = diff > -30 && diff < 0;
  
  if (!isLatePacket && diff <= 0) {
    return { restore: false, lost: 0, late: 0, success: false };
  }

  let result;
  if (isLatePacket) {
    const withWraparound = ivbyte > this._decryptIV[0];
    result = this._handleLatePacket(ivbyte, withWraparound);
  } else {
    const withWraparound = ivbyte < this._decryptIV[0];
    result = this._handleLostPackets(ivbyte, withWraparound);
  }

  if (result.success && this._decryptHistory[this._decryptIV[0]] == this._decryptIV[1]) {
    return { success: false, restore: false, lost: 0, late: 0 };
  }

  return result;
};

UdpCrypt.prototype._verifyAndDecryptPacket = function(cipherText, saveiv) {
  // AES-128-ECB is required by Mumble protocol specification (OCB mode implementation)
  // This is a protocol requirement for compatibility with Mumble servers, not a security choice
  // See: https://github.com/mumble-voip/mumble/blob/master/src/CryptState.cpp
  const encrypt = crypto.createCipheriv('AES-128-ECB', this._key, '') // NOSONAR - Protocol requirement
    .setAutoPadding(false);
  const decrypt = crypto.createDecipheriv('AES-128-ECB', this._key, '') // NOSONAR - Protocol requirement
    .setAutoPadding(false);

  const plainText = new Buffer(cipherText.length - 4);
  const tag = ocbDecrypt(cipherText.slice(4), plainText, this._decryptIV,
      encrypt.update.bind(encrypt), decrypt.update.bind(decrypt));

  if (tag.compare(cipherText, 1, 4, 0, 3) !== 0) {
    this._decryptIV = saveiv;
    return null;
  }

  this._decryptHistory[this._decryptIV[0]] = this._decryptIV[1];
  return plainText;
};

UdpCrypt.prototype.decrypt = function(cipherText) {
  if (cipherText.length < 4) {
    return null;
  }

  const saveiv = Buffer.from(this._decryptIV);
  const ivbyte = cipherText[0];
  let restore = false;
  let lost = 0;
  let late = 0;
  
  if (((this._decryptIV[0] + 1) & 0xFF) == ivbyte) {
    // In order as expected
    if (!this._handleIVUpdate(ivbyte)) {
      return null;
    }
  } else {
    // Out of order or repeat
    const result = this._handleOutOfOrderPacket(ivbyte, saveiv);
    if (!result.success) {
      this._decryptIV = saveiv;
      return null;
    }
    restore = result.restore;
    lost = result.lost;
    late = result.late;
  }

  const plainText = this._verifyAndDecryptPacket(cipherText, saveiv);
  if (!plainText) {
    return null;
  }

  if (restore) {
    this._decryptIV = saveiv;
  }

  this._stats.good++;
  this._stats.late += late;
  this._stats.lost += lost;
  return plainText;
};

function ocbEncrypt(plainText, cipherText, nonce, aesEncrypt) {
  const checksum = new Buffer(BLOCK_SIZE);
  let tmp = new Buffer(BLOCK_SIZE);
  
  const delta = aesEncrypt(nonce);
  ZERO(checksum);

  let len = plainText.length;
  while (len > BLOCK_SIZE) {
    S2(delta);
    XOR(tmp, delta, plainText);
    tmp = aesEncrypt(tmp);
    XOR(cipherText, delta, tmp);
    XOR(checksum, checksum, plainText);
    len -= BLOCK_SIZE;
    plainText = plainText.slice(BLOCK_SIZE);
    cipherText = cipherText.slice(BLOCK_SIZE);
  }

  S2(delta);
  ZERO(tmp);
  tmp[BLOCK_SIZE - 1] = len * 8;
  XOR(tmp, tmp, delta);
  const pad = aesEncrypt(tmp);
  plainText.copy(tmp, 0, 0, len);
  pad.copy(tmp, len, len, BLOCK_SIZE);
  XOR(checksum, checksum, tmp);
  XOR(tmp, pad, tmp);
  tmp.copy(cipherText, 0, 0, len);

  S3(delta);
  XOR(tmp, delta, checksum);
  const tag = aesEncrypt(tmp);
  
  return tag;
}

function ocbDecrypt(cipherText, plainText, nonce, aesEncrypt, aesDecrypt) {
  const checksum = new Buffer(BLOCK_SIZE);
  let tmp = new Buffer(BLOCK_SIZE);
  
  // Initialize
  const delta = aesEncrypt(nonce);
  ZERO(checksum);

  let len = plainText.length;
  while (len > BLOCK_SIZE) {
    S2(delta);
    XOR(tmp, delta, cipherText);
    tmp = aesDecrypt(tmp);
    XOR(plainText, delta, tmp);
    XOR(checksum, checksum, plainText);
    len -= BLOCK_SIZE;
    plainText = plainText.slice(BLOCK_SIZE);
    cipherText = cipherText.slice(BLOCK_SIZE);
  }

  S2(delta);
  ZERO(tmp);
  tmp[BLOCK_SIZE - 1] = len * 8;
  XOR(tmp, tmp, delta);
  const pad = aesEncrypt(tmp);
  ZERO(tmp);
  cipherText.copy(tmp, 0, 0, len);
  XOR(tmp, tmp, pad);
  XOR(checksum, checksum, tmp);
  tmp.copy(plainText, 0, 0, len);

  S3(delta);
  XOR(tmp, delta, checksum);
  const tag = aesEncrypt(tmp);

  return tag;
}

function XOR(dst, a, b) {
  for (let i = 0; i < BLOCK_SIZE; i++) {
    dst[i] = a[i] ^ b[i];
  }
}

function S2(block) {
  const carry = block[0] >> 7;
  for (let i = 0; i < BLOCK_SIZE - 1; i++) {
    block[i] = block[i] << 1 | block[i+1] >> 7;
  }
  block[BLOCK_SIZE-1] = block[BLOCK_SIZE-1] << 1 ^ (carry * 0x87);
}

// Equivalent to: XOR(block, block, R2(block))
function S3(block) {
  const carry = block[0] >> 7;
  for (let i = 0; i < BLOCK_SIZE - 1; i++) {
    block[i] ^= block[i] << 1 | block[i+1] >> 7;
  }
  block[BLOCK_SIZE-1] ^= block[BLOCK_SIZE-1] << 1 ^ (carry * 0x87);
}

function ZERO(block) {
  block.fill(0, 0, BLOCK_SIZE);
}

// End of port

import util from 'node:util';
import { Transform } from 'node:stream';

/**
 * @typedef {object} States
 */

/**
 * Transform stream for encrypting Mumble UDP packets.
 *
 * @constructor
 * @constructs Encrypt
 * @param {Stats} [stats] - Object into which network statistics are written
 */
function Encrypt(stats) {
  // Allow use without new
  if (!(this instanceof Encrypt)) return new Encrypt(dest);

  Transform.call(this, {});
  
  this._block = new UdpCrypt(stats);
} 
util.inherits(Encrypt, Transform);

Encrypt.prototype._transform = function(chunk, encoding, callback) {
  callback(null, this._block.encrypt(chunk));
};

/**
 * @return The underlying block cipher.
 */
Encrypt.prototype.getBlockCipher = function() {
  return this._block;
};

export default UdpCrypt;
export { BLOCK_SIZE, ocbEncrypt, ocbDecrypt };
