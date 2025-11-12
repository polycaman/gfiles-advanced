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
let gameWindows = new Map();
let serverPort;
let appIconGlobal = null;
if (process.platform === 'win32' && !process.env.WEBGL_FORCE && !process.env.WEBGL_LEGACY && process.env.WEBGL_NO_LEGACY !== '1') {
  process.env.WEBGL_LEGACY = '1';
  console.log('[BOOT] win32 platform detected; defaulting WEBGL_LEGACY=1 (set WEBGL_NO_LEGACY=1 to disable)');
}

if (process.env.WEBGL_FORCE === "1") {
  try {
    console.log("[WEBGL_FORCE] Applying GPU/WebGL command line switches");
    app.commandLine.appendSwitch("ignore-gpu-blacklist");
    app.commandLine.appendSwitch("enable-webgl");
    app.commandLine.appendSwitch("use-angle", "d3d11");
    app.commandLine.appendSwitch("disable-gpu-sandbox");
    app.commandLine.appendSwitch("enable-gpu-rasterization");
    app.commandLine.appendSwitch("enable-zero-copy");
    app.commandLine.appendSwitch("enable-webgl-developer-extensions");
  } catch (e) {
    console.warn("[WEBGL_FORCE] Failed to set GPU flags:", e.message);
  }
}

if (process.env.WEBGL_LEGACY === "1") {
  try {
    console.log("[WEBGL_LEGACY] Applying legacy GPU fallback switches");
    app.commandLine.appendSwitch("disable-vulkan");
    app.commandLine.appendSwitch("ignore-gpu-blacklist");
    app.commandLine.appendSwitch("enable-webgl");
    app.commandLine.appendSwitch("use-angle", "d3d11");
    app.commandLine.appendSwitch("disable-gpu-rasterization");
    app.commandLine.appendSwitch("disable-zero-copy");
    app.commandLine.appendSwitch("disable-direct-composition");
    app.commandLine.appendSwitch("enable-webgl-software-renderer");
  } catch (e) {
    console.warn("[WEBGL_LEGACY] Failed to set legacy GPU flags:", e.message);
  }
}

let gpuCrashCount = 0;
app.on("child-process-gone", (event, details) => {
  if (details.type === "GPU") {
    gpuCrashCount++;
    console.error(`[GPU_CRASH] gpuCrashCount=${gpuCrashCount} reason=${details.reason} exitCode=${details.exitCode}`);
    if (gpuCrashCount === 2) {
      console.warn("[GPU_CRASH] Multiple GPU crashes. Try: npm run start:webgl OR npm run start:webgl:legacy OR update drivers.");
    }
    if (gpuCrashCount === 3 && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.executeJavaScript(
        "(function(){if(!document.getElementById('gpu-warn')){var d=document.createElement('div');d.id='gpu-warn';d.style.cssText='position:fixed;top:0;left:0;right:0;background:#b30000;color:#fff;font:14px sans-serif;padding:8px;z-index:9999';d.textContent='GPU süreci tekrar tekrar çöküyor. WebGL devre dışı. Sürücüleri güncelleyin veya legacy modu deneyin (start:webgl:legacy).';document.body.appendChild(d);} })();"
      ).catch(()=>{});
    }
  }
});

function injectWebGLDiagnostics(targetWindow, label = "MAIN") {
  if (!targetWindow || targetWindow.isDestroyed()) return;
  targetWindow.webContents
    .executeJavaScript(
      `(() => {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        const support = !!gl;
        let info = {};
        if (gl) {
          const dbgInfo = gl.getExtension('WEBGL_debug_renderer_info');
          if (dbgInfo) {
            info.vendor = gl.getParameter(dbgInfo.UNMASKED_VENDOR_WEBGL);
            info.renderer = gl.getParameter(dbgInfo.UNMASKED_RENDERER_WEBGL);
          } else {
            info.vendor = 'N/A';
            info.renderer = 'N/A';
          }
          info.version = gl.getParameter(gl.VERSION);
          info.shadingLanguage = gl.getParameter(gl.SHADING_LANGUAGE_VERSION);
        }
        return { support, info };
      })();`
    )
    .then((res) => {
      console.log(`[WEBGL_DIAG:${label}] support=${res.support}`, res.info);
    })
    .catch((e) => console.warn(`[WEBGL_DIAG:${label}] JS exec failed`, e));
}

async function logGPUInfoOnce() {
  try {
    const gpuInfo = await app.getGPUInfo("complete");
    console.log("[GPU_INFO]", {
      amdSwitchable: gpuInfo.amdSwitchable,
      gpuDevice: gpuInfo.gpuDevice,
      driverBugWorkarounds: gpuInfo.driverBugWorkarounds,
      videoDecodeAcceleratorCapabilities: gpuInfo.videoDecodeAcceleratorCapabilities,
      auxAttributes: gpuInfo.auxAttributes,
    });
  } catch (e) {
    console.warn("[GPU_INFO] retrieval failed:", e.message);
  }
}

async function createWindow() {
  const forceProd = process.env.ELECTRON_IS_DEV === "0";
  const runningDev = isDev && !forceProd;

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
      webSecurity: runningDev ? false : true,
      allowRunningInsecureContent: false,
    },
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    show: false,
    icon: appIconGlobal || path.join(__dirname, "logo.svg"),
  });

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

  const fs = require("fs");
  const buildIndexPath = path.join(__dirname, "../build/index.html");

  if (runningDev) {
    try {
      await mainWindow.loadURL("http://localhost:3000");
    } catch (err) {
      console.warn("[LOAD] Dev server load failed", err.message);
      mainWindow.loadURL(
        "data:text/html,<h1>Dev server unreachable</h1><p>Çalıştır: <code>npm run start:dev</code></p>"
      );
    }
  } else {
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

  mainWindow.webContents.on("did-finish-load", () => {
    console.log("[WINDOW] did-finish-load", mainWindow.webContents.getURL());
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
        // After initial content load, run WebGL diagnostics.
        injectWebGLDiagnostics(mainWindow, "MAIN");
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
            // Re-run diagnostics after fallback check (in case of delayed mount).
            injectWebGLDiagnostics(mainWindow, "MAIN-LATE");
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
    injectWebGLDiagnostics(gameWindow, `GAME:${gameId}`);
  });

  gameWindow.on("closed", () => {
    stopGameInstance(gameId, gameType);
    gameWindows.delete(gameId);
    console.log(`Game window closed for ${gameId}, server stopped`);
  });

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
    // Log GPU info after initial window creation.
    logGPUInfoOnce();
  } catch (error) {
    console.error("Failed to start server:", error);
    app.quit();
  }
});

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
