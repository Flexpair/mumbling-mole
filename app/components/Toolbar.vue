<template>
  <div 
    class="toolbar-horizontal" 
    role="toolbar"
    aria-label="Voice and communication controls"
  >
    <!-- Mute/Unmute Button -->
    <button
      v-show="!selfMute"
      v-tooltip="'Mute microphone (Ctrl+M)'"
      class="toolbar-button tb-mute"
      type="button"
      @click="handleMuteClick"
      aria-pressed="false"
      :aria-label="'Mute microphone. Press Control plus M'"
    >
      <img src="svg/audio-input-microphone.svg" alt="" aria-hidden="true" />
    </button>
    <button
      v-show="selfMute"
      v-tooltip="audioLockActive ? 'Cannot unmute - audio disabled' : 'Unmute microphone (Ctrl+M)'"
      class="toolbar-button tb-unmute tb-active"
      :class="{ 'tb-disabled': audioLockActive }"
      type="button"
      @click="handleUnmuteClick"
      :disabled="audioLockActive"
      aria-pressed="true"
      :aria-label="audioLockActive ? 'Microphone muted. Cannot unmute because audio is disabled' : 'Unmute microphone. Press Control plus M'"
    >
      <img src="svg/audio-input-microphone-muted.svg" alt="" aria-hidden="true" />
    </button>

    <!-- Deaf/Undeaf Button -->
    <button
      v-show="!selfDeaf"
      v-tooltip="'Deafen (disable all audio)'"
      class="toolbar-button tb-deaf"
      type="button"
      @click="handleDeafClick"
      aria-pressed="false"
      aria-label="Deafen. Disable all audio output"
    >
      <img src="svg/audio-output.svg" alt="" aria-hidden="true" />
    </button>
    <button
      v-show="selfDeaf"
      v-tooltip="audioLockActive ? 'Cannot undeafen - audio disabled' : 'Undeafen (enable audio)'"
      class="toolbar-button tb-undeaf tb-active"
      :class="{ 'tb-disabled': audioLockActive }"
      type="button"
      @click="handleUndeafClick"
      :disabled="audioLockActive"
      aria-pressed="true"
      :aria-label="audioLockActive ? 'Audio deafened. Cannot undeafen because audio is disabled' : 'Undeafen. Enable audio output'"
    >
      <img src="svg/audio-output-deafened.svg" alt="" aria-hidden="true" />
    </button>

    <!-- Message Input Form (separate from toolbar) -->
    <form class="message-box-container" @submit.prevent="handleSubmitMessageBox">
      <label for="message-box" class="sr-only">{{ messageBoxLabel }}</label>
      <input
        id="message-box"
        type="text"
        :placeholder="messageBoxHint"
        v-model="messageBox"
        aria-describedby="message-hint"
      />
      <span id="message-hint" class="sr-only">Press Enter to send message</span>
      <!-- Message confirmation (green checkmark) appears inside message box -->
      <MessageConfirmation />
    </form>

    <!-- Send File Link -->
    <a
      :href="mailToDesktop"
      v-tooltip="'Send file to remote desktop'"
      class="toolbar-link mail-link"
      aria-label="Send file attachment to remote desktop via email"
    >
      <img src="svg/mail-attachment.svg" alt="" aria-hidden="true" />
    </a>

    <!-- Settings Button -->
    <button
      v-tooltip="'Audio Info & Settings'"
      class="toolbar-button tb-settings"
      type="button"
      @click="handleSettingsClick"
      aria-label="Open audio info and settings dialog"
      aria-haspopup="dialog"
    >
      <img src="svg/config_basic.svg" alt="" aria-hidden="true" />
    </button>

    <!-- Source Code Button -->
    <button
      v-tooltip="'View source code on GitHub'"
      class="toolbar-button tb-sourcecode"
      type="button"
      @click="handleSourceCodeClick"
      aria-label="Open source code on GitHub in new tab"
    >
      <img src="svg/source-code.svg" alt="" aria-hidden="true" />
    </button>

    <!-- Support Link -->
    <a
      href="mailto:mail@flexpair.com?subject=Open%20support%20request"
      v-tooltip="'Contact support'"
      class="toolbar-link"
      aria-label="Contact support via email"
    >
      <img src="svg/system-help.svg" alt="" aria-hidden="true" />
    </a>

    <!-- Logout Button -->
    <button
      v-tooltip="'Logout'"
      class="toolbar-button tb-logout"
      type="button"
      @click="handleLogoutClick"
      aria-label="Log out of application"
    >
      <img src="svg/logout.svg" alt="" aria-hidden="true" />
    </button>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue';
import { storeToRefs } from 'pinia';
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

// Reactive refs from Pinia stores (storeToRefs preserves reactivity)
const { selfMute, selfDeaf } = storeToRefs(userStore);
const { audioLockActive } = storeToRefs(audioStore);

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

// Accessible label for message box
const messageBoxLabel = computed(() => {
  const user = userStore.thisUser;
  if (!user?.channel?.value?.name) return 'Send a message';
  return `Send a message to ${user.channel.value.name.value}`;
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
  if (uiStore.currentOpenModal === 'settings') {
    uiStore.currentOpenModal = null;
  } else {
    uiStore.currentOpenModal = 'settings';
  }
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
.toolbar-link {
  text-decoration: none;
}

/* Toolbar button base styles for accessibility */
.toolbar-button {
  background: none;
  border: none; /* Removed border to avoid double-outline effect with focus indicator */
  border-radius: 3px;
  padding: 3px; /* Slightly increased to compensate for removed border */
  margin: 0 2px; /* Horizontal margin prevents focus outline overlap between adjacent buttons */
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.toolbar-button img,
.toolbar-link img {
  height: 28px;
  width: 28px;
  display: block;
  border: none;
}

.toolbar-button:hover:not(:disabled),
.toolbar-link:hover {
  background-color: #a9a9a9;
  box-shadow: inset 0 0 0 1px #d3d3d3; /* Use inset box-shadow instead of border */
}

.toolbar-button:disabled {
  filter: grayscale(100%);
  cursor: not-allowed;
  opacity: 0.45;
}

.toolbar-button.tb-active {
  box-shadow: inset 0 0 0 1px #fff; /* Use inset box-shadow instead of border to maintain consistent size */
  background-color: #d3d3d3;
}

.toolbar-horizontal {
  height: 36px;
  display: flex;
  align-items: center;
  padding: 0;
  box-sizing: border-box;
  margin: 0;
  border: none;
  width: 100%;
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
