import { jest } from '@jest/globals';

// Minimal mocks
jest.unstable_mockModule('../app/mumble-client/index.js', () => ({
  default: jest.fn(() => ({ maxBandwidth: 0 }))
}));

jest.unstable_mockModule('../app/utils/to-arraybuffer-lite.js', () => ({
  default: (buf) => buf instanceof ArrayBuffer ? buf : new ArrayBuffer(0)
}));

// Mock Worker with minimal interface
class MockWorker {
  listeners = { message: [] };
  postMessage = jest.fn();
  
  addEventListener(event, cb) {
    if (event === 'message') this.listeners.message.push(cb);
  }
  
  _simulateMessage(data) {
    this.listeners.message.forEach(cb => cb({ data }));
  }
}

globalThis.Worker = MockWorker;

const WorkerBasedMumbleConnector = (await import('../app/worker-client.js')).default;

describe('WorkerBasedMumbleClient Stats Sync', () => {
  let connector, mockWorker, client;

  beforeEach(async () => {
    connector = new WorkerBasedMumbleConnector();
    mockWorker = connector._worker;
    
    const connectPromise = connector.connect('example.com', 'user');
    const reqId = Object.keys(connector._requests)[0];
    mockWorker._simulateMessage({ reqId, result: { client: 1 } });
    
    client = await connectPromise;
  });

  test('updates dataStats and emits dataPing in correct order', (done) => {
    const stats = { mean: 100, variance: 10, n: 50 };
    const latency = 100;
    
    client.on('dataPing', (lat) => {
      try {
        expect(lat).toBe(latency);
        expect(client.dataStats).toEqual(stats);
        done();
      } catch (e) {
        done(e);
      }
    });
    
    // Simulate worker messages: 1. dataStats property, 2. dataPing event
    mockWorker._simulateMessage({
      clientId: client._id,
      prop: 'dataStats',
      value: stats
    });
    
    mockWorker._simulateMessage({
      clientId: client._id,
      event: 'dataPing',
      value: [latency]
    });
  });
});
