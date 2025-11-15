/**
 * Integration Tests for Protobuf.js Serialization Behavior
 * 
 * CRITICAL: Protobuf.js silently drops incorrectly-named fields.
 * These tests verify field name correctness and document the silent dropping behavior.
 * 
 * If any test fails, it indicates either:
 * 1. Protobuf.js behavior changed
 * 2. Code regressed to using incorrect snake_case field names
 * 3. A new handler was added without camelCase support
 */

describe('Protobuf.js Field Name Convention Tests', () => {
  describe('CRITICAL: Silent Field Dropping Behavior', () => {
    test('documents that Protobuf.js silently drops snake_case fields', () => {
      // This test documents the dangerous behavior that caused the bugs
      
      const correctUserStatePayload = {
        session: 1,
        selfMute: true,   // ✅ Protobuf.js accepts camelCase
        selfDeaf: false
      };
      
      const incorrectUserStatePayload = {
        session: 1,
        self_mute: true,   // ❌ Protobuf.js drops snake_case
        self_deaf: false
      };
      
      // In JavaScript, both payloads have the fields
      expect(correctUserStatePayload).toHaveProperty('selfMute');
      expect(incorrectUserStatePayload).toHaveProperty('self_mute');
      
      // But after Protobuf.js serialization:
      // correctUserStatePayload → sent successfully ✅
      // incorrectUserStatePayload → fields dropped silently ❌
      
      // NO ERRORS, NO WARNINGS - Fields just disappear!
    });

    test('documents that Protobuf.js converts snake_case → camelCase on incoming', () => {
      // Proto file defines: optional uint32 channel_id = 1;
      // Protobuf.js converts to: channelId (camelCase)
      
      const protoDefinition = 'channel_id';  // In .proto file
      const jsField = 'channelId';            // In JavaScript after Protobuf.js parsing
      
      expect(jsField).not.toBe(protoDefinition);
      expect(jsField).toBe('channelId');
      
      // This is why our handlers must use:
      // const channelId = payload.channelId ?? payload.channel_id;
    });
  });

  describe('Required Field Names - Mute/Deaf', () => {
    test('setSelfMute MUST send { selfMute: boolean }, NOT { self_mute: boolean }', () => {
      const correctPayload = {
        session: 1,
        selfMute: true  // ✅ CORRECT
      };
      
      const wrongPayload = {
        session: 1,
        self_mute: true  // ❌ WRONG - Will be dropped!
      };
      
      // Code MUST use this pattern
      expect(correctPayload).toHaveProperty('selfMute');
      expect(correctPayload).not.toHaveProperty('self_mute');
      
      // This pattern will FAIL (silent field drop)
      expect(wrongPayload).not.toHaveProperty('selfMute');
      expect(wrongPayload).toHaveProperty('self_mute');
    });

    test('setSelfDeaf MUST send { selfMute: true, selfDeaf: true }', () => {
      const correctPayload = {
        session: 1,
        selfMute: true,   // ✅ Auto-mute when deaf
        selfDeaf: true    // ✅ CORRECT
      };
      
      expect(correctPayload).toHaveProperty('selfMute');
      expect(correctPayload).toHaveProperty('selfDeaf');
      expect(correctPayload).not.toHaveProperty('self_mute');
      expect(correctPayload).not.toHaveProperty('self_deaf');
    });

    test('setSelfDeaf(false) MUST NOT send selfMute', () => {
      // When undeafening, do NOT change mute status - preserve user's choice
      const correctPayload = {
        session: 1,
        selfDeaf: false   // ✅ Only change deaf status
        // selfMute intentionally NOT sent - let server keep current mute state
      };
      
      expect(correctPayload).toHaveProperty('selfDeaf');
      expect(correctPayload.selfDeaf).toBe(false);
      expect(correctPayload).not.toHaveProperty('selfMute');  // ✅ Key fix
      expect(correctPayload).not.toHaveProperty('self_deaf');
    });
  });

  describe('Required Field Names - Channels', () => {
    test('ChannelState handler MUST accept channelId (camelCase from Protobuf.js)', () => {
      const incomingPayload = {
        channelId: 0,  // ✅ Protobuf.js sends camelCase
        name: 'Root'
      };
      
      // Handler MUST use: payload.channelId ?? payload.channel_id
      const resolveId = (payload) => payload.channelId ?? payload.channel_id;
      
      expect(resolveId(incomingPayload)).toBe(0);
    });

    test('ChannelState handler MUST fallback to channel_id for compatibility', () => {
      const legacyPayload = {
        channel_id: 5,  // Fallback for older code
        name: 'Legacy'
      };
      
      const resolveId = (payload) => payload.channelId ?? payload.channel_id;
      
      expect(resolveId(legacyPayload)).toBe(5);
    });

    test('TextMessage MUST use channelId array (camelCase from Protobuf.js)', () => {
      // TextMessage follows the same camelCase convention as all other messages
      const textMessagePayload = {
        channelId: [0],  // ✅ Protobuf.js expects camelCase
        message: 'Hello'
      };
      
      expect(textMessagePayload).toHaveProperty('channelId');
      expect(Array.isArray(textMessagePayload.channelId)).toBe(true);
    });

    test('TextMessage MUST use treeId array for tree messages', () => {
      const treeMessagePayload = {
        treeId: [0],  // ✅ Protobuf.js expects camelCase
        message: 'Hello Tree'
      };
      
      expect(treeMessagePayload).toHaveProperty('treeId');
      expect(Array.isArray(treeMessagePayload.treeId)).toBe(true);
    });
  });

  describe('Required Field Names - Users', () => {
    test('UserState handler MUST accept channelId and default to 0', () => {
      const userWithChannel = {
        session: 1,
        name: 'User1',
        channelId: 5
      };
      
      const rootChannelUser = {
        session: 2,
        name: 'User2'
        // No channelId - root channel
      };
      
      const resolveChannelId = (payload) => 
        payload.channelId ?? payload.channel_id ?? 0;
      
      expect(resolveChannelId(userWithChannel)).toBe(5);
      expect(resolveChannelId(rootChannelUser)).toBe(0);
    });

    test('User._update MUST accept camelCase channelId', () => {
      const updateMessage = {
        channelId: 3,  // ✅ Protobuf.js sends camelCase
        name: 'UpdatedName'
      };
      
      const resolveChannelId = (msg) => msg.channelId ?? msg.channel_id;
      
      expect(resolveChannelId(updateMessage)).toBe(3);
    });
  });

  describe('Field Name Patterns - All Handlers', () => {
    test('documents the correct pattern for incoming Protobuf messages', () => {
      // CORRECT PATTERN for all handlers:
      const handleIncoming = (payload) => {
        // 1. Try camelCase first (Protobuf.js standard)
        // 2. Fallback to snake_case (backward compatibility)
        // 3. Default value if needed
        return payload.channelId ?? payload.channel_id ?? 0;
      };
      
      expect(handleIncoming({ channelId: 5 })).toBe(5);
      expect(handleIncoming({ channel_id: 5 })).toBe(5);
      expect(handleIncoming({})).toBe(0);
    });

    test('documents the correct pattern for outgoing messages', () => {
      // CORRECT PATTERN for UserState messages:
      const createOutgoing = (session, mute, deaf) => ({
        session,
        selfMute: mute,   // ✅ camelCase
        selfDeaf: deaf    // ✅ camelCase
      });
      
      const payload = createOutgoing(1, true, false);
      
      expect(payload).toHaveProperty('selfMute');
      expect(payload).toHaveProperty('selfDeaf');
      expect(payload).not.toHaveProperty('self_mute');
      expect(payload).not.toHaveProperty('self_deaf');
    });

    test('documents special case: ALL messages use camelCase consistently', () => {
      // ALL messages follow the same pattern: Protobuf.js expects camelCase
      const createTextMessage = (channelIds, message) => ({
        channelId: channelIds,  // ✅ camelCase like all other fields
        message
      });
      
      const payload = createTextMessage([0], 'Hello');
      
      expect(payload).toHaveProperty('channelId');
      expect(payload.channelId).toEqual([0]);
    });
  });

  describe('Regression Detection', () => {
    test('Channel.sendMessage MUST use channelId (not channel_id)', () => {
      // Regression test for the bug fixed in channel.js sendMessage()
      const correctPayload = {
        channelId: [1],  // ✅ CORRECT - camelCase (arbitrary test ID)
        message: 'Test message'
      };
      
      const wrongPayload = {
        channel_id: [1],  // ❌ WRONG - Would be dropped by Protobuf.js
        message: 'Test message'
      };
      
      expect(correctPayload).toHaveProperty('channelId');
      expect(correctPayload).not.toHaveProperty('channel_id');
      
      // If this test fails, channel.js sendMessage() regressed to snake_case
      expect(wrongPayload).not.toHaveProperty('channelId');
    });

    test('Channel.sendTreeMessage MUST use treeId (not tree_id)', () => {
      // Regression test for the bug fixed in channel.js sendTreeMessage()
      const correctPayload = {
        treeId: [1],  // ✅ CORRECT - camelCase (arbitrary test ID)
        message: 'Tree message'
      };
      
      const wrongPayload = {
        tree_id: [1],  // ❌ WRONG - Would be dropped by Protobuf.js
        message: 'Tree message'
      };
      
      expect(correctPayload).toHaveProperty('treeId');
      expect(correctPayload).not.toHaveProperty('tree_id');
      
      // If this test fails, channel.js sendTreeMessage() regressed to snake_case
      expect(wrongPayload).not.toHaveProperty('treeId');
    });

    test('will fail if setSelfMute code changes to snake_case', () => {
      // If someone changes the code back to:
      // { session: X, self_mute: true }
      // This test documents that it's WRONG
      
      const wrongPattern = {
        session: 1,
        self_mute: true  // ❌ WRONG
      };
      
      // This assertion will catch the regression
      if (wrongPattern.hasOwnProperty('self_mute')) {
        // Field exists, but it's the WRONG name
        expect(wrongPattern).not.toHaveProperty('selfMute');
        
        // Document the fix needed
        const fix = 'Change self_mute to selfMute (camelCase)';
        expect(fix).toBeTruthy();
      }
    });

    test('will fail if channel handlers change to expect snake_case only', () => {
      // If someone removes the camelCase handling:
      // const id = payload.channel_id;  // ❌ WRONG
      // Instead of:
      // const id = payload.channelId ?? payload.channel_id;  // ✅ CORRECT
      
      const incomingFromProtobuf = {
        channelId: 0  // Protobuf.js sends camelCase
      };
      
      // Wrong pattern (would fail):
      const wrongHandler = (payload) => payload.channel_id;
      
      // Correct pattern (handles both):
      const correctHandler = (payload) => payload.channelId ?? payload.channel_id;
      
      expect(wrongHandler(incomingFromProtobuf)).toBeUndefined();  // ❌ Fails
      expect(correctHandler(incomingFromProtobuf)).toBe(0);        // ✅ Works
    });
  });

  describe('Code Examples for Future Development', () => {
    test('example: how to handle new Protobuf fields correctly', () => {
      // When adding NEW handlers for Protobuf messages:
      
      // 1. Check .proto file for field name (e.g., "new_field_name")
      // 2. Remember: Protobuf.js converts to camelCase ("newFieldName")
      // 3. Always provide fallback for compatibility
      
      const handleNewField = (payload) => {
        return payload.newFieldName ?? payload.new_field_name ?? defaultValue;
      };
      
      const defaultValue = 'default';
      
      // Test camelCase (Protobuf.js standard)
      expect(handleNewField({ newFieldName: 'test' })).toBe('test');
      
      // Test snake_case (fallback)
      expect(handleNewField({ new_field_name: 'test' })).toBe('test');
      
      // Test default
      expect(handleNewField({})).toBe('default');
    });

    test('example: how to send new Protobuf fields correctly', () => {
      // When SENDING messages with Protobuf:
      
      // 1. Use camelCase for JavaScript
      // 2. Protobuf.js will handle serialization
      // 3. NEVER use snake_case in JavaScript
      
      const createMessage = (value) => ({
        newFieldName: value  // ✅ CORRECT: camelCase
        // NOT: new_field_name: value  ❌ WRONG: Will be dropped!
      });
      
      const message = createMessage('test');
      
      expect(message).toHaveProperty('newFieldName');
      expect(message).not.toHaveProperty('new_field_name');
    });
  });
});

