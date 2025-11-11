<template>
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
            </td>
          </tr>

          <!-- Audio Quality Slider -->
          <tr>
            <td colspan="2">
              <input
                type="range"
                min="8000"
                max="96000"
                step="8"
                v-model.number="audioBitrate"
              />
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

          <!-- Bandwidth Info -->
          <tr>
            <td colspan="2" class="bandwidth-info">
              <span>{{ (totalBandwidth / 1000).toFixed(1) }}</span> kbit/s
              (Audio <span>{{ (audioBitrate / 1000).toFixed(1) }}</span>,
              Position <span>{{ (positionBandwidth / 1000).toFixed(1) }}</span>,
              Overhead <span>{{ (overheadBandwidth / 1000).toFixed(1) }}</span>)
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
</template>

<script setup>
import { ref, computed, inject, watch, onMounted, onBeforeUnmount } from 'vue';
import keyboardjs from 'keyboardjs';
import MumbleClient from '../mumble-client/client.js';

// Inject AppState from the main app
const appState = inject('appState');

// Translation helper
const t = inject('translate');

// Component visibility state
const visible = ref(false);
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

// Computed: msPerPacket (bidirectional conversion)
const msPerPacket = computed({
  get: () => appState.settings.msPerPacket.value,
  set: (value) => {
    appState.settings.samplesPerPacket.value = value * 48;
  }
});

// Computed: Bandwidth calculations (from AppState.settings)
const totalBandwidth = computed(() => appState.settings.totalBandwidth.value);
const positionBandwidth = computed(() => appState.settings.positionBandwidth.value);
const overheadBandwidth = computed(() => appState.settings.overheadBandwidth.value);

// PTT Key Recording - delegate to AppState.settings
const recordPttKey = () => {
  appState.settings.recordPttKey(keyboardjs);
};

// Form submission
const handleSubmit = () => {
  // Save settings to localStorage
  appState.settings.save();

  // Trigger AppState.applySettings behavior (recreates voice handler with new settings)
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
</style>
