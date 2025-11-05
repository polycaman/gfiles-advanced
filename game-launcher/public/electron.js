const { app, BrowserWindow, ipcMain, shell, nativeImage } = require("electron");
const path = require("path");
const isDev = require("electron-is-dev");
const {
  startServer,
  stopServer,
  startGameInstance,
  stopGameInstance,
  stopAllGameInstances,
} = require("../src/server");

let mainWindow;
let gameWindows = new Map(); // Track multiple game windows
let serverPort;
// Promote app icon to module scope so game windows can reuse it.
let appIconGlobal = null;

function createWindow() {
  // Determine if we should treat this as production even if electron-is-dev reports dev.
  const forceProd = process.env.ELECTRON_IS_DEV === "0";
  const runningDev = isDev && !forceProd;

  // Load single SVG icon (icon.svg) instead of generated raster set.
  let appIcon;
  try {
    const fs = require("fs");
    const svgPath = app.isPackaged
      ? path.join(process.resourcesPath, "public", "icon.svg")
      : path.join(__dirname, "icon.svg");
    if (fs.existsSync(svgPath)) {
      appIcon = nativeImage.createFromPath(svgPath);
      if (appIcon.isEmpty()) {
        console.warn("[ICON] icon.svg loaded but empty.");
      } else if (process.env.ICON_DEBUG === "1") {
        console.log("[ICON] Loaded SVG icon at", svgPath);
      }
    } else {
      console.warn("[ICON] icon.svg not found at", svgPath);
    }
  } catch (e) {
    console.warn("[ICON] Failed to load icon.svg:", e.message);
  }

  // Cache globally
  if (appIcon) {
    appIconGlobal = appIcon;
  }
  if (process.platform === "darwin" && appIconGlobal) {
    app.dock.setIcon(appIconGlobal);
  }

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, "preload.js"),
      // Only disable webSecurity in actual development browser mode
      webSecurity: runningDev ? false : true,
      allowRunningInsecureContent: false,
    },
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    show: false,
  icon: appIconGlobal || path.join(__dirname, "icon.svg"),
  });

  // Optional cache clearing before first load
  if (process.env.CLEAR_CACHE === "1") {
    const ses = mainWindow.webContents.session;
    Promise.all([
      ses.clearCache(),
      ses.clearStorageData({
        storages: [
          "localstorage",
          "indexdb",
          "serviceworkers",
          "cookies",
          "filesystem",
        ],
        quotas: ["temporary", "persistent", "syncable"],
      }),
    ])
      .then(() => {
        console.log("Cache & storage cleared before initial load.");
      })
      .catch((err) => console.warn("Failed to clear cache:", err));
  }

  let startUrl;
  if (runningDev) {
    startUrl = "http://localhost:3000";
  } else {
    startUrl = `file://${path.join(__dirname, "../build/index.html")}`;
  }

  // Try to load; if dev URL fails, fallback to build.
  mainWindow.loadURL(startUrl).catch((err) => {
    console.warn(
      "Primary start URL failed, falling back to build index.html",
      err
    );
    const fallback = `file://${path.join(__dirname, "../build/index.html")}`;
    mainWindow.loadURL(fallback);
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
    for (const [gameId, gameData] of gameWindows) {
      gameData.window.close();
    }
    gameWindows.clear();
  });

  if (runningDev) {
    mainWindow.webContents.openDevTools();
  }
}

async function createGameWindow(gameUrl, gameId, gameType) {
  // Close existing window for this game if it exists
  if (gameWindows.has(gameId)) {
    const existingWindow = gameWindows.get(gameId);
    existingWindow.window.close();
  }

  const forceProd = process.env.ELECTRON_IS_DEV === "0";
  const runningDev = isDev && !forceProd;

  const gameWindow = new BrowserWindow({
    fullscreen: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      // Keep webSecurity enabled in production for game windows
      webSecurity: runningDev ? false : true,
      allowRunningInsecureContent: false,
    },
    title: "Game Player",
    show: false,
  icon: appIconGlobal || path.join(__dirname, "icon.svg"),
  });

  gameWindow.loadURL(gameUrl);

  gameWindow.once("ready-to-show", () => {
    gameWindow.show();
  });

  gameWindow.on("closed", () => {
    // Stop the individual game server when window closes
    stopGameInstance(gameId, gameType);
    gameWindows.delete(gameId);
    console.log(`Game window closed for ${gameId}, server stopped`);
  });

  // Store the window reference
  gameWindows.set(gameId, {
    window: gameWindow,
    gameId: gameId,
    gameType: gameType,
  });

  return gameWindow;
}

app.whenReady().then(async () => {
  try {
    // Start the HTTP server
    serverPort = await startServer();
    console.log(`Game server started on port ${serverPort}`);

    createWindow();
  } catch (error) {
    console.error("Failed to start server:", error);
    app.quit();
  }
});

// IPC to clear cache & reload on demand
ipcMain.handle("clear-cache-and-reload", async () => {
  if (!mainWindow) return false;
  const ses = mainWindow.webContents.session;
  try {
    await ses.clearCache();
    await ses.clearStorageData({
      storages: [
        "localstorage",
        "indexdb",
        "serviceworkers",
        "cookies",
        "filesystem",
      ],
      quotas: ["temporary", "persistent", "syncable"],
    });
    console.log("Cache cleared via IPC; reloading main window.");
    mainWindow.reload();
    return true;
  } catch (e) {
    console.warn("Cache clear failed:", e.message);
    return false;
  }
});

app.on("window-all-closed", () => {
  stopAllGameInstances();
  stopServer();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC handlers
ipcMain.handle("get-games", async () => {
  try {
    console.log("IPC: get-games called");
    const gameScanner = require("../src/gameScanner");
    const result = await gameScanner.scanGames();
    console.log("IPC: get-games result:", result);
    return result;
  } catch (error) {
    console.error("IPC: get-games error:", error);
    throw error;
  }
});

ipcMain.handle("launch-game", async (event, gamePath, gameType) => {
  try {
    console.log(
      `IPC: launch-game called with path: ${gamePath}, type: ${gameType}`
    );

    // Start individual game server instance
    const gamePort = await startGameInstance(gamePath, gameType, gamePath);
    const gameUrl = `http://localhost:${gamePort}/${gameType}/${gamePath}/`;

    console.log(`IPC: launching game at URL: ${gameUrl}`);
    await createGameWindow(gameUrl, gamePath, gameType);
    return gameUrl;
  } catch (error) {
    console.error("IPC: launch-game error:", error);
    throw error;
  }
});

ipcMain.handle("get-server-port", () => {
  console.log(`IPC: get-server-port returning: ${serverPort}`);
  return serverPort;
});
