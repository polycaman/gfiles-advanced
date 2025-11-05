const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  getGames: () => ipcRenderer.invoke("get-games"),
  launchGame: (gamePath, gameType) =>
    ipcRenderer.invoke("launch-game", gamePath, gameType),
  getServerPort: () => ipcRenderer.invoke("get-server-port"),
  clearCacheAndReload: () => ipcRenderer.invoke("clear-cache-and-reload"),
});
