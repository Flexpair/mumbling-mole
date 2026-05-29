export function handleTextMessage(client, payload) {
  const channelIds = payload.channelId ?? [];
  const treeIds = payload.treeId ?? [];
  client.emit(
    'message',
    client._userById[payload.actor],
    payload.message,
    payload.session.map(id => client._userById[id]),
    channelIds.map(id => client._channelById[id]),
    treeIds.map(id => client._channelById[id])
  );
}
