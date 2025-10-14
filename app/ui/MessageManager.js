import ko from "knockout";
import { translate } from "../localize";

/**
 * Manages messaging functionality
 */
export default class MessageManager {
  constructor(thisUser, selected) {
    this.thisUser = thisUser;
    this.selected = selected;
    this.messageBox = ko.observable("");
    
    this.mailToDesktop = ko.observable(
      "mailto:mail@" +
      window.location.hostname +
      "?subject=Send%20attachment%20to%20desktop"
    );
  }

  /**
   * Get message box hint based on current selection
   */
  get messageBoxHint() {
    return ko.pureComputed(() => {
      if (!this.thisUser()) {
        return ""; // Not yet connected
      }
      var target = this.selected();
      if (!target) {
        target = this.thisUser();
      }
      if (target === this.thisUser()) {
        target = target.channel();
      }
      if (target.users) {
        // Channel
        return translate("chat.channel_message_placeholder").replace(
          "%1",
          target.name()
        );
      } else {
        // User
        return translate("chat.user_message_placeholder").replace(
          "%1",
          target.name()
        );
      }
    });
  }

  /**
   * Submit message box
   */
  submitMessageBox() {
    this.sendMessage(this.selected(), this.messageBox());
    this.messageBox("");
  }

  /**
   * Send a message
   */
  sendMessage(target, message, isConnected) {
    if (isConnected) {
      // If no target is selected, choose our own user
      if (!target) {
        target = this.thisUser();
      }
      // If target is our own user, send to our channel
      if (target === this.thisUser()) {
        target = target.channel();
      }
      // Send message
      target.model.sendMessage(message);
    }
  }
}
