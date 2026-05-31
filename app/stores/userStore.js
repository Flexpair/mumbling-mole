import { defineStore } from 'pinia';
import { ref, watch, markRaw } from 'vue';
import { useAudioStore } from './audioStore';
import { useVoiceStore } from './voiceStore';
import { useConnectionStore } from './connectionStore';
import { useSettingsStore } from './settingsStore';
import { debugLog } from '../utils/debug-utils';
import { useUserVoiceStream } from '../composables/useUserVoiceStream';

export const useUserStore = defineStore('user', () => {
  const audioStore = useAudioStore();
  const voiceStore = useVoiceStore();
  const connectionStore = useConnectionStore();
  const settingsStore = useSettingsStore();
  
  // Current user
  const thisUser = ref(null);
  
  // Self mute/deaf state
  const selfMute = ref(false);
  const selfDeaf = ref(false);
  
  // Use extracted voice stream logic
  const { handleVoiceStream } = useUserVoiceStream({
    audioStore,
    voiceStore,
    settingsStore,
    selfMute,
    selfDeaf,
    thisUser
  });

  /**
   * Handle user update events
   * @param {object} user - User model
   * @param {object} ui - User UI object
   * @param {object} actor - Actor who triggered update
   * @param {object} properties - Updated properties
   */
  const handleUserUpdate = (user, ui, properties) => {
    if ('channel' in properties) {
      const newChannel = user.channel?.__ui;
      ui.channel.value = newChannel;
    }
    if ('selfMute' in properties) {
      ui.selfMute.value = properties.selfMute;
    }
    if ('selfDeaf' in properties) {
      ui.selfDeaf.value = properties.selfDeaf;
    }
  };

  /**
   * Register a user with minimal UI wrapper
   * @param {object} user - User model from mumble-client
   */
  function registerUser(user) {
    if (user.__ui) {
      delete user.__ui;
    }

    const syncServerState = (serverState) => {
      debugLog('[SERVER-STATE-SYNC] Received server state:', serverState);
      debugLog('[SERVER-STATE-SYNC] Current UI state:', { selfMute: selfMute.value, selfDeaf: selfDeaf.value });
      
      if (serverState.selfMute !== undefined) {
        selfMute.value = serverState.selfMute;
      }
      if (serverState.selfDeaf !== undefined) {
        selfDeaf.value = serverState.selfDeaf;
      }
      
      debugLog('[SERVER-STATE-SYNC] UI synchronized to:', { selfMute: selfMute.value, selfDeaf: selfDeaf.value });
    };
    
    if (user.__syncServerState) {
      user.off('server-state-sync', user.__syncServerState);
    }
    
    user.__syncServerState = syncServerState;
    user.on('server-state-sync', syncServerState);
    
    let ui = (user.__ui = markRaw({
      model: user,
      name: ref(user.username),
      channel: ref(user.channel?.__ui),
      selfMute: ref(user.selfMute),
      selfDeaf: ref(user.selfDeaf),
      talking: ref('off'),
    }));
    
    user.on('update', (actor, properties) => handleUserUpdate(user, ui, properties));

    user.on('voice', (stream) => handleVoiceStream(user, ui, stream));
  }
  
  function requestMute(user) {
    if (user === undefined || user === thisUser.value) {
      selfMute.value = true;
      if (thisUser.value) {
        connectionStore.getClient()?.setSelfMute(true);
      }
    }
  }

  function requestDeaf(user, isLoopbackMode = false) {
    if (user === undefined || user === thisUser.value) {
      if (!isLoopbackMode) {
        selfMute.value = true;
      }
      selfDeaf.value = true;
      if (thisUser.value) {
        connectionStore.getClient()?.setSelfDeaf(true);
        if (!isLoopbackMode) {
          connectionStore.getClient()?.setSelfMute(true);
        }
      }
    }
  }

  function requestUnmute(user) {
    if (audioStore.audioLockActive) {
      audioStore.notifyAudioLock();
      return;
    }
    
    if (user === undefined || user === thisUser.value) {
      selfMute.value = false;
      selfDeaf.value = false;
      if (thisUser.value) {
        connectionStore.getClient()?.setSelfMute(false);
        connectionStore.getClient()?.setSelfDeaf(false);
      }
    }
  }

  function requestUndeaf(user) {
    if (audioStore.audioLockActive) {
      audioStore.notifyAudioLock();
      return;
    }

    if (user === undefined || user === thisUser.value) {
      selfDeaf.value = false;
      if (thisUser.value) {
        connectionStore.getClient()?.setSelfDeaf(false);
      }
    }
  }

  function reset() {
    thisUser.value = null;
    selfMute.value = false;
    selfDeaf.value = false;
  }

  // Set up cross-store reactive subscription: selfMute → voice.setMute
  // Previously handled by AppState._setupSubscriptions()
  watch(selfMute, (mute) => {
    voiceStore.setMute(mute);
  });

  return {
    // State
    thisUser,
    selfMute,
    selfDeaf,
    
    // Methods
    registerUser,
    requestMute,
    requestDeaf,
    requestUnmute,
    requestUndeaf,
    reset
  };
});
