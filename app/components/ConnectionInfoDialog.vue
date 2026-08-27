<template>
  <Teleport to="body">
    <Transition name="dialog-fade" @after-enter="onDialogShown">
      <dialog 
        v-if="visible" 
        class="connection-info-dialog dialog-container"
        aria-labelledby="dialog-title"
        open
        @keydown="handleDialogKeydown"
      >
        <!-- Sidebar Navigation -->
        <div class="dialog-sidebar">
          <div class="sidebar-header" id="dialog-title">
            Settings
          </div>
          <div 
            class="sidebar-nav" 
            role="tablist"
            aria-label="Settings sections"
            @keydown="handleTabListKeydown"
          >
            <button 
              ref="tabLatency"
              type="button"
              :class="['nav-item', { active: activeTab === 'latency' }]"
              @click="selectTab('latency')"
              :tabindex="activeTab === 'latency' ? 0 : -1"
              role="tab"
              :aria-selected="activeTab === 'latency'"
              aria-controls="latency-panel"
            >
              <span>Audio Delay</span>
            </button>
            <button 
              ref="tabBandwidth"
              type="button"
              :class="['nav-item', { active: activeTab === 'bandwidth' }]"
              @click="selectTab('bandwidth')"
              :tabindex="activeTab === 'bandwidth' ? 0 : -1"
              role="tab"
              :aria-selected="activeTab === 'bandwidth'"
              aria-controls="bandwidth-panel"
            >
              <span>Bandwidth</span>
            </button>
            <button 
              ref="tabClient"
              type="button"
              :class="['nav-item', { active: activeTab === 'client' }]"
              @click="selectTab('client')"
              :tabindex="activeTab === 'client' ? 0 : -1"
              role="tab"
              :aria-selected="activeTab === 'client'"
              aria-controls="client-panel"
            >
              <span>Client</span>
            </button>
            <button 
              ref="tabServer"
              type="button"
              :class="['nav-item', { active: activeTab === 'server' }]"
              @click="selectTab('server')"
              :tabindex="activeTab === 'server' ? 0 : -1"
              role="tab"
              :aria-selected="activeTab === 'server'"
              aria-controls="server-panel"
            >
              <span>Server</span>
            </button>
          </div>
          <div class="sidebar-footer">
            <button class="close-button" type="button" @click="handleHide">
              {{ t('settingsdialog.close') }}
            </button>
          </div>
        </div>

        <!-- Main Content Area -->
        <div class="dialog-main" @keydown="handlePanelKeydown">
            <ClientTab v-show="activeTab === 'client'" />
            <LatencyTab v-show="activeTab === 'latency'" :latencyMs="latencyMs" :latencyDeviation="latencyDeviation" />
            <BandwidthTab v-show="activeTab === 'bandwidth'" />
            <ServerTab v-show="activeTab === 'server'" :serverVersion="serverVersion" />
        </div>
      </dialog>
    </Transition>
  </Teleport>
</template>

<script setup>
import { Teleport, Transition, computed, inject, watch, ref, onUnmounted, nextTick } from 'vue';
import { useUIStore } from '../stores/uiStore';
import { useConnectionStore } from '../stores/connectionStore';

import ClientTab from './connection-info/ClientTab.vue';
import LatencyTab from './connection-info/LatencyTab.vue';
import BandwidthTab from './connection-info/BandwidthTab.vue';
import ServerTab from './connection-info/ServerTab.vue';

const t = inject('translate');

const activeTab = ref('latency');

const tabLatency = ref(null);
const tabBandwidth = ref(null);
const tabClient = ref(null);
const tabServer = ref(null);

const tabOrder = ['latency', 'bandwidth', 'client', 'server'];
const tabRefs = computed(() => ({
  latency: tabLatency,
  bandwidth: tabBandwidth,
  client: tabClient,
  server: tabServer
}));

const selectTab = (tabName) => {
  activeTab.value = tabName;
  nextTick(() => {
    tabRefs.value[tabName]?.value?.focus();
  });
};

const navigateTab = (direction) => {
  const currentIndex = tabOrder.indexOf(activeTab.value);
  let newIndex;
  
  if (direction === 'up' || direction === 'prev') {
    newIndex = currentIndex <= 0 ? tabOrder.length - 1 : currentIndex - 1;
  } else {
    newIndex = currentIndex >= tabOrder.length - 1 ? 0 : currentIndex + 1;
  }
  
  selectTab(tabOrder[newIndex]);
};

const focusPanel = () => {
  nextTick(() => {
    const panelId = `${activeTab.value}-panel`;
    const panel = document.getElementById(panelId);
    if (panel) {
      const focusable = panel.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (focusable) {
        focusable.focus();
      }
    }
  });
};

const focusTabList = () => {
  nextTick(() => {
    tabRefs.value[activeTab.value]?.value?.focus();
  });
};

const onDialogShown = () => {
  tabRefs.value.latency?.value?.focus();
};

const handleDialogKeydown = (event) => {
  if (event.key === 'Escape') {
    const target = event.target;
    const isInPanel = target?.closest('.dialog-main') !== null;
    
    if (isInPanel) {
      event.preventDefault();
      event.stopPropagation();
      focusTabList();
    } else {
      event.preventDefault();
      visible.value = false;
    }
  }
};

const handleTabListKeydown = (event) => {
  switch (event.key) {
    case 'ArrowUp':
      event.preventDefault();
      navigateTab('up');
      break;
    case 'ArrowDown':
      event.preventDefault();
      navigateTab('down');
      break;
    case 'ArrowRight':
      event.preventDefault();
      focusPanel();
      break;
    case 'Home':
      event.preventDefault();
      selectTab(tabOrder[0]);
      break;
    case 'End':
      event.preventDefault();
      selectTab(tabOrder[tabOrder.length - 1]);
      break;
  }
};

const handlePanelKeydown = (event) => {
  if (event.key === 'ArrowLeft') {
    const activeElement = document.activeElement;
    const tagName = activeElement?.tagName?.toLowerCase();
    const role = activeElement?.getAttribute('role');
    
    if (tagName === 'input' || tagName === 'textarea' || tagName === 'select' || 
        role === 'slider' || role === 'spinbutton' || role === 'textbox' ||
        role === 'combobox' || role === 'listbox') {
      return;
    }
    
    event.preventDefault();
    focusTabList();
  }
};

const uiStore = useUIStore();
const connectionStore = useConnectionStore();

const visible = computed({
  get: () => uiStore.currentOpenModal === 'connectionInfo' || uiStore.currentOpenModal === 'settings',
  set: (val) => { 
    if (!val) uiStore.currentOpenModal = null; 
  }
});

const serverVersion = ref(null);
const latencyMs = ref(Number.NaN);
const latencyDeviation = ref(Number.NaN);

onUnmounted(() => {
  if (statsInterval) {
    clearInterval(statsInterval);
    statsInterval = null;
  }
});

function updateStats() {
  const client = connectionStore.getClient();
  if (client) {
    serverVersion.value = client.serverVersion || null;
    const dataStats = client.dataStats;
    if (dataStats) {
      latencyMs.value = dataStats.mean;
      latencyDeviation.value = Math.sqrt(dataStats.variance);
    } else {
      latencyMs.value = Number.NaN;
      latencyDeviation.value = Number.NaN;
    }
  } else {
    serverVersion.value = null;
    latencyMs.value = Number.NaN;
    latencyDeviation.value = Number.NaN;
  }
}

let statsInterval = null;

watch(visible, (val) => {
  if (val) {
    activeTab.value = 'latency';
    nextTick(() => {
      tabRefs.value.latency?.value?.focus();
    });
    updateStats();
    statsInterval = setInterval(updateStats, 1000);
  } else if (statsInterval) {
    clearInterval(statsInterval);
    statsInterval = null;
  }
});

const handleHide = () => {
  visible.value = false;
};

watch(() => uiStore.currentOpenModal, (newVal) => {
  if (newVal === 'connectionInfo' || newVal === 'settings') {
    updateStats();
    activeTab.value = 'latency';
    nextTick(() => {
      tabRefs.value.latency?.value?.focus();
    });
  }
});
</script>

<style scoped>
.dialog-container {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100%;
  max-width: min(700px, calc(100vw - 40px));
  height: auto;
  max-height: calc(100vh - 40px);
  min-height: 300px;
  background: #1e1e1e;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: row;
  overflow: hidden;
  z-index: 1000;
  color: #fff;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  box-sizing: border-box;
}

/* Sidebar */
.dialog-sidebar {
  width: 220px;
  min-width: 180px;
  flex-shrink: 0;
  background: #252526;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #333;
}

.sidebar-header {
  padding: 20px;
  font-size: 18px;
  font-weight: 600;
  color: #fff;
  border-bottom: 1px solid #333;
}

.sidebar-nav {
  flex: 1;
  padding: 10px 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  background: transparent;
  border: none;
  color: #aaa;
  cursor: pointer;
  text-align: left;
  font-size: 14px;
  transition: all 0.2s;
  border-left: 3px solid transparent;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
}

.nav-item.active {
  background: rgba(0, 255, 255, 0.1);
  color: #00ffff;
  border-left-color: #00ffff;
}

.sidebar-footer {
  padding: 20px;
  border-top: 1px solid #333;
}

.close-button {
  width: 100%;
  padding: 10px;
  background: #444;
  border: none;
  border-radius: 6px;
  color: #fff;
  cursor: pointer;
  transition: background 0.2s;
}

.close-button:hover {
  background: #444;
}

/* Main Content */
.dialog-main {
  flex: 1;
  background: #1e1e1e;
  position: relative;
  overflow-y: auto;
}

/* Transitions */
.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
  transform: translate(-50%, -48%) scale(0.98);
}

/* Default inner styles passed down with :deep() */
:deep(.content-panel) {
  padding: 30px;
  min-height: 400px;
}

:deep(.panel-title) {
  margin: 0 0 25px 0;
  font-size: 24px;
  font-weight: 300;
  color: #fff;
}

:deep(.setting-group) {
  margin-bottom: 25px;
}

:deep(.setting-group.version-group) {
  margin-top: 30px;
}

:deep(.setting-label) {
  display: block;
  margin-bottom: 8px;
  color: #ccc;
  font-size: 14px;
  font-weight: 500;
}

:deep(.setting-label.info) {
  font-weight: normal;
  opacity: 0.8;
}

:deep(.setting-label.info.top-info) {
  margin-bottom: 15px;
}

:deep(.control-wrapper) {
  position: relative;
}

:deep(.modern-select) {
  width: 100%;
  padding: 10px;
  background: #2d2d2d;
  border: 1px solid #444;
  border-radius: 6px;
  color: #fff;
  font-size: 14px;
  outline: none;
  cursor: pointer;
}

:deep(.modern-select:focus) {
  border-color: #00ffff;
}

:deep(.ptt-record-btn),
:deep(.action-button) {
  padding: 10px 16px;
  background: #2d2d2d;
  border: 1px solid #444;
  border-radius: 6px;
  color: #fff;
  cursor: pointer;
  transition: all 0.2s;
}

:deep(.ptt-record-btn) {
  width: 100%;
  color: #00ffff;
  font-weight: 600;
}

:deep(.ptt-record-btn:hover) {
  background: #333;
  border-color: #00ffff;
}

:deep(.action-button) {
  font-size: 13px;
}

:deep(.slider-container) {
  margin: 15px 0;
}

:deep(.slider-container.bandwidth-slider) {
  position: relative;
  margin: 50px 0;
}

:deep(.slider-labels) {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #666;
  margin-top: 5px;
}

:deep(.label-row) {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

:deep(.label-row.bottom-spacing) {
  margin-top: 15px;
}

:deep(.stat-card) {
  background: #252526;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
  text-align: center;
  border: 1px solid #333;
}

:deep(.stat-value-large) {
  font-size: 36px;
  font-weight: 300;
  color: #00ffff;
  margin: 10px 0;
}

:deep(.stat-sub) {
  font-size: 12px;
  color: #888;
}

:deep(.stat-label) {
  font-size: 12px;
  color: #888;
  margin-bottom: 5px;
}

:deep(.stat-value) {
  font-size: 18px;
  font-weight: 600;
  color: #fff;
}

:deep(.unit) {
  font-size: 12px;
  color: #666;
  font-weight: normal;
}

:deep(.info-section) {
  background: #252526;
  padding: 20px;
  border-radius: 8px;
  border: 1px solid #333;
}

:deep(.info-row) {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #333;
}

:deep(.info-row:last-child) {
  border-bottom: none;
}

:deep(.info-row .label) {
  color: #888;
}

:deep(.info-row .value) {
  color: #fff;
}

:deep(.info-note) {
  margin-top: 8px;
  font-size: 12px;
  color: #888;
}

:deep(.custom-slider) {
  position: relative;
  height: 24px;
  background: #1e1e1e;
  border-radius: 2px;
  cursor: pointer;
  margin: 10px 0;
  border: 1px solid #333;
  touch-action: none;
}

:deep(.slider-track-fill) {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: #157878;
  border-radius: 1px 0 0 1px;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

:deep(.slider-thumb) {
  position: absolute;
  top: -2px;
  height: 26px;
  box-sizing: border-box;
  background: #a84444;
  border: 1px solid #ccc;
  border-radius: 2px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.3);
  cursor: grab;
  z-index: 10;
  background-image: linear-gradient(45deg, rgba(255,255,255,.1) 25%, transparent 25%, transparent 50%, rgba(255,255,255,.1) 50%, rgba(255,255,255,.1) 75%, transparent 75%, transparent);
  background-size: 10px 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}

:deep(.slider-label-inner) {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.9);
  white-space: nowrap;
  padding: 0 4px;
  text-shadow: 0 1px 2px rgba(0,0,0,0.5);
  pointer-events: none;
  user-select: none;
  -webkit-user-select: none;
}

:deep(.slider-thumb:active) {
  cursor: grabbing;
  transform: scale(1.02);
}

:deep(.floating-badge) {
  position: absolute;
  color: #ccc;
  font-size: 12px;
  font-weight: normal;
  white-space: nowrap;
  pointer-events: none;
  z-index: 20;
  background: none;
  border: none;
  box-shadow: none;
  padding: 0;
  line-height: 14px;
}

:deep(.floating-badge.top) {
  top: -52px;
  transform: translateX(-100%);
  padding-right: 8px;
}

:deep(.floating-badge.top::after) {
  content: '';
  position: absolute;
  right: 0;
  top: 100%;
  width: 1px;
  height: 50px;
  background: #666;
  display: block;
  z-index: 25;
}

:deep(.floating-badge.bottom) {
  top: 62px;
  transform: translateX(0);
  padding-left: 8px;
}

:deep(.floating-badge.bottom::before) {
  content: '';
  position: absolute;
  left: 0;
  bottom: 100%;
  width: 1px;
  height: 50px;
  background: #666;
  display: block;
  z-index: 25;
}

@media only screen and (max-width: 768px) {
  .dialog-container {
    flex-direction: column;
    max-height: calc(100vh - 20px);
    max-width: calc(100vw - 20px);
  }
  
  .dialog-sidebar {
    width: 100%;
    min-width: 100%;
    flex-shrink: 0;
    border-right: none;
    border-bottom: 1px solid #333;
  }
  
  .sidebar-header {
    padding: 12px 16px;
    font-size: 16px;
  }
  
  .sidebar-nav {
    flex-direction: row;
    overflow-x: auto;
    padding: 0;
    gap: 0;
    -webkit-overflow-scrolling: touch;
  }
  
  .nav-item {
    flex-shrink: 0;
    padding: 10px 16px;
    border-left: none;
    border-bottom: 3px solid transparent;
    white-space: nowrap;
  }
  
  .nav-item.active {
    border-left-color: transparent;
    border-bottom-color: #00ffff;
  }
  
  .sidebar-footer {
    display: none;
  }
  
  .dialog-main {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
  }
  
  :deep(.content-panel) {
    padding: 20px 16px;
  }
  
  :deep(.panel-title) {
    font-size: 20px;
    margin-bottom: 20px;
  }
  
  :deep(.stat-card) {
    padding: 16px;
  }
  
  :deep(.stat-value-large) {
    font-size: 28px;
  }
  
  :deep(.floating-badge) {
    display: none;
  }
}

@media only screen and (max-width: 480px) {
  .dialog-container {
    border-radius: 8px;
  }
  
  .sidebar-header {
    padding: 10px 12px;
    font-size: 14px;
  }
  
  .nav-item {
    padding: 8px 12px;
    font-size: 13px;
  }
  
  :deep(.content-panel) {
    padding: 16px 12px;
  }
  
  :deep(.panel-title) {
    font-size: 18px;
  }
  
  :deep(.setting-group) {
    margin-bottom: 20px;
  }
}

@media only screen and (max-height: 500px) and (orientation: landscape) {
  .dialog-container {
    flex-direction: row;
    max-height: calc(100vh - 20px);
  }
  
  .dialog-sidebar {
    width: 160px;
    min-width: 140px;
    border-right: 1px solid #333;
    border-bottom: none;
  }
  
  .sidebar-header {
    padding: 10px 12px;
    font-size: 14px;
  }
  
  .sidebar-nav {
    flex-direction: column;
    overflow-x: visible;
  }
  
  .nav-item {
    padding: 8px 12px;
    font-size: 13px;
    border-left: 3px solid transparent;
    border-bottom: none;
  }
  
  .nav-item.active {
    border-left-color: #00ffff;
    border-bottom-color: transparent;
  }
  
  .sidebar-footer {
    display: block;
    padding: 10px;
  }
  
  :deep(.content-panel) {
    padding: 16px;
  }
  
  :deep(.panel-title) {
    font-size: 18px;
    margin-bottom: 16px;
  }
}
</style>