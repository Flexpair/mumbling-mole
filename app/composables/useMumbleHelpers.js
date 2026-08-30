/**
 * Register existing users in the channel
 * @param {Object} client
 * @param {Object} userStore
 */
export function registerExistingUsers(client, userStore, isCurrent) {
  for (const user of client.users.values()) {
    if (user !== client.self) {
      userStore.registerUser(user, isCurrent);
    }
  }
}

/**
 * Reset UI state for new connection
 * @param {Object} audioStore
 * @param {Object} userStore
 * @param {Object} voiceStore
 */
export function resetUIForConnection(audioStore, userStore, voiceStore) {
  audioStore.stopBeep();
  userStore.thisUser = null;
  
  if (!voiceStore.isLoopbackMode) {
    audioStore.beeperReady = false;
    voiceStore.voiceHandlerReady = false;
  }
}
