<template>
  <div class="connect-dialog dialog" v-show="visible">
    <div class="dialog-header">Join audio conference</div>
    <form @submit.prevent="handleConnect">
      <table>
        <tbody>
          <tr v-if="config.connectDialog?.username">
            <td class="label">Username</td>
            <td>
              <input
                v-model="username"
                type="text"
                class="dialog-input"
                readonly
                required
              />
            </td>
          </tr>
          <tr v-if="config.connectDialog?.password">
            <td class="label">Password</td>
            <td>
              <input
                v-model="password"
                type="password"
                class="dialog-input"
              />
            </td>
          </tr>
          <tr>
            <td class="label">Microphone</td>
            <td>
              <!-- Placeholder for audioSource select (moved here via script) -->
              <div ref="microphoneContainer"></div>
            </td>
          </tr>
        </tbody>
      </table>

      <p style="margin: 0.5em 0;">Please use headphones. Thank you.</p>

      <!-- Loopback Test Section (clear both floats) -->
      <div class="loopback-test-section" style="clear: both;">
        <div class="test-toggle-container">
          <div 
            class="test-toggle-label"
            @click="handleToggleLoopback"
            style="height: 32px; display: inline-flex; align-items: center; cursor: pointer;"
          >
            <span class="test-toggle-text" style="font-size: 1em;">Audio Test</span>
            <span
              class="test-toggle-slider"
              :class="{ active: isTestActive }"
            ></span>
          </div>
        </div>

        <!-- Piano Button and Frequency Display Row -->
        <div v-if="isTestActive" style="display: flex; align-items: center; gap: 10px; margin-top: 8px; clear: both;">
          <!-- Piano Button (Beeper) -->
          <button
            type="button"
            class="beep-test-button"
            @mousedown="startBeep"
            @mouseup="stopBeep"
            @mouseleave="stopBeep"
            @touchstart="startBeep"
            @touchend="stopBeep"
            :class="{ active: isBeeping }"
            :disabled="!beeperReady || !voiceHandlerReady"
            style="height: 32px; padding: 4px 8px; white-space: nowrap; flex-shrink: 0; font-size: 1em;"
          >
            <span style="font-size: 1.2em;">🎹</span> Play an A (440 Hz)
          </button>

          <!-- Frequency Display -->
          <div
            v-if="isLoopbackMode"
            class="loopback-frequency-display"
            style="padding: 6px 12px; background-color: rgba(0, 150, 255, 0.1); border: 1px solid rgba(0, 150, 255, 0.3); border-radius: 4px; flex-shrink: 0;"
          >
            <span style="font-weight: bold; color: #0096ff;">📊</span>
            <span style="font-size: 1.1em; font-weight: bold; color: #0066cc; margin-left: 4px;">
              {{ dominantFrequency > 0 ? dominantFrequency + ' Hz' : '--- Hz' }}
            </span>
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
  </div>
</template>

<script setup>
import { ref, reactive, computed, inject, onMounted, onUnmounted, watch } from 'vue';

/**
 * Vue 3 ConnectDialog Component (DUAL RUNTIME)
 * 
 * Integrates with existing Knockout AppState via provide/inject.
 * Uses AppState directly instead of props/emits for compatibility.
 */

// Inject AppState (from main app)
const appState = inject('appState');
const config = inject('config', { connectDialog: {} });

// Ref for microphone container (to inject the global select element)
const microphoneContainer = ref(null);

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
}

// Computed state from AppState
const connected = computed(() => appState?.connected() ?? false);
const isLoopbackMode = computed(() => appState?.voice?.isLoopbackMode() ?? false);
const isBeeping = computed(() => appState?.audio?.isBeeping() ?? false);

// Reactive refs for Knockout observables (updated via subscriptions)
const beeperReady = ref(false);
const voiceHandlerReady = ref(false);
const dominantFrequency = ref(0); // Changed from computed to ref with subscription

// Subscribe to Knockout observables
onMounted(() => {
  if (appState?.audio?.beeperReady) {
    beeperReady.value = appState.audio.beeperReady();
    const sub1 = appState.audio.beeperReady.subscribe((val) => {
      beeperReady.value = val;
    });
    onUnmounted(() => sub1.dispose());
  }
  
  if (appState?.voice?.voiceHandlerReady) {
    voiceHandlerReady.value = appState.voice.voiceHandlerReady();
    const sub2 = appState.voice.voiceHandlerReady.subscribe((val) => {
      voiceHandlerReady.value = val;
    });
    onUnmounted(() => sub2.dispose());
  }
  
  // Subscribe to loopbackDominantFrequency
  if (appState?.voice?.loopbackDominantFrequency) {
    dominantFrequency.value = appState.voice.loopbackDominantFrequency();
    const sub3 = appState.voice.loopbackDominantFrequency.subscribe((freq) => {
      dominantFrequency.value = freq;
    });
    onUnmounted(() => sub3.dispose());
  }
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

<style scoped>
/* Component-specific styles */
.loopback-test-section {
  margin-top: 10px;
  padding: 10px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
}

.test-toggle-container {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.test-toggle-label {
  display: flex;
  align-items: center;
  cursor: pointer;
  user-select: none;
}

.test-toggle-checkbox {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.test-toggle-slider {
  width: 40px;
  height: 20px;
  background: #ccc;
  border-radius: 10px;
  position: relative;
  transition: background 0.3s;
  margin-right: 8px;
}

.test-toggle-slider.active {
  background: #0096ff;
}

.test-toggle-slider::after {
  content: '';
  position: absolute;
  width: 16px;
  height: 16px;
  background: white;
  border-radius: 50%;
  top: 2px;
  left: 2px;
  transition: left 0.3s;
}

.test-toggle-slider.active::after {
  left: 22px;
}

.test-toggle-text {
  font-weight: 500;
}

.frequency-display {
  margin-top: 8px;
  font-size: 0.9em;
  color: #0096ff;
}
</style>
