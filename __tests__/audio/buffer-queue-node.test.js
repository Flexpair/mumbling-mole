/**
 * buffer-queue-node.js - Tests
 * 
 * Tests audio buffer wrapper classes and BufferQueueNode:
 * - Float32ArrayWrapper (PCM conversion)
 * - Int16ArrayWrapper (PCM conversion with scaling)
 * - AudioBufferWrapper
 * - BufferQueueNode (AudioWorklet-based playback)
 */

import { jest } from '@jest/globals';

const { 
  Float32Array: Float32ArrayWrapper,
  Int16Array: Int16ArrayWrapper,
  AudioBuffer: AudioBufferWrapper,
  default: BufferQueueNode
} = await import('../../app/audio/buffer-queue-node.js');

/**
 * Creates mock AudioContext and AudioWorkletNode for testing.
 * @returns {{ mockAudioContext: object, mockWorkletNode: object }}
 */
function createAudioMocks() {
  const mockWorkletNode = {
    connect: jest.fn(),
    disconnect: jest.fn(),
    port: {
      postMessage: jest.fn(),
      onmessage: null
    }
  };

  const mockAudioContext = {
    audioWorklet: {
      addModule: jest.fn().mockResolvedValue(undefined)
    },
    createGain: jest.fn(() => ({
      connect: jest.fn(),
      gain: { value: 1 }
    }))
  };

  globalThis.AudioWorkletNode = jest.fn(() => mockWorkletNode);

  return { mockAudioContext, mockWorkletNode };
}

/**
 * Cleans up global AudioWorkletNode mock.
 */
function cleanupAudioMocks() {
  delete globalThis.AudioWorkletNode;
}

describe('Float32ArrayWrapper', () => {
  test('converts non-interleaved mono to channel data', () => {
    const data = new Float32Array([0.1, 0.2, 0.3, 0.4]);
    const wrapper = new Float32ArrayWrapper(1, false, data);
    
    const result = wrapper.toChannelData();
    
    expect(result.channels.length).toBe(1);
    expect(result.channels[0]).toEqual(new Float32Array([0.1, 0.2, 0.3, 0.4]));
    expect(result.length).toBe(4);
  });

  test('converts non-interleaved stereo to channel data', () => {
    // [L0, L1, R0, R1]
    const data = new Float32Array([0.1, 0.2, 0.3, 0.4]);
    const wrapper = new Float32ArrayWrapper(2, false, data);
    
    const result = wrapper.toChannelData();
    
    expect(result.channels.length).toBe(2);
    expect(result.channels[0]).toEqual(new Float32Array([0.1, 0.2]));
    expect(result.channels[1]).toEqual(new Float32Array([0.3, 0.4]));
    expect(result.length).toBe(2);
  });

  test('converts interleaved stereo to channel data', () => {
    // [L0, R0, L1, R1]
    const data = new Float32Array([0.1, 0.3, 0.2, 0.4]);
    const wrapper = new Float32ArrayWrapper(2, true, data);
    
    const result = wrapper.toChannelData();
    
    expect(result.channels.length).toBe(2);
    expect(result.channels[0]).toEqual(new Float32Array([0.1, 0.2]));
    expect(result.channels[1]).toEqual(new Float32Array([0.3, 0.4]));
    expect(result.length).toBe(2);
  });

  test('handles Buffer input', () => {
    if (typeof Buffer !== 'undefined') {
      const buffer = Buffer.allocUnsafe(16); // 4 floats
      const view = new Float32Array(buffer.buffer, buffer.byteOffset, 4);
      view.set([0.1, 0.2, 0.3, 0.4]);
      
      const wrapper = new Float32ArrayWrapper(1, false, buffer);
      const result = wrapper.toChannelData();
      
      expect(result.channels[0][0]).toBeCloseTo(0.1, 5);
      expect(result.channels[0][1]).toBeCloseTo(0.2, 5);
    }
  });

  test('calculates length correctly', () => {
    const data = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6]);
    const wrapper = new Float32ArrayWrapper(2, false, data);
    
    expect(wrapper.length).toBe(3); // 6 samples / 2 channels
  });
});

describe('Int16ArrayWrapper', () => {
  test('converts Int16 to normalized float32', () => {
    // Max positive: 32767 -> ~1.0
    // Max negative: -32768 -> -1.0
    const data = new Int16Array([32767, -32768, 0, 16384]);
    const wrapper = new Int16ArrayWrapper(1, false, data);
    
    const result = wrapper.toChannelData();
    
    expect(result.channels[0][0]).toBeCloseTo(1.0, 5);
    expect(result.channels[0][1]).toBeCloseTo(-1.0, 5);
    expect(result.channels[0][2]).toBe(0);
    expect(result.channels[0][3]).toBeCloseTo(0.5, 2);
  });

  test('converts interleaved stereo Int16 to channel data', () => {
    const data = new Int16Array([1000, 2000, 3000, 4000]);
    const wrapper = new Int16ArrayWrapper(2, true, data);
    
    const result = wrapper.toChannelData();
    
    expect(result.channels.length).toBe(2);
    expect(result.length).toBe(2);
  });

  test('handles Buffer input', () => {
    if (typeof Buffer !== 'undefined') {
      const buffer = Buffer.allocUnsafe(8); // 4 int16s
      const view = new Int16Array(buffer.buffer, buffer.byteOffset, 4);
      view.set([1000, 2000, 3000, 4000]);
      
      const wrapper = new Int16ArrayWrapper(1, false, buffer);
      const result = wrapper.toChannelData();
      
      expect(result.channels[0].length).toBe(4);
    }
  });
});

describe('AudioBufferWrapper', () => {
  test('wraps AudioBuffer and extracts channel data', () => {
    const mockAudioBuffer = {
      numberOfChannels: 2,
      length: 3,
      getChannelData: jest.fn((channel) => {
        if (channel === 0) return new Float32Array([0.1, 0.2, 0.3]);
        if (channel === 1) return new Float32Array([0.4, 0.5, 0.6]);
        return new Float32Array();
      })
    };
    
    const wrapper = new AudioBufferWrapper(mockAudioBuffer);
    const result = wrapper.toChannelData();
    
    expect(result.channels.length).toBe(2);
    expect(result.channels[0]).toEqual(new Float32Array([0.1, 0.2, 0.3]));
    expect(result.channels[1]).toEqual(new Float32Array([0.4, 0.5, 0.6]));
    expect(result.length).toBe(3);
  });

  test('exposes length property', () => {
    const mockAudioBuffer = {
      numberOfChannels: 1,
      length: 100,
      getChannelData: jest.fn(() => new Float32Array(100))
    };
    
    const wrapper = new AudioBufferWrapper(mockAudioBuffer);
    
    expect(wrapper.length).toBe(100);
  });
});

describe('BufferQueueNode - Basic Functionality', () => {
  let mockAudioContext;
  let mockWorkletNode;

  beforeEach(() => {
    ({ mockAudioContext, mockWorkletNode } = createAudioMocks());
  });

  afterEach(() => {
    cleanupAudioMocks();
  });

  test('requires audioContext parameter', () => {
    expect(() => new BufferQueueNode()).toThrow('AudioContext is required');
  });

  test('initializes with audioContext', () => {
    const node = new BufferQueueNode({ audioContext: mockAudioContext });
    
    expect(node).toBeDefined();
  });

  test('loads AudioWorklet module', async () => {
    const node = new BufferQueueNode({ audioContext: mockAudioContext });
    
    // Explicitly initialize the node
    await node.initialize();
    
    expect(mockAudioContext.audioWorklet.addModule).toHaveBeenCalledWith(
      'playback-buffer-processor.js'
    );
  });

  test('creates AudioWorkletNode with correct configuration', async () => {
    const node = new BufferQueueNode({ 
      audioContext: mockAudioContext,
      channels: 2
    });
    
    // Explicitly initialize the node
    await node.initialize();
    
    expect(globalThis.AudioWorkletNode).toHaveBeenCalledWith(
      mockAudioContext,
      'playback-buffer-processor',
      expect.objectContaining({
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [2]
      })
    );
  });

  test('emits ready event after initialization', async () => {
    const node = new BufferQueueNode({ audioContext: mockAudioContext });
    
    const readyPromise = new Promise(resolve => node.on('ready', resolve));
    
    // Trigger initialization
    node.initialize();
    
    await readyPromise;
    expect(mockAudioContext.audioWorklet.addModule).toHaveBeenCalled();
  });

  test('handles already loaded AudioWorklet module', async () => {
    mockAudioContext.audioWorklet.addModule.mockRejectedValue({
      name: 'InvalidStateError',
      message: 'Module already loaded'
    });
    
    const node = new BufferQueueNode({ audioContext: mockAudioContext });
    
    // Trigger initialization
    await node.initialize();
    
    // Should still emit ready despite error
    expect(node._isReady).toBe(true);
  });
});

describe('BufferQueueNode - Audio Connection', () => {
  let mockAudioContext;
  let mockWorkletNode;

  beforeEach(() => {
    ({ mockAudioContext, mockWorkletNode } = createAudioMocks());
  });

  afterEach(() => {
    cleanupAudioMocks();
  });

  test('connect forwards to worklet node', async () => {
    const node = new BufferQueueNode({ audioContext: mockAudioContext });
    await node.initialize();
    
    const destination = { name: 'destination' };
    node.connect(destination);
    
    expect(mockWorkletNode.connect).toHaveBeenCalledWith(destination);
  });

  test('disconnect forwards to worklet node', async () => {
    const node = new BufferQueueNode({ audioContext: mockAudioContext });
    await node.initialize();
    
    node.disconnect();
    
    expect(mockWorkletNode.disconnect).toHaveBeenCalled();
  });

  test('connect waits for ready if called early', (done) => {
    const node = new BufferQueueNode({ audioContext: mockAudioContext });
    
    const destination = { name: 'destination' };
    node.connect(destination);
    
    // Should not have connected yet
    expect(mockWorkletNode.connect).not.toHaveBeenCalled();
    
    node.on('ready', () => {
      // Should connect after ready
      setTimeout(() => {
        expect(mockWorkletNode.connect).toHaveBeenCalledWith(destination);
        done();
      }, 10);
    });
  });
});

describe('BufferQueueNode - Error Handling', () => {
  let mockAudioContext;
  let mockWorkletNode;

  beforeEach(() => {
    ({ mockAudioContext, mockWorkletNode } = createAudioMocks());
  });

  afterEach(() => {
    cleanupAudioMocks();
  });

  test('emits error on worklet initialization failure', async () => {
    const testError = new Error('Network error');
    testError.name = 'NetworkError';
    mockAudioContext.audioWorklet.addModule.mockRejectedValue(testError);
    
    const node = new BufferQueueNode({ audioContext: mockAudioContext });
    
    const errorPromise = new Promise(resolve => node.on('error', resolve));
    
    // Trigger initialization
    node.initialize().catch(() => {}); // catch to prevent unhandled rejection
    
    const error = await errorPromise;
    
    expect(error).toBe(testError);
    expect(node._isReady).toBe(false);
  });

  test('handles unsupported buffer type in Float32ArrayWrapper', () => {
    expect(() => {
      new Float32ArrayWrapper(1, false, [1, 2, 3]);
    }).toThrow('Unsupported buffer type');
  });

  test('handles unsupported buffer type in Int16ArrayWrapper', () => {
    expect(() => {
      new Int16ArrayWrapper(1, false, { not: 'a buffer' });
    }).toThrow('Unsupported buffer type');
  });
});

describe('BufferQueueNode - Stream Events', () => {
  let mockAudioContext;
  let mockWorkletNode;

  beforeEach(() => {
    ({ mockAudioContext, mockWorkletNode } = createAudioMocks());
  });

  afterEach(() => {
    cleanupAudioMocks();
  });

  test('sends finish message on stream finish', async () => {
    const node = new BufferQueueNode({ audioContext: mockAudioContext });
    await node.initialize();
    
    node.emit('finish');
    
    expect(mockWorkletNode.port.postMessage).toHaveBeenCalledWith({ type: 'finish' });
  });

  test('sends close message and disconnects on stream close', async () => {
    const node = new BufferQueueNode({ audioContext: mockAudioContext });
    await node.initialize();
    
    node.emit('close');
    
    expect(mockWorkletNode.port.postMessage).toHaveBeenCalledWith({ type: 'close' });
    expect(mockWorkletNode.disconnect).toHaveBeenCalled();
  });

  test('handles close message from worklet', async () => {
    const node = new BufferQueueNode({ audioContext: mockAudioContext });
    await node.initialize();
    
    const closePromise = new Promise(resolve => node.on('close', resolve));
    
    // Simulate worklet sending close message
    mockWorkletNode.port.onmessage({ data: { type: 'close' } });
    
    await closePromise;
  });

  test('handles closed confirmation from worklet', async () => {
    const node = new BufferQueueNode({ audioContext: mockAudioContext });
    await node.initialize();
    
    // Should not emit close event for 'closed' type (just confirmation)
    const closeListener = jest.fn();
    node.on('close', closeListener);
    
    mockWorkletNode.port.onmessage({ data: { type: 'closed' } });
    
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(closeListener).not.toHaveBeenCalled();
  });
});

describe('BufferQueueNode - _write() Method', () => {
  let mockAudioContext;
  let mockWorkletNode;

  beforeEach(() => {
    ({ mockAudioContext, mockWorkletNode } = createAudioMocks());
  });

  afterEach(() => {
    cleanupAudioMocks();
  });

  test('writes Float32Array in object mode', async () => {
    const node = new BufferQueueNode({ 
      audioContext: mockAudioContext,
      objectMode: true,
      channels: 1
    });
    await node.initialize();
    
    const data = new Float32Array([0.1, 0.2, 0.3, 0.4]);
    const callback = jest.fn();
    
    node._write(data, null, callback);
    
    expect(callback).toHaveBeenCalledWith();
    expect(mockWorkletNode.port.postMessage).toHaveBeenCalledWith({
      type: 'data',
      data: expect.objectContaining({
        channels: expect.any(Array),
        length: 4
      })
    });
  });

  test('writes Int16Array in object mode', async () => {
    const node = new BufferQueueNode({ 
      audioContext: mockAudioContext,
      objectMode: true,
      channels: 1
    });
    await node.initialize();
    
    const data = new Int16Array([16384, -16384, 0, 32767]);
    const callback = jest.fn();
    
    node._write(data, null, callback);
    
    expect(callback).toHaveBeenCalledWith();
    expect(mockWorkletNode.port.postMessage).toHaveBeenCalled();
  });

  test('writes AudioBuffer in object mode', async () => {
    const node = new BufferQueueNode({ 
      audioContext: mockAudioContext,
      objectMode: true,
      channels: 1
    });
    await node.initialize();
    
    const audioBuffer = {
      numberOfChannels: 1,
      length: 100,
      getChannelData: jest.fn(() => new Float32Array(100))
    };
    
    const callback = jest.fn();
    
    node._write(audioBuffer, null, callback);
    
    expect(callback).toHaveBeenCalledWith();
    expect(mockWorkletNode.port.postMessage).toHaveBeenCalledWith({
      type: 'data',
      data: expect.objectContaining({
        channels: expect.any(Array),
        length: 100
      })
    });
  });

  test('writes Float32Array in non-object mode with dataType', async () => {
    const node = new BufferQueueNode({ 
      audioContext: mockAudioContext,
      objectMode: false,
      dataType: Float32ArrayWrapper,
      channels: 1
    });
    await node.initialize();
    
    const data = new Float32Array([0.5, 0.6]);
    const callback = jest.fn();
    
    node._write(data, null, callback);
    
    expect(callback).toHaveBeenCalledWith();
    expect(mockWorkletNode.port.postMessage).toHaveBeenCalled();
  });

  test('waits for ready before writing', async () => {
    const node = new BufferQueueNode({ audioContext: mockAudioContext });
    
    const data = new Float32Array([0.1, 0.2]);
    const callback = jest.fn();
    
    // Write before ready - should trigger initialization internally
    node._write(data, null, callback);
    
    // Callback should not be called yet
    expect(callback).not.toHaveBeenCalled();
    
    // Wait for ready
    await new Promise(resolve => node.on('ready', resolve));
    
    // Now callback should be called
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(callback).toHaveBeenCalledWith();
  });

  test('calls callback with error on write failure', async () => {
    const node = new BufferQueueNode({ 
      audioContext: mockAudioContext,
      objectMode: false,
      dataType: Float32ArrayWrapper
    });
    await node.initialize();
    
    // Mock postMessage to throw an error
    mockWorkletNode.port.postMessage.mockImplementation(() => {
      throw new Error('Failed to post message');
    });
    
    const data = new Float32Array([0.1, 0.2]);
    const callback = jest.fn();
    
    node._write(data, null, callback);
    
    expect(callback).toHaveBeenCalledWith(expect.any(Error));
  });
});

describe('BufferQueueNode - Exported Classes', () => {
  test('exports AudioBuffer wrapper', () => {
    expect(BufferQueueNode.AudioBuffer).toBe(AudioBufferWrapper);
  });

  test('exports Float32Array wrapper', () => {
    expect(BufferQueueNode.Float32Array).toBe(Float32ArrayWrapper);
  });

  test('exports Int16Array wrapper', () => {
    expect(BufferQueueNode.Int16Array).toBe(Int16ArrayWrapper);
  });
});

describe('BufferQueueNode - setJitterBufferSize', () => {
  let mockAudioContext;
  let mockWorkletNode;

  beforeEach(() => {
    ({ mockAudioContext, mockWorkletNode } = createAudioMocks());
  });

  afterEach(() => {
    cleanupAudioMocks();
  });

  test('sends setJitterBufferSize message when worklet is ready', async () => {
    const node = new BufferQueueNode({ audioContext: mockAudioContext });
    await node.initialize();
    
    node.setJitterBufferSize(25);
    
    expect(mockWorkletNode.port.postMessage).toHaveBeenCalledWith({
      type: 'setJitterBufferSize',
      size: 25
    });
  });

  test('queues setJitterBufferSize when initializing', async () => {
    const node = new BufferQueueNode({ audioContext: mockAudioContext });
    
    // Start initialization but don't await
    const initPromise = node.initialize();
    
    // Mark as initializing
    node._isInitializing = true;
    node._workletNode = null; // Clear worklet to trigger queue branch
    
    // Set size while initializing - should queue
    node.setJitterBufferSize(30);
    
    // Complete initialization
    await initPromise;
    
    // Now trigger the queued operation
    node.emit('ready');
    
    // Wait for queued operation
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Should have been called with the queued size
    expect(mockWorkletNode.port.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'setJitterBufferSize' })
    );
  });

  test('ignores setJitterBufferSize when not initializing and not ready', () => {
    const node = new BufferQueueNode({ audioContext: mockAudioContext });
    
    // Do not initialize - node is neither ready nor initializing
    node.setJitterBufferSize(25);
    
    // Should not throw or cause issues - just ignored
    expect(mockWorkletNode.port.postMessage).not.toHaveBeenCalled();
  });
});

describe('BufferQueueNode - end() method', () => {
  let mockAudioContext;
  let mockWorkletNode;

  beforeEach(() => {
    ({ mockAudioContext, mockWorkletNode } = createAudioMocks());
  });

  afterEach(() => {
    cleanupAudioMocks();
  });

  test('emits finish when called without chunk', async () => {
    const node = new BufferQueueNode({ audioContext: mockAudioContext });
    await node.initialize();
    
    const finishPromise = new Promise(resolve => node.on('finish', resolve));
    node.end();
    
    await finishPromise;
  });

  test('calls callback when called without chunk', async () => {
    const node = new BufferQueueNode({ audioContext: mockAudioContext });
    await node.initialize();
    
    const callback = jest.fn();
    node.end(undefined, undefined, callback);
    
    expect(callback).toHaveBeenCalled();
  });

  test('writes chunk then emits finish when called with chunk', async () => {
    const node = new BufferQueueNode({ 
      audioContext: mockAudioContext,
      objectMode: true
    });
    await node.initialize();
    
    const finishPromise = new Promise(resolve => node.on('finish', resolve));
    const callback = jest.fn();
    const data = new Float32Array([0.1, 0.2]);
    
    node.end(data, null, callback);
    
    await finishPromise;
    expect(callback).toHaveBeenCalled();
    expect(mockWorkletNode.port.postMessage).toHaveBeenCalled();
  });
});

describe('BufferQueueNode - _handleCallback', () => {
  let mockAudioContext;
  let mockWorkletNode;

  beforeEach(() => {
    ({ mockAudioContext, mockWorkletNode } = createAudioMocks());
  });

  afterEach(() => {
    cleanupAudioMocks();
  });

  test('calls callback without args on success', async () => {
    const node = new BufferQueueNode({ audioContext: mockAudioContext });
    await node.initialize();
    
    const callback = jest.fn();
    node._handleCallback(callback);
    
    expect(callback).toHaveBeenCalledWith();
  });

  test('calls callback with error when present', async () => {
    const node = new BufferQueueNode({ audioContext: mockAudioContext });
    await node.initialize();
    
    const callback = jest.fn();
    const error = new Error('test error');
    node._handleCallback(callback, error);
    
    expect(callback).toHaveBeenCalledWith(error);
  });

  test('emits error when no callback and error present', async () => {
    const node = new BufferQueueNode({ audioContext: mockAudioContext });
    await node.initialize();
    
    const errorHandler = jest.fn();
    node.on('error', errorHandler);
    
    const error = new Error('test error');
    node._handleCallback(undefined, error);
    
    expect(errorHandler).toHaveBeenCalledWith(error);
  });

  test('does nothing when no callback and no error', async () => {
    const node = new BufferQueueNode({ audioContext: mockAudioContext });
    await node.initialize();
    
    const errorHandler = jest.fn();
    node.on('error', errorHandler);
    
    // Should not throw or emit
    node._handleCallback(undefined, undefined);
    
    expect(errorHandler).not.toHaveBeenCalled();
  });
});
