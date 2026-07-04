<template>
  <Teleport to="body">
    <dialog
      ref="dialogElement"
      class="connect-dialog dialog"
      aria-labelledby="connect-dialog_title"
      aria-describedby="headphones-recommendation"
      @cancel.prevent
    >
    <h2 id="connect-dialog_title" class="dialog-header">{{ translate('connectdialog.title') }}</h2>
    <form @submit.prevent="handleConnect">
      <div class="form-fields">
        <div v-if="config.connectDialog?.username" class="form-field">
          <label for="username">{{ translate('connectdialog.username') }}</label>
          <input
            id="username"
            v-model="username"
            type="text"
            readonly
            required
            aria-readonly="true"
          />
        </div>
        <div v-if="config.connectDialog?.password" class="form-field">
          <label for="password">{{ translate('connectdialog.password') }}</label>
          <input
            id="password"
            v-model="password"
            type="password"
            autocomplete="current-password"
          />
        </div>
        <div class="form-field">
          <label for="audioSource">{{ translate('connectdialog.microphone') }}</label>
          <!-- Placeholder for audioSource select (moved here via script) -->
          <div ref="microphoneContainer"></div>
        </div>
      </div>

      <p id="headphones-recommendation" style="margin: 0.5em 0;">
        We recommend using headphones <span aria-hidden="true">🎧</span> for the best audio experience.
      </p>

      <!-- Loopback Test Section (clear both floats) -->
      <fieldset class="loopback-test-section" style="clear: both; border: none; padding: 0; margin: 0;">
        <legend class="sr-only">Audio Test Controls</legend>
        <div class="test-toggle-container">
          <button 
            type="button"
            class="test-toggle-label"
            @click="handleToggleLoopback"
            :aria-pressed="isTestActive || isLoopbackMode"
            aria-describedby="audio-test-description"
            style="height: 32px; display: inline-flex; align-items: center; cursor: pointer; background: none; border: none; padding: 0; color: inherit; font: inherit;"
          >
            <span
              class="test-toggle-slider"
              :class="{ active: isTestActive || isLoopbackMode }"
              aria-hidden="true"
            ></span>
            <span class="test-toggle-text" style="font-size: 1em; margin-left: 8px;">Audio Test</span>
          </button>
          <span id="audio-test-description" class="sr-only">Toggle audio test mode to verify your microphone and speakers</span>
        </div>

        <!-- Piano Button and Frequency Display Row -->
        <!-- Fixed height container to prevent layout shifts -->
        <div style="min-height: 40px; margin-top: 8px;">
          <div v-if="isTestActive" style="display: flex; align-items: center; gap: 10px;">
            <!-- Piano Button (Beeper) - disabled until audio pipeline is ready -->
            <button
              ref="pianoButton"
              type="button"
              class="beep-test-button"
              @mousedown="startBeep"
              @mouseup="stopBeep"
              @mouseleave="stopBeep"
              @keydown.space.prevent="startBeep"
              @keyup.space.prevent="stopBeep"
              @keydown.enter.prevent="startBeep"
              @keyup.enter.prevent="stopBeep"
              :disabled="!pianoButtonReady"
              :class="{ active: isBeeping, disabled: !pianoButtonReady }"
              :aria-pressed="isBeeping ? 'true' : 'false'"
              :aria-describedby="pianoButtonReady ? 'piano-ready-hint' : 'piano-loading-hint'"
              style="height: 32px; padding: 4px 8px; white-space: nowrap; flex-shrink: 0; font-size: 1em;"
            >
              <span aria-hidden="true" style="font-size: 1.2em;">🎹</span> 
              {{ pianoButtonReady ? 'Play an A (440 Hz)' : 'Initializing...' }}
            </button>
            <span v-if="pianoButtonReady" id="piano-ready-hint" class="sr-only">Hold button or press Space or Enter to play a 440 Hertz test tone</span>
            <span v-else id="piano-loading-hint" class="sr-only">Audio system is initializing, please wait</span>

            <!-- Frequency Display with fixed width -->
            <output
              v-if="isLoopbackMode"
              class="loopback-frequency-display"
              style="padding: 6px 12px; background-color: rgba(21, 120, 120, 0.1); border: 1px solid rgba(21, 120, 120, 0.3); border-radius: 4px; flex-shrink: 0; min-width: 120px; text-align: center;"
              aria-live="polite"
              aria-atomic="true"
            >
              <span style="font-weight: bold; color: #157878;" aria-hidden="true">📊</span>
              <span style="font-size: 1.1em; font-weight: bold; color: #157878; margin-left: 4px; font-variant-numeric: tabular-nums;">
                {{ dominantFrequency > 0 ? dominantFrequency + ' Hz' : '--- Hz' }}
              </span>
              <span class="sr-only">
                {{ dominantFrequency > 0 ? 'Detected frequency: ' + dominantFrequency + ' Hertz' : 'No frequency detected' }}
              </span>
            </output>
          </div>
        </div>
      </fieldset>

      <!-- Dialog Buttons - completely separate section -->
      <div class="dialog-buttons">
        <input
          type="submit"
          class="connect-dialog-submit"
          :value="isTestActive && connected ? 'Exit Test & Connect' : 'Connect'"
          :aria-label="(isTestActive && connected ? 'Exit Test & Connect' : 'Connect') + ' to voice server'"
        />
        <button
          v-if="auth?.logout && username"
          type="button"
          class="dialog-logout-button"
          @click="handleLogout"
          :aria-label="translate('connectdialog.logout') + ' of application'"
        >
          {{ translate('connectdialog.logout') }}
        </button>
      </div>
    </form>
    </dialog>
  </Teleport>
</template>

<script setup>
import { computed, inject, onMounted, onUnmounted, watch, nextTick, useTemplateRef, toRefs } from 'vue';
import { storeToRefs } from 'pinia';
import { useAudioStore } from '../stores/audioStore';
import { useVoiceStore } from '../stores/voiceStore';
import { useUserStore } from '../stores/userStore';
import { useUIStore } from '../stores/uiStore';
import { useDialogStore } from '../stores/dialogStore';
import { useConnectionLogic } from '../composables/useConnectionLogic';
import { announceToScreenReader } from '../composables/useAccessibility';

/**
 * Vue 3 ConnectDialog Component (Pure Vue - No Knockout)
/**
 * Uses Pinia stores directly.
 * No more AppState compatibility layer or singleton composables.
 */

const config = inject('config', { connectDialog: {} });
const translate = inject('translate');
const auth = inject('auth');

// Pinia stores
const audioStore = useAudioStore();
const voiceStore = useVoiceStore();
const userStore = useUserStore();
const dialogStore = useDialogStore();

// Composables (for connection logic only)
const connectionLogic = useConnectionLogic({ auth });

/** @type {import('vue').Ref<HTMLDialogElement | null>} */
const dialogElement = useTemplateRef('dialogElement');

/** @type {import('vue').Ref<HTMLDivElement | null>} */
const microphoneContainer = useTemplateRef('microphoneContainer');

/** @type {import('vue').Ref<HTMLButtonElement | null>} */
const pianoButton = useTemplateRef('pianoButton');

// Use toRefs to get reactive refs from nested dialog store object
const { visible, isTestActive, address, port, username, password } = toRefs(dialogStore.connectDialog);

// Watch visible and sync with native dialog open/close
watch(visible, async (val) => {
  if (!dialogElement.value) return;
  // Wait for next tick to ensure dialog is in DOM
  await nextTick();
  if (val && !dialogElement.value.open) {
    dialogElement.value.showModal();
    // Focus first focusable element for accessibility
    await nextTick();
    const firstFocusable = dialogElement.value.querySelector('input:not([readonly]), button:not([disabled]), select');
    if (firstFocusable) {
      firstFocusable.focus();
    }
    // Announce dialog opening to screen readers
    announceToScreenReader('Connect dialog opened');
  } else if (!val && dialogElement.value.open) {
    dialogElement.value.close();
    announceToScreenReader('Dialog closed');
  }
});

// Reactive refs from Pinia stores (storeToRefs preserves reactivity)
const { isBeeping, beeperReady } = storeToRefs(audioStore);
const { voiceHandlerReady, isLoopbackMode, loopbackDominantFrequency: dominantFrequency } = storeToRefs(voiceStore);

// Computed for derived state (requires logic)
const connected = computed(() => userStore.thisUser != null);

// Piano button is ready when voice handler AND beeper are both initialized
const pianoButtonReady = computed(() => voiceHandlerReady.value && beeperReady.value);

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
  // If in test mode and connected: exit test mode and switch to normal mode
  if (isTestActive.value && connected.value) {
    isTestActive.value = false;
    voiceStore.isLoopbackMode = false;
    
    // Update voice handler to switch from loopback (target=31) to normal (target=0)
    connectionLogic.updateVoiceHandler();
    
    // Setup and show Guacamole frame when exiting test mode
    const uiStore = useUIStore();
    if (uiStore.guacamoleFrame) {
      // Get user roles to determine Guacamole access
      const user_roles = (auth?.currentUser()?.app_metadata?.roles) || [];
      const guac_login = connectionLogic.getGuacamoleLogin(user_roles);
      
      if (guac_login) {
        uiStore.guacamoleFrame.start(guac_login, password.value);
        uiStore.guacamoleFrame.show();
      } else {
        alert('For visual access please ask your administrator.');
      }
    }
    
    // Close dialog when switching from test to normal mode
    visible.value = false;
    return;
  }
  
  // Normal connection flow (not in test mode)
  if (!isTestActive.value) {
    // Hide dialog before connecting
    visible.value = false;
    
    await connectionLogic.connect(address.value, port.value, username.value, password.value);
  }
}

/**
 * Handle loopback toggle - ONE-WAY activation only
 */
async function handleToggleLoopback() {
  // ONE-WAY: Only allow activation, not deactivation
  // Use "Exit Test Mode" button to deactivate
  if (isTestActive.value) {
    return;
  }

  isTestActive.value = true;
  await connectionLogic.connectLoopback(address.value, port.value, username.value, password.value);
}

/**
 * Exit test mode and show Guacamole
 */
async function handleExitTest() {
  // Call connect() which will detect we're already connected and exit test mode
  await handleConnect();
}

/**
 * Start beep (Piano button pressed)
 * Guard: Only starts beep if audio pipeline is fully ready (voiceHandler + beeper initialized)
 */
function startBeep() {
  // Guard: Prevent beep if audio pipeline not ready
  if (!pianoButtonReady.value) {
    return;
  }

  if (audioStore?.startBeep) {
    audioStore.startBeep();
  }
}

/**
 * Stop beep (Piano button released)
 */
function stopBeep() {
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

async function handleLogout() {
  try {
    const { clearCredentials } = await import('../auth/credentials-service.js');
    clearCredentials();
    await auth.logout();
  } catch (error) {
    console.error('[ConnectDialog Vue] Logout failed', error);
  } finally {
    location.reload();
  }
}

// Note: Escape key is intentionally disabled for Connect Dialog
// User must connect to proceed - dialog cannot be dismissed
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

/* Piano button disabled state while audio initializing */
.beep-test-button.disabled,
.beep-test-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background-color: #ccc !important;
}
</style>
