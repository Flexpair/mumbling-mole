<template>
  <Teleport to="body">
    <Transition name="dialog-fade">
      <div
        v-if="visible"
        class="connect-dialog error-dialog dialog"
      >
    <div class="dialog-header">{{ translate('connectdialog.error.title') }}</div>
    <form @submit.prevent="handleConnect">
      <table>
        <thead>
          <tr>
            <th scope="col" style="position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden;">Field</th>
            <th scope="col" style="position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden;">Value</th>
          </tr>
        </thead>
        <tbody>
          <tr class="reason">
            <td colspan="2">
              <span v-if="type === 0 || type === 8" class="refused">
                {{ translate('connectdialog.error.reason.refused') }}
              </span>
              <span v-if="type === 1" class="version">
                {{ translate('connectdialog.error.reason.version') }}
              </span>
              <span v-if="type === 2" class="username">
                {{ translate('connectdialog.error.reason.username') }}
              </span>
              <span v-if="type === 3" class="userpassword">
                {{ translate('connectdialog.error.reason.userpassword') }}
              </span>
              <span v-if="type === 4" class="serverpassword">
                {{ translate('connectdialog.error.reason.serverpassword') }}
              </span>
              <span v-if="type === 5" class="username-in-use">
                {{ translate('connectdialog.error.reason.username_in_use') }}
              </span>
              <span v-if="type === 6" class="full">
                {{ translate('connectdialog.error.reason.full') }}
              </span>
              <span v-if="type === 7" class="clientcert">
                {{ translate('connectdialog.error.reason.clientcert') }}
              </span>
              <br />
              <span class="server"> {{ translate('connectdialog.error.reason.server') }} </span>
              <br />
              "<span class="connect-error-reason">{{ reason }}</span>"
            </td>
          </tr>
          <tr v-if="type === 2 || type === 3 || type === 5">
            <td class="alternate-username">{{ translate('connectdialog.username') }}</td>
            <td>
              <input
                id="alternate-username"
                type="text"
                v-model="username"
                required
                readonly
              />
            </td>
          </tr>
          <tr v-if="type === 3 || type === 4">
            <td class="alternate-password">{{ translate('connectdialog.password') }}</td>
            <td>
              <input
                id="alternate-password"
                type="password"
                autocomplete="off"
                v-model="password"
                required
              />
            </td>
          </tr>
        </tbody>
      </table>
      <div class="dialog-footer">
        <input class="dialog-submit" type="submit" :value="translate('connectdialog.error.retry')" />
        <input class="dialog-close" type="button" :value="translate('connectdialog.error.cancel')" @click="hide" />
      </div>
    </form>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { Teleport, Transition, inject } from 'vue';
import { storeToRefs } from 'pinia';
import { useConnectErrorDialogStore } from '../stores/connectErrorDialogStore';
import { useConnectionDialogStore } from '../stores/connectionDialogStore';
import { useConnectionLogic } from '../composables/useConnectionLogic';

const translate = inject('translate');
const auth = inject('auth');
const settings = inject('settings');

// Pinia stores
const connectErrorDialogStore = useConnectErrorDialogStore();
const connectionDialogStore = useConnectionDialogStore();

// Composables (for connection logic only)
const connectionLogic = useConnectionLogic({ auth, settings });

// Use storeToRefs for reactive destructuring (eliminates computed wrappers)
const { visible, type, reason } = storeToRefs(connectErrorDialogStore);

// Username and password from connection dialog store
const { username, password, address, port } = storeToRefs(connectionDialogStore);

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
