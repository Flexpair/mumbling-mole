import { Writable } from 'node:stream';

class DropStream extends Writable {
  constructor(options) {
    super(options);
  }

  _write(chunk, encoding, callback) {
    callback();
  }

  static obj(options) {
    return new DropStream({ ...options, objectMode: true });
  }
}

export default DropStream;
