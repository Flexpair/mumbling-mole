<template>
  <form class="toolbar-horizontal" @submit.prevent="handleSubmitMessageBox">
    <img
      v-show="!selfMute"
      v-tooltip="'Mute microphone (Ctrl+M)'"
      class="tb-mute"
      alt="Mute my microphone"
      rel="mute"
      src="svg/audio-input-microphone.svg"
      @click="handleMuteClick"
    />
    <img
      v-show="selfMute"
      v-tooltip="audioLockActive ? 'Cannot unmute - audio disabled' : 'Unmute microphone (Ctrl+M)'"
      class="tb-unmute tb-active"
      :class="{ 'tb-disabled': audioLockActive }"
      alt="Unmute my microphone"
      rel="unmute"
      src="svg/audio-input-microphone-muted.svg"
      @click="handleUnmuteClick"
    />
    <img
      v-show="!selfDeaf"
      v-tooltip="'Deafen (disable all audio)'"
      class="tb-deaf"
      alt="Turn off sound"
      rel="deaf"
      src="svg/audio-output.svg"
      @click="handleDeafClick"
    />
    <img
      v-show="selfDeaf"
      v-tooltip="audioLockActive ? 'Cannot undeafen - audio disabled' : 'Undeafen (enable audio)'"
      class="tb-undeaf tb-active"
      :class="{ 'tb-disabled': audioLockActive }"
      alt="Turn sound back on"
      rel="undeaf"
      src="svg/audio-output-deafened.svg"
      @click="handleUndeafClick"
    />
    <div class="message-box-container">
      <input
        id="message-box"
        type="text"
        :placeholder="messageBoxHint"
        v-model="messageBox"
      />
      <!-- Message confirmation (green checkmark) appears inside message box -->
      <MessageConfirmation />
    </div>
    <a
      :href="mailToDesktop"
      v-tooltip="'Send file to remote desktop'"
      class="mail-link"
    >
      <img
        alt="Send mail (attachment) to shared desktop"
        src="svg/mail-attachment.svg"
      />
    </a>
    <img
      v-tooltip="'Audio Info & Settings'"
      class="tb-settings"
      alt="Open audio info and settings dialog"
      rel="settings"
      src="svg/config_basic.svg"
      @click="handleSettingsClick"
    />
    <img
      v-tooltip="'View source code on GitHub'"
      class="tb-sourcecode"
      alt="Navigate to source code on Github"
      rel="Source Code"
      src="svg/source-code.svg"
      @click="handleSourceCodeClick"
    />
    <a
      href="mailto:mail@flexpair.com?subject=Open%20support%20request"
      v-tooltip="'Contact support'"
      style="text-decoration: none"
    >
      <img alt="Open a support request" src="svg/system-help.svg" />
    </a>
    <img
      v-tooltip="'Logout'"
      class="tb-logout"
      alt="Log user out"
      src="svg/logout.svg"
      @click="handleLogoutClick"
    />
  </form>
</template>

<script setup>
import { computed, inject } from 'vue';
import { useUserStore } from '../stores/userStore';
import { useAudioStore } from '../stores/audioStore';
import { useUIStore } from '../stores/uiStore';
import { useConnectionStore } from '../stores/connectionStore';
import { useVoiceStore } from '../stores/voiceStore';
import MessageConfirmation from './MessageConfirmation.vue';

const appState = inject('appState');
const userStore = useUserStore();
const audioStore = useAudioStore();
const uiStore = useUIStore();
const connectionStore = useConnectionStore();
const voiceStore = useVoiceStore();

// Computed properties that directly track Pinia store state
const selfMute = computed(() => userStore.selfMute ?? false);
const selfDeaf = computed(() => userStore.selfDeaf ?? false);
const audioLockActive = computed(() => audioStore.audioLockActive ?? false);

// Writable computed for 2-way binding with messageBox (UI store)
const messageBox = computed({
  get: () => uiStore.messageBox || '',
  set: (val) => {
    uiStore.messageBox = val;
  }
});

// AppState computed properties (still provided by AppState for now)
const messageBoxHint = computed(() => appState.messageBoxHint?.value || '');
const mailToDesktop = computed(() => appState.mailToDesktop?.value || '');

// Methods
const handleMuteClick = () => {
  const thisUser = userStore.thisUser;
  if (!thisUser?.value) return;

  userStore.requestMute(thisUser.value);

  const client = connectionStore.getClient();
  if (client) {
    client.setSelfMute(true);
  }
};

const handleUnmuteClick = () => {
  if (audioLockActive.value) {
    if (appState?.notifyAudioLock) {
      appState.notifyAudioLock();
    }
    return;
  }

  const thisUser = userStore.thisUser;
  if (!thisUser?.value) return;

  userStore.requestUnmute(thisUser.value);

  const client = connectionStore.getClient();
  if (client) {
    client.setSelfMute(false);
    client.setSelfDeaf(false);
  }
};

const handleDeafClick = () => {
  const thisUser = userStore.thisUser;
  if (!thisUser?.value) return;

  userStore.requestDeaf(thisUser.value, voiceStore.isLoopbackMode ?? false);

  const client = connectionStore.getClient();
  if (client) {
    client.setSelfDeaf(true);
  }
};

const handleUndeafClick = () => {
  if (audioLockActive.value) {
    if (appState?.notifyAudioLock) {
      appState.notifyAudioLock();
    }
    return;
  }

  const thisUser = userStore.thisUser;
  if (!thisUser?.value) return;

  userStore.requestUndeaf(thisUser.value);

  const client = connectionStore.getClient();
  if (client) {
    client.setSelfDeaf(false);
  }
};

const handleSubmitMessageBox = () => {
  appState.submitMessageBox();
};

const handleSettingsClick = () => {
  if (appState.openSettings) {
    appState.openSettings();
  }
};

const handleSourceCodeClick = () => {
  if (appState.openSourceCode) {
    appState.openSourceCode();
  }
};

const handleLogoutClick = () => {
  if (appState.logoutUser) {
    appState.logoutUser();
  }
};
</script>

<style scoped>
.mail-link {
  text-decoration: none;
}

.toolbar-horizontal {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 36px;
  display: flex;
  align-items: center;
  padding: 4px 0;
}

.message-box-container {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
}

#message-box {
  flex: 1;
}
</style>
