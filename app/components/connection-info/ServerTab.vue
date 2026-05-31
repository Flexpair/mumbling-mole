<template>
  <div class="content-panel" role="tabpanel" id="server-panel">
    <h2 class="panel-title">Server Version Info</h2>

    <div class="info-section">
      <div class="info-row">
        <span class="label">Version:</span>
        <span class="value" v-if="serverVersion">{{ serverVersion.release }}</span>
        <span class="value" v-else>Unknown</span>
      </div>
      <div class="info-row">
        <span class="label">OS:</span>
        <span class="value" v-if="serverVersion">{{ serverVersion.os }} {{ serverVersion.osVersion }}</span>
        <span class="value" v-else>Unknown</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { defineProps } from 'vue';

const props = defineProps({
  serverVersion: {
    type: Object,
    default: null
  }
});
</script>