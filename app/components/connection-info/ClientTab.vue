<template>
  <div class="content-panel" role="tabpanel" id="client-panel">
    <h2 class="panel-title">Client Settings</h2>
    
    <div class="setting-group">
      <label class="setting-label" for="voice-mode-select">{{ t('settingsdialog.transmission') }}</label>
      <div class="control-wrapper">
        <select id="voice-mode-select" v-model="voiceMode" class="modern-select">
          <option value="cont">{{ t('settingsdialog.cont') }}</option>
          <option value="ptt" disabled>{{ t('settingsdialog.ptt') }} {{ t('settingsdialog.ptt_disabled') }}</option>
        </select>
      </div>
    </div>

    <div v-if="voiceMode === 'ptt'" class="setting-group">
      <label class="setting-label" for="ptt-key-button">{{ t('settingsdialog.ptt_key') }}</label>
      <div class="control-wrapper">
        <button id="ptt-key-button" class="ptt-record-btn" @click="recordPttKey">
          {{ pttKeyDisplay }}
        </button>
      </div>
    </div>

    <div class="setting-group version-group">
      <span class="setting-label">Client Version</span>
      <button @click="copyCommitHash" class="action-button" :title="copyButtonTitle">
        {{ copyButtonText }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue';
import { storeToRefs } from 'pinia';
import keyboardjs from 'keyboardjs';
import buildInfo from '../../build-info.json';
import { useClipboard } from '../../composables';
import { useSettingsStore } from '../../stores/settingsStore';

const t = inject('translate');
const settingsStore = useSettingsStore();

const { voiceMode, pttKeyDisplay } = storeToRefs(settingsStore);

const { copy: copyToClipboard, copied } = useClipboard({ timeout: 2000 });
const commitHash = buildInfo.commit;

const copyButtonText = computed(() => 
  copied.value ? '✓ Copied' : `Commit: ${commitHash.substring(0, 7)}`
);

const copyButtonTitle = computed(() =>
  copied.value ? 'Copied!' : `Copy full hash: ${commitHash}`
);

const copyCommitHash = () => copyToClipboard(commitHash);

const recordPttKey = () => {
  settingsStore.recordPttKey(keyboardjs);
};
</script>