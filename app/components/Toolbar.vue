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
      <MessageConfirmation :appState="appState" />
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
      v-tooltip="'View connection statistics'"
      class="tb-information"
      alt="Show information about connection quality"
      rel="information"
      src="svg/mumble.svg"
      @click="handleConnectionInfoClick"
    />
    <img
      v-tooltip="'Open audio settings'"
      class="tb-settings"
      alt="Open audio settings dialog"
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
import MessageConfirmation from './MessageConfirmation.vue';

const appState = inject('appState');

// Computed properties that directly track Vue refs
const selfMute = computed(() => appState.selfMute?.value || false);
const selfDeaf = computed(() => appState.selfDeaf?.value || false);
const audioLockActive = computed(() => appState.audioLockActive?.value || false);

// Writable computed for 2-way binding with messageBox
const messageBox = computed({
  get: () => appState.messageBox?.value || '',
  set: (val) => {
    if (appState.messageBox) {
      appState.messageBox.value = val;
    }
  }
});

// AppState computed properties (now Vue computed refs, not Knockout)
const messageBoxHint = computed(() => appState.messageBoxHint?.value || '');
const mailToDesktop = computed(() => appState.mailToDesktop?.value || '');

// Methods
const handleMuteClick = () => {
  appState.requestMute(appState.thisUser?.value);
};

const handleUnmuteClick = () => {
  appState.handleUnmuteClick();
};

const handleDeafClick = () => {
  appState.requestDeaf(appState.thisUser?.value);
};

const handleUndeafClick = () => {
  appState.handleUndeafClick();
};

const handleSubmitMessageBox = () => {
  appState.submitMessageBox();
};

const handleConnectionInfoClick = () => {
  if (appState.connectionInfo?.show) {
    appState.connectionInfo.show();
  }
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
