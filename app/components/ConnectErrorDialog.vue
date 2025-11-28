<template>
  <Teleport to="body">
    <Transition name="dialog-fade">
      <div
        v-if="visible"
        class="connect-dialog error-dialog dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="error-dialog-title"
        aria-describedby="error-dialog-description"
        @keydown.escape="hide"
      >
    <h2 id="error-dialog-title" class="dialog-header">{{ translate('connectdialog.error.title') }}</h2>
    <form @submit.prevent="handleConnect">
      <div id="error-dialog-description" class="error-description">
        <div class="reason">
          <p v-if="type === 0 || type === 8" class="refused">
            {{ translate('connectdialog.error.reason.refused') }}
          </p>
          <p v-if="type === 1" class="version">
            {{ translate('connectdialog.error.reason.version') }}
          </p>
          <p v-if="type === 2" class="username">
            {{ translate('connectdialog.error.reason.username') }}
          </p>
          <p v-if="type === 3" class="userpassword">
            {{ translate('connectdialog.error.reason.userpassword') }}
          </p>
          <p v-if="type === 4" class="serverpassword">
            {{ translate('connectdialog.error.reason.serverpassword') }}
          </p>
          <p v-if="type === 5" class="username-in-use">
            {{ translate('connectdialog.error.reason.username_in_use') }}
          </p>
          <p v-if="type === 6" class="full">
            {{ translate('connectdialog.error.reason.full') }}
          </p>
          <p v-if="type === 7" class="clientcert">
            {{ translate('connectdialog.error.reason.clientcert') }}
          </p>
          <p class="server">{{ translate('connectdialog.error.reason.server') }}</p>
          <p class="connect-error-reason">"{{ reason }}"</p>
        </div>
      </div>
      
      <div v-if="type === 2 || type === 3 || type === 5" class="form-group">
        <label for="alternate-username">{{ translate('connectdialog.username') }}</label>
        <input
          id="alternate-username"
          type="text"
          v-model="username"
          required
          readonly
          aria-readonly="true"
        />
      </div>
      <div v-if="type === 3 || type === 4" class="form-group">
        <label for="alternate-password">{{ translate('connectdialog.password') }}</label>
        <input
          id="alternate-password"
          type="password"
          autocomplete="current-password"
          v-model="password"
          required
          ref="passwordInput"
        />
      </div>
      
      <div class="dialog-footer">
        <button 
          class="dialog-close" 
          type="button" 
          @click="hide"
          aria-label="Cancel and close dialog"
        >
          {{ translate('connectdialog.error.cancel') }}
        </button>
        <button 
          class="dialog-submit" 
          type="submit"
          aria-label="Retry connection"
        >
          {{ translate('connectdialog.error.retry') }}
        </button>
      </div>
    </form>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { Teleport, Transition, inject, toRefs, watch, nextTick, useTemplateRef } from 'vue';
import { useDialogStore } from '../stores/dialogStore';
import { useConnectionLogic } from '../composables/useConnectionLogic';

const translate = inject('translate');
const auth = inject('auth');
// Pinia stores
const dialogStore = useDialogStore();

// Composables (for connection logic only)
const connectionLogic = useConnectionLogic({ auth });

// Template ref for password input focus
const passwordInput = useTemplateRef('passwordInput');

// Use toRefs to get reactive refs from nested dialog store objects
const { visible, type, reason } = toRefs(dialogStore.errorDialog);

// Username and password from connection dialog store
const { username, password, address, port } = toRefs(dialogStore.connectDialog);

// Focus management when dialog opens
watch(visible, async (val) => {
  if (val) {
    await nextTick();
    // Focus password input if present, otherwise first focusable element
    if (passwordInput.value) {
      passwordInput.value.focus();
    }
    // Announce error to screen readers
    announceToScreenReader('Connection error. ' + (reason.value || 'Please try again.'));
  }
});

/**
 * Announce message to screen readers via live region
 */
function announceToScreenReader(message) {
  const announcer = document.getElementById('a11y-announcer');
  if (announcer) {
    announcer.textContent = message;
    setTimeout(() => { announcer.textContent = ''; }, 1000);
  }
}

// Methods
const hide = () => {
  visible.value = false;
};

const handleConnect = () => {
  hide();
  connectionLogic.connect(
    address.value,
    port.value,
    username.value,
    password.value
  );
};
</script>

<style scoped>
/* Ensure error dialog floats above everything */
.connect-dialog.error-dialog.dialog {
  position: fixed !important;
}

/* Error description styling */
.error-description {
  padding: 1rem;
}

.error-description .reason p {
  margin: 0.5rem 0;
}

.connect-error-reason {
  font-style: italic;
  color: #666;
}

/* Form groups for accessible layout */
.form-group {
  margin: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.25rem;
  font-weight: 500;
}

.form-group input {
  width: 100%;
  padding: 0.5rem;
  font-size: 1rem;
  box-sizing: border-box;
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
