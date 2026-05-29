import mumbleStreams from '../../mumble-streams/index.js';
const DenyType = mumbleStreams.data.messages.PermissionDenied.DenyType;

export function handlePermissionDenied(client, payload) {
  const denyType = payload.type;
  
  if (denyType === DenyType.Text) {
    client.emit('denied', 'Text', null, null, payload.reason);
  } else if (denyType === DenyType.Permission) {
    const channelId = payload.channelId;
    const user = client._userById[payload.session];
    const channel = client._channelById[channelId];
    client.emit('denied', 'Permission', user, channel, payload.permission);
  } else if (denyType === DenyType.SuperUser) {
    client.emit('denied', 'SuperUser', null, null, null);
  } else if (denyType === DenyType.ChannelName) {
    client.emit('denied', 'ChannelName', null, null, payload.name);
  } else if (denyType === DenyType.TextTooLong) {
    client.emit('denied', 'TextTooLong', null, null, null);
  } else if (denyType === DenyType.TemporaryChannel) {
    client.emit('denied', 'TemporaryChannel', null, null, null);
  } else if (denyType === DenyType.MissingCertificate) {
    const user = client._userById[payload.session];
    client.emit('denied', 'MissingCertificate', user, null, null);
  } else if (denyType === DenyType.UserName) {
    client.emit('denied', 'UserName', null, null, payload.name);
  } else if (denyType === DenyType.ChannelFull) {
    client.emit('denied', 'ChannelFull', null, null, null);
  } else if (denyType === DenyType.NestingLimit) {
    client.emit('denied', 'NestingLimit', null, null, null);
  } else {
    throw new Error('Invalid DenyType: ' + denyType);
  }
}
