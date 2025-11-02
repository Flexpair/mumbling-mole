<template>
  <div class="connect-dialog dialog" v-show="visible">
    <div class="dialog-header">{{ $t('connectdialog.title') }}</div>
    <form @submit.prevent="handleConnect">
      <table>
        <tbody>
          <tr>
            <td class="label">{{ $t('connectdialog.address') }}</td>
            <td>
              <input
                v-model="formData.address"
                type="text"
                class="dialog-input"
                autofocus
              />
            </td>
          </tr>
          <tr>
            <td class="label">{{ $t('connectdialog.port') }}</td>
            <td>
              <input
                v-model.number="formData.port"
                type="number"
                class="dialog-input"
              />
            </td>
          </tr>
          <tr v-if="config.connectDialog.username">
            <td class="label">{{ $t('connectdialog.username') }}</td>
            <td>
              <input
                v-model="formData.username"
                type="text"
                class="dialog-input"
              />
            </td>
          </tr>
          <tr v-if="config.connectDialog.password">
            <td class="label">{{ $t('connectdialog.password') }}</td>
            <td>
              <input
                v-model="formData.password"
                type="password"
                class="dialog-input"
              />
            </td>
          </tr>
        </tbody>
      </table>

      <div class="loopback-test-section">
        <div class="test-toggle-container">
          <label class="test-toggle-label">
            <input
              type="checkbox"
              class="test-toggle-checkbox"
              :checked="isTestActive"
              @click="handleToggleLoopback"
              :disabled="isTestActive"
            />
            <span
              class="test-toggle-slider"
              :class="{ active: isTestActive }"
            ></span>
            <span class="test-toggle-text">{{ $t('connectdialog.loopback_test') }}</span>
          </label>
        </div>

        <div
          v-if="isTestActive && isLoopbackMode"
          class="frequency-display"
        >
          <span style="font-weight: bold; color: #0096ff;">📊</span>
          <span
            v-if="dominantFrequency > 0"
            style="font-size: 1.1em; font-weight: bold; color: #0066cc;"
          >
            {{ dominantFrequency }} Hz
          </span>
        </div>
      </div>

      <div class="dialog-buttons">
        <input
          type="button"
          class="dialog-close"
          :value="$t('connectdialog.cancel')"
          @click="handleHide"
        />
        <input
          type="submit"
          :value="connected ? $t('connectdialog.reconnect') : $t('connectdialog.connect')"
        />
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, reactive, computed, inject, watch } from 'vue';

/**
 * Vue 3 ConnectDialog Component (PROTOTYPE)
 * 
 * This is a proof-of-concept Vue component to validate the migration strategy.
 * It demonstrates:
 * - Composition API usage
 * - Reactive state management with ref/reactive
 * - Two-way binding with v-model
 * - Event handling with @click/@submit
 * - Computed properties
 * - Integration with existing AppState (via provide/inject)
 * 
 * Migration from Knockout:
 * - ko.observable() → ref()
 * - data-bind="visible" → v-show
 * - data-bind="value" → v-model
 * - data-bind="click" → @click
 * - data-bind="submit" → @submit.prevent
 * - ko.pureComputed() → computed()
 */

// Props
const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  isTestActive: {
    type: Boolean,
    default: false
  }
});

// Emits
const emit = defineEmits(['update:visible', 'update:isTestActive', 'connect', 'connectLoopback']);

// Inject AppState (from main app)
const appState = inject('appState', null);
const config = inject('config', { connectDialog: {} });

// Form data
const formData = reactive({
  address: '',
  port: '',
  username: '',
  password: ''
});

// Computed state from AppState (if available)
const connected = computed(() => appState?.connected() ?? false);
const isLoopbackMode = computed(() => appState?.voice?.isLoopbackMode() ?? false);
const dominantFrequency = computed(() => appState?.voice?.loopbackDominantFrequency() ?? 0);

// Watch appState observables (Knockout compatibility layer)
if (appState) {
  // Subscribe to AppState changes
  // In pure Vue app, this wouldn't be needed
  watch(
    () => appState.connected(),
    (newVal) => {
      console.log('[Vue ConnectDialog] Connected state changed:', newVal);
    }
  );
}

/**
 * Handle connect button click
 */
function handleConnect() {
  emit('update:visible', false);
  
  if (connected.value) {
    // Exit loopback mode
    emit('update:isTestActive', false);
    if (appState) {
      appState.voice.isLoopbackMode(false);
      appState._updateVoiceHandler();
      
      if (appState._guacLogin) {
        appState.guacamoleFrame.loading(false);
        appState.guacamoleFrame.start(appState._guacLogin, appState._guacPassword);
        appState.guacamoleFrame.show();
      }
    }
  } else {
    // Normal connect
    emit('update:isTestActive', false);
    emit('connect', {
      address: formData.address,
      port: formData.port,
      username: formData.username,
      password: formData.password
    });
  }
}

/**
 * Handle loopback toggle
 */
async function handleToggleLoopback(event) {
  // Prevent if already active
  if (props.isTestActive) {
    event.preventDefault();
    return;
  }
  
  // Ensure AudioContext is ready (user gesture)
  if (appState?.audio) {
    try {
      if (appState.audio.audioContextManager) {
        appState.audio.audioContextManager.userInteractionDetected = true;
      }
      
      if (!appState.audio.audioContext) {
        console.log('[Vue LOOPBACK] Creating AudioContext on user click');
        await appState.audio.initializeAudioContext();
      }
      
      if (appState.audio.audioContext?.state === 'suspended') {
        console.log('[Vue LOOPBACK] Resuming AudioContext on user click');
        await appState.audio.audioContext.resume();
      }
      
      console.log('[Vue LOOPBACK] AudioContext ready:', appState.audio.audioContext.state);
    } catch (err) {
      console.error('[Vue LOOPBACK] Failed to prepare AudioContext:', err);
    }
  }
  
  emit('update:isTestActive', true);
  emit('connectLoopback', {
    address: formData.address,
    port: formData.port,
    username: formData.username,
    password: formData.password
  });
}

/**
 * Handle hide
 */
function handleHide() {
  emit('update:visible', false);
}

/**
 * Public API (for parent access)
 */
defineExpose({
  formData,
  handleConnect,
  handleToggleLoopback
});
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
