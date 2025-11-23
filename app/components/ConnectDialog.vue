<template>
  <Teleport to="body">
    <dialog
      ref="dialogElement"
      class="connect-dialog dialog"
      aria-labelledby="connect-dialog_title"
    >
    <div id="connect-dialog_title" class="dialog-header">{{ translate('connectdialog.title') }}</div>
    <form @submit.prevent="handleConnect">
      <table>
        <tbody>
          <tr v-if="config.connectDialog?.username">
            <th scope="row">
              <label for="username">{{ translate('connectdialog.username') }}</label>
            </th>
            <td>
              <input
                id="username"
                v-model="username"
                type="text"
                readonly
                required
              />
            </td>
          </tr>
          <tr v-if="config.connectDialog?.password">
            <th scope="row">
              <label for="password">{{ translate('connectdialog.password') }}</label>
            </th>
            <td>
              <input
                id="password"
                v-model="password"
                type="password"
                autocomplete="off"
              />
            </td>
          </tr>
          <tr>
            <th scope="row">
              <label for="audioSource">{{ translate('connectdialog.microphone') }}</label>
            </th>
            <td>
              <!-- Placeholder for audioSource select (moved here via script) -->
              <div ref="microphoneContainer"></div>
            </td>
          </tr>
        </tbody>
      </table>

      <p style="margin: 0.5em 0;">We recommend using headphones for the best audio experience.</p>

      <!-- Loopback Test Section (clear both floats) -->
      <div class="loopback-test-section" style="clear: both;">
        <div class="test-toggle-container">
          <button 
            type="button"
            class="test-toggle-label"
            @click="handleToggleLoopback"
            :aria-pressed="isTestActive || isLoopbackMode"
            style="height: 32px; display: inline-flex; align-items: center; cursor: pointer; background: none; border: none; padding: 0; color: inherit; font: inherit;"
          >
            <span
              class="test-toggle-slider"
              :class="{ active: isTestActive || isLoopbackMode }"
            ></span>
            <span class="test-toggle-text" style="font-size: 1em; margin-left: 8px;">Audio Test</span>
          </button>
        </div>

        <!-- Piano Button and Frequency Display Row -->
        <!-- Fixed height container to prevent layout shifts -->
        <div style="min-height: 40px; margin-top: 8px;">
          <div v-if="isTestActive" style="display: flex; align-items: center; gap: 10px;">
            <!-- Piano Button (Beeper) -->
            <button
              ref="pianoButton"
              type="button"
              class="beep-test-button"
              @mousedown="startBeep"
              @mouseup="stopBeep"
              @mouseleave="stopBeep"
              :class="{ active: isBeeping }"
              :aria-pressed="isBeeping ? 'true' : 'false'"
              style="height: 32px; padding: 4px 8px; white-space: nowrap; flex-shrink: 0; font-size: 1em;"
            >
              <span style="font-size: 1.2em;">🎹</span> Play an A (440 Hz)
            </button>

            <!-- Frequency Display with fixed width -->
            <div
              v-if="isLoopbackMode"
              class="loopback-frequency-display"
              style="padding: 6px 12px; background-color: rgba(21, 120, 120, 0.1); border: 1px solid rgba(21, 120, 120, 0.3); border-radius: 4px; flex-shrink: 0; min-width: 120px; text-align: center;"
            >
              <span style="font-weight: bold; color: #157878;">📊</span>
              <span style="font-size: 1.1em; font-weight: bold; color: #157878; margin-left: 4px; font-variant-numeric: tabular-nums;">
                {{ dominantFrequency > 0 ? dominantFrequency + ' Hz' : '--- Hz' }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Dialog Buttons - completely separate section -->
      <div class="dialog-buttons">
        <input
          type="submit"
          class="connect-dialog-submit"
          value="Connect"
        />
      </div>
    </form>
    </dialog>
  </Teleport>
</template>

<script setup>
import { ref, computed, inject, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useAudioStore } from '../stores/audioStore';
import { useVoiceStore } from '../stores/voiceStore';
import { useUserStore } from '../stores/userStore';
import { useConnectionDialog } from '../composables/useConnectionDialog';
import { useConnectionLogic } from '../composables/useConnectionLogic';

/**
 * Vue 3 ConnectDialog Component (Pure Vue - No Knockout)
/**
 * Uses Pinia stores and composables directly.
 * No more AppState compatibility layer.
 */

const config = inject('config', { connectDialog: {} });
const translate = inject('translate');
const auth = inject('auth');
const settings = inject('settings');

// Pinia stores
const audioStore = useAudioStore();
const voiceStore = useVoiceStore();
const userStore = useUserStore();

// Composables
const connectDialog = useConnectionDialog();
const connectionLogic = useConnectionLogic({ auth, settings });

/** @type {import('vue').Ref<HTMLDialogElement | null>} */
const dialogElement = ref(null);

/** @type {import('vue').Ref<HTMLDivElement | null>} */
const microphoneContainer = ref(null);

/** @type {import('vue').Ref<HTMLButtonElement | null>} */
const pianoButton = ref(null);

// Direct access to composable refs (already reactive)
const visible = computed({
  get: () => connectDialog.visible.value,
  set: (val) => { connectDialog.visible.value = val; }
});
const isTestActive = computed({
  get: () => connectDialog.isTestActive.value,
  set: (val) => { connectDialog.isTestActive.value = val; }
});
const address = computed({
  get: () => connectDialog.address.value,
  set: (val) => { connectDialog.address.value = val; }
});
const port = computed({
  get: () => connectDialog.port.value,
  set: (val) => { connectDialog.port.value = val; }
});
const username = computed({
  get: () => connectDialog.username.value,
  set: (val) => { connectDialog.username.value = val; }
});
const password = computed({
  get: () => connectDialog.password.value,
  set: (val) => { connectDialog.password.value = val; }
});

// Watch visible and sync with native dialog open/close
watch(visible, async (val) => {
  if (!dialogElement.value) return;
  // Wait for next tick to ensure dialog is in DOM
  await nextTick();
  if (val && !dialogElement.value.open) {
    dialogElement.value.showModal();
  } else if (!val && dialogElement.value.open) {
    dialogElement.value.close();
  }
});

// Computed state from Pinia stores (values are auto-unwrapped by Pinia)
const connected = computed(() => userStore.thisUser != null);
const isBeeping = computed(() => audioStore.isBeeping ?? false);

// Computed properties from Pinia store state
const beeperReady = computed(() => audioStore.beeperReady ?? false);
const voiceHandlerReady = computed(() => voiceStore.voiceHandlerReady ?? false);
const isLoopbackMode = computed(() => voiceStore.isLoopbackMode ?? false);
const dominantFrequency = computed(() => voiceStore.loopbackDominantFrequency ?? 0);

// Subscribe to Knockout observables
onMounted(() => {
  // Move the global audioSource select into the Vue component
  const audioSourceSelect = document.getElementById('audioSource');
  if (audioSourceSelect && microphoneContainer.value) {
    audioSourceSelect.style.display = 'block';
    microphoneContainer.value.appendChild(audioSourceSelect);
  }
  
  // Add passive touch event listeners to piano button for better mobile performance
  if (pianoButton.value) {
    pianoButton.value.addEventListener('touchstart', startBeep, { passive: true });
    pianoButton.value.addEventListener('touchend', stopBeep, { passive: true });
  }
});

// Always dispose subscriptions on unmount
onUnmounted(() => {
  // Remove passive touch event listeners
  if (pianoButton.value) {
    pianoButton.value.removeEventListener('touchstart', startBeep);
    pianoButton.value.removeEventListener('touchend', stopBeep);
  }
});

/**
 * Handle connect button click
 */
/**
 * Handle form submission (Connect button)
 */
async function handleConnect() {
  console.log('[ConnectDialog Vue] handleConnect() called');
  
  // If in test mode and connected: exit test mode and switch to normal mode
  if (isTestActive.value && connected.value) {
    console.log('[ConnectDialog Vue] Exiting test mode, switching to normal connection');
    isTestActive.value = false;
    voiceStore.isLoopbackMode = false;
    voiceStore.updateVoiceHandler();
    
    // Close dialog when switching from test to normal mode
    visible.value = false;
    return;
  }
  
  // Normal connection flow (not in test mode)
  if (!isTestActive.value) {
    // Hide dialog before connecting
    visible.value = false;
    
    console.log('[ConnectDialog Vue] Connecting in normal mode');
    await connectionLogic.connect(address.value, port.value, username.value, password.value);
  }
}

/**
 * Handle loopback toggle - ONE-WAY activation only
 */
async function handleToggleLoopback() {
  console.log('[ConnectDialog Vue] handleToggleLoopback() called, isTestActive:', isTestActive.value);
  
  // ONE-WAY: Only allow activation, not deactivation
  // Use "Exit Test Mode" button to deactivate
  if (isTestActive.value) {
    console.log('[ConnectDialog Vue] Test already active, ignoring toggle');
    return;
  }
  
  console.log('[ConnectDialog Vue] Activating test mode');
  isTestActive.value = true;
  await connectionLogic.connectLoopback(address.value, port.value, username.value, password.value);
}

/**
 * Exit test mode and show Guacamole
 */
async function handleExitTest() {
  console.log('[ConnectDialog Vue] handleExitTest() called');
  
  // Call connect() which will detect we're already connected and exit test mode
  await handleConnect();
}

/**
 * Start beep (Piano button pressed)
 */
function startBeep() {
  console.log('[ConnectDialog Vue] startBeep() called');
  if (audioStore?.startBeep) {
    console.log('[ConnectDialog Vue] Calling audioStore.startBeep()');
    audioStore.startBeep();
  } else {
    console.error('[ConnectDialog Vue] audioStore.startBeep not available');
  }
}

/**
 * Stop beep (Piano button released)
 */
function stopBeep() {
  console.log('[ConnectDialog Vue] stopBeep() called');
  if (audioStore?.stopBeep) {
    audioStore.stopBeep();
  }
}

/**
 * Handle hide
 */
function handleHide() {
  visible.value = false;
}
</script>

<style>
/* Component-specific styles removed - using theme.css styles instead */
/* Toggle switch styling, beep button, and dialog styles are all in theme.css */

/* Ensure dialog appears above toolbar and floats above everything */
/* Reset theme.css positioning to let native <dialog> handle centering */
.connect-dialog.dialog {
  position: fixed !important;
  top: 50% !important;
  left: 50% !important;
  transform: translate(-50%, -50%) !important;
  margin: 0 !important;
  z-index: 30 !important;
}

/* Dialog backdrop (dark overlay) */
dialog::backdrop {
  background: rgba(0, 0, 0, 0.5);
}
</style>
