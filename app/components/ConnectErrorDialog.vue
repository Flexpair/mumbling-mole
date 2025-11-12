<template>
  <div
    v-if="visible"
    class="connect-dialog error-dialog dialog"
  >
    <div class="dialog-header">Failed to connect</div>
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
                The connection has been refused.
              </span>
              <span v-if="type === 1" class="version">
                The server uses an incompatible version.
              </span>
              <span v-if="type === 2" class="username">
                Your user name was rejected. Maybe try a different one?
              </span>
              <span v-if="type === 3" class="userpassword">
                The given password is incorrect. The user name you have chosen
                requires a special one.
              </span>
              <span v-if="type === 4" class="serverpassword">
                The given password is incorrect.
              </span>
              <span v-if="type === 5" class="username-in-use">
                The user name you have chosen is already in use.
              </span>
              <span v-if="type === 6" class="full">
                The server is full.
              </span>
              <span v-if="type === 7" class="clientcert">
                The server requires you to provide a client certificate which
                is not supported by this web application.
              </span>
              <br />
              <span class="server"> The server reports: </span>
              <br />
              "<span class="connect-error-reason">{{ reason }}</span>"
            </td>
          </tr>
          <tr v-if="type === 2 || type === 3 || type === 5">
            <td class="alternate-username">Username</td>
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
            <td class="alternate-password">Password</td>
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
        <input class="dialog-submit" type="submit" value="Retry" />
        <input class="dialog-close" type="button" value="Cancel" @click="hide" />
      </div>
    </form>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue';

const appState = inject('appState');

// Direct computed getters/setters pointing to AppState connectErrorDialog Vue refs
const visible = computed({
  get: () => appState.connectErrorDialog.visible.value,
  set: (val) => { appState.connectErrorDialog.visible.value = val; }
});

const type = computed({
  get: () => appState.connectErrorDialog.type.value,
  set: (val) => { appState.connectErrorDialog.type.value = val; }
});

const reason = computed({
  get: () => appState.connectErrorDialog.reason.value,
  set: (val) => { appState.connectErrorDialog.reason.value = val; }
});

// Username and password are shared with connectDialog
const username = computed({
  get: () => appState.connectDialog.username.value,
  set: (val) => { appState.connectDialog.username.value = val; }
});

const password = computed({
  get: () => appState.connectDialog.password.value,
  set: (val) => { appState.connectDialog.password.value = val; }
});

// Methods
const hide = () => {
  visible.value = false;
};

const handleConnect = () => {
  hide();
  // Call AppState.connect directly
  if (appState.connect) {
    appState.connect(
      appState.connectDialog.address.value,
      appState.connectDialog.port.value,
      username.value,
      password.value
    );
  }
};
</script>

<style scoped>
/* Ensure error dialog floats above everything */
.connect-dialog.error-dialog.dialog {
  position: fixed !important;
}
</style>
