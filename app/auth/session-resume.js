export function createSessionResumeHandler({
  auth,
  onInitFailed = () => {},
  isReady = () => true,
  isAuthModalOpen = () => false,
  isConnectDialogVisible = () => false,
  shouldRestoreConnectDialog = null,
  onValidationStart = () => {},
  onAuthenticated = () => {},
  onUnauthenticated = () => {},
  onValidationError = () => {},
}) {
  let inFlightCheck = null;
  let pendingConnectRestore = false;

  return async function revalidateSessionOnResume() {
    if (!isReady() || isAuthModalOpen() || onInitFailed()) return null;
    if (inFlightCheck) return inFlightCheck;

    const restoreConnectDialog = pendingConnectRestore || isConnectDialogVisible();
    let validationStarted = false;
    const check = (async () => {
      try {
        validationStarted = true;
        await onValidationStart();
        const user = await auth.getCurrentUser();
        const mayRestoreDialog = shouldRestoreConnectDialog
          ? shouldRestoreConnectDialog(restoreConnectDialog)
          : restoreConnectDialog;
        if (!user) {
          pendingConnectRestore = false;
          await onUnauthenticated();
          return null;
        }

        pendingConnectRestore = false;
        await onAuthenticated(user, {
          restoreConnectDialog: mayRestoreDialog,
        });
        return user;
      } catch (error) {
        if (!validationStarted) throw error;
        pendingConnectRestore ||= restoreConnectDialog;
        await onValidationError(error, {
          restoreConnectDialog: shouldRestoreConnectDialog
            ? shouldRestoreConnectDialog(pendingConnectRestore)
            : pendingConnectRestore,
        });
        return undefined;
      }
    })();

    inFlightCheck = check;
    try {
      return await check;
    } finally {
      if (inFlightCheck === check) inFlightCheck = null;
    }
  };
}
