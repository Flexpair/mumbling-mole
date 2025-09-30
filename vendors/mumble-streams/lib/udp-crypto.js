// This module is a port of the original CryptState class to Node.js
// The original file can be found at
// https://github.com/mumble-voip/mumble/blob/master/src/CryptState.cpp

// Copyright notice of the original source:
// Copyright 2005-2016 The Mumble Developers. All rights reserved.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file at the root of the
// Mumble source tree or at <https://www.mumble.info/LICENSE>.

var crypto = require('crypto');

var BLOCK_SIZE = 16;

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
  for (var i = 0; i < BLOCK_SIZE; i++) {
    if (++this._encryptIV[i] == 256) {
      this._encryptIV[i] = 0;
    } else {
      break;
    }
  }
  var cipher = crypto.createCipheriv('AES-128-ECB', this._key, '')
    .setAutoPadding(false);

  var cipherText = new Buffer(plainText.length + 4);
  var tag = ocbEncrypt(plainText, cipherText.slice(4), this._encryptIV,
      cipher.update.bind(cipher));
  cipherText[0] = this._encryptIV[0];
  cipherText[1] = tag[0];
  cipherText[2] = tag[1];
  cipherText[3] = tag[2];
  
  return cipherText;
};

UdpCrypt.prototype.decrypt = function(cipherText) {
  if (cipherText.length < 4) {
    return null;
  }

  var saveiv = Buffer.from(this._decryptIV);
  var ivbyte = cipherText[0];
  var restore = false;
  var lost = 0;
  var late = 0;
  var i;
  
  if (((this._decryptIV[0] + 1) & 0xFF) == ivbyte) {
    // In order as expected
    if (ivbyte > this._decryptIV[0]) {
      this._decryptIV[0] = ivbyte;
    } else if (ivbyte < this._decryptIV[0]) {
      this._decryptIV[0] = ivbyte;
      for (i = 1; i < BLOCK_SIZE; i++) {
        if (++this._decryptIV[i] == 256) {
          this._encryptIV[i] = 0;
        } else {
          break;
        }
      }
    } else {
      return null;
    }
  } else {
    // This is either out of order or a repeat.

    var diff = ivbyte - this._decryptIV[0];
    if (diff > 128) {
      diff = diff - 256;
    } else if (diff < -128) {
      diff = diff + 256;
    }

    if ((ivbyte < this._decryptIV[0]) && (diff > -30) && (diff < 0)) {
      // Late packet, but no wraparound
      late++;
      lost--;
      this._decryptIV[0] = ivbyte;
      restore = true;
    } else if ((ivbyte > this._decryptIV[0]) && (diff > -30) && (diff < 0)) {
      // Late was 0x02, here comes 0xff from last round
      late++;
      lost--;
      this._decryptIV[0] = ivbyte;
      for (i = 0; i < BLOCK_SIZE; i++) {
        if (this._decryptIV[i]-- == -1) {
          this._decryptIV[i] = 255;
        } else {
          break;
        }
      }
      restore = true;
    } else if ((ivbyte > this._decryptIV[0]) && (diff > 0)) {
      // Lost a few packets, but beyond that we're good.
      lost += ivbyte - this._decryptIV[0] - 1;
      this._decryptIV[0] = ivbyte;
    } else if ((ivbyte < this._decryptIV[0]) && (diff > 0)) {
      // Lost a few packets, and wrapped around
      lost += 256 - this._decryptIV[0] + ivbyte - 1;
      this._decryptIV[0] = ivbyte;
      for (i = 0; i < BLOCK_SIZE; i++) {
        if (++this._decryptIV[i] == 256) {
          this._encryptIV[i] = 0;
        } else {
          break;
        }
      }
    } else {
      return null;
    }

    if (this._decryptHistory[this._decryptIV[0]] == this._decryptIV[1]) {
      this._decryptIV = saveiv;
      return null;
    }
  }

  var encrypt = crypto.createCipheriv('AES-128-ECB', this._key, '')
    .setAutoPadding(false);
  var decrypt = crypto.createDecipheriv('AES-128-ECB', this._key, '')
    .setAutoPadding(false);

  var plainText = new Buffer(cipherText.length - 4);
  var tag = ocbDecrypt(cipherText.slice(4), plainText, this._decryptIV,
      encrypt.update.bind(encrypt), decrypt.update.bind(decrypt));

  if (tag.compare(cipherText, 1, 4, 0, 3) !== 0) {
    this._decryptIV = saveiv;
    return null;
  }
  this._decryptHistory[this._decryptIV[0]] = this._decryptIV[1];

  if (restore) {
    this._decryptIV = saveiv;
  }

  this._stats.good++;
  this._stats.late += late;
  this._stats.lost += lost;
  return plainText;
};

function ocbEncrypt(plainText, cipherText, nonce, aesEncrypt) {
  var checksum = new Buffer(BLOCK_SIZE);
  var tmp = new Buffer(BLOCK_SIZE);
  
  var delta = aesEncrypt(nonce);
  ZERO(checksum);

  var len = plainText.length;
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
  var pad = aesEncrypt(tmp);
  plainText.copy(tmp, 0, 0, len);
  pad.copy(tmp, len, len, BLOCK_SIZE);
  XOR(checksum, checksum, tmp);
  XOR(tmp, pad, tmp);
  tmp.copy(cipherText, 0, 0, len);

  S3(delta);
  XOR(tmp, delta, checksum);
  var tag = aesEncrypt(tmp);
  
  return tag;
}

function ocbDecrypt(cipherText, plainText, nonce, aesEncrypt, aesDecrypt) {
  var checksum = new Buffer(BLOCK_SIZE);
  var tmp = new Buffer(BLOCK_SIZE);
  
  // Initialize
  var delta = aesEncrypt(nonce);
  ZERO(checksum);

  var len = plainText.length;
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
  var pad = aesEncrypt(tmp);
  ZERO(tmp);
  cipherText.copy(tmp, 0, 0, len);
  XOR(tmp, tmp, pad);
  XOR(checksum, checksum, tmp);
  tmp.copy(plainText, 0, 0, len);

  S3(delta);
  XOR(tmp, delta, checksum);
  var tag = aesEncrypt(tmp);

  return tag;
}

function XOR(dst, a, b) {
  for (var i = 0; i < BLOCK_SIZE; i++) {
    dst[i] = a[i] ^ b[i];
  }
}

function S2(block) {
  var carry = block[0] >> 7;
  for (var i = 0; i < BLOCK_SIZE - 1; i++) {
    block[i] = block[i] << 1 | block[i+1] >> 7;
  }
  block[BLOCK_SIZE-1] = block[BLOCK_SIZE-1] << 1 ^ (carry * 0x87);
}

// Equivalent to: XOR(block, block, R2(block))
function S3(block) {
  var carry = block[0] >> 7;
  for (var i = 0; i < BLOCK_SIZE - 1; i++) {
    block[i] ^= block[i] << 1 | block[i+1] >> 7;
  }
  block[BLOCK_SIZE-1] ^= block[BLOCK_SIZE-1] << 1 ^ (carry * 0x87);
}

function ZERO(block) {
  block.fill(0, 0, BLOCK_SIZE);
}

// End of port

var util = require('util'),
    Transform = require('stream').Transform;

module.exports = UdpCrypt;
module.exports.BLOCK_SIZE = BLOCK_SIZE;
module.exports.ocbEncrypt = ocbEncrypt;
module.exports.ocbDecrypt = ocbDecrypt;

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
