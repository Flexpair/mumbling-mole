<template>
  <div class="content-panel" role="tabpanel" id="latency-panel">
    <h2 class="panel-title">Audio Delay</h2>

    <div class="stat-card">
      <div class="stat-label">Network Latency (Ping)</div>
      <div class="stat-value-large">
        <template v-if="latencyMs && !Number.isNaN(latencyMs)">
          {{ latencyMs.toFixed(1) }} <span class="unit">ms</span>
        </template>
        <template v-else>--</template>
      </div>
      <div class="stat-sub" v-if="latencyMs">
        Deviation: ±{{ latencyDeviation.toFixed(1) }} ms
      </div>
    </div>

    <div class="setting-group">
      <label class="setting-label" for="jitter-buffer-select">Jitter Buffer Strategy</label>
      <div class="control-wrapper">
        <select id="jitter-buffer-select" v-model="jitterBufferMode" class="modern-select">
          <option value="low-latency">Low Latency</option>
          <option value="balanced">Balanced</option>
          <option value="high-quality">High Quality</option>
        </select>
      </div>
      <div class="info-note">
        Current buffer: {{ jitterBufferMs }} ms = {{ jitterBufferSize }} Audio Packets
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useSettingsStore } from '../../stores/settingsStore';

const props = defineProps({
  latencyMs: {
    type: Number,
    default: Number.NaN
  },
  latencyDeviation: {
    type: Number,
    default: Number.NaN
  }
});

const settingsStore = useSettingsStore();
const { jitterBufferMode, jitterBufferSize } = storeToRefs(settingsStore);

const MS_PER_PACKET = 20;
const jitterBufferMs = computed(() => jitterBufferSize.value * MS_PER_PACKET);
</script>