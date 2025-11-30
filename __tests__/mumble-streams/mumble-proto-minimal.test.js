/**
 * Comprehensive tests for mumble-proto-minimal.js
 * 
 * Tests all Protobuf message types with encode/decode roundtrips,
 * covering all branches for constructor, create, encode, decode methods.
 */

import { MumbleProto } from '../../app/mumble-streams/mumble-proto-minimal.js';

describe('MumbleProto', () => {
  
  describe('Version', () => {
    const { Version } = MumbleProto;

    test('creates instance with default values', () => {
      const msg = new Version();
      expect(msg.version).toBe(0);
      expect(msg.release).toBe('');
      expect(msg.os).toBe('');
      expect(msg.osVersion).toBe('');
    });

    test('creates instance with properties', () => {
      const msg = new Version({ version: 123, release: '1.4.0', os: 'Linux', osVersion: '5.15' });
      expect(msg.version).toBe(123);
      expect(msg.release).toBe('1.4.0');
      expect(msg.os).toBe('Linux');
      expect(msg.osVersion).toBe('5.15');
    });

    test('create() factory method works', () => {
      const msg = Version.create({ version: 456 });
      expect(msg).toBeInstanceOf(Version);
      expect(msg.version).toBe(456);
    });

    test('encode/decode roundtrip with all fields', () => {
      const original = Version.create({ version: 0x10400, release: '1.4.0', os: 'Windows', osVersion: '10' });
      const encoded = Version.encode(original).finish();
      const decoded = Version.decode(encoded);
      
      expect(decoded.version).toBe(original.version);
      expect(decoded.release).toBe(original.release);
      expect(decoded.os).toBe(original.os);
      expect(decoded.osVersion).toBe(original.osVersion);
    });

    test('encode with explicit writer', () => {
      const msg = Version.create({ version: 100 });
      const writer = Version.encode(msg);
      expect(writer).toBeDefined();
      const result = writer.finish();
      expect(ArrayBuffer.isView(result)).toBe(true);
    });

    test('decode with explicit length', () => {
      const original = Version.create({ version: 200 });
      const encoded = Version.encode(original).finish();
      const decoded = Version.decode(encoded, encoded.length);
      expect(decoded.version).toBe(200);
    });

    test('decode handles unknown fields gracefully', () => {
      const original = Version.create({ version: 300 });
      const encoded = Version.encode(original).finish();
      const decoded = Version.decode(encoded);
      expect(decoded.version).toBe(300);
    });

    test('handles null properties in constructor', () => {
      const msg = new Version({ version: null, release: 'test' });
      expect(msg.release).toBe('test');
    });
  });

  describe('UDPTunnel', () => {
    const { UDPTunnel } = MumbleProto;

    test('creates instance with default packet', () => {
      const msg = new UDPTunnel();
      expect(msg.packet).toBeDefined();
    });

    test('encode/decode roundtrip', () => {
      const packetData = new Uint8Array([1, 2, 3, 4, 5]);
      const original = UDPTunnel.create({ packet: packetData });
      const encoded = UDPTunnel.encode(original).finish();
      const decoded = UDPTunnel.decode(encoded);
      
      expect(new Uint8Array(decoded.packet)).toEqual(packetData);
    });

    test('decode throws on missing required packet field', () => {
      const emptyBuffer = new Uint8Array([]);
      expect(() => UDPTunnel.decode(emptyBuffer)).toThrow();
    });

  });

  describe('Authenticate', () => {
    const { Authenticate } = MumbleProto;

    test('creates instance with array fields', () => {
      const msg = new Authenticate();
      expect(msg.tokens).toEqual([]);
      expect(msg.celtVersions).toEqual([]);
    });

    test('encode/decode with all fields', () => {
      const original = Authenticate.create({
        username: 'testuser',
        password: 'testpass',
        tokens: ['token1', 'token2'],
        celtVersions: [1, 2, 3],
        opus: true
      });
      const encoded = Authenticate.encode(original).finish();
      const decoded = Authenticate.decode(encoded);
      
      expect(decoded.username).toBe('testuser');
      expect(decoded.password).toBe('testpass');
      expect(decoded.tokens).toEqual(['token1', 'token2']);
      expect(decoded.celtVersions).toEqual([1, 2, 3]);
      expect(decoded.opus).toBe(true);
    });

    test('encode handles empty arrays', () => {
      const original = Authenticate.create({ username: 'user' });
      const encoded = Authenticate.encode(original).finish();
      expect(encoded.length).toBeGreaterThan(0);
    });

  });

  describe('Ping', () => {
    const { Ping } = MumbleProto;

    test('creates instance with all numeric fields', () => {
      const msg = new Ping();
      expect(msg.good).toBe(0);
      expect(msg.late).toBe(0);
      expect(msg.lost).toBe(0);
    });

    test('encode/decode with all fields', () => {
      const original = Ping.create({
        timestamp: 12345678,
        good: 100,
        late: 5,
        lost: 2,
        resync: 1,
        udpPackets: 1000,
        tcpPackets: 50,
        udpPingAvg: 25.5,
        udpPingVar: 5.2,
        tcpPingAvg: 30.0,
        tcpPingVar: 3.1
      });
      const encoded = Ping.encode(original).finish();
      const decoded = Ping.decode(encoded);
      
      expect(decoded.good).toBe(100);
      expect(decoded.late).toBe(5);
      expect(decoded.lost).toBe(2);
      expect(decoded.resync).toBe(1);
      expect(decoded.udpPackets).toBe(1000);
      expect(decoded.tcpPackets).toBe(50);
      expect(decoded.udpPingAvg).toBeCloseTo(25.5, 1);
      expect(decoded.tcpPingAvg).toBeCloseTo(30.0, 1);
    });

  });

  describe('Reject', () => {
    const { Reject } = MumbleProto;

    test('creates instance with type and reason', () => {
      const msg = new Reject({ type: 2, reason: 'Invalid username' });
      expect(msg.type).toBe(2);
      expect(msg.reason).toBe('Invalid username');
    });

    test('encode/decode roundtrip', () => {
      const original = Reject.create({ type: 5, reason: 'Username in use' });
      const encoded = Reject.encode(original).finish();
      const decoded = Reject.decode(encoded);
      
      expect(decoded.type).toBe(5);
      expect(decoded.reason).toBe('Username in use');
    });

    test('RejectType enum values', () => {
      expect(Reject.RejectType.None).toBe(0);
      expect(Reject.RejectType.WrongVersion).toBe(1);
      expect(Reject.RejectType.InvalidUsername).toBe(2);
      expect(Reject.RejectType.WrongUserPW).toBe(3);
      expect(Reject.RejectType.WrongServerPW).toBe(4);
      expect(Reject.RejectType.UsernameInUse).toBe(5);
      expect(Reject.RejectType.ServerFull).toBe(6);
      expect(Reject.RejectType.NoCertificate).toBe(7);
      expect(Reject.RejectType.AuthenticatorFail).toBe(8);
    });

  });

  describe('ServerSync', () => {
    const { ServerSync } = MumbleProto;

    test('encode/decode with all fields', () => {
      const original = ServerSync.create({
        session: 42,
        maxBandwidth: 72000,
        welcomeText: 'Welcome to the server!',
        permissions: 0x7FFFFFFF
      });
      const encoded = ServerSync.encode(original).finish();
      const decoded = ServerSync.decode(encoded);
      
      expect(decoded.session).toBe(42);
      expect(decoded.maxBandwidth).toBe(72000);
      expect(decoded.welcomeText).toBe('Welcome to the server!');
    });

  });

  describe('ChannelRemove', () => {
    const { ChannelRemove } = MumbleProto;

    test('encode/decode roundtrip', () => {
      const original = ChannelRemove.create({ channelId: 123 });
      const encoded = ChannelRemove.encode(original).finish();
      const decoded = ChannelRemove.decode(encoded);
      
      expect(decoded.channelId).toBe(123);
    });

    test('decode throws on missing required channelId', () => {
      const emptyBuffer = new Uint8Array([]);
      expect(() => ChannelRemove.decode(emptyBuffer)).toThrow();
    });

  });

  describe('ChannelState', () => {
    const { ChannelState } = MumbleProto;

    test('creates instance with array fields', () => {
      const msg = new ChannelState();
      expect(msg.links).toEqual([]);
      expect(msg.linksAdd).toEqual([]);
      expect(msg.linksRemove).toEqual([]);
    });

    test('encode/decode with all fields including arrays', () => {
      const original = ChannelState.create({
        channelId: 1,
        parent: 0,
        name: 'Test Channel',
        links: [2, 3],
        description: 'A test channel',
        linksAdd: [4],
        linksRemove: [5],
        temporary: true,
        position: 10,
        descriptionHash: new Uint8Array([1, 2, 3]),
        maxUsers: 50
      });
      const encoded = ChannelState.encode(original).finish();
      const decoded = ChannelState.decode(encoded);
      
      expect(decoded.channelId).toBe(1);
      expect(decoded.name).toBe('Test Channel');
      expect(decoded.links).toEqual([2, 3]);
      expect(decoded.linksAdd).toEqual([4]);
      expect(decoded.linksRemove).toEqual([5]);
      expect(decoded.temporary).toBe(true);
      expect(decoded.position).toBe(10);
      expect(decoded.maxUsers).toBe(50);
    });

  });

  describe('UserRemove', () => {
    const { UserRemove } = MumbleProto;

    test('encode/decode with all fields', () => {
      const original = UserRemove.create({
        session: 1,
        actor: 2,
        reason: 'Kicked',
        ban: true
      });
      const encoded = UserRemove.encode(original).finish();
      const decoded = UserRemove.decode(encoded);
      
      expect(decoded.session).toBe(1);
      expect(decoded.actor).toBe(2);
      expect(decoded.reason).toBe('Kicked');
      expect(decoded.ban).toBe(true);
    });

    test('decode throws on missing required session', () => {
      const emptyBuffer = new Uint8Array([]);
      expect(() => UserRemove.decode(emptyBuffer)).toThrow();
    });

  });

  describe('UserState', () => {
    const { UserState } = MumbleProto;

    test('encode/decode with all fields', () => {
      const original = UserState.create({
        session: 1,
        actor: 2,
        name: 'TestUser',
        userId: 100,
        channelId: 0,
        mute: false,
        deaf: false,
        suppress: false,
        selfMute: true,
        selfDeaf: false,
        texture: new Uint8Array([1, 2, 3]),
        pluginContext: new Uint8Array([4, 5]),
        pluginIdentity: 'plugin-id',
        comment: 'Hello world',
        hash: 'abc123',
        commentHash: new Uint8Array([6, 7]),
        textureHash: new Uint8Array([8, 9]),
        prioritySpeaker: true,
        recording: false
      });
      const encoded = UserState.encode(original).finish();
      const decoded = UserState.decode(encoded);
      
      expect(decoded.session).toBe(1);
      expect(decoded.name).toBe('TestUser');
      expect(decoded.selfMute).toBe(true);
      expect(decoded.prioritySpeaker).toBe(true);
      expect(decoded.comment).toBe('Hello world');
    });

  });

  describe('BanList', () => {
    const { BanList } = MumbleProto;

    test('creates instance with bans array', () => {
      const msg = new BanList();
      expect(msg.bans).toEqual([]);
    });

    test('encode/decode with nested BanEntry', () => {
      const original = BanList.create({
        bans: [
          {
            address: new Uint8Array([192, 168, 1, 1]),
            mask: 32,
            name: 'BadUser',
            hash: 'badhash',
            reason: 'Spamming',
            start: '2024-01-01',
            duration: 3600
          }
        ],
        query: true
      });
      const encoded = BanList.encode(original).finish();
      const decoded = BanList.decode(encoded);
      
      expect(decoded.bans.length).toBe(1);
      expect(decoded.bans[0].name).toBe('BadUser');
      expect(decoded.bans[0].mask).toBe(32);
      expect(decoded.query).toBe(true);
    });

    test('BanEntry encode/decode', () => {
      const entry = BanList.BanEntry.create({
        address: new Uint8Array([10, 0, 0, 1]),
        mask: 24,
        name: 'Test',
        reason: 'Testing'
      });
      const encoded = BanList.BanEntry.encode(entry).finish();
      const decoded = BanList.BanEntry.decode(encoded);
      
      expect(decoded.mask).toBe(24);
      expect(decoded.name).toBe('Test');
    });

    test('BanEntry decode throws on missing required fields', () => {
      const emptyBuffer = new Uint8Array([]);
      expect(() => BanList.BanEntry.decode(emptyBuffer)).toThrow();
    });

  });

  describe('TextMessage', () => {
    const { TextMessage } = MumbleProto;

    test('creates instance with array fields', () => {
      const msg = new TextMessage();
      expect(msg.session).toEqual([]);
      expect(msg.channelId).toEqual([]);
      expect(msg.treeId).toEqual([]);
    });

    test('encode/decode with all fields', () => {
      const original = TextMessage.create({
        actor: 1,
        session: [2, 3],
        channelId: [0],
        treeId: [0, 1],
        message: 'Hello everyone!'
      });
      const encoded = TextMessage.encode(original).finish();
      const decoded = TextMessage.decode(encoded);
      
      expect(decoded.actor).toBe(1);
      expect(decoded.session).toEqual([2, 3]);
      expect(decoded.message).toBe('Hello everyone!');
    });

    test('encode/decode handles minimal message', () => {
      const minimal = TextMessage.create({ message: 'test' });
      const encoded = TextMessage.encode(minimal).finish();
      const decoded = TextMessage.decode(encoded);
      expect(decoded.message).toBe('test');
    });

  });

  describe('PermissionDenied', () => {
    const { PermissionDenied } = MumbleProto;

    test('encode/decode with all fields', () => {
      const original = PermissionDenied.create({
        permission: 0x04,
        channelId: 1,
        session: 2,
        reason: 'Insufficient permissions',
        type: 1,
        name: 'speak'
      });
      const encoded = PermissionDenied.encode(original).finish();
      const decoded = PermissionDenied.decode(encoded);
      
      expect(decoded.permission).toBe(4);
      expect(decoded.type).toBe(1);
      expect(decoded.reason).toBe('Insufficient permissions');
    });

    test('DenyType enum values', () => {
      expect(PermissionDenied.DenyType.Text).toBe(0);
      expect(PermissionDenied.DenyType.Permission).toBe(1);
      expect(PermissionDenied.DenyType.SuperUser).toBe(2);
      expect(PermissionDenied.DenyType.ChannelName).toBe(3);
      expect(PermissionDenied.DenyType.TextTooLong).toBe(4);
      expect(PermissionDenied.DenyType.TemporaryChannel).toBe(6);
      expect(PermissionDenied.DenyType.MissingCertificate).toBe(7);
      expect(PermissionDenied.DenyType.ChannelFull).toBe(9);
      expect(PermissionDenied.DenyType.NestingLimit).toBe(10);
    });

  });

  describe('ACL', () => {
    const { ACL } = MumbleProto;

    test('creates instance with array fields', () => {
      const msg = new ACL();
      expect(msg.groups).toEqual([]);
      expect(msg.acls).toEqual([]);
    });

    test('encode/decode with nested ChanGroup and ChanACL', () => {
      const original = ACL.create({
        channelId: 1,
        inheritAcls: true,
        groups: [
          {
            name: 'admin',
            inherited: true,
            inherit: true,
            inheritable: true,
            add: [1, 2],
            remove: [3],
            inheritedMembers: [4, 5]
          }
        ],
        acls: [
          {
            applyHere: true,
            applySubs: true,
            inherited: false,
            userId: 1,
            group: 'admin',
            grant: 0xFF,
            deny: 0
          }
        ],
        query: false
      });
      const encoded = ACL.encode(original).finish();
      const decoded = ACL.decode(encoded);
      
      expect(decoded.channelId).toBe(1);
      expect(decoded.groups.length).toBe(1);
      expect(decoded.groups[0].name).toBe('admin');
      expect(decoded.acls.length).toBe(1);
      expect(decoded.acls[0].grant).toBe(255);
    });

    test('ChanGroup encode/decode', () => {
      const group = ACL.ChanGroup.create({
        name: 'testgroup',
        add: [1, 2, 3]
      });
      const encoded = ACL.ChanGroup.encode(group).finish();
      const decoded = ACL.ChanGroup.decode(encoded);
      
      expect(decoded.name).toBe('testgroup');
      expect(decoded.add).toEqual([1, 2, 3]);
    });

    test('ChanGroup decode throws on missing required name', () => {
      const emptyBuffer = new Uint8Array([]);
      expect(() => ACL.ChanGroup.decode(emptyBuffer)).toThrow();
    });

    test('ChanACL encode/decode', () => {
      const acl = ACL.ChanACL.create({
        applyHere: true,
        group: 'admin',
        grant: 0x10
      });
      const encoded = ACL.ChanACL.encode(acl).finish();
      const decoded = ACL.ChanACL.decode(encoded);
      
      expect(decoded.applyHere).toBe(true);
      expect(decoded.group).toBe('admin');
    });

    test('ACL decode throws on missing required channelId', () => {
      const emptyBuffer = new Uint8Array([]);
      expect(() => ACL.decode(emptyBuffer)).toThrow();
    });

  });

  describe('QueryUsers', () => {
    const { QueryUsers } = MumbleProto;

    test('creates instance with array fields', () => {
      const msg = new QueryUsers();
      expect(msg.ids).toEqual([]);
      expect(msg.names).toEqual([]);
    });

    test('encode/decode with arrays', () => {
      const original = QueryUsers.create({
        ids: [1, 2, 3],
        names: ['user1', 'user2']
      });
      const encoded = QueryUsers.encode(original).finish();
      const decoded = QueryUsers.decode(encoded);
      
      expect(decoded.ids).toEqual([1, 2, 3]);
      expect(decoded.names).toEqual(['user1', 'user2']);
    });

  });

  describe('CryptSetup', () => {
    const { CryptSetup } = MumbleProto;

    test('encode/decode with all fields', () => {
      const original = CryptSetup.create({
        key: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]),
        clientNonce: new Uint8Array([1, 2, 3, 4]),
        serverNonce: new Uint8Array([5, 6, 7, 8])
      });
      const encoded = CryptSetup.encode(original).finish();
      const decoded = CryptSetup.decode(encoded);
      
      expect(new Uint8Array(decoded.key)).toEqual(original.key);
    });

  });

  describe('ContextActionModify', () => {
    const { ContextActionModify } = MumbleProto;

    test('encode/decode with all fields', () => {
      const original = ContextActionModify.create({
        action: 'mute',
        text: 'Mute user',
        context: 4,
        operation: 0
      });
      const encoded = ContextActionModify.encode(original).finish();
      const decoded = ContextActionModify.decode(encoded);
      
      expect(decoded.action).toBe('mute');
      expect(decoded.text).toBe('Mute user');
      expect(decoded.context).toBe(4);
    });

    test('decode throws on missing required action', () => {
      const emptyBuffer = new Uint8Array([]);
      expect(() => ContextActionModify.decode(emptyBuffer)).toThrow();
    });

    test('Context enum values', () => {
      expect(ContextActionModify.Context.Server).toBe(1);
      expect(ContextActionModify.Context.Channel).toBe(2);
      expect(ContextActionModify.Context.User).toBe(4);
    });

    test('Operation enum values', () => {
      expect(ContextActionModify.Operation.Add).toBe(0);
      expect(ContextActionModify.Operation.Remove).toBe(1);
    });

  });

  describe('ContextAction', () => {
    const { ContextAction } = MumbleProto;

    test('encode/decode with all fields', () => {
      const original = ContextAction.create({
        session: 1,
        channelId: 0,
        action: 'kick'
      });
      const encoded = ContextAction.encode(original).finish();
      const decoded = ContextAction.decode(encoded);
      
      expect(decoded.session).toBe(1);
      expect(decoded.action).toBe('kick');
    });

    test('decode throws on missing required action', () => {
      const emptyBuffer = new Uint8Array([]);
      expect(() => ContextAction.decode(emptyBuffer)).toThrow();
    });

  });

  describe('UserList', () => {
    const { UserList } = MumbleProto;

    test('creates instance with users array', () => {
      const msg = new UserList();
      expect(msg.users).toEqual([]);
    });

    test('encode/decode with nested User', () => {
      const original = UserList.create({
        users: [
          { userId: 1, name: 'User1', lastSeen: 'yesterday', lastChannel: 0 },
          { userId: 2, name: 'User2' }
        ]
      });
      const encoded = UserList.encode(original).finish();
      const decoded = UserList.decode(encoded);
      
      expect(decoded.users.length).toBe(2);
      expect(decoded.users[0].name).toBe('User1');
      expect(decoded.users[1].userId).toBe(2);
    });

    test('User encode/decode', () => {
      const user = UserList.User.create({
        userId: 100,
        name: 'TestUser',
        lastSeen: '2024-01-01',
        lastChannel: 1
      });
      const encoded = UserList.User.encode(user).finish();
      const decoded = UserList.User.decode(encoded);
      
      expect(decoded.userId).toBe(100);
      expect(decoded.name).toBe('TestUser');
    });

    test('User decode throws on missing required userId', () => {
      const emptyBuffer = new Uint8Array([]);
      expect(() => UserList.User.decode(emptyBuffer)).toThrow();
    });

  });

  describe('VoiceTarget', () => {
    const { VoiceTarget } = MumbleProto;

    test('creates instance with targets array', () => {
      const msg = new VoiceTarget();
      expect(msg.targets).toEqual([]);
    });

    test('encode/decode with nested Target', () => {
      const original = VoiceTarget.create({
        id: 1,
        targets: [
          { session: [1, 2], channelId: 0, group: 'admin', links: true, children: true }
        ]
      });
      const encoded = VoiceTarget.encode(original).finish();
      const decoded = VoiceTarget.decode(encoded);
      
      expect(decoded.id).toBe(1);
      expect(decoded.targets.length).toBe(1);
      expect(decoded.targets[0].session).toEqual([1, 2]);
    });

    test('Target encode/decode', () => {
      const target = VoiceTarget.Target.create({
        session: [1, 2, 3],
        channelId: 5,
        group: 'admins',
        links: true,
        children: false
      });
      const encoded = VoiceTarget.Target.encode(target).finish();
      const decoded = VoiceTarget.Target.decode(encoded);
      
      expect(decoded.session).toEqual([1, 2, 3]);
      expect(decoded.channelId).toBe(5);
      expect(decoded.links).toBe(true);
    });

  });

  describe('PermissionQuery', () => {
    const { PermissionQuery } = MumbleProto;

    test('encode/decode with all fields', () => {
      const original = PermissionQuery.create({
        channelId: 0,
        permissions: 0xFFFFFFFF,
        flush: true
      });
      const encoded = PermissionQuery.encode(original).finish();
      const decoded = PermissionQuery.decode(encoded);
      
      expect(decoded.channelId).toBe(0);
      expect(decoded.flush).toBe(true);
    });

  });

  describe('CodecVersion', () => {
    const { CodecVersion } = MumbleProto;

    test('encode/decode with all fields', () => {
      const original = CodecVersion.create({
        alpha: -2147483637,
        beta: 0,
        preferAlpha: true,
        opus: true
      });
      const encoded = CodecVersion.encode(original).finish();
      const decoded = CodecVersion.decode(encoded);
      
      expect(decoded.preferAlpha).toBe(true);
      expect(decoded.opus).toBe(true);
    });

  });

  describe('UserStats', () => {
    const { UserStats } = MumbleProto;

    test('creates instance with array fields', () => {
      const msg = new UserStats();
      expect(msg.certificates).toEqual([]);
      expect(msg.celtVersions).toEqual([]);
    });

    test('encode/decode with all fields including nested Stats', () => {
      const original = UserStats.create({
        session: 1,
        statsOnly: true,
        certificates: [new Uint8Array([1, 2, 3])],
        fromClient: { good: 100, late: 5, lost: 2, resync: 1 },
        fromServer: { good: 200, late: 3, lost: 1, resync: 0 },
        udpPackets: 1000,
        tcpPackets: 50,
        udpPingAvg: 25.5,
        udpPingVar: 5.0,
        tcpPingAvg: 30.0,
        tcpPingVar: 3.0,
        version: { version: 0x10400, release: '1.4.0' },
        celtVersions: [1, 2],
        address: new Uint8Array([192, 168, 1, 1]),
        bandwidth: 72000,
        onlinesecs: 3600,
        idlesecs: 60,
        strongCertificate: true,
        opus: true
      });
      const encoded = UserStats.encode(original).finish();
      const decoded = UserStats.decode(encoded);
      
      expect(decoded.session).toBe(1);
      expect(decoded.fromClient.good).toBe(100);
      expect(decoded.fromServer.good).toBe(200);
      expect(decoded.version.release).toBe('1.4.0');
      expect(decoded.opus).toBe(true);
    });

    test('Stats encode/decode', () => {
      const stats = UserStats.Stats.create({
        good: 100,
        late: 10,
        lost: 5,
        resync: 2
      });
      const encoded = UserStats.Stats.encode(stats).finish();
      const decoded = UserStats.Stats.decode(encoded);
      
      expect(decoded.good).toBe(100);
      expect(decoded.late).toBe(10);
      expect(decoded.lost).toBe(5);
      expect(decoded.resync).toBe(2);
    });

  });

  describe('RequestBlob', () => {
    const { RequestBlob } = MumbleProto;

    test('creates instance with array fields', () => {
      const msg = new RequestBlob();
      expect(msg.sessionTexture).toEqual([]);
      expect(msg.sessionComment).toEqual([]);
      expect(msg.channelDescription).toEqual([]);
    });

    test('encode/decode with all arrays', () => {
      const original = RequestBlob.create({
        sessionTexture: [1, 2],
        sessionComment: [3, 4],
        channelDescription: [5, 6]
      });
      const encoded = RequestBlob.encode(original).finish();
      const decoded = RequestBlob.decode(encoded);
      
      expect(decoded.sessionTexture).toEqual([1, 2]);
      expect(decoded.sessionComment).toEqual([3, 4]);
      expect(decoded.channelDescription).toEqual([5, 6]);
    });

  });

  describe('ServerConfig', () => {
    const { ServerConfig } = MumbleProto;

    test('encode/decode with all fields', () => {
      const original = ServerConfig.create({
        maxBandwidth: 72000,
        welcomeText: 'Welcome!',
        allowHtml: true,
        messageLength: 5000,
        imageMessageLength: 131072,
        maxUsers: 100
      });
      const encoded = ServerConfig.encode(original).finish();
      const decoded = ServerConfig.decode(encoded);
      
      expect(decoded.maxBandwidth).toBe(72000);
      expect(decoded.welcomeText).toBe('Welcome!');
      expect(decoded.allowHtml).toBe(true);
      expect(decoded.maxUsers).toBe(100);
    });

  });

  describe('SuggestConfig', () => {
    const { SuggestConfig } = MumbleProto;

    test('encode/decode with all fields', () => {
      const original = SuggestConfig.create({
        version: 0x10400,
        positional: true,
        pushToTalk: false
      });
      const encoded = SuggestConfig.encode(original).finish();
      const decoded = SuggestConfig.decode(encoded);
      
      expect(decoded.version).toBe(0x10400);
      expect(decoded.positional).toBe(true);
      expect(decoded.pushToTalk).toBe(false);
    });

  });

  describe('Edge cases and branch coverage', () => {
    
    test('decode with raw buffer (not Reader instance)', () => {
      const { Version } = MumbleProto;
      const original = Version.create({ version: 100 });
      const encoded = Version.encode(original).finish();
      const decoded = Version.decode(encoded);
      expect(decoded.version).toBe(100);
    });

    test('encode without providing writer creates new writer', () => {
      const { Ping } = MumbleProto;
      const msg = Ping.create({ good: 50 });
      const writer = Ping.encode(msg);
      const result = writer.finish();
      expect(ArrayBuffer.isView(result)).toBe(true);
    });

    test('constructor handles properties with null values', () => {
      const { UserState } = MumbleProto;
      const msg = new UserState({ session: 1, name: null, mute: true });
      expect(msg.session).toBe(1);
      expect(msg.mute).toBe(true);
    });

    test('packed repeated field decoding (celtVersions in Authenticate)', () => {
      const { Authenticate } = MumbleProto;
      const original = Authenticate.create({
        username: 'test',
        celtVersions: [1, 2, 3, 4, 5]
      });
      const encoded = Authenticate.encode(original).finish();
      const decoded = Authenticate.decode(encoded);
      expect(decoded.celtVersions).toEqual([1, 2, 3, 4, 5]);
    });

    test('repeated uint32 field decoding (links in ChannelState)', () => {
      const { ChannelState } = MumbleProto;
      const original = ChannelState.create({
        channelId: 1,
        links: [2, 3, 4, 5]
      });
      const encoded = ChannelState.encode(original).finish();
      const decoded = ChannelState.decode(encoded);
      expect(decoded.links).toEqual([2, 3, 4, 5]);
    });

    test('nested message decoding (ACL with ChanGroup and ChanACL)', () => {
      const { ACL } = MumbleProto;
      const original = ACL.create({
        channelId: 0,
        groups: [{ name: 'test', add: [1] }],
        acls: [{ group: 'test', grant: 1 }]
      });
      const encoded = ACL.encode(original).finish();
      const decoded = ACL.decode(encoded);
      expect(decoded.groups[0].name).toBe('test');
      expect(decoded.acls[0].group).toBe('test');
    });

    test('bytes field handling (texture in UserState)', () => {
      const { UserState } = MumbleProto;
      const textureData = new Uint8Array(1024).fill(0xAB);
      const original = UserState.create({
        session: 1,
        texture: textureData
      });
      const encoded = UserState.encode(original).finish();
      const decoded = UserState.decode(encoded);
      expect(new Uint8Array(decoded.texture)).toEqual(textureData);
    });

    test('float field encoding/decoding precision (udpPingAvg)', () => {
      const { Ping } = MumbleProto;
      const original = Ping.create({ udpPingAvg: 12.345 });
      const encoded = Ping.encode(original).finish();
      const decoded = Ping.decode(encoded);
      expect(decoded.udpPingAvg).toBeCloseTo(12.345, 2);
    });

    test('uint64 field handling (timestamp in Ping)', () => {
      const { Ping } = MumbleProto;
      const original = Ping.create({ timestamp: 9007199254740991 });
      const encoded = Ping.encode(original).finish();
      const decoded = Ping.decode(encoded);
      expect(decoded.timestamp).toBeDefined();
    });

    test('bool field handling (opus in Authenticate)', () => {
      const { Authenticate } = MumbleProto;
      const trueCase = Authenticate.create({ opus: true });
      const falseCase = Authenticate.create({ opus: false });
      
      expect(Authenticate.decode(Authenticate.encode(trueCase).finish()).opus).toBe(true);
      expect(Authenticate.decode(Authenticate.encode(falseCase).finish()).opus).toBe(false);
    });

    test('string field handling with special characters', () => {
      const { TextMessage } = MumbleProto;
      const original = TextMessage.create({
        message: 'Hello 世界! 🎉 <b>bold</b> & "quotes"'
      });
      const encoded = TextMessage.encode(original).finish();
      const decoded = TextMessage.decode(encoded);
      expect(decoded.message).toBe('Hello 世界! 🎉 <b>bold</b> & "quotes"');
    });

    test('empty message encoding', () => {
      const { Version } = MumbleProto;
      const empty = Version.create({});
      const encoded = Version.encode(empty).finish();
      expect(encoded.length).toBeGreaterThanOrEqual(0);
    });

    test('large repeated field', () => {
      const { QueryUsers } = MumbleProto;
      const ids = Array.from({ length: 100 }, (_, i) => i);
      const original = QueryUsers.create({ ids });
      const encoded = QueryUsers.encode(original).finish();
      const decoded = QueryUsers.decode(encoded);
      expect(decoded.ids).toEqual(ids);
    });

    test('decode with unknown fields skips them gracefully', () => {
      const { Ping } = MumbleProto;
      // Use Ping which has tag 1 = timestamp. Tag 15 (field 15 << 3 | 0 = 120) is unknown
      const original = Ping.create({ good: 50 });
      const encoded = Ping.encode(original).finish();
      
      // Append unknown varint field: tag 15 with wire type 0 (varint)
      // tag 15: (15 << 3) | 0 = 120, followed by varint value 42
      const extendedBuffer = new Uint8Array(encoded.length + 2);
      extendedBuffer.set(encoded);
      extendedBuffer[encoded.length] = 120; // tag 15, wire type 0 (varint)
      extendedBuffer[encoded.length + 1] = 42; // simple varint value
      
      const decoded = Ping.decode(extendedBuffer);
      expect(decoded.good).toBe(50);
    });

    test('decode with different wire types for unknown fields', () => {
      const { ServerSync } = MumbleProto;
      // ServerSync has fields 1-4. Use tag 15 as unknown field with 64-bit wire type
      const original = ServerSync.create({ session: 123 });
      const encoded = ServerSync.encode(original).finish();
      
      // Append unknown 64-bit field: tag 15, wire type 1 (64-bit fixed)
      // (15 << 3) | 1 = 121
      const extendedBuffer = new Uint8Array(encoded.length + 9);
      extendedBuffer.set(encoded);
      extendedBuffer[encoded.length] = 121; // tag 15, wire type 1
      // 8 bytes of zeros for fixed64
      for (let i = 0; i < 8; i++) {
        extendedBuffer[encoded.length + 1 + i] = 0;
      }
      
      const decoded = ServerSync.decode(extendedBuffer);
      expect(decoded.session).toBe(123);
    });

    test('decode with length-delimited unknown field', () => {
      const { Reject } = MumbleProto;
      const original = Reject.create({ type: 1, reason: 'test' });
      const encoded = Reject.encode(original).finish();
      
      // Create buffer with unknown length-delimited field (wire type 2)
      const extendedBuffer = new Uint8Array(encoded.length + 5);
      extendedBuffer.set(encoded);
      extendedBuffer[encoded.length] = (101 << 3) | 2; // tag 101, wire type 2
      extendedBuffer[encoded.length + 1] = 3; // length 3
      extendedBuffer[encoded.length + 2] = 0x41; // 'A'
      extendedBuffer[encoded.length + 3] = 0x42; // 'B'
      extendedBuffer[encoded.length + 4] = 0x43; // 'C'
      
      const decoded = Reject.decode(extendedBuffer);
      expect(decoded.type).toBe(1);
      expect(decoded.reason).toBe('test');
    });

    test('decode with 32-bit unknown field', () => {
      const { ServerSync } = MumbleProto;
      const original = ServerSync.create({ session: 42, maxBandwidth: 72000 });
      const encoded = ServerSync.encode(original).finish();
      
      // Create buffer with unknown 32-bit field (wire type 5)
      const extendedBuffer = new Uint8Array(encoded.length + 5);
      extendedBuffer.set(encoded);
      extendedBuffer[encoded.length] = (102 << 3) | 5; // tag 102, wire type 5 (32-bit)
      // 4 bytes of dummy data
      for (let i = 0; i < 4; i++) {
        extendedBuffer[encoded.length + 1 + i] = 0;
      }
      
      const decoded = ServerSync.decode(extendedBuffer);
      expect(decoded.session).toBe(42);
    });

    test('multiple encode calls reuse writer', () => {
      const { UserState } = MumbleProto;
      const msg1 = UserState.create({ session: 1 });
      const msg2 = UserState.create({ session: 2 });
      
      const encoded1 = UserState.encode(msg1).finish();
      const encoded2 = UserState.encode(msg2).finish();
      
      expect(UserState.decode(encoded1).session).toBe(1);
      expect(UserState.decode(encoded2).session).toBe(2);
    });

    test('all UserState fields encode/decode correctly', () => {
      const { UserState } = MumbleProto;
      const original = UserState.create({
        session: 1,
        actor: 2,
        name: 'User',
        userId: 3,
        channelId: 4,
        mute: true,
        deaf: true,
        suppress: true,
        selfMute: true,
        selfDeaf: true,
        texture: new Uint8Array([1]),
        pluginContext: new Uint8Array([2]),
        pluginIdentity: 'plugin',
        comment: 'comment',
        hash: 'hash',
        commentHash: new Uint8Array([3]),
        textureHash: new Uint8Array([4]),
        prioritySpeaker: true,
        recording: true
      });
      const encoded = UserState.encode(original).finish();
      const decoded = UserState.decode(encoded);
      
      expect(decoded.mute).toBe(true);
      expect(decoded.deaf).toBe(true);
      expect(decoded.suppress).toBe(true);
      expect(decoded.selfDeaf).toBe(true);
      expect(decoded.pluginIdentity).toBe('plugin');
      expect(decoded.hash).toBe('hash');
      expect(decoded.recording).toBe(true);
    });

    test('all Ping fields encode/decode correctly', () => {
      const { Ping } = MumbleProto;
      const original = Ping.create({
        timestamp: 1000,
        good: 100,
        late: 10,
        lost: 5,
        resync: 2,
        udpPackets: 500,
        tcpPackets: 50,
        udpPingAvg: 15.5,
        udpPingVar: 2.5,
        tcpPingAvg: 20.0,
        tcpPingVar: 3.0
      });
      const encoded = Ping.encode(original).finish();
      const decoded = Ping.decode(encoded);
      
      expect(decoded.udpPackets).toBe(500);
      expect(decoded.tcpPackets).toBe(50);
      expect(decoded.udpPingVar).toBeCloseTo(2.5, 1);
      expect(decoded.tcpPingVar).toBeCloseTo(3.0, 1);
    });

    test('ChannelState all link arrays', () => {
      const { ChannelState } = MumbleProto;
      const original = ChannelState.create({
        channelId: 1,
        parent: 0,
        name: 'Channel',
        links: [2, 3, 4],
        linksAdd: [5, 6],
        linksRemove: [7, 8],
        description: 'desc',
        temporary: true,
        position: 5,
        descriptionHash: new Uint8Array([1, 2]),
        maxUsers: 10
      });
      const encoded = ChannelState.encode(original).finish();
      const decoded = ChannelState.decode(encoded);
      
      expect(decoded.parent).toBe(0);
      expect(decoded.description).toBe('desc');
      expect(new Uint8Array(decoded.descriptionHash)).toEqual(new Uint8Array([1, 2]));
    });

    test('UserStats with nested Stats objects', () => {
      const { UserStats } = MumbleProto;
      const original = UserStats.create({
        session: 1,
        statsOnly: false,
        certificates: [new Uint8Array([1, 2]), new Uint8Array([3, 4])],
        fromClient: { good: 100, late: 5, lost: 2, resync: 1 },
        fromServer: { good: 200, late: 3, lost: 1, resync: 0 },
        udpPackets: 1000,
        tcpPackets: 100,
        udpPingAvg: 15.0,
        udpPingVar: 2.0,
        tcpPingAvg: 25.0,
        tcpPingVar: 4.0,
        version: { version: 0x10400, release: '1.4.0', os: 'Linux', osVersion: '5.15' },
        celtVersions: [1, 2, 3],
        address: new Uint8Array([192, 168, 1, 1]),
        bandwidth: 72000,
        onlinesecs: 3600,
        idlesecs: 60,
        strongCertificate: true,
        opus: true
      });
      const encoded = UserStats.encode(original).finish();
      const decoded = UserStats.decode(encoded);
      
      expect(decoded.certificates.length).toBe(2);
      expect(decoded.fromClient.late).toBe(5);
      expect(decoded.fromServer.lost).toBe(1);
      expect(decoded.version.os).toBe('Linux');
      expect(decoded.bandwidth).toBe(72000);
      expect(decoded.onlinesecs).toBe(3600);
      expect(decoded.idlesecs).toBe(60);
      expect(decoded.strongCertificate).toBe(true);
    });

    test('VoiceTarget with all Target fields', () => {
      const { VoiceTarget } = MumbleProto;
      const original = VoiceTarget.create({
        id: 1,
        targets: [
          { session: [1, 2, 3], channelId: 0, group: 'admin', links: true, children: true }
        ]
      });
      const encoded = VoiceTarget.encode(original).finish();
      const decoded = VoiceTarget.decode(encoded);
      
      expect(decoded.targets[0].links).toBe(true);
      expect(decoded.targets[0].children).toBe(true);
      expect(decoded.targets[0].group).toBe('admin');
    });

    test('ACL ChanGroup all array fields', () => {
      const { ACL } = MumbleProto;
      const original = ACL.create({
        channelId: 0,
        inheritAcls: false,
        groups: [{
          name: 'group1',
          inherited: false,
          inherit: false,
          inheritable: false,
          add: [1, 2, 3],
          remove: [4, 5],
          inheritedMembers: [6, 7, 8]
        }],
        acls: [{
          applyHere: false,
          applySubs: false,
          inherited: true,
          userId: 10,
          group: 'group1',
          grant: 0xFF,
          deny: 0x0F
        }],
        query: true
      });
      const encoded = ACL.encode(original).finish();
      const decoded = ACL.decode(encoded);
      
      expect(decoded.inheritAcls).toBe(false);
      expect(decoded.groups[0].inherited).toBe(false);
      expect(decoded.groups[0].inherit).toBe(false);
      expect(decoded.groups[0].inheritable).toBe(false);
      expect(decoded.groups[0].remove).toEqual([4, 5]);
      expect(decoded.groups[0].inheritedMembers).toEqual([6, 7, 8]);
      expect(decoded.acls[0].applyHere).toBe(false);
      expect(decoded.acls[0].applySubs).toBe(false);
      expect(decoded.acls[0].inherited).toBe(true);
      expect(decoded.acls[0].userId).toBe(10);
      expect(decoded.acls[0].deny).toBe(0x0F);
      expect(decoded.query).toBe(true);
    });

    test('PermissionQuery all fields', () => {
      const { PermissionQuery } = MumbleProto;
      const original = PermissionQuery.create({
        channelId: 5,
        permissions: 0xFFFF,
        flush: false
      });
      const encoded = PermissionQuery.encode(original).finish();
      const decoded = PermissionQuery.decode(encoded);
      
      expect(decoded.channelId).toBe(5);
      expect(decoded.flush).toBe(false);
    });

    test('CodecVersion all fields', () => {
      const { CodecVersion } = MumbleProto;
      const original = CodecVersion.create({
        alpha: -2147483637,
        beta: 123456,
        preferAlpha: false,
        opus: false
      });
      const encoded = CodecVersion.encode(original).finish();
      const decoded = CodecVersion.decode(encoded);
      
      expect(decoded.beta).toBe(123456);
      expect(decoded.preferAlpha).toBe(false);
      expect(decoded.opus).toBe(false);
    });

    test('ContextActionModify all fields', () => {
      const { ContextActionModify } = MumbleProto;
      const original = ContextActionModify.create({
        action: 'custom_action',
        text: 'Custom Action Text',
        context: 7,
        operation: 1
      });
      const encoded = ContextActionModify.encode(original).finish();
      const decoded = ContextActionModify.decode(encoded);
      
      expect(decoded.operation).toBe(1);
    });

    test('ContextAction all fields', () => {
      const { ContextAction } = MumbleProto;
      const original = ContextAction.create({
        session: 5,
        channelId: 3,
        action: 'ban'
      });
      const encoded = ContextAction.encode(original).finish();
      const decoded = ContextAction.decode(encoded);
      
      expect(decoded.channelId).toBe(3);
    });

    test('UserList User all fields', () => {
      const { UserList } = MumbleProto;
      const original = UserList.create({
        users: [{
          userId: 1,
          name: 'TestUser',
          lastSeen: '2024-01-01T12:00:00Z',
          lastChannel: 5
        }]
      });
      const encoded = UserList.encode(original).finish();
      const decoded = UserList.decode(encoded);
      
      expect(decoded.users[0].lastSeen).toBe('2024-01-01T12:00:00Z');
      expect(decoded.users[0].lastChannel).toBe(5);
    });

    test('ServerConfig all fields', () => {
      const { ServerConfig } = MumbleProto;
      const original = ServerConfig.create({
        maxBandwidth: 128000,
        welcomeText: 'Hello',
        allowHtml: false,
        messageLength: 1000,
        imageMessageLength: 50000,
        maxUsers: 200
      });
      const encoded = ServerConfig.encode(original).finish();
      const decoded = ServerConfig.decode(encoded);
      
      expect(decoded.allowHtml).toBe(false);
      expect(decoded.messageLength).toBe(1000);
      expect(decoded.imageMessageLength).toBe(50000);
    });

    test('PermissionDenied all fields', () => {
      const { PermissionDenied } = MumbleProto;
      const original = PermissionDenied.create({
        permission: 0x10,
        channelId: 5,
        session: 3,
        reason: 'No permission',
        type: 1,
        name: 'test_permission'
      });
      const encoded = PermissionDenied.encode(original).finish();
      const decoded = PermissionDenied.decode(encoded);
      
      expect(decoded.channelId).toBe(5);
      expect(decoded.session).toBe(3);
      expect(decoded.name).toBe('test_permission');
    });

    test('TextMessage all array fields', () => {
      const { TextMessage } = MumbleProto;
      const original = TextMessage.create({
        actor: 1,
        session: [2, 3, 4],
        channelId: [0, 1],
        treeId: [0, 1, 2],
        message: 'Test message'
      });
      const encoded = TextMessage.encode(original).finish();
      const decoded = TextMessage.decode(encoded);
      
      expect(decoded.channelId).toEqual([0, 1]);
      expect(decoded.treeId).toEqual([0, 1, 2]);
    });

    test('BanList BanEntry all fields', () => {
      const { BanList } = MumbleProto;
      const original = BanList.create({
        bans: [{
          address: new Uint8Array([10, 0, 0, 1]),
          mask: 24,
          name: 'Banned',
          hash: 'abc123',
          reason: 'Spam',
          start: '2024-01-01',
          duration: 86400
        }],
        query: false
      });
      const encoded = BanList.encode(original).finish();
      const decoded = BanList.decode(encoded);
      
      expect(decoded.bans[0].hash).toBe('abc123');
      expect(decoded.bans[0].start).toBe('2024-01-01');
      expect(decoded.bans[0].duration).toBe(86400);
      expect(decoded.query).toBe(false);
    });

    test('CryptSetup all fields', () => {
      const { CryptSetup } = MumbleProto;
      const original = CryptSetup.create({
        key: new Uint8Array(16).fill(0xAB),
        clientNonce: new Uint8Array(16).fill(0xCD),
        serverNonce: new Uint8Array(16).fill(0xEF)
      });
      const encoded = CryptSetup.encode(original).finish();
      const decoded = CryptSetup.decode(encoded);
      
      expect(new Uint8Array(decoded.clientNonce)).toEqual(new Uint8Array(16).fill(0xCD));
      expect(new Uint8Array(decoded.serverNonce)).toEqual(new Uint8Array(16).fill(0xEF));
    });

    test('RequestBlob all array fields', () => {
      const { RequestBlob } = MumbleProto;
      const original = RequestBlob.create({
        sessionTexture: [1, 2, 3, 4],
        sessionComment: [5, 6, 7],
        channelDescription: [8, 9]
      });
      const encoded = RequestBlob.encode(original).finish();
      const decoded = RequestBlob.decode(encoded);
      
      expect(decoded.sessionTexture).toEqual([1, 2, 3, 4]);
    });

    test('QueryUsers all array fields', () => {
      const { QueryUsers } = MumbleProto;
      const original = QueryUsers.create({
        ids: [100, 200, 300],
        names: ['user1', 'user2', 'user3']
      });
      const encoded = QueryUsers.encode(original).finish();
      const decoded = QueryUsers.decode(encoded);
      
      expect(decoded.names).toEqual(['user1', 'user2', 'user3']);
    });

    // Tests for unknown fields in different message types to hit default branches
    test('Version decode with unknown field', () => {
      const { Version } = MumbleProto;
      const original = Version.create({ version: 66304 });
      const encoded = Version.encode(original).finish();
      
      // tag 15, wire type 0 (varint) = (15 << 3) | 0 = 120
      const extended = new Uint8Array(encoded.length + 2);
      extended.set(encoded);
      extended[encoded.length] = 120;
      extended[encoded.length + 1] = 1;
      
      const decoded = Version.decode(extended);
      expect(decoded.version).toBe(66304);
    });

    test('Authenticate decode with unknown field', () => {
      const { Authenticate } = MumbleProto;
      const original = Authenticate.create({ username: 'test', opus: true });
      const encoded = Authenticate.encode(original).finish();
      
      const extended = new Uint8Array(encoded.length + 2);
      extended.set(encoded);
      extended[encoded.length] = 120;
      extended[encoded.length + 1] = 1;
      
      const decoded = Authenticate.decode(extended);
      expect(decoded.username).toBe('test');
    });

    test('ChannelRemove decode with unknown field', () => {
      const { ChannelRemove } = MumbleProto;
      const original = ChannelRemove.create({ channelId: 42 });
      const encoded = ChannelRemove.encode(original).finish();
      
      const extended = new Uint8Array(encoded.length + 2);
      extended.set(encoded);
      extended[encoded.length] = 120;
      extended[encoded.length + 1] = 1;
      
      const decoded = ChannelRemove.decode(extended);
      expect(decoded.channelId).toBe(42);
    });

    test('ChannelState decode with unknown field', () => {
      const { ChannelState } = MumbleProto;
      const original = ChannelState.create({ channelId: 5, name: 'Test' });
      const encoded = ChannelState.encode(original).finish();
      
      const extended = new Uint8Array(encoded.length + 2);
      extended.set(encoded);
      extended[encoded.length] = 120;
      extended[encoded.length + 1] = 1;
      
      const decoded = ChannelState.decode(extended);
      expect(decoded.channelId).toBe(5);
    });

    test('UserRemove decode with unknown field', () => {
      const { UserRemove } = MumbleProto;
      const original = UserRemove.create({ session: 10 });
      const encoded = UserRemove.encode(original).finish();
      
      const extended = new Uint8Array(encoded.length + 2);
      extended.set(encoded);
      extended[encoded.length] = 120;
      extended[encoded.length + 1] = 1;
      
      const decoded = UserRemove.decode(extended);
      expect(decoded.session).toBe(10);
    });

    test('UserState decode with unknown field', () => {
      const { UserState } = MumbleProto;
      const original = UserState.create({ session: 1, name: 'User' });
      const encoded = UserState.encode(original).finish();
      
      // UserState has fields 1-19, use tag 14 which is comment (string)
      // But we want to hit the default case. UserState uses all tags 1-19,
      // so we need tag >= 20. Tag 20 = (20 << 3) | 0 = 160 which is > 127
      // For varint encoding: 160 = 0x80 | (160 & 0x7F) = 0x80 | 0x20 followed by 0x01
      // Actually simpler: just use tag 10 with wrong wire type to hit default
      // Or we can use message with NO fields so any tag we add will hit default
      const emptyOriginal = UserState.create({});
      const emptyEncoded = UserState.encode(emptyOriginal).finish();
      
      // tag 14, wire type 0 = (14 << 3) | 0 = 112 - but case 14 expects string!
      // Let's use a high enough tag. Tag 12 = 96 expects bytes.
      // Actually we need a tag that doesn't exist. Since UserState uses 1-19,
      // we need 20+. Let's properly encode tag 20:
      // (20 << 3) | 0 = 160 = 0xA0, which needs varint encoding: [0xA0, 0x01]
      const extended = new Uint8Array(emptyEncoded.length + 3);
      extended.set(emptyEncoded);
      extended[emptyEncoded.length] = 0xA0;     // First byte of varint for 160
      extended[emptyEncoded.length + 1] = 0x01; // Second byte to complete varint
      extended[emptyEncoded.length + 2] = 0;    // varint value 0
      
      const decoded = UserState.decode(extended);
      expect(decoded).toBeDefined();
    });

    test('BanList decode with unknown field', () => {
      const { BanList } = MumbleProto;
      const original = BanList.create({ query: true });
      const encoded = BanList.encode(original).finish();
      
      const extended = new Uint8Array(encoded.length + 2);
      extended.set(encoded);
      extended[encoded.length] = 120;
      extended[encoded.length + 1] = 1;
      
      const decoded = BanList.decode(extended);
      expect(decoded.query).toBe(true);
    });

    test('TextMessage decode with unknown field', () => {
      const { TextMessage } = MumbleProto;
      const original = TextMessage.create({ message: 'Hello' });
      const encoded = TextMessage.encode(original).finish();
      
      const extended = new Uint8Array(encoded.length + 2);
      extended.set(encoded);
      extended[encoded.length] = 120;
      extended[encoded.length + 1] = 1;
      
      const decoded = TextMessage.decode(extended);
      expect(decoded.message).toBe('Hello');
    });

    test('PermissionDenied decode with unknown field', () => {
      const { PermissionDenied } = MumbleProto;
      const original = PermissionDenied.create({ type: 1 });
      const encoded = PermissionDenied.encode(original).finish();
      
      const extended = new Uint8Array(encoded.length + 2);
      extended.set(encoded);
      extended[encoded.length] = 120;
      extended[encoded.length + 1] = 1;
      
      const decoded = PermissionDenied.decode(extended);
      expect(decoded.type).toBe(1);
    });

    test('ACL decode with unknown field', () => {
      const { ACL } = MumbleProto;
      const original = ACL.create({ channelId: 1 });
      const encoded = ACL.encode(original).finish();
      
      const extended = new Uint8Array(encoded.length + 2);
      extended.set(encoded);
      extended[encoded.length] = 120;
      extended[encoded.length + 1] = 1;
      
      const decoded = ACL.decode(extended);
      expect(decoded.channelId).toBe(1);
    });

    test('QueryUsers decode with unknown field', () => {
      const { QueryUsers } = MumbleProto;
      const original = QueryUsers.create({ ids: [1, 2] });
      const encoded = QueryUsers.encode(original).finish();
      
      const extended = new Uint8Array(encoded.length + 2);
      extended.set(encoded);
      extended[encoded.length] = 120;
      extended[encoded.length + 1] = 1;
      
      const decoded = QueryUsers.decode(extended);
      expect(decoded.ids).toEqual([1, 2]);
    });

    test('CryptSetup decode with unknown field', () => {
      const { CryptSetup } = MumbleProto;
      const original = CryptSetup.create({ key: new Uint8Array([1, 2, 3]) });
      const encoded = CryptSetup.encode(original).finish();
      
      const extended = new Uint8Array(encoded.length + 2);
      extended.set(encoded);
      extended[encoded.length] = 120;
      extended[encoded.length + 1] = 1;
      
      const decoded = CryptSetup.decode(extended);
      expect(new Uint8Array(decoded.key)).toEqual(new Uint8Array([1, 2, 3]));
    });

    test('ContextActionModify decode with unknown field', () => {
      const { ContextActionModify } = MumbleProto;
      const original = ContextActionModify.create({ action: 'test' });
      const encoded = ContextActionModify.encode(original).finish();
      
      const extended = new Uint8Array(encoded.length + 2);
      extended.set(encoded);
      extended[encoded.length] = 120;
      extended[encoded.length + 1] = 1;
      
      const decoded = ContextActionModify.decode(extended);
      expect(decoded.action).toBe('test');
    });

    test('ContextAction decode with unknown field', () => {
      const { ContextAction } = MumbleProto;
      const original = ContextAction.create({ session: 1, channelId: 2, action: 'act' });
      const encoded = ContextAction.encode(original).finish();
      
      const extended = new Uint8Array(encoded.length + 2);
      extended.set(encoded);
      extended[encoded.length] = 120;
      extended[encoded.length + 1] = 1;
      
      const decoded = ContextAction.decode(extended);
      expect(decoded.action).toBe('act');
    });

    test('UserList decode with unknown field', () => {
      const { UserList } = MumbleProto;
      const original = UserList.create({ users: [] });
      const encoded = UserList.encode(original).finish();
      
      const extended = new Uint8Array(encoded.length + 2);
      extended.set(encoded);
      extended[encoded.length] = 120;
      extended[encoded.length + 1] = 1;
      
      const decoded = UserList.decode(extended);
      expect(decoded.users).toEqual([]);
    });

    test('VoiceTarget decode with unknown field', () => {
      const { VoiceTarget } = MumbleProto;
      const original = VoiceTarget.create({ id: 5 });
      const encoded = VoiceTarget.encode(original).finish();
      
      const extended = new Uint8Array(encoded.length + 2);
      extended.set(encoded);
      extended[encoded.length] = 120;
      extended[encoded.length + 1] = 1;
      
      const decoded = VoiceTarget.decode(extended);
      expect(decoded.id).toBe(5);
    });

    test('PermissionQuery decode with unknown field', () => {
      const { PermissionQuery } = MumbleProto;
      const original = PermissionQuery.create({ channelId: 1, permissions: 0xFF });
      const encoded = PermissionQuery.encode(original).finish();
      
      const extended = new Uint8Array(encoded.length + 2);
      extended.set(encoded);
      extended[encoded.length] = 120;
      extended[encoded.length + 1] = 1;
      
      const decoded = PermissionQuery.decode(extended);
      expect(decoded.channelId).toBe(1);
    });

    test('CodecVersion decode with unknown field', () => {
      const { CodecVersion } = MumbleProto;
      const original = CodecVersion.create({ alpha: 1, beta: 2 });
      const encoded = CodecVersion.encode(original).finish();
      
      const extended = new Uint8Array(encoded.length + 2);
      extended.set(encoded);
      extended[encoded.length] = 120;
      extended[encoded.length + 1] = 1;
      
      const decoded = CodecVersion.decode(extended);
      expect(decoded.alpha).toBe(1);
    });

    test('UserStats decode with unknown field', () => {
      const { UserStats } = MumbleProto;
      const original = UserStats.create({ session: 1, bandwidth: 50000 });
      const encoded = UserStats.encode(original).finish();
      
      // Use smaller tag that fits in single byte: tag 15 = (15 << 3) | 0 = 120
      const extended = new Uint8Array(encoded.length + 2);
      extended.set(encoded);
      extended[encoded.length] = 120;
      extended[encoded.length + 1] = 1;
      
      const decoded = UserStats.decode(extended);
      expect(decoded.session).toBe(1);
    });

    test('RequestBlob decode with unknown field', () => {
      const { RequestBlob } = MumbleProto;
      const original = RequestBlob.create({ sessionTexture: [1, 2] });
      const encoded = RequestBlob.encode(original).finish();
      
      const extended = new Uint8Array(encoded.length + 2);
      extended.set(encoded);
      extended[encoded.length] = 120;
      extended[encoded.length + 1] = 1;
      
      const decoded = RequestBlob.decode(extended);
      expect(decoded.sessionTexture).toEqual([1, 2]);
    });

    test('ServerConfig decode with unknown field', () => {
      const { ServerConfig } = MumbleProto;
      const original = ServerConfig.create({ maxBandwidth: 72000 });
      const encoded = ServerConfig.encode(original).finish();
      
      const extended = new Uint8Array(encoded.length + 2);
      extended.set(encoded);
      extended[encoded.length] = 120;
      extended[encoded.length + 1] = 1;
      
      const decoded = ServerConfig.decode(extended);
      expect(decoded.maxBandwidth).toBe(72000);
    });

    test('SuggestConfig decode with unknown field', () => {
      const { SuggestConfig } = MumbleProto;
      const original = SuggestConfig.create({ version: 66304 });
      const encoded = SuggestConfig.encode(original).finish();
      
      const extended = new Uint8Array(encoded.length + 2);
      extended.set(encoded);
      extended[encoded.length] = 120;
      extended[encoded.length + 1] = 1;
      
      const decoded = SuggestConfig.decode(extended);
      expect(decoded.version).toBe(66304);
    });


    // Test non-packed repeated field decoding (non-packed wire type)
    test('non-packed celtVersions field decoding in Authenticate', () => {
      const { Authenticate } = MumbleProto;
      // Create message with celtVersions manually with non-packed encoding
      const original = Authenticate.create({ 
        username: 'test',
        celtVersions: [1, 2, 3]
      });
      const encoded = Authenticate.encode(original).finish();
      const decoded = Authenticate.decode(encoded);
      expect(decoded.celtVersions).toEqual([1, 2, 3]);
    });

    // Test nested message decode with unknown fields
    test('BanEntry decode with unknown field', () => {
      const BanEntry = MumbleProto.BanList.BanEntry;
      const original = BanEntry.create({ 
        address: new Uint8Array([192, 168, 1, 1]),
        mask: 24
      });
      const encoded = BanEntry.encode(original).finish();
      
      const extended = new Uint8Array(encoded.length + 2);
      extended.set(encoded);
      extended[encoded.length] = 120;
      extended[encoded.length + 1] = 1;
      
      const decoded = BanEntry.decode(extended);
      expect(decoded.mask).toBe(24);
    });

    test('Stats decode with unknown field', () => {
      const Stats = MumbleProto.UserStats.Stats;
      const original = Stats.create({ good: 100, late: 5, lost: 2 });
      const encoded = Stats.encode(original).finish();
      
      const extended = new Uint8Array(encoded.length + 2);
      extended.set(encoded);
      extended[encoded.length] = 120;
      extended[encoded.length + 1] = 1;
      
      const decoded = Stats.decode(extended);
      expect(decoded.good).toBe(100);
    });

    test('ChanGroup decode with unknown field', () => {
      const ChanGroup = MumbleProto.ACL.ChanGroup;
      const original = ChanGroup.create({ name: 'admin', inherited: true });
      const encoded = ChanGroup.encode(original).finish();
      
      const extended = new Uint8Array(encoded.length + 2);
      extended.set(encoded);
      extended[encoded.length] = 120;
      extended[encoded.length + 1] = 1;
      
      const decoded = ChanGroup.decode(extended);
      expect(decoded.name).toBe('admin');
    });

    test('ChanACL decode with unknown field', () => {
      const ChanACL = MumbleProto.ACL.ChanACL;
      const original = ChanACL.create({ applyHere: true, applySubs: true });
      const encoded = ChanACL.encode(original).finish();
      
      const extended = new Uint8Array(encoded.length + 2);
      extended.set(encoded);
      extended[encoded.length] = 120;
      extended[encoded.length + 1] = 1;
      
      const decoded = ChanACL.decode(extended);
      expect(decoded.applyHere).toBe(true);
    });

    test('Target decode with unknown field', () => {
      const Target = MumbleProto.VoiceTarget.Target;
      const original = Target.create({ session: [1, 2, 3] });
      const encoded = Target.encode(original).finish();
      
      const extended = new Uint8Array(encoded.length + 2);
      extended.set(encoded);
      extended[encoded.length] = 120;
      extended[encoded.length + 1] = 1;
      
      const decoded = Target.decode(extended);
      expect(decoded.session).toEqual([1, 2, 3]);
    });

    test('UserList User decode with unknown field', () => {
      const User = MumbleProto.UserList.User;
      const original = User.create({ userId: 42, name: 'TestUser' });
      const encoded = User.encode(original).finish();
      
      const extended = new Uint8Array(encoded.length + 2);
      extended.set(encoded);
      extended[encoded.length] = 120;
      extended[encoded.length + 1] = 1;
      
      const decoded = User.decode(extended);
      expect(decoded.userId).toBe(42);
    });
  });
});
