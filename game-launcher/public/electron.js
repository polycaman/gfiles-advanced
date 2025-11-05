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

async function createWindow() {
  // Determine if we should treat this as production even if electron-is-dev reports dev.
  const forceProd = process.env.ELECTRON_IS_DEV === "0";
  const runningDev = isDev && !forceProd;

  // Load single SVG icon (logo.svg) instead of generated raster set.
  let appIcon;
  try {
    const fs = require("fs");
    const svgPath = app.isPackaged
      ? path.join(process.resourcesPath, "public", "logo.svg")
      : path.join(__dirname, "logo.svg");
    if (fs.existsSync(svgPath)) {
      appIcon = nativeImage.createFromPath(svgPath);
      if (appIcon.isEmpty()) {
        console.warn("[ICON] logo.svg loaded but empty.");
      } else if (process.env.ICON_DEBUG === "1") {
        console.log("[ICON] Loaded SVG logo at", svgPath);
      }
    } else {
      console.warn("[ICON] logo.svg not found at", svgPath);
    }
  } catch (e) {
    console.warn("[ICON] Failed to load logo.svg:", e.message);
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
    icon: appIconGlobal || path.join(__dirname, "logo.svg"),
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

  // Establish initial load target.
  const fs = require("fs");
  const buildIndexPath = path.join(__dirname, "../build/index.html");

  if (runningDev) {
    // Dev: use CRA dev server; electron.js is started after wait-on in npm script.
    try {
      await mainWindow.loadURL("http://localhost:3000");
    } catch (err) {
      console.warn("[LOAD] Dev server load failed", err.message);
      mainWindow.loadURL(
        "data:text/html,<h1>Dev server unreachable</h1><p>Çalıştır: <code>npm run start:dev</code></p>"
      );
    }
  } else {
    // Production style: prefer loadFile for local build to avoid 'Not allowed to load local resource'.
    try {
      if (fs.existsSync(buildIndexPath)) {
        await mainWindow.loadFile(buildIndexPath);
        console.log("[LOAD] Loaded build via loadFile:", buildIndexPath);
      } else {
        console.warn("[LOAD] build/index.html bulunamadı:", buildIndexPath);
        mainWindow.loadURL(
          "data:text/html,<h1>Build eksik</h1><p>'npm run build' çalıştırıp sonra 'npm start' deneyin.</p>"
        );
      }
    } catch (err) {
      console.warn("[LOAD] build yüklenemedi", err.message);
      mainWindow.loadURL(
        "data:text/html,<h1>Yükleme hatası</h1><p>Yerel kaynağa erişilemedi. 'npm run build' sonrası tekrar başlatın.</p>"
      );
    }
  }

  // Diagnostics for blank screen troubleshooting
  mainWindow.webContents.on("did-finish-load", () => {
    console.log("[WINDOW] did-finish-load", mainWindow.webContents.getURL());
    // Inject a quick JS check for React root.
    mainWindow.webContents
      .executeJavaScript(
        "(function(){const el=document.getElementById('root');return el && el.childElementCount;})()"
      )
      .then((count) => {
        if (!count) {
          console.warn(
            "[DIAG] #root has no children after load; React may not have mounted yet."
          );
        }
      })
      .catch(() => {});
  });
  mainWindow.webContents.on(
    "did-fail-load",
    (e, ec, desc, url, isMainFrame) => {
      console.warn(
        "[WINDOW] did-fail-load",
        ec,
        desc,
        url,
        "mainFrame=",
        isMainFrame
      );
    }
  );
  // Timeout fallback if nothing rendered in dev
  if (runningDev) {
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents
          .executeJavaScript(
            "document.getElementById('root') && document.getElementById('root').childElementCount"
          )
          .then((count) => {
            if (!count) {
              console.warn(
                "[FALLBACK] React dev server content not mounted; showing diagnostic page."
              );
              mainWindow.loadURL(
                "data:text/html,<h1>React dev server blank</h1><p>Port 3000 may not have started yet. Try re-running: npm run start:dev</p>"
              );
            }
          })
          .catch(() => {});
      }
    }, 5000);
  }

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
    icon: appIconGlobal || path.join(__dirname, "logo.svg"),
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
    serverPort = await startServer();
    console.log(`Game server started on port ${serverPort}`);
    await createWindow();
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
    createWindow(); // fire-and-forget
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
