<template>
  <Teleport to="body">
    <dialog
      ref="dialogElement"
      class="settings-dialog dialog"
      aria-labelledby="settings-dialog_title"
    >
    <div id="settings-dialog_title" class="dialog-header">
      {{ t('settingsdialog.title') }}
    </div>
    <form @submit.prevent="handleSubmit">
      <table>
        <thead>
          <tr>
            <th
              scope="col"
              style="position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden;"
            >
              {{ t('settingsdialog.setting') }}
            </th>
            <th
              scope="col"
              style="position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden;"
            >
              {{ t('settingsdialog.control') }}
            </th>
          </tr>
        </thead>
        <tbody>
          <!-- Transmission Mode -->
          <tr>
            <td id="settings-dialog_transmission">
              {{ t('settingsdialog.transmission') }}
            </td>
            <td>
              <select v-model="voiceMode">
                <option id="settings-dialog_cont" value="cont">
                  {{ t('settingsdialog.cont') }}
                </option>
                <option id="settings-dialog_ptt" value="ptt">
                  {{ t('settingsdialog.ptt') }}
                </option>
              </select>
            </td>
          </tr>

          <!-- PTT Key (only visible when PTT mode selected) -->
          <tr v-if="voiceMode === 'ptt'">
            <td id="settings-dialog_ptt_key">
              {{ t('settingsdialog.ptt_key') }}
            </td>
            <td>
              <input
                type="button"
                :value="pttKeyDisplay"
                @click="recordPttKey"
              />
            </td>
          </tr>

          <!-- Audio Quality -->
          <tr>
            <td id="settings-dialog_audio_quality">
              {{ t('settingsdialog.audio_quality') }}
            </td>
            <td>
              <span>{{ (audioBitrate / 1000).toFixed(1) }}</span> kbit/s
              <span v-if="isServerLimited && actualBitrate < audioBitrate" class="actual-bitrate-note">
                (actual: {{ (actualBitrate / 1000).toFixed(1) }} kbit/s)
              </span>
            </td>
          </tr>

          <!-- Audio Quality Slider -->
          <tr>
            <td colspan="2">
              <input
                type="range"
                min="8000"
                :max="maxAllowedBitrate"
                step="8"
                v-model.number="audioBitrate"
              />
              <small v-if="isServerLimited" class="server-limit-note">
                Limited by server maximum ({{ (maxAllowedBitrate / 1000).toFixed(0) }} kbit/s)
              </small>
            </td>
          </tr>

          <!-- Audio per Packet -->
          <tr>
            <td id="settings-dialog_packet">
              {{ t('settingsdialog.packet') }}
            </td>
            <td><span>{{ msPerPacket }}</span> ms (fixed)</td>
          </tr>

          <!-- Audio per Packet Slider - DISABLED: Architecture constraint -->
          <!-- The audio pipeline is hard-coded for 960 samples (20ms @ 48kHz).
               Changing this requires coordinated updates across:
               - AudioWorklet processor (recorder-worker.js)
               - Worker resampler (worker.js)
               - Opus codec configuration
               - Settings serialization
               See: app/audio/README.md for details -->
          <tr style="display: none;">
            <td colspan="2">
              <input
                type="range"
                min="20"
                max="20"
                step="10"
                v-model.number="msPerPacket"
                disabled
              />
            </td>
          </tr>

          <!-- Jitter Buffer -->
          <tr>
            <td id="settings-dialog_jitter_buffer">
              {{ t('settingsdialog.jitter_buffer') }}
            </td>
            <td>
              <select v-model="jitterBufferMode" aria-labelledby="settings-dialog_jitter_buffer">
                <option value="low-latency">Low Latency</option>
                <option value="balanced">Balanced</option>
                <option value="high-quality">High Quality</option>
              </select>
            </td>
          </tr>
          <tr>
            <td colspan="2">
              <div class="settings-help-text">
                Current buffer: {{ jitterBufferMs }} ms (Dynamic)
              </div>
            </td>
          </tr>

          <!-- Bandwidth Info with tooltips -->
          <tr>
            <td colspan="2" class="bandwidth-info">
              <span class="bandwidth-total">{{ (totalBandwidth / 1000).toFixed(1) }}</span> kbit/s total
              <br>
              <small class="bandwidth-detail">
                (<span title="Opus audio codec bitrate">Audio {{ (audioBitrate / 1000).toFixed(1) }}</span> + 
                <span 
                  title="Protocol overhead: packet headers, encryption, framing, and reliability mechanisms"
                  class="bandwidth-overhead"
                >Overhead {{ (overheadBandwidth / 1000).toFixed(1) }}</span> kbit/s)
              </small>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="dialog-footer">
        <input
          id="settings-dialog_close"
          class="dialog-close"
          type="button"
          :value="t('settingsdialog.close')"
          @click="handleCancel"
        />
        <input
          id="settings-dialog_submit"
          class="dialog-submit"
          type="submit"
          :value="t('settingsdialog.submit')"
        />
      </div>
    </form>
    </dialog>
  </Teleport>
</template>

<script setup>
import { ref, computed, inject, watch, onMounted, onBeforeUnmount } from 'vue';
import keyboardjs from 'keyboardjs';

/**
 * SettingsDialog Component
 * 
 * Audio settings configuration with reactive bitrate limits from server.
 * Integrates with AppState.settings composable for persistent configuration.
 */

// Inject AppState from the main app
const appState = inject('appState');

// Translation helper
const t = inject('translate');

/** @type {import('vue').Ref<boolean>} */
const visible = ref(false);

/** @type {import('vue').Ref<HTMLDialogElement | null>} */
const dialogElement = ref(null);

// Form state - writable computed that point to AppState.settings Vue refs
const voiceMode = computed({
  get: () => appState.settings.voiceMode.value,
  set: (val) => { appState.settings.voiceMode.value = val; }
});

const pttKey = computed({
  get: () => appState.settings.pttKey.value,
  set: (val) => { appState.settings.pttKey.value = val; }
});

const pttKeyDisplay = computed({
  get: () => appState.settings.pttKeyDisplay.value,
  set: (val) => { appState.settings.pttKeyDisplay.value = val; }
});

const audioBitrate = computed({
  get: () => appState.settings.audioBitrate.value,
  set: (val) => { appState.settings.audioBitrate.value = val; }
});

const samplesPerPacket = computed({
  get: () => appState.settings.samplesPerPacket.value,
  set: (val) => { appState.settings.samplesPerPacket.value = val; }
});

const msPerPacket = computed({
  get: () => samplesPerPacket.value / 48,
  set: (val) => { samplesPerPacket.value = val * 48; }
});

const jitterBufferSize = computed({
  get: () => appState.settings.jitterBufferSize.value,
  set: (val) => { appState.settings.jitterBufferSize.value = val; }
});

const jitterBufferMode = computed({
  get: () => appState.settings.jitterBufferMode.value,
  set: (val) => { appState.settings.jitterBufferMode.value = val; }
});

const MS_PER_PACKET = 20; // 20ms per packet at 48kHz (960 samples)

const jitterBufferMs = computed(() => jitterBufferSize.value * MS_PER_PACKET);

// Computed: Bandwidth calculations (from AppState.settings)
const totalBandwidth = computed(() => appState.settings.totalBandwidth.value);
const positionBandwidth = computed(() => appState.settings.positionBandwidth.value);
const overheadBandwidth = computed(() => appState.settings.overheadBandwidth.value);

// Calculate maximum allowed bitrate based on server configuration
const maxAllowedBitrate = computed(() => {
  // Force reactivity by checking if connected (thisUser is reactive)
  const isConnected = appState.user?.thisUser.value != null;
  const client = isConnected ? appState.client : null;
  
  if (!client || client.maxBandwidth === undefined || client.maxBandwidth === null) {
    // Not connected or server doesn't limit bandwidth - use client default
    return 96000;
  }
  
  // Server has a bandwidth limit - calculate max bitrate with current packet size
  const spp = appState.settings.samplesPerPacket.value;
  const maxBitrate = client.getMaxBitrate(spp, false);
  
  // Round down to nearest 100 for finer control while keeping UI clean
  return Math.floor(maxBitrate / 100) * 100;
});

// Check if server is limiting the bitrate
const isServerLimited = computed(() => {
  const client = appState?.client;
  return client?.maxBandwidth != null && maxAllowedBitrate.value < 96000;
});

// Calculate actual bitrate that will be used (considering server limits)
const actualBitrate = computed(() => {
  const client = appState?.client;
  if (!client) return audioBitrate.value;
  
  const spp = appState.settings.samplesPerPacket.value;
  return client.getActualBitrate(spp, false);
});

// Watch for changes in maxAllowedBitrate and adjust audioBitrate if it exceeds the limit
watch(maxAllowedBitrate, (newMax) => {
  if (audioBitrate.value > newMax) {
    audioBitrate.value = newMax;
  }
});

// PTT Key Recording - delegate to AppState.settings
const recordPttKey = () => {
  appState.settings.recordPttKey(keyboardjs);
};

// Form submission
const handleSubmit = () => {
  // Settings auto-save via useLocalStorage, just apply and close
  appState.applySettings();
  
  // Close the dialog
  visible.value = false;
  if (dialogElement.value) {
    dialogElement.value.close();
  }
  appState.closeSettings();
};

const handleCancel = () => {
  if (dialogElement.value) {
    dialogElement.value.close();
  }
  visible.value = false;
  appState.closeSettings();
};

// Lifecycle: Watch UIState.settingsDialog for visibility changes
onMounted(() => {
  // Initialize from UIState
  visible.value = appState.ui.settingsDialog.value !== null;
  if (visible.value && dialogElement.value && !dialogElement.value.open) {
    dialogElement.value.showModal();
  }

  // Watch UIState.settingsDialog for changes
  watch(() => appState.ui.settingsDialog.value, (dialog) => {
    visible.value = dialog !== null;
    if (visible.value && dialogElement.value && !dialogElement.value.open) {
      dialogElement.value.showModal();
    } else if (!visible.value && dialogElement.value?.open) {
      dialogElement.value.close();
    }
  });
});

onBeforeUnmount(() => {
  // Cleanup keyboard bindings if recordPttKey was called
  // (Note: recordPttKey now delegates to appState.settings.recordPttKey,
  // which handles its own cleanup internally)
});
</script>

<style scoped>
/* Component-specific styles if needed */
/* Most styles come from themes/MetroMumbleLight/main.scss */

/* Ensure settings dialog floats above everything and is centered */
.settings-dialog.dialog {
  position: fixed !important;
  top: 50% !important;
  left: 50% !important;
  transform: translate(-50%, -50%) !important;
  margin: 0 !important;
  z-index: 30 !important;
}

/* Ensure dialog backdrop works correctly */
dialog::backdrop {
  background: rgba(0, 0, 0, 0.5);
}

/* Bandwidth info styling - using CSS v-bind() pattern */
.bandwidth-total {
  font-weight: bold;
}

.bandwidth-detail {
  color: #666;
}

.bandwidth-overhead {
  cursor: help;
  border-bottom: 1px dotted #999;
}

/* Server limit notes */
.server-limit-note {
  color: #666;
  font-style: italic;
}

.settings-help-text {
  font-size: 0.8em;
  color: #666;
  margin-top: 4px;
}

.actual-bitrate-note {
  color: #888;
  font-size: 0.9em;
}
</style>
