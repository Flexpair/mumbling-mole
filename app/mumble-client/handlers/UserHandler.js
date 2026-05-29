import User from '../user.js';

export function handleUserState(client, payload) {
  let user = client._userById[payload.session];
  if (!user) {
    user = new User(client, payload.session);
    client._userById[user._id] = user;
    client.users.push(user);
    client.emit('newUser', user);

    // For some reason, the mumble protocol does not send the initial
    // channel of a client if it is the root channel
    payload.channelId = payload.channelId ?? 0;
  }
  user._update(payload);
}

export function handleUserRemove(client, payload) {
  const user = client._userById[payload.session];
  if (user) {
    user._remove(client._userById[payload.actor], payload.reason, payload.ban);
    delete client._userById[user._id];
    const index = client.users.indexOf(user);
    if (index !== -1) {
      client.users.splice(index, 1);
    }
  }
}
