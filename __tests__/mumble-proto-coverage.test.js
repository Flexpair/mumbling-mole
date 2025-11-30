import { MumbleProto } from '../app/mumble-streams/mumble-proto-minimal.js';
import $protobuf from "protobufjs/minimal.js";

describe('MumbleProto Coverage', () => {
  
  // Helper to verify round-trip encoding/decoding
  const verifyRoundTrip = (MessageType, payload) => {
    const message = MessageType.create(payload);
    const buffer = MessageType.encode(message).finish();
    const decoded = MessageType.decode(buffer);
    
    // Verify all payload fields are present in decoded message
    for (const key of Object.keys(payload)) {
      expect(decoded[key]).toBeDefined();
    }
    
    return { message, buffer, decoded };
  };

  // Helper to verify required fields throw error on decode
  const verifyDecodeThrowsOnMissingField = (MessageType, buffer = Buffer.alloc(0)) => {
    expect(() => {
      MessageType.decode(buffer);
    }).toThrow();
  };

  // Helper to verify unknown fields are skipped (covers default switch case)
  const verifyUnknownField = (MessageType, validPayload) => {
    const message = MessageType.create(validPayload);
    const buffer = MessageType.encode(message).finish();
    
    // Append an unknown field (tag 999, varint 0)
    // Tag 999 = (999 << 3) | 0 = 7992
    // Varint: 0xB8 0x3E
    // Value 0: 0x00
    const unknownField = Buffer.from([0xB8, 0x3E, 0x00]);
    const bufferWithUnknown = Buffer.concat([buffer, unknownField]);
    
    const decoded = MessageType.decode(bufferWithUnknown);
    expect(decoded).toBeDefined();
  };

  test('Version coverage', () => {
    const payload = {
      version: 123,
      release: "1.2.3",
      os: "Linux",
      osVersion: "Ubuntu"
    };
    verifyRoundTrip(MumbleProto.Version, payload);
    verifyUnknownField(MumbleProto.Version, payload);
  });

  test('UDPTunnel coverage', () => {
    const payload = {
      packet: Buffer.from([1, 2, 3, 4])
    };
    verifyRoundTrip(MumbleProto.UDPTunnel, payload);
    verifyUnknownField(MumbleProto.UDPTunnel, payload);
    verifyDecodeThrowsOnMissingField(MumbleProto.UDPTunnel);
  });

  test('Authenticate coverage', () => {
    const payload = {
      username: "User",
      password: "Password",
      tokens: ["token1", "token2"],
      celtVersions: [1, 2],
      opus: true
    };
    verifyRoundTrip(MumbleProto.Authenticate, payload);
    verifyUnknownField(MumbleProto.Authenticate, payload);
  });

  test('Ping coverage', () => {
    const payload = {
      timestamp: 12345,
      good: 1,
      late: 2,
      lost: 3,
      resync: 4,
      udpPackets: 100,
      tcpPackets: 200,
      udpPingAvg: 10.5,
      udpPingVar: 2.5,
      tcpPingAvg: 15.5,
      tcpPingVar: 3.5
    };
    verifyRoundTrip(MumbleProto.Ping, payload);
    verifyUnknownField(MumbleProto.Ping, payload);
  });

  test('Reject coverage', () => {
    const payload = {
      type: 1,
      reason: "Reason"
    };
    verifyRoundTrip(MumbleProto.Reject, payload);
    verifyUnknownField(MumbleProto.Reject, payload);
  });

  test('ServerSync coverage', () => {
    const payload = {
      session: 1,
      maxBandwidth: 1000,
      welcomeText: "Welcome",
      permissions: 12345
    };
    verifyRoundTrip(MumbleProto.ServerSync, payload);
    verifyUnknownField(MumbleProto.ServerSync, payload);
  });

  test('ChannelRemove coverage', () => {
    const payload = {
      channelId: 1
    };
    verifyRoundTrip(MumbleProto.ChannelRemove, payload);
    verifyUnknownField(MumbleProto.ChannelRemove, payload);
    verifyDecodeThrowsOnMissingField(MumbleProto.ChannelRemove);
  });

  test('ChannelState coverage', () => {
    const payload = {
      channelId: 1,
      parent: 0,
      name: "Channel",
      links: [2, 3],
      description: "Desc",
      linksAdd: [4],
      linksRemove: [5],
      temporary: true,
      position: 10,
      descriptionHash: Buffer.from([1, 2]),
      maxUsers: 100
    };
    verifyRoundTrip(MumbleProto.ChannelState, payload);
    verifyUnknownField(MumbleProto.ChannelState, payload);
  });

  test('UserRemove coverage', () => {
    const payload = {
      session: 1,
      actor: 2,
      reason: "Reason",
      ban: true
    };
    verifyRoundTrip(MumbleProto.UserRemove, payload);
    verifyUnknownField(MumbleProto.UserRemove, payload);
    verifyDecodeThrowsOnMissingField(MumbleProto.UserRemove);
  });

  test('UserState coverage', () => {
    const payload = {
      session: 1,
      actor: 2,
      name: "User",
      userId: 3,
      channelId: 4,
      mute: true,
      deaf: true,
      suppress: true,
      selfMute: true,
      selfDeaf: true,
      texture: Buffer.from([1]),
      pluginContext: Buffer.from([2]),
      pluginIdentity: "Plugin",
      comment: "Comment",
      hash: "Hash",
      commentHash: Buffer.from([3]),
      textureHash: Buffer.from([4]),
      prioritySpeaker: true,
      recording: true
    };
    verifyRoundTrip(MumbleProto.UserState, payload);
    verifyUnknownField(MumbleProto.UserState, payload);
  });

  test('BanList coverage', () => {
    const payload = {
      bans: [{
        address: Buffer.from([127, 0, 0, 1]),
        mask: 32,
        name: "Banned",
        hash: "Hash",
        reason: "Reason",
        start: "Now",
        duration: 100
      }],
      query: true
    };
    verifyRoundTrip(MumbleProto.BanList, payload);
    verifyUnknownField(MumbleProto.BanList, payload);
    
    // Test required fields in BanEntry (nested)
    // BanList: bans (tag 1, wire 2)
    const writer = $protobuf.Writer.create();
    writer.uint32((1 << 3) | 2);
    // Fork for length-delimited BanEntry
    const fork = writer.fork();
    // BanEntry: mask (tag 2, wire 0) = 32
    fork.uint32((2 << 3) | 0).uint32(32);
    // NO address (tag 1)
    writer.ldelim();
    const buffer = writer.finish();
    
    verifyDecodeThrowsOnMissingField(MumbleProto.BanList, buffer);
  });

  test('TextMessage coverage', () => {
    const payload = {
      actor: 1,
      session: [2, 3],
      channelId: [4, 5],
      treeId: [6, 7],
      message: "Message"
    };
    verifyRoundTrip(MumbleProto.TextMessage, payload);
    verifyUnknownField(MumbleProto.TextMessage, payload);
    verifyDecodeThrowsOnMissingField(MumbleProto.TextMessage);
  });

  test('PermissionDenied coverage', () => {
    const payload = {
      permission: 1,
      channelId: 2,
      session: 3,
      reason: "Reason",
      type: 1,
      name: "Name"
    };
    verifyRoundTrip(MumbleProto.PermissionDenied, payload);
    verifyUnknownField(MumbleProto.PermissionDenied, payload);
  });

  test('ACL coverage', () => {
    const payload = {
      channelId: 1,
      inheritAcls: true,
      groups: [{
        name: "Group",
        inherited: true,
        inherit: true,
        inheritable: true,
        add: [1, 2],
        remove: [3, 4],
        inheritedMembers: [5, 6]
      }],
      acls: [{
        applyHere: true,
        applySubs: true,
        inherited: true,
        userId: 1,
        group: "Group",
        grant: 10,
        deny: 5
      }],
      query: true
    };
    verifyRoundTrip(MumbleProto.ACL, payload);
    verifyUnknownField(MumbleProto.ACL, payload);
    verifyDecodeThrowsOnMissingField(MumbleProto.ACL);
    
    // Test required fields in ChanGroup (name)
    // ACL: groups (tag 3, wire 2)
    const writer = $protobuf.Writer.create();
    writer.uint32((1 << 3) | 0).uint32(1); // channelId (required)
    writer.uint32((3 << 3) | 2); // groups
    const fork = writer.fork();
    // ChanGroup: inherited (tag 2, wire 0) = 1
    fork.uint32((2 << 3) | 0).uint32(1);
    // NO name (tag 1)
    writer.ldelim();
    const buffer = writer.finish();
    
    verifyDecodeThrowsOnMissingField(MumbleProto.ACL, buffer);
  });

  test('QueryUsers coverage', () => {
    const payload = {
      ids: [1, 2],
      names: ["User1", "User2"]
    };
    verifyRoundTrip(MumbleProto.QueryUsers, payload);
    verifyUnknownField(MumbleProto.QueryUsers, payload);
  });

  test('CryptSetup coverage', () => {
    const payload = {
      key: Buffer.from([1]),
      clientNonce: Buffer.from([2]),
      serverNonce: Buffer.from([3])
    };
    verifyRoundTrip(MumbleProto.CryptSetup, payload);
    verifyUnknownField(MumbleProto.CryptSetup, payload);
  });

  test('ContextActionModify coverage', () => {
    const payload = {
      action: "Action",
      text: "Text",
      context: 1,
      operation: 2
    };
    verifyRoundTrip(MumbleProto.ContextActionModify, payload);
    verifyUnknownField(MumbleProto.ContextActionModify, payload);
    verifyDecodeThrowsOnMissingField(MumbleProto.ContextActionModify);
  });

  test('ContextAction coverage', () => {
    const payload = {
      session: 1,
      channelId: 2,
      action: "Action"
    };
    verifyRoundTrip(MumbleProto.ContextAction, payload);
    verifyUnknownField(MumbleProto.ContextAction, payload);
    verifyDecodeThrowsOnMissingField(MumbleProto.ContextAction);
  });

  test('UserList coverage', () => {
    const payload = {
      users: [{
        userId: 1,
        name: "User",
        lastSeen: "Time",
        lastChannel: 2
      }]
    };
    verifyRoundTrip(MumbleProto.UserList, payload);
    verifyUnknownField(MumbleProto.UserList, payload);
    
    // Test required fields in User (userId)
    // UserList: users (tag 1, wire 2)
    const writer = $protobuf.Writer.create();
    writer.uint32((1 << 3) | 2); // users
    const fork = writer.fork();
    // User: name (tag 2, wire 2) = "User"
    fork.uint32((2 << 3) | 2).string("User");
    // NO userId (tag 1)
    writer.ldelim();
    const buffer = writer.finish();
    
    verifyDecodeThrowsOnMissingField(MumbleProto.UserList, buffer);
  });

  test('VoiceTarget coverage', () => {
    const payload = {
      id: 1,
      targets: [{
        session: [1, 2],
        channelId: 3,
        group: "Group",
        links: true,
        children: true
      }]
    };
    verifyRoundTrip(MumbleProto.VoiceTarget, payload);
    verifyUnknownField(MumbleProto.VoiceTarget, payload);
  });

  test('PermissionQuery coverage', () => {
    const payload = {
      channelId: 1,
      permissions: 2,
      flush: true
    };
    verifyRoundTrip(MumbleProto.PermissionQuery, payload);
    verifyUnknownField(MumbleProto.PermissionQuery, payload);
  });

  test('CodecVersion coverage', () => {
    const payload = {
      alpha: 1,
      beta: 2,
      preferAlpha: true,
      opus: true
    };
    verifyRoundTrip(MumbleProto.CodecVersion, payload);
    verifyUnknownField(MumbleProto.CodecVersion, payload);
    verifyDecodeThrowsOnMissingField(MumbleProto.CodecVersion);
  });

  test('UserStats coverage', () => {
    const payload = {
      session: 1,
      statsOnly: true,
      certificates: [Buffer.from([1])],
      fromClient: {
        good: 1, late: 2, lost: 3, resync: 4
      },
      fromServer: {
        good: 5, late: 6, lost: 7, resync: 8
      },
      udpPackets: 10,
      tcpPackets: 20,
      udpPingAvg: 1.5,
      udpPingVar: 0.5,
      tcpPingAvg: 2.5,
      tcpPingVar: 0.5,
      version: {
        version: 1, release: "Rel", os: "OS", osVersion: "Ver"
      },
      celtVersions: [1, 2],
      address: Buffer.from([127, 0, 0, 1]),
      bandwidth: 1000,
      onlinesecs: 100,
      idlesecs: 10,
      strongCertificate: true,
      opus: true
    };
    verifyRoundTrip(MumbleProto.UserStats, payload);
    verifyUnknownField(MumbleProto.UserStats, payload);
  });

  test('RequestBlob coverage', () => {
    const payload = {
      sessionTexture: [1, 2],
      sessionComment: [3, 4],
      channelDescription: [5, 6]
    };
    verifyRoundTrip(MumbleProto.RequestBlob, payload);
    verifyUnknownField(MumbleProto.RequestBlob, payload);

    // Test packed decoding for repeated fields (sessionTexture, sessionComment, channelDescription)
    // These are repeated uint32s. Standard encode uses non-packed (tag repeated).
    // We need to manually construct packed (tag | 2, length, data) to cover that decode branch.
    
    const verifyPacked = (fieldId, values) => {
      const writer = $protobuf.Writer.create();
      // Write tag with wire type 2 (LEN)
      writer.uint32((fieldId << 3) | 2);
      
      // Create a separate writer for the packed data
      const packedWriter = $protobuf.Writer.create();
      values.forEach(v => packedWriter.uint32(v));
      const packedData = packedWriter.finish();
      
      // Write length and data
      writer.bytes(packedData);
      
      const buffer = writer.finish();
      const decoded = MumbleProto.RequestBlob.decode(buffer);
      
      // Verify
      let fieldName;
      if (fieldId === 1) fieldName = 'sessionTexture';
      if (fieldId === 2) fieldName = 'sessionComment';
      if (fieldId === 3) fieldName = 'channelDescription';
      
      expect(decoded[fieldName]).toBeDefined();
      expect(decoded[fieldName]).toHaveLength(values.length);
      expect(decoded[fieldName]).toEqual(values);
    };

    verifyPacked(1, [10, 20]); // sessionTexture
    verifyPacked(2, [30, 40]); // sessionComment
    verifyPacked(3, [50, 60]); // channelDescription
  });

  test('UserStats packed coverage', () => {
    // celtVersions (field 13) is repeated int32
    const writer = $protobuf.Writer.create();
    writer.uint32((13 << 3) | 2);
    const packedWriter = $protobuf.Writer.create();
    for (const v of [1, 2]) packedWriter.int32(v);
    writer.bytes(packedWriter.finish());
    
    const buffer = writer.finish();
    const decoded = MumbleProto.UserStats.decode(buffer);
    expect(decoded.celtVersions).toEqual([1, 2]);
  });

  test('QueryUsers packed coverage', () => {
    // ids (field 1) is repeated uint32
    const writer = $protobuf.Writer.create();
    writer.uint32((1 << 3) | 2);
    const packedWriter = $protobuf.Writer.create();
    for (const v of [10, 20]) packedWriter.uint32(v);
    writer.bytes(packedWriter.finish());
    
    const buffer = writer.finish();
    const decoded = MumbleProto.QueryUsers.decode(buffer);
    expect(decoded.ids).toEqual([10, 20]);
  });

  test('TextMessage packed coverage', () => {
    // session (2), channelId (3), treeId (4) are repeated uint32
    const verifyPacked = (fieldId, values, fieldName) => {
      const writer = $protobuf.Writer.create();
      writer.uint32((fieldId << 3) | 2);
      const packedWriter = $protobuf.Writer.create();
      for (const v of values) packedWriter.uint32(v);
      writer.bytes(packedWriter.finish());
      
      // TextMessage requires 'message' field
      writer.uint32((5 << 3) | 2).string("msg");

      const buffer = writer.finish();
      const decoded = MumbleProto.TextMessage.decode(buffer);
      expect(decoded[fieldName]).toEqual(values);
    };

    verifyPacked(2, [1, 2], 'session');
    verifyPacked(3, [3, 4], 'channelId');
    verifyPacked(4, [5, 6], 'treeId');
  });

  test('VoiceTarget packed coverage', () => {
    // VoiceTarget has 'targets' (repeated Target). Target has 'session' (repeated uint32).
    // We need to construct VoiceTarget -> Target -> session (packed)
    
    // Construct Target with packed session
    const targetWriter = $protobuf.Writer.create();
    // session (field 1) packed
    targetWriter.uint32((1 << 3) | 2);
    const packedSession = $protobuf.Writer.create();
    [100, 200].forEach(v => packedSession.uint32(v));
    targetWriter.bytes(packedSession.finish());
    
    const targetBuffer = targetWriter.finish();
    
    // Construct VoiceTarget with this Target
    const writer = $protobuf.Writer.create();
    // targets (field 2) repeated message
    writer.uint32((2 << 3) | 2).bytes(targetBuffer);
    
    const buffer = writer.finish();
    const decoded = MumbleProto.VoiceTarget.decode(buffer);
    expect(decoded.targets[0].session).toEqual([100, 200]);
  });

  test('ACL packed coverage', () => {
    // ACL -> groups (ChanGroup) -> add(5), remove(6), inheritedMembers(7)
    
    // Construct ChanGroup with packed fields
    const groupWriter = $protobuf.Writer.create();
    groupWriter.uint32((1 << 3) | 2).string("Group"); // name (required)
    
    // add (5)
    groupWriter.uint32((5 << 3) | 2);
    const packedAdd = $protobuf.Writer.create();
    [1, 2].forEach(v => packedAdd.uint32(v));
    groupWriter.bytes(packedAdd.finish());
    
    // remove (6)
    groupWriter.uint32((6 << 3) | 2);
    const packedRemove = $protobuf.Writer.create();
    [3, 4].forEach(v => packedRemove.uint32(v));
    groupWriter.bytes(packedRemove.finish());
    
    // inheritedMembers (7)
    groupWriter.uint32((7 << 3) | 2);
    const packedMembers = $protobuf.Writer.create();
    [5, 6].forEach(v => packedMembers.uint32(v));
    groupWriter.bytes(packedMembers.finish());
    
    const groupBuffer = groupWriter.finish();
    
    // Construct ACL
    const writer = $protobuf.Writer.create();
    writer.uint32((1 << 3) | 0).uint32(1); // channelId (required)
    // groups (3)
    writer.uint32((3 << 3) | 2).bytes(groupBuffer);
    
    const buffer = writer.finish();
    const decoded = MumbleProto.ACL.decode(buffer);
    expect(decoded.groups[0].add).toEqual([1, 2]);
    expect(decoded.groups[0].remove).toEqual([3, 4]);
    expect(decoded.groups[0].inheritedMembers).toEqual([5, 6]);
  });

  test('Nested messages coverage', () => {
    // Verify direct decode and unknown fields for nested messages
    
    // UserStats.Stats
    const statsPayload = { good: 1, late: 2 };
    verifyRoundTrip(MumbleProto.UserStats.Stats, statsPayload);
    verifyUnknownField(MumbleProto.UserStats.Stats, statsPayload);
    
    // UserList.User
    const userPayload = { userId: 1, name: "User" };
    verifyRoundTrip(MumbleProto.UserList.User, userPayload);
    verifyUnknownField(MumbleProto.UserList.User, userPayload);
    
    // VoiceTarget.Target
    const targetPayload = { session: [1], channelId: 2 };
    verifyRoundTrip(MumbleProto.VoiceTarget.Target, targetPayload);
    verifyUnknownField(MumbleProto.VoiceTarget.Target, targetPayload);
    
    // ACL.ChanGroup
    const groupPayload = { name: "Group", inherited: true };
    verifyRoundTrip(MumbleProto.ACL.ChanGroup, groupPayload);
    verifyUnknownField(MumbleProto.ACL.ChanGroup, groupPayload);
    
    // ACL.ChanACL
    const aclPayload = { userId: 1, grant: 10 };
    verifyRoundTrip(MumbleProto.ACL.ChanACL, aclPayload);
    verifyUnknownField(MumbleProto.ACL.ChanACL, aclPayload);
    
    // BanList.BanEntry
    const banEntryPayload = {
      address: Buffer.from([127, 0, 0, 1]),
      mask: 32,
      name: "Banned"
    };
    verifyRoundTrip(MumbleProto.BanList.BanEntry, banEntryPayload);
    verifyUnknownField(MumbleProto.BanList.BanEntry, banEntryPayload);
  });

  test('CodecVersion missing fields coverage', () => {
    // Manually construct a buffer missing 'beta' (tag 2)
    const writer = $protobuf.Writer.create();
    // alpha (tag 1)
    writer.uint32(8).int32(-2147483648);
    // SKIP beta (tag 2)
    // preferAlpha (tag 3)
    writer.uint32(24).bool(true);
    // opus (tag 4)
    writer.uint32(32).bool(false);
    
    const buf1 = writer.finish();
    
    try {
      MumbleProto.CodecVersion.decode(buf1);
      throw new Error('Should have thrown');
    } catch (e) {
      if (e.message === 'Should have thrown') throw e;
      expect(e.message).toContain("missing required 'beta'");
    }

    // Manually construct a buffer missing 'preferAlpha' (tag 3)
    const writer2 = $protobuf.Writer.create();
    // alpha (tag 1)
    writer2.uint32(8).int32(1);
    // beta (tag 2)
    writer2.uint32(16).int32(2);
    // SKIP preferAlpha (tag 3)
    // opus (tag 4)
    writer2.uint32(32).bool(false);
    
    const buf2 = writer2.finish();
    
    try {
      MumbleProto.CodecVersion.decode(buf2);
      throw new Error('Should have thrown');
    } catch (e) {
      if (e.message === 'Should have thrown') throw e;
      expect(e.message).toContain("missing required 'preferAlpha'");
    }
  });

  test('ServerConfig coverage', () => {
    const payload = {
      maxBandwidth: 1000,
      welcomeText: "Welcome",
      allowHtml: true,
      messageLength: 100,
      imageMessageLength: 200,
      maxUsers: 50
    };
    verifyRoundTrip(MumbleProto.ServerConfig, payload);
    verifyUnknownField(MumbleProto.ServerConfig, payload);
  });

  test('SuggestConfig coverage', () => {
    const payload = {
      version: 1,
      positional: true,
      pushToTalk: true
    };
    verifyRoundTrip(MumbleProto.SuggestConfig, payload);
    verifyUnknownField(MumbleProto.SuggestConfig, payload);
  });

  test('Empty creation coverage', () => {
    const msg = MumbleProto.Version.create();
    expect(msg).toBeDefined();
    expect(msg.version).toBe(0); // Default value
    
    const msg2 = new MumbleProto.Version();
    expect(msg2).toBeDefined();
    expect(msg2.version).toBe(0);
  });

  test('BanEntry missing fields coverage', () => {
    // Missing address (tag 1)
    const writer = $protobuf.Writer.create();
    // mask (tag 2)
    writer.uint32(16).uint32(32);
    
    const buf1 = writer.finish();
    
    try {
      MumbleProto.BanList.BanEntry.decode(buf1);
      throw new Error('Should have thrown');
    } catch (e) {
      if (e.message === 'Should have thrown') throw e;
      expect(e.message).toContain("missing required 'address'");
    }

    // Missing mask (tag 2)
    const writer2 = $protobuf.Writer.create();
    // address (tag 1)
    writer2.uint32(10).bytes(Buffer.from([127, 0, 0, 1]));
    
    const buf2 = writer2.finish();
    
    try {
      MumbleProto.BanList.BanEntry.decode(buf2);
      throw new Error('Should have thrown');
    } catch (e) {
      if (e.message === 'Should have thrown') throw e;
      expect(e.message).toContain("missing required 'mask'");
    }
  });

  test('ChannelState packed coverage', () => {
    // linksAdd (6), linksRemove (7) are repeated uint32
    const verifyPacked = (fieldId, values, fieldName) => {
      const writer = $protobuf.Writer.create();
      writer.uint32((fieldId << 3) | 2);
      const packedWriter = $protobuf.Writer.create();
      values.forEach(v => packedWriter.uint32(v));
      writer.bytes(packedWriter.finish());
      
      const buffer = writer.finish();
      const decoded = MumbleProto.ChannelState.decode(buffer);
      expect(decoded[fieldName]).toEqual(values);
    };

    verifyPacked(6, [1, 2], 'linksAdd');
    verifyPacked(7, [3, 4], 'linksRemove');
  });

  test('Authenticate packed coverage', () => {
    // celtVersions (4) is repeated int32
    const writer = $protobuf.Writer.create();
    writer.uint32((4 << 3) | 2);
    const packedWriter = $protobuf.Writer.create();
    [1, 2].forEach(v => packedWriter.int32(v));
    writer.bytes(packedWriter.finish());
    
    const buffer = writer.finish();
    const decoded = MumbleProto.Authenticate.decode(buffer);
    expect(decoded.celtVersions).toEqual([1, 2]);
  });

  test('ChannelState links packed coverage', () => {
    // links (4) is repeated uint32
    const writer = $protobuf.Writer.create();
    writer.uint32((4 << 3) | 2);
    const packedWriter = $protobuf.Writer.create();
    [1, 2].forEach(v => packedWriter.uint32(v));
    writer.bytes(packedWriter.finish());
    
    const buffer = writer.finish();
    const decoded = MumbleProto.ChannelState.decode(buffer);
    expect(decoded.links).toEqual([1, 2]);
  });
});
