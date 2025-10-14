import ko from "knockout";
import { translate } from "../localize";

/**
 * Manages messaging functionality
 */
export default class MessageManager {
  constructor(getThisUser, getSelected) {
    this.getThisUser = getThisUser;
    this.getSelected = getSelected;
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
      const thisUser = this.getThisUser();
      if (!thisUser) {
        return ""; // Not yet connected
      }
      let target = this.getSelected();
      if (!target) {
        target = thisUser;
      }
      if (target === thisUser) {
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
    this.sendMessage(this.getSelected(), this.messageBox());
    this.messageBox("");
  }

  /**
   * Send a message
   */
  sendMessage(target, message, isConnected) {
    if (isConnected) {
      const thisUser = this.getThisUser();
      // If no target is selected, choose our own user
      if (!target) {
        target = thisUser;
      }
      // If target is our own user, send to our channel
      if (target === thisUser) {
        target = target.channel();
      }
      // Send message
      target.model.sendMessage(message);
    }
  }
}
