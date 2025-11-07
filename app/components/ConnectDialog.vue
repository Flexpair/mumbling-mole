<template>
  <dialog
    ref="dialogElement"
    class="connect-dialog dialog"
    aria-labelledby="connect-dialog_title"
  >
    <div id="connect-dialog_title" class="dialog-header">Join audio conference</div>
    <form @submit.prevent="handleConnect">
      <table>
        <tbody>
          <tr v-if="config.connectDialog?.username">
            <th scope="row">
              <label for="username">Username</label>
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
              <label for="password">Password</label>
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
              <label for="audioSource">Microphone</label>
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
          <div 
            class="test-toggle-label"
            @click="handleToggleLoopback"
            style="height: 32px; display: inline-flex; align-items: center; cursor: pointer;"
          >
            <span
              class="test-toggle-slider"
              :class="{ active: isTestActive }"
            ></span>
            <span class="test-toggle-text" style="font-size: 1em; margin-left: 8px;">Audio Test</span>
          </div>
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
              :disabled="!beeperReady || !voiceHandlerReady"
              :aria-pressed="isBeeping ? 'true' : 'false'"
              aria-label="Test microphone with 440 Hz tone"
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
            <!-- DEBUG: Show when loopback mode is not active -->
            <div v-if="!isLoopbackMode" style="padding: 6px 12px; background-color: rgba(255, 0, 0, 0.1); border: 1px solid rgba(255, 0, 0, 0.3); border-radius: 4px; flex-shrink: 0; min-width: 120px; text-align: center; color: red; font-size: 0.9em;">
              DEBUG: isLoopbackMode = false
            </div>
          </div>
        </div>
      </div>

      <!-- Dialog Buttons - completely separate section -->
      <div class="dialog-buttons" style="display: block; width: 100%; clear: both; margin-top: 1em;">
        <input
          type="button"
          class="dialog-close"
          value="Cancel"
          @click="handleHide"
          disabled
          style="float: left;"
        />
        <input
          v-if="!isTestActive"
          type="submit"
          class="connect-dialog-submit"
          :value="connected ? 'Reconnect' : 'Connect'"
          style="float: right;"
        />
        <input
          v-else
          type="button"
          value="Connect"
          @click="handleExitTest"
          style="float: right;"
        />
      </div>
    </form>
  </dialog>
</template>

<script setup>
import { ref, computed, inject, onMounted, onUnmounted, watch } from 'vue';

/**
 * Vue 3 ConnectDialog Component (DUAL RUNTIME)
 * 
 * Integrates with existing Knockout AppState via provide/inject.
 * Uses AppState directly instead of props/emits for compatibility.
 */

// Inject AppState (from main app)
const appState = inject('appState');
const config = inject('config', { connectDialog: {} });

// Ref for dialog element
const dialogElement = ref(null);
// Ref for microphone container (to inject the global select element)
const microphoneContainer = ref(null);
// Ref for piano button (to add passive touch listeners)
const pianoButton = ref(null);

// Local reactive state (synced with appState.connectDialog)
const visible = ref(false);
const isTestActive = ref(false);
const address = ref('');
const port = ref('');
const username = ref('');
const password = ref('');

// Sync with Knockout observables
if (appState?.connectDialog) {
  // Initialize from Knockout state
  onMounted(() => {
    // Move the global audioSource select into the Vue component
    const audioSourceSelect = document.getElementById('audioSource');
    if (audioSourceSelect && microphoneContainer.value) {
      audioSourceSelect.style.display = 'block';
      microphoneContainer.value.appendChild(audioSourceSelect);
    }
    
    visible.value = appState.connectDialog.visible();
    isTestActive.value = appState.connectDialog.isTestActive();
    address.value = appState.connectDialog.address();
    port.value = appState.connectDialog.port();
    username.value = appState.connectDialog.username();
    password.value = appState.connectDialog.password();
    
    // Subscribe to Knockout observable changes
    appState.connectDialog.visible.subscribe((val) => {
      visible.value = val;
    });
    appState.connectDialog.isTestActive.subscribe((val) => {
      isTestActive.value = val;
    });
    appState.connectDialog.username.subscribe((val) => {
      username.value = val;
    });
  });
  
  // Sync Vue changes back to Knockout
  watch(visible, (val) => appState.connectDialog.visible(val));
  watch(isTestActive, (val) => appState.connectDialog.isTestActive(val));
  watch(address, (val) => appState.connectDialog.address(val));
  watch(port, (val) => appState.connectDialog.port(val));
  watch(username, (val) => appState.connectDialog.username(val));
  watch(password, (val) => appState.connectDialog.password(val));
  
  // Watch visible and sync with native dialog open/close
  watch(visible, (val) => {
    if (!dialogElement.value) return;
    if (val && !dialogElement.value.open) {
      dialogElement.value.showModal();
    } else if (!val && dialogElement.value.open) {
      dialogElement.value.close();
    }
  });
}

// Computed state from AppState
const connected = computed(() => appState?.connected() ?? false);
const isBeeping = computed(() => appState?.audio?.isBeeping() ?? false);

// Reactive refs for Knockout observables (updated via subscriptions)
const beeperReady = ref(false);
const voiceHandlerReady = ref(false);
const isLoopbackMode = ref(false); // Changed from computed to ref with subscription
const dominantFrequency = ref(0); // Changed from computed to ref with subscription

// Knockout subscriptions (for cleanup)
let sub1, sub2, sub3, sub4;

// Subscribe to Knockout observables
onMounted(() => {
  // Add passive touch event listeners to piano button for better mobile performance
  if (pianoButton.value) {
    pianoButton.value.addEventListener('touchstart', startBeep, { passive: true });
    pianoButton.value.addEventListener('touchend', stopBeep, { passive: true });
  }
  
  if (appState?.audio?.beeperReady) {
    beeperReady.value = appState.audio.beeperReady();
    sub1 = appState.audio.beeperReady.subscribe((val) => {
      beeperReady.value = val;
    });
  }
  
  if (appState?.voice?.voiceHandlerReady) {
    voiceHandlerReady.value = appState.voice.voiceHandlerReady();
    sub2 = appState.voice.voiceHandlerReady.subscribe((val) => {
      voiceHandlerReady.value = val;
    });
  }
  
  // Subscribe to isLoopbackMode
  if (appState?.voice?.isLoopbackMode) {
    isLoopbackMode.value = appState.voice.isLoopbackMode();
    sub3 = appState.voice.isLoopbackMode.subscribe((val) => {
      console.log('[ConnectDialog Vue] isLoopbackMode changed to:', val);
      isLoopbackMode.value = val;
    });
  }
  
  // Subscribe to loopbackDominantFrequency
  if (appState?.voice?.loopbackDominantFrequency) {
    dominantFrequency.value = appState.voice.loopbackDominantFrequency();
    sub4 = appState.voice.loopbackDominantFrequency.subscribe((freq) => {
      dominantFrequency.value = freq;
    });
  }
});

// Always dispose subscriptions on unmount
onUnmounted(() => {
  // Remove passive touch event listeners
  if (pianoButton.value) {
    pianoButton.value.removeEventListener('touchstart', startBeep);
    pianoButton.value.removeEventListener('touchend', stopBeep);
  }
  
  if (sub1) sub1.dispose();
  if (sub2) sub2.dispose();
  if (sub3) sub3.dispose();
  if (sub4) sub4.dispose();
});

/**
 * Handle connect button click
 */
/**
 * Handle form submission (Connect button)
 */
function handleConnect() {
  console.log('[ConnectDialog Vue] handleConnect() called');
  console.log('[ConnectDialog Vue] appState:', appState);
  console.log('[ConnectDialog Vue] appState.connectDialog:', appState?.connectDialog);
  console.log('[ConnectDialog Vue] appState.connectDialog.connect:', appState?.connectDialog?.connect);
  
  // Delegate to Knockout ConnectDialog.connect()
  if (appState?.connectDialog?.connect) {
    console.log('[ConnectDialog Vue] Calling appState.connectDialog.connect()');
    appState.connectDialog.connect();
  } else {
    console.error('[ConnectDialog Vue] appState.connectDialog.connect not available!');
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
  
  // Delegate to Knockout ConnectDialog.toggleLoopback()
  if (appState?.connectDialog?.toggleLoopback) {
    console.log('[ConnectDialog Vue] Activating test mode');
    await appState.connectDialog.toggleLoopback();
  }
}

/**
 * Exit test mode and show Guacamole
 */
async function handleExitTest() {
  console.log('[ConnectDialog Vue] handleExitTest() called');
  
  // Delegate to the same logic as connect() when in test mode
  // This will exit test mode and show Guacamole
  if (appState?.connectDialog?.connect) {
    console.log('[ConnectDialog Vue] Calling connect() to exit test and show Guacamole');
    
    // Ensure isTestActive is true so connect() takes the right path
    if (!appState.connectDialog.isTestActive()) {
      console.warn('[ConnectDialog Vue] isTestActive is false, setting it to true');
      appState.connectDialog.isTestActive(true);
    }
    
    await appState.connectDialog.connect();
  }
}

/**
 * Start beep (Piano button pressed)
 */
function startBeep() {
  console.log('[ConnectDialog Vue] startBeep() called');
  if (appState?.startBeep) {
    console.log('[ConnectDialog Vue] Calling appState.startBeep()');
    appState.startBeep();
  } else {
    console.error('[ConnectDialog Vue] appState.startBeep not available');
  }
}

/**
 * Stop beep (Piano button released)
 */
function stopBeep() {
  console.log('[ConnectDialog Vue] stopBeep() called');
  if (appState?.stopBeep) {
    appState.stopBeep();
  }
}

/**
 * Handle hide
 */
function handleHide() {
  if (appState?.connectDialog?.hide) {
    appState.connectDialog.hide();
  }
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
