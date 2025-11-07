const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const DEFAULT_GAME_TYPES = new Set(["games", "emulators"]);

function safeExists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function detectPaths() {
  let electronApp;
  try {
    electronApp = require("electron").app;
  } catch {
    /* optional */
  }
  const isPackagedFlag = electronApp ? electronApp.isPackaged : false;
  const resourcesRoot = isPackagedFlag
    ? process.resourcesPath
    : path.join(__dirname, "../../");
  const packagedAssets = path.join(resourcesRoot, "packaged-assets");
  const packaged = isPackagedFlag && safeExists(packagedAssets);

  const baseGames = packaged
    ? path.join(packagedAssets, "games")
    : path.join(__dirname, "../../games");
  const baseEmus = packaged
    ? path.join(packagedAssets, "emulators")
    : path.join(__dirname, "../../emulators");

  const screenshotCandidates = [
    path.join(__dirname, "../public/screenshots"),
    path.join(resourcesRoot, "public", "screenshots"),
  ];
  const screenshots = screenshotCandidates.find(safeExists) || null;

  return {
    packaged,
    gamesPath: baseGames,
    emulatorsPath: baseEmus,
    screenshotsPath: screenshots,
    resourcesRoot,
  };
}

function buildStatic(rootPath) {
  return express.static(rootPath, {
    fallthrough: true,
  });
}

function sanitizeSegment(seg) {
  if (!/^[a-zA-Z0-9._-]+$/.test(seg)) return null;
  return seg;
}

class GameServer {
  constructor(opts = {}) {
    const {
      logger = console,
      host = process.env.HOST || "127.0.0.1",
      allowedGameTypes = DEFAULT_GAME_TYPES,
      cooperativeIsolation = false,
      pathsConfig = detectPaths(),
    } = opts;

    this.logger = logger;
    this.host = host;
    this.allowedGameTypes = allowedGameTypes;
    this.cooperativeIsolation = cooperativeIsolation;
    this.paths = pathsConfig;

    this.app = express();
    this.server = null;

    this._setupMiddleware();
    this._setupRoutes();
  }

  _setupMiddleware() {
    this.app.use(cors({ origin: true, credentials: true }));
    this.app.use(express.json({ limit: "1mb" }));

    this.app.use((req, res, next) => {
      if (this.cooperativeIsolation) {
        res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
        res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
      } else {
        res.setHeader("Cross-Origin-Embedder-Policy", "unsafe-none");
        res.setHeader("Cross-Origin-Opener-Policy", "unsafe-none");
      }
      res.setHeader("X-Frame-Options", "SAMEORIGIN");
      next();
    });
  }

  _setupRoutes() {
    this.app.get("/health", (req, res) => {
      res.json({ status: "ok", ts: Date.now(), packaged: this.paths.packaged });
    });

    this.app.use("/games", buildStatic(this.paths.gamesPath));
    this.app.use("/emulators", buildStatic(this.paths.emulatorsPath));

    if (this.paths.screenshotsPath) {
      this.logger.log("[Server] Screenshots:", this.paths.screenshotsPath);
      this.app.use("/screenshots", buildStatic(this.paths.screenshotsPath));
    } else {
      this.logger.log("[Server] No screenshots directory found.");
    }

    this.app.get("/launch/:type/:game", (req, res) => {
      const rawType = req.params.type;
      const rawGame = req.params.game;

      const type = sanitizeSegment(rawType);
      const game = sanitizeSegment(rawGame);

      if (!type || !this.allowedGameTypes.has(type)) {
        return res.status(400).json({ error: "Invalid game type" });
      }
      if (!game) {
        return res.status(400).json({ error: "Invalid game id" });
      }

      const root =
        type === "games" ? this.paths.gamesPath : this.paths.emulatorsPath;
      const indexPath = path.join(root, game, "index.html");

      if (!safeExists(indexPath)) {
        return res.status(404).json({ error: "Game not found" });
      }

      res.redirect(`/${type}/${encodeURIComponent(game)}/`);
    });

    if (process.env.NODE_ENV !== "production") {
      this.app.get("/_status", (req, res) => {
        res.json({
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          paths: this.paths,
        });
      });
    }

    this.app.use((req, res) => {
      res.status(404).json({ error: "Not found" });
    });

    // eslint-disable-next-line no-unused-vars
    this.app.use((err, req, res, next) => {
      this.logger.error("Server error:", err);
      res.status(500).json({ error: "Internal server error" });
    });
  }

  start(port = 0) {
    if (this.server) return Promise.resolve(this.server.address().port);
    return new Promise((resolve, reject) => {
      const srv = this.app.listen(port, this.host, (err) => {
        if (err) return reject(err);
        this.server = srv;
        const actual = srv.address().port;
        this.logger.log(`Game server listening http://${this.host}:${actual}`);
        resolve(actual);
      });
    });
  }

  async stop() {
    if (!this.server) return;
    const srv = this.server;
    this.server = null;
    await new Promise((resolve) => srv.close(resolve));
    this.logger.log("Game server stopped");
  }
}

//.  Instance Management
let mainServer;
const gameInstances = new Map();

function getInstanceKey(gameId, gameType) {
  return `${gameType}::${gameId}`;
}

async function startServer(port) {
  if (!mainServer) {
    mainServer = new GameServer();
  }
  return mainServer.start(port);
}

async function stopServer() {
  if (mainServer) {
    await mainServer.stop();
    mainServer = null;
  }
}

async function startGameInstance(gameId, gameType) {
  const type = sanitizeSegment(gameType);
  const gid = sanitizeSegment(gameId);
  if (!type || !gid) throw new Error("Invalid game id or type");
  const key = getInstanceKey(gid, type);
  if (gameInstances.has(key)) {
    return gameInstances.get(key).port;
  }

  const basePaths = mainServer ? mainServer.paths : detectPaths();
  const instance = new GameServer({ pathsConfig: basePaths });

  const port = await instance.start(0);
  gameInstances.set(key, {
    server: instance,
    port,
    gameId: gid,
    gameType: type,
    createdAt: Date.now(),
  });
  console.log(`Started game instance ${key} on :${port}`);
  return port;
}

async function stopGameInstance(gameId, gameType) {
  const key = getInstanceKey(gameId, gameType);
  const meta = gameInstances.get(key);
  if (!meta) return false;
  await meta.server.stop();
  gameInstances.delete(key);
  console.log(`Stopped game instance ${key}`);
  return true;
}

async function stopAllGameInstances() {
  const stops = [];
  for (const [key, meta] of gameInstances.entries()) {
    stops.push(
      meta.server.stop().then(() => console.log(`Stopped game instance ${key}`))
    );
  }
  await Promise.allSettled(stops);
  gameInstances.clear();
}

function getGameInstancePort(gameId, gameType) {
  const key = getInstanceKey(gameId, gameType);
  return gameInstances.get(key)?.port || null;
}

module.exports = {
  startServer,
  stopServer,
  startGameInstance,
  stopGameInstance,
  stopAllGameInstances,
  getGameInstancePort,
  GameServer,
};
