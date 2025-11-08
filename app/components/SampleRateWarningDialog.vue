<template>
  <div
    v-if="visible"
    class="connect-dialog sample-rate-dialog dialog"
  >
    <div class="dialog-header">{{ title }}</div>
    <div class="dialog-body">
      <p>{{ description }}</p>
      <div v-if="hints.length > 0" class="sample-rate-hints">
        <div class="sample-rate-hints__title">{{ hintsTitle }}</div>
        <ul>
          <li v-for="(hint, index) in hints" :key="index">{{ hint }}</li>
        </ul>
      </div>
    </div>
    <div class="dialog-footer">
      <input
        class="dialog-close"
        type="button"
        :value="secondaryLabel"
        @click="cancel"
      />
      <input
        v-if="isConfirm"
        class="dialog-submit"
        type="button"
        :value="primaryLabel"
        @click="joinWithoutAudio"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, inject, watch, onMounted, onUnmounted } from 'vue';

const appState = inject('appState');

// Import translate function from localize module
// This needs to be available in the component context
const translate = inject('translate');

// Local reactive state
const visible = ref(false);
const mode = ref('confirm');
const sampleRate = ref(null);
let pendingConnection = null;

// Subscriptions for cleanup
const subscriptions = [];

// Computed properties
const isConfirm = computed(() => mode.value === 'confirm');

const formatSampleRate = (value) => {
  if (typeof value === 'number' && !Number.isNaN(value) && value > 0) {
    return String(Math.round(value));
  }
  return translate('audio.sample_rate.warning.unknown_rate');
};

const title = computed(() => translate('audio.sample_rate.warning.title'));

const description = computed(() => {
  const key = isConfirm.value
    ? 'audio.sample_rate.warning.body'
    : 'audio.sample_rate.warning.info';
  const template = translate(key);
  return template.replace('%1', formatSampleRate(sampleRate.value));
});

const primaryLabel = computed(() => translate('audio.sample_rate.warning.accept'));

const secondaryLabel = computed(() => {
  const key = isConfirm.value
    ? 'audio.sample_rate.warning.cancel'
    : 'audio.sample_rate.warning.close';
  return translate(key);
});

const hintsTitle = computed(() => translate('audio.sample_rate.warning.hints_title'));

const hints = computed(() => {
  const hintKeys = [
    'audio.sample_rate.warning.hints.item1',
    'audio.sample_rate.warning.hints.item2',
    'audio.sample_rate.warning.hints.item3'
  ];
  return hintKeys
    .map((key) => translate(key))
    .filter((text) => text && !/^\{\{.*\}\}$/.test(text));
});

// Methods
const show = (sr, params) => {
  if (appState.currentOpenModal() !== null) {
    return;
  }
  mode.value = 'confirm';
  sampleRate.value = sr || null;
  pendingConnection = params || null;
  visible.value = true;
  appState.currentOpenModal('sampleRateWarning');
};

const showInfo = (sr) => {
  if (appState.currentOpenModal() !== null) {
    return;
  }
  mode.value = 'info';
  sampleRate.value = sr || null;
  pendingConnection = null;
  visible.value = true;
  appState.currentOpenModal('sampleRateWarning');
};

const hide = () => {
  visible.value = false;
  if (appState.currentOpenModal() === 'sampleRateWarning') {
    appState.currentOpenModal(null);
  }
  pendingConnection = null;
};

const joinWithoutAudio = () => {
  const params = pendingConnection;
  const sr = sampleRate.value;
  hide();
  if (params) {
    appState._performConnect(params, {
      audioEnabled: false,
      sampleRate: sr,
    });
  }
};

const cancel = () => {
  hide();
};

// Bidirectional sync with Knockout AppState
onMounted(() => {
  // Initialize from AppState
  visible.value = appState.sampleRateWarningDialog.visible();
  mode.value = appState.sampleRateWarningDialog.mode();
  sampleRate.value = appState.sampleRateWarningDialog.sampleRate();

  // Knockout → Vue sync
  subscriptions.push(
    appState.sampleRateWarningDialog.visible.subscribe((val) => {
      visible.value = val;
    })
  );
  subscriptions.push(
    appState.sampleRateWarningDialog.mode.subscribe((val) => {
      mode.value = val;
    })
  );
  subscriptions.push(
    appState.sampleRateWarningDialog.sampleRate.subscribe((val) => {
      sampleRate.value = val;
    })
  );
});

// Vue → Knockout sync
watch(visible, (val) => appState.sampleRateWarningDialog.visible(val));
watch(mode, (val) => appState.sampleRateWarningDialog.mode(val));
watch(sampleRate, (val) => appState.sampleRateWarningDialog.sampleRate(val));

// Cleanup subscriptions
onUnmounted(() => {
  subscriptions.forEach(sub => sub.dispose());
});

// Expose methods to appState for backward compatibility
appState.sampleRateWarningDialog.show = show;
appState.sampleRateWarningDialog.showInfo = showInfo;
appState.sampleRateWarningDialog.hide = hide;
appState.sampleRateWarningDialog.joinWithoutAudio = joinWithoutAudio;
appState.sampleRateWarningDialog.cancel = cancel;
</script>

<style scoped>
/* Ensure warning dialog floats above everything */
.dialog {
  position: fixed !important;
}
</style>
