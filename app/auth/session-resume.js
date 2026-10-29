export function createSessionResumeHandler({
  auth,
  onInitFailed = () => {},
  isReady = () => true,
  isAuthModalOpen = () => false,
  getSessionGeneration = () => 0,
  isConnectDialogVisible = () => false,
  shouldRestoreConnectDialog = null,
  onValidationStart = async () => {},
  onAuthenticated = async () => {},
  onUnauthenticated = async () => {},
  onValidationError = async () => {},
}) {
  let inFlightCheck = null;
  let inFlightGeneration = null;
  let pendingConnectRestore = false;
  let pendingConnectRestoreGeneration = null;

  return async function revalidateSessionOnResume() {
    if (!isReady() || isAuthModalOpen() || onInitFailed()) return null;
    const generation = getSessionGeneration();
    if (inFlightCheck && inFlightGeneration === generation) return inFlightCheck;
    if (pendingConnectRestoreGeneration !== generation) pendingConnectRestore = false;
    const restoreConnectDialog = pendingConnectRestore || isConnectDialogVisible();
    let validationStarted = false;
    const check = (async () => {
      try {
        validationStarted = true;
        await onValidationStart();
        if (generation !== getSessionGeneration()) return undefined;
        const user = await auth.getCurrentUser();
        if (generation !== getSessionGeneration()) return undefined;
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
        if (generation !== getSessionGeneration()) return undefined;
        pendingConnectRestore ||= restoreConnectDialog;
        pendingConnectRestoreGeneration = generation;
        await onValidationError(error, {
          restoreConnectDialog: shouldRestoreConnectDialog
            ? shouldRestoreConnectDialog(pendingConnectRestore)
            : pendingConnectRestore,
        });
        return undefined;
      }
    })();

    inFlightCheck = check;
    inFlightGeneration = generation;
    try {
      return await check;
    } finally {
      if (inFlightCheck === check) {
        inFlightCheck = null;
        inFlightGeneration = null;
      }
    }
  };
}
