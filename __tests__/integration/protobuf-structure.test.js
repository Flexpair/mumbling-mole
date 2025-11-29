/**
 * Proto Structure Compatibility Tests
 * 
 * These tests verify that mumble-proto-minimal.js contains all required
 * message types and fields. When updating Mumble.proto and regenerating,
 * these tests will catch:
 * 
 * 1. Missing message types
 * 2. Missing required fields
 * 3. Changed field types
 * 4. Encode/decode roundtrip failures
 * 
 * Run after regenerating: npm run test:unit -- --testPathPatterns=protobuf-structure
 */

import { MumbleProto } from '../../app/mumble-streams/mumble-proto-minimal.js';

describe('Proto Structure Compatibility Tests', () => {
  
  describe('Required Message Types Exist', () => {
    const requiredTypes = [
      'Version',
      'UDPTunnel', 
      'Authenticate',
      'Ping',
      'Reject',
      'ServerSync',
      'ChannelRemove',
      'ChannelState',
      'UserRemove',
      'UserState',
      'BanList',
      'TextMessage',
      'PermissionDenied',
      'ACL',
      'QueryUsers',
      'CryptSetup',
      'ContextActionModify',
      'ContextAction',
      'UserList',
      'VoiceTarget',
      'PermissionQuery',
      'CodecVersion',
      'UserStats',
      'RequestBlob',
      'ServerConfig',
      'SuggestConfig'
    ];

    test.each(requiredTypes)('MumbleProto.%s exists and has required methods', (typeName) => {
      const MessageType = MumbleProto[typeName];
      
      expect(MessageType).toBeDefined();
      expect(typeof MessageType).toBe('function');
      expect(typeof MessageType.create).toBe('function');
      expect(typeof MessageType.encode).toBe('function');
      expect(typeof MessageType.decode).toBe('function');
    });
  });

  describe('Critical Field Existence - UserState', () => {
    test('UserState has all mute/deaf fields when set', () => {
      // Proto3: default values (false) are not serialized, so we test with explicit values
      const user = MumbleProto.UserState.create({
        mute: true,
        deaf: true,
        selfMute: true,
        selfDeaf: true,
        suppress: true
      });
      
      // These fields are critical for audio control
      expect(user.mute).toBe(true);
      expect(user.deaf).toBe(true);
      expect(user.selfMute).toBe(true);
      expect(user.selfDeaf).toBe(true);
      expect(user.suppress).toBe(true);
    });

    test('UserState has identity fields when set', () => {
      const user = MumbleProto.UserState.create({
        session: 42,
        name: 'TestUser',
        channelId: 1
      });
      
      expect(user.session).toBe(42);
      expect(user.name).toBe('TestUser');
      expect(user.channelId).toBe(1);
    });
  });

  describe('Critical Field Existence - ChannelState', () => {
    test('ChannelState has navigation fields when set', () => {
      const channel = MumbleProto.ChannelState.create({
        channelId: 5,
        parent: 0,
        name: 'Test'
      });
      
      expect(channel.channelId).toBe(5);
      expect(channel.parent).toBe(0);
      expect(channel.name).toBe('Test');
    });

    test('ChannelState has link arrays when set', () => {
      const channel = MumbleProto.ChannelState.create({
        links: [1, 2],
        linksAdd: [3],
        linksRemove: [4]
      });
      
      expect(channel.links).toEqual([1, 2]);
      expect(channel.linksAdd).toEqual([3]);
      expect(channel.linksRemove).toEqual([4]);
    });
  });

  describe('Critical Field Existence - TextMessage', () => {
    test('TextMessage has routing fields when set', () => {
      const msg = MumbleProto.TextMessage.create({
        actor: 1,
        session: [2, 3],
        channelId: [0],
        treeId: [1],
        message: 'test'
      });
      
      expect(msg.actor).toBe(1);
      expect(msg.session).toEqual([2, 3]);
      expect(msg.channelId).toEqual([0]);
      expect(msg.treeId).toEqual([1]);
      expect(msg.message).toBe('test');
    });
  });

  describe('Encode/Decode Roundtrip Tests', () => {
    test('UserState roundtrip preserves mute/deaf state', () => {
      const original = {
        session: 42,
        selfMute: true,
        channelId: 1
      };

      const encoded = MumbleProto.UserState.encode(
        MumbleProto.UserState.create(original)
      ).finish();
      
      const decoded = MumbleProto.UserState.decode(encoded);

      expect(decoded.session).toBe(42);
      expect(decoded.selfMute).toBe(true);
      // Proto3: false is default and not serialized, so decoded value is undefined/falsy
      expect(decoded.selfDeaf).toBeFalsy();
      expect(decoded.channelId).toBe(1);
    });

    test('ChannelState roundtrip preserves hierarchy', () => {
      const original = {
        channelId: 5,
        name: 'Test Channel',
        temporary: true
      };

      const encoded = MumbleProto.ChannelState.encode(
        MumbleProto.ChannelState.create(original)
      ).finish();
      
      const decoded = MumbleProto.ChannelState.decode(encoded);

      expect(decoded.channelId).toBe(5);
      // Proto3: 0 is default for int and not serialized
      expect(decoded.parent || 0).toBe(0);
      expect(decoded.name).toBe('Test Channel');
      expect(decoded.temporary).toBe(true);
    });

    test('TextMessage roundtrip preserves content and routing', () => {
      const original = {
        actor: 1,
        channelId: [5],
        message: 'Hello <b>World</b>!'
      };

      const encoded = MumbleProto.TextMessage.encode(
        MumbleProto.TextMessage.create(original)
      ).finish();
      
      const decoded = MumbleProto.TextMessage.decode(encoded);

      expect(decoded.actor).toBe(1);
      expect(decoded.channelId).toHaveLength(1);
      expect(Number(decoded.channelId[0])).toBe(5);
      expect(decoded.message).toBe('Hello <b>World</b>!');
    });

    test('Ping roundtrip preserves timestamp', () => {
      // Use a number that fits in safe integer range
      const timestamp = Date.now();
      const original = { timestamp };

      const encoded = MumbleProto.Ping.encode(
        MumbleProto.Ping.create(original)
      ).finish();
      
      const decoded = MumbleProto.Ping.decode(encoded);

      // Timestamp may be Long object depending on protobufjs config
      // Long has .low and .high properties, or can be converted via .toNumber()
      const decodedTimestamp = typeof decoded.timestamp === 'object' 
        ? (decoded.timestamp.toNumber ? decoded.timestamp.toNumber() : Number(decoded.timestamp))
        : Number(decoded.timestamp);
      
      expect(decodedTimestamp).toBe(timestamp);
    });

    test('Authenticate roundtrip preserves credentials', () => {
      const original = {
        username: 'TestUser',
        password: 'secret123',
        opus: true,
        tokens: ['token1', 'token2']
      };

      const encoded = MumbleProto.Authenticate.encode(
        MumbleProto.Authenticate.create(original)
      ).finish();
      
      const decoded = MumbleProto.Authenticate.decode(encoded);

      expect(decoded.username).toBe('TestUser');
      expect(decoded.password).toBe('secret123');
      expect(decoded.opus).toBe(true);
      expect(decoded.tokens).toEqual(['token1', 'token2']);
    });
  });

  describe('Enum Types Exist', () => {
    test('Reject.RejectType has expected values', () => {
      const RejectType = MumbleProto.Reject.RejectType;
      
      expect(RejectType).toBeDefined();
      expect(RejectType.None).toBe(0);
      expect(RejectType.WrongVersion).toBe(1);
      expect(RejectType.InvalidUsername).toBe(2);
      expect(RejectType.UsernameInUse).toBe(5);
      expect(RejectType.ServerFull).toBe(6);
    });

    test('PermissionDenied.DenyType has expected values', () => {
      const DenyType = MumbleProto.PermissionDenied.DenyType;
      
      expect(DenyType).toBeDefined();
      expect(DenyType.Text).toBe(0);
      expect(DenyType.Permission).toBe(1);
      expect(DenyType.ChannelFull).toBe(9);
    });
  });

  describe('Nested Types Exist', () => {
    test('BanList.BanEntry exists', () => {
      expect(MumbleProto.BanList.BanEntry).toBeDefined();
      expect(typeof MumbleProto.BanList.BanEntry.create).toBe('function');
    });

    test('ACL.ChanGroup exists', () => {
      expect(MumbleProto.ACL.ChanGroup).toBeDefined();
      expect(typeof MumbleProto.ACL.ChanGroup.create).toBe('function');
    });

    test('ACL.ChanACL exists', () => {
      expect(MumbleProto.ACL.ChanACL).toBeDefined();
      expect(typeof MumbleProto.ACL.ChanACL.create).toBe('function');
    });

    test('VoiceTarget.Target exists', () => {
      expect(MumbleProto.VoiceTarget.Target).toBeDefined();
      expect(typeof MumbleProto.VoiceTarget.Target.create).toBe('function');
    });
  });

  describe('Binary Field Handling', () => {
    test('UDPTunnel handles binary packet data', () => {
      const packetData = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
      const original = { packet: packetData };

      const encoded = MumbleProto.UDPTunnel.encode(
        MumbleProto.UDPTunnel.create(original)
      ).finish();
      
      const decoded = MumbleProto.UDPTunnel.decode(encoded);

      // In Node.js, protobufjs returns Buffer; in browser, Uint8Array
      // Both are array-like and can be converted with Array.from
      expect(decoded.packet).toBeDefined();
      expect(decoded.packet.length).toBe(4);
      expect(Array.from(decoded.packet)).toEqual([0x01, 0x02, 0x03, 0x04]);
    });
  });

  describe('Default Values', () => {
    test('UserState booleans default to falsy', () => {
      const user = MumbleProto.UserState.create({});
      
      // Proto3 semantics: unset booleans are falsy (undefined or false)
      expect(user.mute).toBeFalsy();
      expect(user.deaf).toBeFalsy();
      expect(user.selfMute).toBeFalsy();
      expect(user.selfDeaf).toBeFalsy();
    });

    test('ChannelState.temporary defaults to falsy', () => {
      const channel = MumbleProto.ChannelState.create({});
      expect(channel.temporary).toBeFalsy();
    });

    test('Authenticate.opus defaults to falsy', () => {
      const auth = MumbleProto.Authenticate.create({});
      expect(auth.opus).toBeFalsy();
    });
  });
});
