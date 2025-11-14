<template>
  <Teleport to="body">
    <Transition name="dialog-fade">
      <div
        v-if="visible"
        class="connect-dialog sample-rate-dialog dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="sample-rate-dialog-title"
        aria-describedby="sample-rate-dialog-description"
      >
    <div id="sample-rate-dialog-title" class="dialog-header">{{ title }}</div>
    <div id="sample-rate-dialog-description" class="dialog-body">
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
    </Transition>
  </Teleport>
</template>

<script setup>
import { Teleport, Transition, computed, inject } from 'vue';

const appState = inject('appState');
const translate = inject('translate');

// Direct access to AppState Vue refs (no local state, no sync needed)
const visible = computed({
  get: () => appState.sampleRateWarningDialog.visible.value,
  set: (val) => { appState.sampleRateWarningDialog.visible.value = val; }
});

const mode = computed({
  get: () => appState.sampleRateWarningDialog.mode.value,
  set: (val) => { appState.sampleRateWarningDialog.mode.value = val; }
});

const sampleRate = computed({
  get: () => appState.sampleRateWarningDialog.sampleRate.value,
  set: (val) => { appState.sampleRateWarningDialog.sampleRate.value = val; }
});

let pendingConnection = null;

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
  if (appState.ui.currentOpenModal.value !== null) {
    return;
  }
  mode.value = 'confirm';
  sampleRate.value = sr || null;
  pendingConnection = params || null;
  visible.value = true;
  appState.ui.currentOpenModal.value = 'sampleRateWarning';
};

const showInfo = (sr) => {
  if (appState.ui.currentOpenModal.value !== null) {
    return;
  }
  mode.value = 'info';
  sampleRate.value = sr || null;
  pendingConnection = null;
  visible.value = true;
  appState.ui.currentOpenModal.value = 'sampleRateWarning';
};

const hide = () => {
  visible.value = false;
  if (appState.ui.currentOpenModal.value === 'sampleRateWarning') {
    appState.ui.currentOpenModal.value = null;
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

/* Transition animations for dialog */
.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 0.2s ease;
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}
</style>
