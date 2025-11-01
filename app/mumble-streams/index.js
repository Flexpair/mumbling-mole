import data from './data.js';
import voice from './voice.js';
import udpCryptoDefault, { BLOCK_SIZE, ocbEncrypt, ocbDecrypt } from './udp-crypto.js';

// Re-attach named exports to default export for backward compatibility
const udpCrypto = udpCryptoDefault;
udpCrypto.BLOCK_SIZE = BLOCK_SIZE;
udpCrypto.ocbEncrypt = ocbEncrypt;
udpCrypto.ocbDecrypt = ocbDecrypt;

export const version = {
  major: 1,
  minor: 2,
  patch: 16,
  toUInt8: function () {
    return (this.major & 0xffff) << 16 | (this.minor & 0xff) << 8 | (this.patch & 0xff);
  }
};

export { data, voice, udpCrypto };

export default {
  version,
  data,
  voice,
  udpCrypto
};
