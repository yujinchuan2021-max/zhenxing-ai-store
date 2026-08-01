const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("aihubPC", {
  getCatalog: () => ipcRenderer.invoke("catalog:get"),
  scanManagedInventory: () => ipcRenderer.invoke("inventory:scan"),
  checkForUpdate: () => ipcRenderer.invoke("update:check"),
  openUpdateDownload: () => ipcRenderer.invoke("update:open-download"),
  getExtensionStatus: (profileId) =>
    ipcRenderer.invoke("extension:status", profileId),
  installExtension: (profileId) =>
    ipcRenderer.invoke("extension:install", profileId),
  uninstallExtension: (profileId) =>
    ipcRenderer.invoke("extension:uninstall", profileId),
  getIdentity: () => ipcRenderer.invoke("identity:current"),
  requestRegistrationCode: (email) =>
    ipcRenderer.invoke("identity:request-code", email),
  register: (input) => ipcRenderer.invoke("identity:register", input),
  login: (input) => ipcRenderer.invoke("identity:login", input),
  logout: () => ipcRenderer.invoke("identity:logout"),
  listIdentitySessions: () => ipcRenderer.invoke("identity:list-sessions"),
  revokeIdentitySession: (sessionId) =>
    ipcRenderer.invoke("identity:revoke-session", sessionId),
  updateIdentityProfile: (input) =>
    ipcRenderer.invoke("identity:update-profile", input),
  updateIdentityAvatar: (input) =>
    ipcRenderer.invoke("identity:update-avatar", input),
  updateIdentityPhone: (input) =>
    ipcRenderer.invoke("identity:update-phone", input),
  requestIdentityEmailChange: (input) =>
    ipcRenderer.invoke("identity:request-email-change", input),
  completeIdentityEmailChange: (input) =>
    ipcRenderer.invoke("identity:complete-email-change", input),
  changeIdentityPassword: (input) =>
    ipcRenderer.invoke("identity:change-password", input),
  getPersonalCenter: () =>
    ipcRenderer.invoke("identity:get-personal-center"),
  markPersonalCenterNotificationRead: (source, notificationId) =>
    ipcRenderer.invoke(
      "identity:mark-personal-center-notification-read",
      source,
      notificationId
    ),
  listSiteMessages: () => ipcRenderer.invoke("identity:list-messages"),
  markSiteMessageRead: (messageId) =>
    ipcRenderer.invoke("identity:mark-message-read", messageId),
  listCommunityInteractions: () =>
    ipcRenderer.invoke("identity:list-community-interactions"),
  setCommunityInteraction: (discussionId, input) =>
    ipcRenderer.invoke(
      "identity:set-community-interaction",
      discussionId,
      input
    ),
  createCommunityEmbedSession: () =>
    ipcRenderer.invoke("community:create-embed-session"),
  getSettings: () => ipcRenderer.invoke("settings:get"),
  setLanguage: (language) =>
    ipcRenderer.invoke("settings:set-language", language),
  chooseDownloadDirectory: () =>
    ipcRenderer.invoke("settings:choose-download-directory"),
  chooseCliDirectory: () =>
    ipcRenderer.invoke("settings:choose-cli-directory"),
  openDownloadDirectory: () =>
    ipcRenderer.invoke("settings:open-download-directory"),
  clearDownloadDirectory: () =>
    ipcRenderer.invoke("settings:clear-download-directory"),
  scanEnvironment: () => ipcRenderer.invoke("environment:scan"),
  openEnvironmentLocation: (environmentId) =>
    ipcRenderer.invoke("environment:open-location", environmentId),
  installEnvironment: (environmentId) =>
    ipcRenderer.invoke("environment:install", environmentId),
  getEnvironmentPackage: (environmentId) =>
    ipcRenderer.invoke("environment:package-get", environmentId),
  openEnvironmentInstaller: (environmentId) =>
    ipcRenderer.invoke("environment:open-installer", environmentId),
  getEnvironmentOperation: (environmentId) =>
    ipcRenderer.invoke("environment:operation-get", environmentId),
  checkEnvironmentOperation: (environmentId, generation, operationId) =>
    ipcRenderer.invoke(
      "environment:operation-check",
      environmentId,
      generation,
      operationId
    ),
  uninstallEnvironment: (environmentId) =>
    ipcRenderer.invoke("environment:uninstall", environmentId),
  startDownload: (productId) =>
    ipcRenderer.invoke("download:start", productId),
  refreshDownload: (productId) =>
    ipcRenderer.invoke("download:refresh", productId),
  pauseDownload: (productId) =>
    ipcRenderer.invoke("download:pause", productId),
  cancelDownload: (productId) =>
    ipcRenderer.invoke("download:discard", productId),
  getDownloadTask: (productId) =>
    ipcRenderer.invoke("download:get-task", productId),
  getPartialDownload: (productId) =>
    ipcRenderer.invoke("download:get-partial", productId),
  getDownloadRecord: (productId) =>
    ipcRenderer.invoke("download:get-record", productId),
  showDownloadInFolder: (productId) =>
    ipcRenderer.invoke("download:show-in-folder", productId),
  clearDownloadHistory: (productId) =>
    ipcRenderer.invoke("download:clear-history", productId),
  clearCompletedDownloads: () =>
    ipcRenderer.invoke("download:clear-completed"),
  deleteDownloadedPackage: (productId) =>
    ipcRenderer.invoke("download:delete-package", productId),
  inspectInstaller: (productId) =>
    ipcRenderer.invoke("installer:inspect", productId),
  launchInstaller: (productId, intent) =>
    ipcRenderer.invoke("installer:launch", productId, intent),
  getDesktopOperation: (productId) =>
    ipcRenderer.invoke("desktop:operation-get", productId),
  checkDesktopOperation: (productId, generation, operationId) =>
    ipcRenderer.invoke(
      "desktop:operation-check",
      productId,
      generation,
      operationId
    ),
  getDesktopStatus: (productId) =>
    ipcRenderer.invoke("desktop:status", productId),
  uninstallDesktopProduct: (productId) =>
    ipcRenderer.invoke("desktop:uninstall", productId),
  openDesktopApp: (productId) =>
    ipcRenderer.invoke("desktop:open", productId),
  openDesktopLocation: (productId) =>
    ipcRenderer.invoke("desktop:open-location", productId),
  closeDesktopApp: (productId) =>
    ipcRenderer.invoke("desktop:close", productId),
  openEnvironment: (environmentId) =>
    ipcRenderer.invoke("environment:open", environmentId),
  closeEnvironment: (environmentId) =>
    ipcRenderer.invoke("environment:close", environmentId),
  getCliStatus: (productId) => ipcRenderer.invoke("cli:status", productId),
  openCli: (productId) => ipcRenderer.invoke("cli:open", productId),
  openCliLocation: (productId) =>
    ipcRenderer.invoke("cli:open-location", productId),
  deployCli: (productId) => ipcRenderer.invoke("cli:deploy", productId),
  uninstallCli: (productId) => ipcRenderer.invoke("cli:uninstall", productId),
  notifyCliTask: (payload) =>
    ipcRenderer.invoke("task-notification:cli", payload),
  updateCliTrayTask: (payload) =>
    ipcRenderer.invoke("tray:update-cli-task", payload),
  onDownloadProgress: (callback) => {
    const listener = (_event, progress) => callback(progress);
    ipcRenderer.on("download:progress", listener);
    return () => ipcRenderer.removeListener("download:progress", listener);
  },
  onDownloadTask: (callback) => {
    const listener = (_event, task) => callback(task);
    ipcRenderer.on("download:task", listener);
    return () => ipcRenderer.removeListener("download:task", listener);
  },
  onEnvironmentOperation: (callback) => {
    const listener = (_event, task) => callback(task);
    ipcRenderer.on("environment:operation", listener);
    return () =>
      ipcRenderer.removeListener("environment:operation", listener);
  },
  onDesktopOperation: (callback) => {
    const listener = (_event, task) => callback(task);
    ipcRenderer.on("desktop:operation", listener);
    return () =>
      ipcRenderer.removeListener("desktop:operation", listener);
  },
  onCliLog: (callback) => {
    const listener = (_event, entry) => callback(entry);
    ipcRenderer.on("cli:log", listener);
    return () => ipcRenderer.removeListener("cli:log", listener);
  },
  onTaskNotificationOpen: (callback) => {
    const listener = (_event, target) => callback(target);
    ipcRenderer.on("task-notification:open", listener);
    return () =>
      ipcRenderer.removeListener("task-notification:open", listener);
  }
});
