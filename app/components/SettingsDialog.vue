<template>
  <div
    v-if="visible"
    class="settings-dialog dialog"
    role="dialog"
    aria-labelledby="settings-dialog-title"
    aria-modal="true"
  >
    <div id="settings-dialog-title" class="dialog-header">
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
            <td><span>{{ msPerPacket }}</span> ms</td>
          </tr>

          <!-- Audio per Packet Slider -->
          <tr>
            <td colspan="2">
              <input
                type="range"
                min="10"
                max="60"
                step="10"
                v-model.number="msPerPacket"
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
  </div>
</template>

<script setup>
import { ref, computed, inject, watch, onMounted, onBeforeUnmount } from 'vue';
import keyboardjs from 'keyboardjs';

// Dynamic import for MumbleClient to access calcEnforcableBandwidth
let MumbleClient = null;
import('../../app/mumble-client/client.js').then((module) => {
  MumbleClient = module.default;
});

// Inject AppState from the main app
const appState = inject('appState');

// Translation helper
const t = inject('translate');

// Component visibility state
const visible = ref(false);

// Form state - matches Knockout SettingsDialog constructor
const voiceMode = ref('cont');
const pttKey = ref('ctrl + shift');
const pttKeyDisplay = ref('ctrl + shift');
const audioBitrate = ref(40000);
const samplesPerPacket = ref(960);

// Computed: msPerPacket (bidirectional conversion)
const msPerPacket = computed({
  get: () => samplesPerPacket.value / 48,
  set: (value) => {
    samplesPerPacket.value = value * 48;
  }
});

// Computed: Bandwidth calculations (matches Knockout SettingsDialog methods)
const totalBandwidth = computed(() => {
  if (!MumbleClient) return 0;
  return MumbleClient.calcEnforcableBandwidth(
    audioBitrate.value,
    samplesPerPacket.value,
    true
  );
});

const positionBandwidth = computed(() => {
  if (!MumbleClient) return 0;
  return (
    totalBandwidth.value -
    MumbleClient.calcEnforcableBandwidth(
      audioBitrate.value,
      samplesPerPacket.value,
      false
    )
  );
});

const overheadBandwidth = computed(() => {
  if (!MumbleClient) return 0;
  return MumbleClient.calcEnforcableBandwidth(0, samplesPerPacket.value, false);
});

// PTT Key Recording
let keydownHandler = null;
let keyupHandler = null;

const recordPttKey = () => {
  let combo = [];

  keydownHandler = (e) => {
    combo = e.pressedKeys;
    const comboStr = combo.join(' + ');
    pttKeyDisplay.value = `> ${comboStr} <`;
  };

  keyupHandler = () => {
    keyboardjs.unbind('', keydownHandler, keyupHandler);
    const comboStr = combo.join(' + ');
    if (comboStr) {
      pttKey.value = comboStr;
      pttKeyDisplay.value = comboStr;
    } else {
      pttKeyDisplay.value = pttKey.value;
    }
  };

  keyboardjs.bind('', keydownHandler, keyupHandler);
  pttKeyDisplay.value = '> ? <';
};

// Form submission
const handleSubmit = () => {
  // Apply settings to Knockout settings object
  appState.settings.voiceMode = voiceMode.value;
  appState.settings.pttKey = pttKey.value;
  appState.settings.audioBitrate = audioBitrate.value;
  appState.settings.samplesPerPacket = samplesPerPacket.value;

  // Trigger AppState.applySettings behavior
  appState.applySettings();
};

const handleCancel = () => {
  appState.closeSettings();
};

// Lifecycle: Sync Knockout settingsDialog visibility with Vue
let settingsDialogSubscription = null;

onMounted(() => {
  // Initialize from current Knockout state
  const koDialog = appState.settingsDialog();
  if (koDialog) {
    visible.value = true;
    voiceMode.value = koDialog.voiceMode();
    pttKey.value = koDialog.pttKey();
    pttKeyDisplay.value = koDialog.pttKeyDisplay();
    audioBitrate.value = koDialog.audioBitrate();
    samplesPerPacket.value = koDialog.samplesPerPacket();
  }

  // Subscribe to Knockout settingsDialog changes
  settingsDialogSubscription = appState.settingsDialog.subscribe((dialog) => {
    if (dialog) {
      visible.value = true;
      voiceMode.value = dialog.voiceMode();
      pttKey.value = dialog.pttKey();
      pttKeyDisplay.value = dialog.pttKeyDisplay();
      audioBitrate.value = dialog.audioBitrate();
      samplesPerPacket.value = dialog.samplesPerPacket();
    } else {
      visible.value = false;
    }
  });
});

onBeforeUnmount(() => {
  // Cleanup keyboard bindings
  if (keydownHandler && keyupHandler) {
    keyboardjs.unbind('', keydownHandler, keyupHandler);
  }

  // Dispose Knockout subscription
  if (settingsDialogSubscription) {
    settingsDialogSubscription.dispose();
  }
});

// Vue → Knockout sync (bidirectional)
watch(visible, (val) => {
  if (!val && appState.settingsDialog()) {
    appState.closeSettings();
  }
});
</script>

<style scoped>
/* Component-specific styles if needed */
/* Most styles come from themes/MetroMumbleLight/main.scss */
</style>
