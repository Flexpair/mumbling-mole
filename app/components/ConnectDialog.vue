<template>
  <div class="connect-dialog dialog vue-version" v-if="visible" style="border: 3px solid blue;">
    <div class="dialog-header">Vue.js PoC - Connect Dialog</div>
    <form @submit.prevent="handleConnect">
      <p style="padding: 20px; background: rgba(0, 100, 255, 0.1);">
        <strong>🎉 Vue.js Component Active!</strong><br>
        This is a minimal PoC showing Vue.js rendering alongside Knockout.<br>
        The Knockout version is still running below.
      </p>
      
      <div class="dialog-buttons">
        <button type="submit" class="dialog-submit">
          Vue Connect (PoC)
        </button>
      </div>
    </form>
  </div>
</template>

<script>
// Simple Vue component with Composition API
export default {
  name: 'ConnectDialog',
  
  data() {
    return {
      visible: true, // Always visible for PoC
    };
  },
  
  methods: {
    handleConnect() {
      alert('Vue.js PoC Connect clicked! This demonstrates Vue rendering.');
      console.log('[Vue PoC] Connect button clicked');
    }
  }
};
</script>

<style scoped>
.vue-version {
  margin-bottom: 20px;
  border: 3px solid #0096ff !important;
}

.dialog-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 12px;
  font-weight: bold;
}

.dialog-buttons {
  padding: 15px;
  text-align: center;
}

.dialog-submit {
  background: #0096ff;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1em;
}

.dialog-submit:hover {
  background: #0077cc;
}
</style>
