<template>
  <div class="content-panel" role="tabpanel" id="bandwidth-panel">
    <h2 class="panel-title">Outgoing Audio Bandwidth</h2>

    <div class="setting-group">
      <div class="label-row">
        <p class="setting-label info top-info">
          <span v-if="isServerLimited">
            Gross bandwidth is limited by server to {{ (maxAllowedBandwidth / 1000).toFixed(0) }} kbps.
          </span>
          <span v-else>
            Gross bandwidth includes audio data and protocol overhead.
          </span>
        </p>
      </div>
      <div class="slider-container bandwidth-slider">
        <!-- Floating Badges -->
        <div class="floating-badge top" :style="grossBadgeStyle">
          {{ (grossBandwidth / 1000).toFixed(1) }} kbps
        </div>
        <div class="floating-badge bottom" :style="netBadgeStyle">
          {{ (audioBitrate / 1000).toFixed(1) }} kbps
        </div>

        <div 
          class="custom-slider" 
          ref="sliderTrack"
          @mousedown="onDragStart"
          @touchstart.prevent="onDragStart"
        >
          <input
            type="range"
            class="slider-input"
            :min="minGrossBandwidth"
            :max="maxAllowedBandwidth"
            :value="grossBandwidth"
            @input="grossBandwidth = Number($event.target.value)"
            @keydown="onKeyDown"
            aria-label="Gross bandwidth slider"
            style="opacity: 0; position: absolute; width: 100%; height: 100%; cursor: pointer;"
          />
          <!-- Net Bandwidth Fill -->
          <div class="slider-track-fill" :style="trackFillStyle"></div>
          
          <!-- Overhead Thumb -->
          <div class="slider-thumb" :style="thumbStyle">
            <span class="slider-label-inner">
              Overhead
            </span>
          </div>
        </div>
        
        <div class="slider-labels">
          <span>Low</span>
          <span>High</span>
        </div>
      </div>

      <div class="label-row bottom-spacing">
          <p class="setting-label info">
            Net bandwidth minimum is 8 kbps for audio transmission.
          </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, watch, useTemplateRef } from 'vue';
import { storeToRefs } from 'pinia';
import { useSettingsStore } from '../../stores/settingsStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { useUserStore } from '../../stores/userStore';
import { useSlider } from '../../composables/ui/useSlider.js';

const settingsStore = useSettingsStore();
const connectionStore = useConnectionStore();
const userStore = useUserStore();

const { audioBitrate, totalBandwidth, overheadBandwidth } = storeToRefs(settingsStore);

const MIN_AUDIO_BITRATE = 8000;

const sliderTrack = useTemplateRef('sliderTrack');

const minGrossBandwidth = computed(() => {
  return MIN_AUDIO_BITRATE + overheadBandwidth.value;
});

const maxAllowedBandwidth = computed(() => {
  const isConnected = userStore.thisUser != null;
  const client = isConnected ? connectionStore.client : null;
  if (!client || client.maxBandwidth === undefined || client.maxBandwidth === null) {
    return 130000;
  }
  return client.maxBandwidth;
});

const isServerLimited = computed(() => {
  const client = connectionStore.client;
  return client && client.maxBandwidth != null;
});

const grossBandwidth = computed({
  get: () => totalBandwidth.value,
  set: (val) => {
    if (val > maxAllowedBandwidth.value) val = maxAllowedBandwidth.value;
    const overhead = overheadBandwidth.value;
    let newNet = val - overhead;
    if (newNet < MIN_AUDIO_BITRATE) newNet = MIN_AUDIO_BITRATE;
    audioBitrate.value = newNet;
  }
});

watch(maxAllowedBandwidth, (newMax) => {
  if (grossBandwidth.value > newMax) {
    grossBandwidth.value = newMax;
  }
});

const {
  isDragging,
  onDragStart,
  onKeyDown,
  thumbStyle,
  trackFillStyle,
  grossBadgeStyle,
  netBadgeStyle
} = useSlider(maxAllowedBandwidth, grossBandwidth, overheadBandwidth, minGrossBandwidth, sliderTrack);
</script>