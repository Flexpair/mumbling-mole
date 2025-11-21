/**
 * worker-client.js unit tests
 * 
 * Tests Worker-based MumbleClient proxy that bridges main thread and worker thread.
 * Focuses on RPC communication, event dispatching, and proxy object lifecycle.
 */

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

describe('WorkerBasedMumbleConnector', () => {
  let connector;
  let mockWorker;

  beforeEach(() => {
    jest.clearAllMocks();
    connector = new WorkerBasedMumbleConnector();
    mockWorker = connector._worker;
  });

  describe('Constructor', () => {
    test('creates worker instance', () => {
      expect(connector._worker).toBeInstanceOf(MockWorker);
    });

    test('uses classic worker type', () => {
      expect(mockWorker.options.type).toBe('classic');
    });

    test('initializes request tracking', () => {
      expect(connector._reqId).toBe(1);
      expect(connector._requests).toEqual({});
    });

    test('initializes client tracking', () => {
      expect(connector._clients).toEqual({});
    });

    test('initializes voice stream tracking', () => {
      expect(connector._nextVoiceId).toBe(1);
      expect(connector._voiceStreams).toEqual({});
    });

    test('attaches message listener', () => {
      expect(mockWorker.listeners.message.length).toBe(1);
    });
  });

  describe('_postMessage', () => {
    test('posts message to worker', () => {
      const msg = { test: 'data' };
      connector._postMessage(msg);

      expect(mockWorker.postMessage).toHaveBeenCalledWith(msg, undefined);
    });

    test('includes transfer list', () => {
      const msg = { test: 'data' };
      const transfer = [new ArrayBuffer(8)];
      connector._postMessage(msg, transfer);

      expect(mockWorker.postMessage).toHaveBeenCalledWith(msg, transfer);
    });

    test('logs error on postMessage failure', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockWorker.postMessage.mockImplementation(() => {
        throw new Error('Post failed');
      });

      expect(() => connector._postMessage({ test: 'data' })).toThrow();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to postMessage',
        { test: 'data' }
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('_call', () => {
    test('increments request ID', () => {
      const initialId = connector._reqId;
      connector._call({ client: 1 }, 'testMethod', { arg: 'value' });

      expect(connector._reqId).toBe(initialId + 1);
    });

    test('posts message with correct structure', () => {
      const id = { client: 1, channelId: 2, userId: 3 };
      connector._call(id, 'testMethod', { arg: 'value' });

      expect(mockWorker.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: 1,
          channelId: 2,
          userId: 3,
          method: 'testMethod',
          reqId: expect.any(Number),
          payload: { arg: 'value' },
        }),
        undefined
      );
    });

    test('returns request ID', () => {
      const reqId = connector._call({ client: 1 }, 'test', {});
      expect(typeof reqId).toBe('number');
    });
  });

  describe('_query', () => {
    test('returns promise', () => {
      const result = connector._query({ client: 1 }, 'test', {});
      expect(result).toBeInstanceOf(Promise);
    });

    test('registers promise handlers', () => {
      const promise = connector._query({ client: 1 }, 'test', {});
      const reqId = connector._reqId - 1;

      expect(connector._requests[reqId]).toBeDefined();
      expect(connector._requests[reqId].length).toBe(2);
    });

    test('resolves promise on successful response', async () => {
      const promise = connector._query({ client: 1 }, 'test', {});
      const reqId = connector._reqId - 1;

      mockWorker._simulateMessage({
        reqId,
        result: { success: true }
      });

      await expect(promise).resolves.toEqual({ success: true });
    });

    test('rejects promise on error response', async () => {
      const promise = connector._query({ client: 1 }, 'test', {});
      const reqId = connector._reqId - 1;

      mockWorker._simulateMessage({
        reqId,
        error: 'Test error'
      });

      await expect(promise).rejects.toBe('Test error');
    });

    test('cleans up request after resolution', async () => {
      const promise = connector._query({ client: 1 }, 'test', {});
      const reqId = connector._reqId - 1;

      mockWorker._simulateMessage({
        reqId,
        result: { success: true }
      });

      await promise;
      expect(connector._requests[reqId]).toBeUndefined();
    });
  });

  describe('connect', () => {
    test('queries worker with host and args', async () => {
      const connectPromise = connector.connect('test.server.com', { port: 64738 });
      const reqId = connector._reqId - 1;

      mockWorker._simulateMessage({
        reqId,
        result: 'client-id-123'
      });

      await connectPromise;

      expect(mockWorker.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          method: '_connect',
          payload: {
            host: 'test.server.com',
            args: { port: 64738 }
          }
        }),
        undefined
      );
    });

    test('returns client proxy', async () => {
      const connectPromise = connector.connect('test.server.com', {});
      const reqId = connector._reqId - 1;

      mockWorker._simulateMessage({
        reqId,
        result: 'client-id-123'
      });

      const client = await connectPromise;
      expect(client).toBeDefined();
      expect(client._id).toBe('client-id-123');
    });
  });

  describe('_client', () => {
    test('creates new client on first access', () => {
      const client = connector._client('test-id');

      expect(client).toBeDefined();
      expect(client._id).toBe('test-id');
    });

    test('returns cached client on subsequent access', () => {
      const client1 = connector._client('test-id');
      const client2 = connector._client('test-id');

      expect(client1).toBe(client2);
    });

    test('tracks clients by ID', () => {
      const client = connector._client('test-id');

      expect(connector._clients['test-id']).toBe(client);
    });
  });

  describe('Message Handling - RPC Responses', () => {
    test('resolves pending request with result', async () => {
      const promise = connector._query({ client: 1 }, 'test', {});
      const reqId = connector._reqId - 1;

      mockWorker._simulateMessage({
        reqId,
        result: { data: 'response' }
      });

      const result = await promise;
      expect(result).toEqual({ data: 'response' });
    });

    test('rejects pending request with error', async () => {
      const promise = connector._query({ client: 1 }, 'test', {});
      const reqId = connector._reqId - 1;

      mockWorker._simulateMessage({
        reqId,
        error: { message: 'Failed' }
      });

      await expect(promise).rejects.toEqual({ message: 'Failed' });
    });
  });

  describe('Message Handling - Events', () => {
    test('dispatches client events', () => {
      const client = connector._client('client-123');
      const eventSpy = jest.fn();
      client.on('testEvent', eventSpy);

      mockWorker._simulateMessage({
        clientId: 'client-123',
        event: 'testEvent',
        value: ['arg1', 'arg2']
      });

      expect(eventSpy).toHaveBeenCalledWith('arg1', 'arg2');
    });

    test('dispatches channel events', () => {
      const client = connector._client('client-123');
      const channel = client._channel('channel-456');
      const eventSpy = jest.fn();
      channel.on('testEvent', eventSpy);

      mockWorker._simulateMessage({
        clientId: 'client-123',
        channelId: 'channel-456',
        event: 'testEvent',
        value: ['data']
      });

      expect(eventSpy).toHaveBeenCalledWith('data');
    });

    test('dispatches user events', () => {
      const client = connector._client('client-123');
      const user = client._user('user-789');
      const eventSpy = jest.fn();
      user.on('testEvent', eventSpy);

      mockWorker._simulateMessage({
        clientId: 'client-123',
        userId: 'user-789',
        event: 'testEvent',
        value: ['info']
      });

      expect(eventSpy).toHaveBeenCalledWith('info');
    });
  });

  describe('Message Handling - Property Updates', () => {
    test('updates client properties', () => {
      const client = connector._client('client-123');

      mockWorker._simulateMessage({
        clientId: 'client-123',
        prop: 'name',
        value: 'TestClient'
      });

      expect(client.name).toBe('TestClient');
    });

    test('updates channel properties', () => {
      const client = connector._client('client-123');
      const channel = client._channel('channel-456');

      mockWorker._simulateMessage({
        clientId: 'client-123',
        channelId: 'channel-456',
        prop: 'name',
        value: 'TestChannel'
      });

      expect(channel.name).toBe('TestChannel');
    });

    test('updates user properties', () => {
      const client = connector._client('client-123');
      const user = client._user('user-789');

      mockWorker._simulateMessage({
        clientId: 'client-123',
        userId: 'user-789',
        prop: 'name',
        value: 'TestUser'
      });

      expect(user.name).toBe('TestUser');
    });
  });

  describe('Message Handling - Voice Streams', () => {
    test('writes voice data to stream', (done) => {
      const voiceId = 'voice-123';
      const buffer = new ArrayBuffer(8);
      const stream = {
        write: jest.fn((data) => {
          expect(data.buffer).toBeDefined();
          expect(data.target).toBe(1);
          done();
        }),
        end: jest.fn()
      };

      connector._voiceStreams[voiceId] = stream;

      mockWorker._simulateMessage({
        voiceId,
        target: 1,
        buffer
      });
    });

    test('ends stream on null buffer', () => {
      const voiceId = 'voice-123';
      const stream = {
        write: jest.fn(),
        end: jest.fn()
      };

      connector._voiceStreams[voiceId] = stream;

      mockWorker._simulateMessage({
        voiceId,
        buffer: null
      });

      expect(stream.end).toHaveBeenCalled();
      expect(connector._voiceStreams[voiceId]).toBeUndefined();
    });
  });
});

describe('WorkerBasedMumbleClient', () => {
  let connector;
  let client;

  beforeEach(() => {
    connector = new WorkerBasedMumbleConnector();
    client = connector._client('test-client-id');
  });

  describe('Constructor', () => {
    test('initializes with connector and ID', () => {
      expect(client._connector).toBe(connector);
      expect(client._id).toBe('test-client-id');
    });

    test('initializes empty user map', () => {
      expect(client._users).toEqual({});
    });

    test('initializes empty channel map', () => {
      expect(client._channels).toEqual({});
    });

    test('creates dummy client for bandwidth calculations', () => {
      expect(client._dummyClient).toBeDefined();
    });
  });

  describe('RPC Methods', () => {
    test('setSelfDeaf calls worker', () => {
      client.setSelfDeaf(true);

      expect(connector._worker.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: 'test-client-id',
          method: 'setSelfDeaf'
        }),
        undefined
      );
    });

    test('setSelfMute calls worker', () => {
      client.setSelfMute(false);

      expect(connector._worker.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: 'test-client-id',
          method: 'setSelfMute'
        }),
        undefined
      );
    });

    test('setAudioQuality updates dummy client and calls worker', () => {
      client.setAudioQuality(40000, 960);

      expect(client._dummyClient.setAudioQuality).toHaveBeenCalledWith(40000, 960);
      expect(connector._worker.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: 'test-client-id',
          method: 'setAudioQuality'
        }),
        undefined
      );
    });

    test('disconnect calls worker method', () => {
      // Note: disconnect() calls worker but doesn't immediately remove from connector
      // The actual removal happens when worker responds (not tested here)
      client.disconnect();

      expect(connector._worker.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: 'test-client-id',
          method: 'disconnect'
        }),
        undefined
      );
    });
  });

  describe('Bandwidth Methods', () => {
    test('getMaxBitrate delegates to dummy client', () => {
      const bitrate = client.getMaxBitrate();

      expect(client._dummyClient.getMaxBitrate).toHaveBeenCalled();
      expect(bitrate).toBe(40000);
    });

    test('getActualBitrate delegates to dummy client', () => {
      const bitrate = client.getActualBitrate();

      expect(client._dummyClient.getActualBitrate).toHaveBeenCalled();
      expect(bitrate).toBe(38000);
    });
  });

  describe('User Management', () => {
    test('_user creates new user on first access', () => {
      const user = client._user('user-123');

      expect(user).toBeDefined();
      expect(user._id).toBe('user-123');
    });

    test('_user returns cached user on subsequent access', () => {
      const user1 = client._user('user-123');
      const user2 = client._user('user-123');

      expect(user1).toBe(user2);
    });

    test('_user emits newUser event immediately (race condition fix)', () => {
      const newUserSpy = jest.fn();
      client.on('newUser', newUserSpy);

      const user = client._user('user-123');

      expect(newUserSpy).toHaveBeenCalledWith(user);
    });

    test('users getter returns all users', () => {
      client._user('user-1');
      client._user('user-2');

      const users = client.users;
      expect(users.length).toBe(2);
    });
  });

  describe('Channel Management', () => {
    test('_channel creates new channel on first access', () => {
      const channel = client._channel('channel-123');

      expect(channel).toBeDefined();
      expect(channel._id).toBe('channel-123');
    });

    test('_channel returns cached channel on subsequent access', () => {
      const channel1 = client._channel('channel-123');
      const channel2 = client._channel('channel-123');

      expect(channel1).toBe(channel2);
    });

    test('_channel emits newChannel event immediately (race condition fix)', () => {
      const newChannelSpy = jest.fn();
      client.on('newChannel', newChannelSpy);

      const channel = client._channel('channel-123');

      expect(newChannelSpy).toHaveBeenCalledWith(channel);
    });

    test('channels getter returns all channels', () => {
      client._channel('channel-1');
      client._channel('channel-2');

      const channels = client.channels;
      expect(channels.length).toBe(2);
    });
  });

  describe('Property Updates', () => {
    test('_setProp sets root channel ID', () => {
      client._setProp('root', 'root-channel-id');

      expect(client._rootId).toBe('root-channel-id');
    });

    test('_setProp sets self user ID', () => {
      client._setProp('self', 'self-user-id');

      expect(client._selfId).toBe('self-user-id');
    });

    test('_setProp migrates undefined user to real ID', () => {
      // Create user with undefined ID (pre-connect state)
      const undefinedUser = client._user(undefined);
      
      // Simulate server assigning real ID
      client._setProp('self', 'real-user-id');

      // User should be migrated to new ID
      expect(client._users['real-user-id']).toBe(undefinedUser);
      expect(client._users[undefined]).toBeUndefined();
      expect(undefinedUser._id).toBe('real-user-id');
    });

    test('_setProp updates maxBandwidth on dummy client', () => {
      client._setProp('maxBandwidth', 100000);

      expect(client._dummyClient.maxBandwidth).toBe(100000);
    });

    test('_setProp sets generic properties', () => {
      client._setProp('customProp', 'customValue');

      expect(client.customProp).toBe('customValue');
    });
  });

  describe('Getters', () => {
    test('root returns root channel', () => {
      client._rootId = 'root-channel-id';
      const channel = client.root;

      expect(channel._id).toBe('root-channel-id');
    });

    test('self returns self user', () => {
      client._selfId = 'self-user-id';
      const user = client.self;

      expect(user._id).toBe('self-user-id');
    });
  });

  describe('Event Dispatching', () => {
    test('dispatches newChannel with channel object', () => {
      const newChannelSpy = jest.fn();
      client.on('newChannel', newChannelSpy);

      client._dispatchEvent('newChannel', ['channel-id-123']);

      expect(newChannelSpy).toHaveBeenCalled();
      const channelArg = newChannelSpy.mock.calls[0][0];
      expect(channelArg._id).toBe('channel-id-123');
    });

    test('dispatches newUser with user object', () => {
      const newUserSpy = jest.fn();
      client.on('newUser', newUserSpy);

      client._dispatchEvent('newUser', ['user-id-456']);

      expect(newUserSpy).toHaveBeenCalled();
      const userArg = newUserSpy.mock.calls[0][0];
      expect(userArg._id).toBe('user-id-456');
    });

    test('dispatches message event with resolved objects', () => {
      const messageSpy = jest.fn();
      client.on('message', messageSpy);

      client._dispatchEvent('message', [
        'sender-id',
        'Hello',
        ['user1', 'user2'],
        ['channel1'],
        ['channel2']
      ]);

      expect(messageSpy).toHaveBeenCalled();
      const [sender, message, users, channels1, channels2] = messageSpy.mock.calls[0];
      expect(sender._id).toBe('sender-id');
      expect(message).toBe('Hello');
      expect(users[0]._id).toBe('user1');
      expect(channels1[0]._id).toBe('channel1');
    });

    test('dispatches generic events as-is', () => {
      const customSpy = jest.fn();
      client.on('customEvent', customSpy);

      client._dispatchEvent('customEvent', ['arg1', 'arg2']);

      expect(customSpy).toHaveBeenCalledWith('arg1', 'arg2');
    });
  });
});

describe('WorkerBasedMumbleChannel', () => {
  let connector;
  let client;
  let channel;

  beforeEach(() => {
    connector = new WorkerBasedMumbleConnector();
    client = connector._client('test-client');
    channel = client._channel('test-channel');
  });

  describe('Constructor', () => {
    test('initializes with connector, client, and ID', () => {
      expect(channel._connector).toBe(connector);
      expect(channel._client).toBe(client);
      expect(channel._id).toBe('test-channel');
    });
  });

  describe('RPC Methods', () => {
    test('sendMessage calls worker', () => {
      channel.sendMessage('Hello channel');

      expect(connector._worker.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: 'test-client',
          channelId: 'test-channel',
          method: 'sendMessage'
        }),
        undefined
      );
    });
  });

  describe('Property Updates', () => {
    test('_setProp sets parent ID', () => {
      channel._setProp('parent', 'parent-channel-id');

      expect(channel._parentId).toBe('parent-channel-id');
    });

    test('_setProp resolves link IDs to channel objects', () => {
      channel._setProp('links', ['link1', 'link2']);

      expect(channel.links.length).toBe(2);
      expect(channel.links[0]._id).toBe('link1');
    });

    test('_setProp sets generic properties', () => {
      channel._setProp('name', 'Test Channel');

      expect(channel.name).toBe('Test Channel');
    });
  });

  describe('Getters', () => {
    test('id returns channel ID', () => {
      expect(channel.id).toBe('test-channel');
    });

    test('parent returns parent channel', () => {
      channel._parentId = 'parent-channel-id';
      const parent = channel.parent;

      expect(parent._id).toBe('parent-channel-id');
    });

    test('parent returns undefined when no parent', () => {
      expect(channel.parent).toBeUndefined();
    });

    test('children returns child channels', () => {
      const child1 = client._channel('child1');
      const child2 = client._channel('child2');
      child1._parentId = 'test-channel';
      child2._parentId = 'test-channel';

      const children = channel.children;

      expect(children.length).toBe(2);
      expect(children).toContain(child1);
      expect(children).toContain(child2);
    });
  });

  describe('Event Dispatching', () => {
    test('dispatches update event with resolved properties', () => {
      channel._parentId = 'parent-id';
      const updateSpy = jest.fn();
      channel.on('update', updateSpy);

      client._channel('parent-id'); // Ensure parent exists
      client._channel('link1'); // Ensure link exists

      channel._dispatchEvent('update', [{
        name: 'Updated Channel',
        parent: 'parent-id',
        links: ['link1']
      }]);

      expect(updateSpy).toHaveBeenCalled();
      const props = updateSpy.mock.calls[0][0];
      expect(props.name).toBe('Updated Channel');
      expect(props.parent._id).toBe('parent-id');
      expect(props.links[0]._id).toBe('link1');
    });

    test('dispatches remove event and deletes channel', () => {
      const removeSpy = jest.fn();
      channel.on('remove', removeSpy);

      channel._dispatchEvent('remove', []);

      expect(removeSpy).toHaveBeenCalled();
      expect(client._channels['test-channel']).toBeUndefined();
    });
  });
});

describe('WorkerBasedMumbleUser', () => {
  let connector;
  let client;
  let user;

  beforeEach(() => {
    connector = new WorkerBasedMumbleConnector();
    client = connector._client('test-client');
    user = client._user('test-user');
  });

  describe('Constructor', () => {
    test('initializes with connector, client, and ID', () => {
      expect(user._connector).toBe(connector);
      expect(user._client).toBe(client);
      expect(user._id).toBe('test-user');
    });
  });

  describe('RPC Methods', () => {
    test('setMute calls worker', () => {
      user.setMute(true);

      expect(connector._worker.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: 'test-client',
          userId: 'test-user',
          method: 'setMute'
        }),
        undefined
      );
    });

    test('setDeaf calls worker', () => {
      user.setDeaf(false);

      expect(connector._worker.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: 'test-client',
          userId: 'test-user',
          method: 'setDeaf'
        }),
        undefined
      );
    });

    test('sendMessage calls worker', () => {
      user.sendMessage('Hello user');

      expect(connector._worker.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: 'test-client',
          userId: 'test-user',
          method: 'sendMessage'
        }),
        undefined
      );
    });

    test('setChannel calls worker with channel ID', () => {
      const channel = client._channel('target-channel');
      
      user.setChannel(channel);

      expect(connector._worker.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: 'test-client',
          userId: 'test-user',
          method: 'setChannel',
          payload: 'target-channel'
        }),
        undefined
      );
    });
  });

  describe('Property Updates', () => {
    test('_setProp sets channel ID', () => {
      user._setProp('channel', 'channel-id');

      expect(user._channelId).toBe('channel-id');
    });

    test('_setProp sets generic properties', () => {
      user._setProp('name', 'Test User');

      expect(user.name).toBe('Test User');
    });
  });

  describe('Getters', () => {
    test('id returns user ID', () => {
      expect(user.id).toBe('test-user');
    });

    test('channel returns user channel', () => {
      user._channelId = 'channel-id';
      client._channel('channel-id'); // Ensure channel exists

      const channel = user.channel;

      expect(channel._id).toBe('channel-id');
    });
  });

  describe('Event Dispatching', () => {
    test('dispatches update event with actor and resolved properties', () => {
      const updateSpy = jest.fn();
      user.on('update', updateSpy);

      client._channel('channel-id'); // Ensure channel exists

      user._dispatchEvent('update', [
        'actor-id',
        { name: 'Updated User', channel: 'channel-id' }
      ]);

      expect(updateSpy).toHaveBeenCalled();
      const [actor, props] = updateSpy.mock.calls[0];
      expect(actor._id).toBe('actor-id');
      expect(props.name).toBe('Updated User');
      expect(props.channel._id).toBe('channel-id');
    });

    test('dispatches voice event with PassThrough stream', () => {
      const voiceSpy = jest.fn();
      user.on('voice', voiceSpy);

      user._dispatchEvent('voice', ['voice-id-123']);

      expect(voiceSpy).toHaveBeenCalled();
      const stream = voiceSpy.mock.calls[0][0];
      expect(stream).toBeDefined();
      expect(connector._voiceStreams['voice-id-123']).toBe(stream);
    });

    test('dispatches remove event and deletes user', () => {
      const removeSpy = jest.fn();
      user.on('remove', removeSpy);

      user._dispatchEvent('remove', []);

      expect(removeSpy).toHaveBeenCalled();
      expect(client._users['test-user']).toBeUndefined();
    });
  });

  describe('Regression Tests - ID Getter Bug', () => {
    test('user.id returns numeric ID correctly', () => {
      const user = client._user(123);
      expect(user.id).toBe(123);
      expect(user._id).toBe(123);
    });

    test('channel.id returns numeric ID correctly', () => {
      const channel = client._channel(456);
      expect(channel.id).toBe(456);
      expect(channel._id).toBe(456);
    });

    test('sendMessage on user with ID does not fail', () => {
      const user = client._user(789);
      
      // Should not throw - id getter provides valid userId for RPC call
      expect(() => user.sendMessage('test')).not.toThrow();
      
      expect(connector._worker.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 789,
          method: 'sendMessage'
        }),
        undefined
      );
    });

    test('sendMessage on channel with ID does not fail', () => {
      const channel = client._channel(999);
      
      // Should not throw - id getter provides valid channelId for RPC call
      expect(() => channel.sendMessage('test')).not.toThrow();
      
      expect(connector._worker.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channelId: 999,
          method: 'sendMessage'
        }),
        undefined
      );
    });

    test('undefined user ID still accessible via id getter', () => {
      const undefinedUser = client._user(undefined);
      expect(undefinedUser.id).toBeUndefined();
      expect(undefinedUser._id).toBeUndefined();
    });

    test('user ID migration preserves id getter functionality', () => {
      // Create user with undefined ID
      const user = client._user(undefined);
      expect(user.id).toBeUndefined();
      
      // Simulate server assigning real ID
      client._setProp('self', 555);
      
      // ID should be updated
      expect(user.id).toBe(555);
      expect(user._id).toBe(555);
      expect(client._users[555]).toBe(user);
    });
  });
});
