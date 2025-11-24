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
import { useVoiceStore } from '../stores/voiceStore';
import { translate } from '../localize';
import MessageConfirmation from './MessageConfirmation.vue';
import packageJson from '../../package.json';

const userStore = useUserStore();
const audioStore = useAudioStore();
const uiStore = useUIStore();
const voiceStore = useVoiceStore();

// Inject auth for logout
const auth = inject('auth');

// Computed properties - Pinia refs are already reactive, no .value needed here
const selfMute = computed(() => userStore.selfMute);
const selfDeaf = computed(() => userStore.selfDeaf);
const audioLockActive = computed(() => audioStore.audioLockActive);

// Writable computed for 2-way binding with messageBox
const messageBox = computed({
  get: () => uiStore.messageBox,
  set: (val) => { uiStore.messageBox = val; }
});

// Message box placeholder hint - simplified
const messageBoxHint = computed(() => {
  const user = userStore.thisUser;
  if (!user?.channel?.value?.name) return '';
  return translate('chat.channel_message_placeholder').replace('%1', user.channel.value.name.value);
});

// Mailto link for desktop attachment
const mailToDesktop = computed(() => 
  `mailto:mail@${globalThis.location.hostname}?subject=Send%20attachment%20to%20desktop`
);

// Methods
const handleMuteClick = () => {
  userStore.requestMute(userStore.thisUser);
};

const handleUnmuteClick = () => {
  userStore.requestUnmute(userStore.thisUser);
};

const handleDeafClick = () => {
  userStore.requestDeaf(userStore.thisUser, voiceStore.isLoopbackMode);
};

const handleUndeafClick = () => {
  userStore.requestUndeaf(userStore.thisUser);
};

const handleSubmitMessageBox = () => {
  const messageText = uiStore.messageBox;
  if (!messageText.trim()) return;
  
  // Get target channel from current user
  const channel = userStore.thisUser?.channel?.value;
  if (!channel?.model?.sendMessage) return;
  
  channel.model.sendMessage(messageText);
  uiStore.messageBox = '';
};

const handleSettingsClick = () => {
  uiStore.currentOpenModal = 'settings';
};

const handleSourceCodeClick = () => {
  globalThis.open(packageJson.homepage, '_blank').focus();
};

const handleLogoutClick = () => {
  auth.logout();
  location.reload();
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
