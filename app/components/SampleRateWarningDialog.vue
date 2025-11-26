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
import { storeToRefs } from 'pinia';
import { useUIStore } from '../stores/uiStore';
import { useSampleRateWarningDialogStore } from '../stores/sampleRateWarningDialogStore';
import { useConnectionLogic } from '../composables/useConnectionLogic';

const translate = inject('translate');
const auth = inject('auth');
const settings = inject('settings');

// Pinia stores and composables
const uiStore = useUIStore();
const sampleRateWarningDialogStore = useSampleRateWarningDialogStore();
const connectionLogic = useConnectionLogic({ auth, settings });

// Use storeToRefs for reactive destructuring (eliminates computed wrappers)
const { visible, mode, sampleRate } = storeToRefs(sampleRateWarningDialogStore);

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
  if (uiStore.currentOpenModal !== null) {
    return;
  }
  mode.value = 'confirm';
  sampleRate.value = sr || null;
  pendingConnection = params || null;
  visible.value = true;
  uiStore.currentOpenModal = 'sampleRateWarning';
};

const showInfo = (sr) => {
  if (uiStore.currentOpenModal !== null) {
    return;
  }
  mode.value = 'info';
  sampleRate.value = sr || null;
  pendingConnection = null;
  visible.value = true;
  uiStore.currentOpenModal = 'sampleRateWarning';
};

const hide = () => {
  visible.value = false;
  if (uiStore.currentOpenModal === 'sampleRateWarning') {
    uiStore.currentOpenModal = null;
  }
  pendingConnection = null;
};

const joinWithoutAudio = () => {
  const params = pendingConnection;
  const sr = sampleRate.value;
  hide();
  if (params) {
    connectionLogic.performConnect(params, {
      audioEnabled: false,
      sampleRate: sr,
    });
  }
};

const cancel = () => {
  hide();
};

// Methods are now available directly on the Pinia store (sampleRateWarningDialogStore)
// No need for backward compatibility exports - store actions handle this
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
