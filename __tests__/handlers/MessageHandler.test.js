import { handleTextMessage } from '../../app/mumble-client/handlers/MessageHandler.js';
import { jest } from '@jest/globals';

describe('MessageHandler', () => {
  it('handleTextMessage emits message event with undefined channelId/treeId', () => {
    const client = {
      emit: jest.fn(),
      _userById: { 1: 'actorUser', 2: 'targetUser' },
      _channelById: {}
    };
    handleTextMessage(client, {
      actor: 1,
      message: 'Hello',
      session: [2]
    });
    expect(client.emit).toHaveBeenCalledWith(
      'message',
      'actorUser',
      'Hello',
      ['targetUser'],
      [],
      []
    );
  });

  it('handleTextMessage emits message event with provided channelId and treeId', () => {
    const client = {
      emit: jest.fn(),
      _userById: { 1: 'actorUser', 2: 'targetUser' },
      _channelById: { 10: 'chan10', 20: 'chan20' }
    };
    handleTextMessage(client, {
      actor: 1,
      message: 'Hello',
      session: [2],
      channelId: [10],
      treeId: [20]
    });
    expect(client.emit).toHaveBeenCalledWith(
      'message',
      'actorUser',
      'Hello',
      ['targetUser'],
      ['chan10'],
      ['chan20']
    );
  });
});
