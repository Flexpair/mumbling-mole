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
import { ref, inject, watch, onMounted, onUnmounted } from 'vue';

const appState = inject('appState');

// Local reactive state
// Local state refs (synced with AppState connectErrorDialog and connectDialog)
const visible = ref(false);
const type = ref(0);
const reason = ref('');
const username = ref('');
const password = ref('');

// Subscriptions for cleanup (connectDialog properties are still Knockout observables)
const subscriptions = [];

// Methods
const show = () => {
  visible.value = true;
};

const hide = () => {
  visible.value = false;
};

const handleConnect = () => {
  hide();
  // Update AppState values before connecting
  appState.connectDialog.username(username.value);
  appState.connectDialog.password(password.value);
  appState.connectDialog.connect();
};

// Bidirectional sync with Knockout AppState
onMounted(() => {
  // Initialize from AppState
  visible.value = appState.connectErrorDialog.visible();
  type.value = appState.connectErrorDialog.type();
  reason.value = appState.connectErrorDialog.reason();
  username.value = appState.connectDialog.username();
  password.value = appState.connectDialog.password();

  // Knockout → Vue sync (connectErrorDialog and connectDialog are still Knockout)
  subscriptions.push(
    appState.connectErrorDialog.visible.subscribe((val) => {
      visible.value = val;
    })
  );
  subscriptions.push(
    appState.connectErrorDialog.type.subscribe((val) => {
      type.value = val;
    })
  );
  subscriptions.push(
    appState.connectErrorDialog.reason.subscribe((val) => {
      reason.value = val;
    })
  );
  subscriptions.push(
    appState.connectDialog.username.subscribe((val) => {
      username.value = val;
    })
  );
  subscriptions.push(
    appState.connectDialog.password.subscribe((val) => {
      password.value = val;
    })
  );
});

// Vue → Knockout sync
watch(visible, (val) => appState.connectErrorDialog.visible(val));
watch(type, (val) => appState.connectErrorDialog.type(val));
watch(reason, (val) => appState.connectErrorDialog.reason(val));
watch(username, (val) => appState.connectDialog.username(val));
watch(password, (val) => appState.connectDialog.password(val));

// Cleanup subscriptions
onUnmounted(() => {
  subscriptions.forEach(sub => sub.dispose());
});

// Expose methods to appState for backward compatibility
appState.connectErrorDialog.show = show;
appState.connectErrorDialog.hide = hide;
</script>

<style scoped>
/* Ensure error dialog floats above everything */
.connect-dialog.error-dialog.dialog {
  position: fixed !important;
}
</style>
