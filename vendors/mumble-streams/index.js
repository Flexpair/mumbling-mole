module.exports.version = {
  major: 1,
  minor: 2,
  patch: 16,
  toUInt8: function () {
    return (this.major & 0xffff) << 16 | (this.minor & 0xff) << 8 | (this.patch & 0xff);
  }
};

module.exports.data = require('./lib/data.js');
module.exports.voice = require('./lib/voice.js');
module.exports.udpCrypto = require('./lib/udp-crypto.js');
