
import { jest } from '@jest/globals';

// Mock dependencies
jest.unstable_mockModule('../app/mumble-client/index.js', () => ({
  default: jest.fn().mockImplementation(() => ({
    maxBandwidth: 0,
    setAudioQuality: jest.fn(),
    getMaxBitrate: jest.fn(() => 40000),
    getActualBitrate: jest.fn(() => 38000),
  }))
}));

jest.unstable_mockModule('to-arraybuffer', () => ({
  default: jest.fn((buf) => {
    if (buf instanceof ArrayBuffer) return buf;
    return new ArrayBuffer(buf.length || 0);
  })
}));

// Mock Worker
class MockWorker {
  constructor(scriptURL, options) {
    this.scriptURL = scriptURL;
    this.options = options;
    this.listeners = { message: [] };
    this.postMessage = jest.fn();
  }
  
  addEventListener(event, callback) {
    if (event === 'message') {
      this.listeners.message.push(callback);
    }
  }
  
  // Helper to simulate messages from worker
  _simulateMessage(data) {
    for (const cb of this.listeners.message) {
      cb({ data });
    }
  }
}

// Set up global Worker mock
globalThis.Worker = MockWorker;

// Now import the module
const WorkerBasedMumbleConnector = (await import('../app/worker-client.js')).default;

describe('WorkerBasedMumbleClient Stats Sync', () => {
  let connector;
  let mockWorker;
  let client;

  beforeEach(async () => {
    jest.clearAllMocks();
    connector = new WorkerBasedMumbleConnector();
    mockWorker = connector._worker;
    
    // Simulate connection to get a client
    const connectPromise = connector.connect('example.com', 'user');
    
    // Simulate worker response for connect
    const reqId = Object.keys(connector._requests)[0];
    mockWorker._simulateMessage({
      reqId: reqId,
      result: { client: 1 }
    });
    
    client = await connectPromise;
  });

  test('updates dataStats and emits dataPing in correct order', (done) => {
    const stats = { mean: 100, variance: 10, n: 50 };
    const latency = 100;
    
    // Setup listener on client
    client.on('dataPing', (lat) => {
      try {
        expect(lat).toBe(latency);
        expect(client.dataStats).toEqual(stats);
        done();
      } catch (e) {
        done(e);
      }
    });
    
    // Simulate sequence of messages from worker (as implemented in worker.js)
    
    // 1. Push Prop (dataStats)
    mockWorker._simulateMessage({
      clientId: client._id,
      prop: 'dataStats',
      value: stats
    });
    
    // 2. Emit Event (dataPing)
    mockWorker._simulateMessage({
      clientId: client._id,
      event: 'dataPing',
      value: [latency]
    });
  });
});
