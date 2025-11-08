<template>
  <form class="toolbar-horizontal" @submit.prevent="handleSubmitMessageBox">
    <img
      v-show="!selfMute"
      class="tb-mute"
      alt="Mute my microphone"
      rel="mute"
      src="svg/audio-input-microphone.svg"
      @click="handleMuteClick"
    />
    <img
      v-show="selfMute"
      class="tb-unmute tb-active"
      :class="{ 'tb-disabled': audioLockActive }"
      alt="Unmute my microphone"
      rel="unmute"
      src="svg/audio-input-microphone-muted.svg"
      @click="handleUnmuteClick"
    />
    <img
      v-show="!selfDeaf"
      class="tb-deaf"
      alt="Turn off sound"
      rel="deaf"
      src="svg/audio-output.svg"
      @click="handleDeafClick"
    />
    <img
      v-show="selfDeaf"
      class="tb-undeaf tb-active"
      :class="{ 'tb-disabled': audioLockActive }"
      alt="Turn sound back on"
      rel="undeaf"
      src="svg/audio-output-deafened.svg"
      @click="handleUndeafClick"
    />
    <input
      id="message-box"
      type="text"
      :placeholder="messageBoxHint"
      v-model="messageBox"
    />
    <a
      :href="mailToDesktop"
      style="text-decoration: none"
    >
      <img
        alt="Send mail (attachment) to shared desktop"
        src="svg/mail-attachment.svg"
      />
    </a>
    <img
      class="tb-information"
      alt="Show information about connection quality"
      rel="information"
      src="svg/mumble.svg"
      @click="handleConnectionInfoClick"
    />
    <img
      class="tb-settings"
      alt="Open audio settings dialog"
      rel="settings"
      src="svg/config_basic.svg"
      @click="handleSettingsClick"
    />
    <img
      class="tb-sourcecode"
      alt="Navigate to source code on Github"
      rel="Source Code"
      src="svg/source-code.svg"
      @click="handleSourceCodeClick"
    />
    <a
      href="mailto:mail@flexpair.com?subject=Open%20support%20request"
      style="text-decoration: none"
    >
      <img alt="Open a support request" src="svg/system-help.svg" />
    </a>
    <img
      class="tb-logout"
      alt="Log user out"
      src="svg/logout.svg"
      @click="handleLogoutClick"
    />
  </form>
</template>

<script setup>
import { ref, inject, watch, onMounted, onUnmounted } from 'vue';

const appState = inject('appState');

// Local reactive state
const selfMute = ref(false);
const selfDeaf = ref(false);
const audioLockActive = ref(false);
const messageBox = ref('');
const messageBoxHint = ref('');
const mailToDesktop = ref('');

// Subscriptions for cleanup
const subscriptions = [];

// Methods
const handleMuteClick = () => {
  if (appState.thisUser && appState.thisUser()) {
    appState.requestMute(appState.thisUser());
  }
};

const handleUnmuteClick = () => {
  appState.handleUnmuteClick();
};

const handleDeafClick = () => {
  if (appState.thisUser && appState.thisUser()) {
    appState.requestDeaf(appState.thisUser());
  }
};

const handleUndeafClick = () => {
  appState.handleUndeafClick();
};

const handleSubmitMessageBox = () => {
  appState.submitMessageBox();
};

const handleConnectionInfoClick = () => {
  if (appState.connectionInfo && appState.connectionInfo.show) {
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

// Bidirectional sync with Knockout AppState
onMounted(() => {
  // Initialize from AppState (use root-level Knockout observables)
  if (appState.selfMute) {
    selfMute.value = appState.selfMute() || false;
  }
  if (appState.selfDeaf) {
    selfDeaf.value = appState.selfDeaf() || false;
  }
  if (appState.audioLockActive) {
    audioLockActive.value = appState.audioLockActive() || false;
  }
  if (appState.messageBox) {
    messageBox.value = appState.messageBox() || '';
  }
  if (appState.messageBoxHint) {
    messageBoxHint.value = appState.messageBoxHint() || '';
  }
  if (appState.mailToDesktop) {
    mailToDesktop.value = appState.mailToDesktop() || '';
  }

  // Knockout → Vue sync (use root-level observables)
  if (appState.selfMute) {
    subscriptions.push(
      appState.selfMute.subscribe((val) => {
        selfMute.value = val || false;
      })
    );
  }
  if (appState.selfDeaf) {
    subscriptions.push(
      appState.selfDeaf.subscribe((val) => {
        selfDeaf.value = val || false;
      })
    );
  }
  if (appState.audioLockActive) {
    subscriptions.push(
      appState.audioLockActive.subscribe((val) => {
        audioLockActive.value = val || false;
      })
    );
  }
  if (appState.messageBox) {
    subscriptions.push(
      appState.messageBox.subscribe((val) => {
        messageBox.value = val || '';
      })
    );
  }
  if (appState.messageBoxHint) {
    subscriptions.push(
      appState.messageBoxHint.subscribe((val) => {
        messageBoxHint.value = val || '';
      })
    );
  }
  if (appState.mailToDesktop) {
    subscriptions.push(
      appState.mailToDesktop.subscribe((val) => {
        mailToDesktop.value = val || '';
      })
    );
  }
});

// Vue → Knockout sync (messageBox is the only user-editable field)
watch(messageBox, (val) => {
  if (appState.messageBox) {
    appState.messageBox(val);
  }
});

// Cleanup subscriptions
onUnmounted(() => {
  subscriptions.forEach(sub => sub.dispose());
});
</script>

<style scoped>
.toolbar-horizontal {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
}
</style>
