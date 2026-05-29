import Channel from '../channel.js';

export function handleChannelState(client, payload) {
  const channelId = payload.channelId;
  let channel = client._channelById[channelId];
  if (!channel) {
    channel = new Channel(client, channelId);
    client._channelById[channel._id] = channel;
    client.channels.push(channel);
    client.emit('newChannel', channel);
  }
  for (const otherId of (payload.linksRemove || [])) {
    const otherChannel = client._channelById[otherId];
    if (otherChannel?.links.includes(channel)) {
      otherChannel._update({
        linksRemove: [channelId]
      });
    }
  }
  channel._update(payload);
}

export function handleChannelRemove(client, payload) {
  const channelId = payload.channelId;
  const channel = client._channelById[channelId];
  if (channel) {
    channel._remove();
    delete client._channelById[channel._id];
    const index = client.channels.indexOf(channel);
    if (index !== -1) {
      client.channels.splice(index, 1);
    }
  }
}
