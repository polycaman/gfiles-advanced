const express = require("express");
const cors = require("cors");
const path = require("path");

class GameServer {
  constructor() {
    this.app = express();
    this.server = null;
    // Detect packaged mode: when app is asar/installed, resourcesPath will contain extraResources.
    const resourcesRoot =
      process.resourcesPath || path.join(__dirname, "../../");
    const packagedAssets = path.join(resourcesRoot, "packaged-assets");
    const isPackaged = require("fs").existsSync(packagedAssets);
    if (isPackaged) {
      this.gamesPath = path.join(packagedAssets, "games");
      this.emulatorsPath = path.join(packagedAssets, "emulators");
    } else {
      this.gamesPath = path.join(__dirname, "../../games");
      this.emulatorsPath = path.join(__dirname, "../../emulators");
    }
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    // Enable CORS for all routes
    this.app.use(
      cors({
        origin: true,
        credentials: true,
      })
    );

    // Set security headers for serving games
    this.app.use((req, res, next) => {
      res.setHeader("Cross-Origin-Embedder-Policy", "unsafe-none");
      res.setHeader("Cross-Origin-Opener-Policy", "unsafe-none");
      res.setHeader("X-Frame-Options", "SAMEORIGIN");
      next();
    });
  }

  setupRoutes() {
    // Health check
    this.app.get("/health", (req, res) => {
      res.json({ status: "ok", timestamp: new Date().toISOString() });
    });

    // Serve games
    this.app.use(
      "/games",
      express.static(this.gamesPath, {
        setHeaders: (res, path, stat) => {
          // Set appropriate headers for different file types
          if (path.endsWith(".html")) {
            res.setHeader("Content-Type", "text/html; charset=utf-8");
          } else if (path.endsWith(".js")) {
            res.setHeader(
              "Content-Type",
              "application/javascript; charset=utf-8"
            );
          } else if (path.endsWith(".css")) {
            res.setHeader("Content-Type", "text/css; charset=utf-8");
          }
        },
      })
    );

    // Serve emulators
    this.app.use(
      "/emulators",
      express.static(this.emulatorsPath, {
        setHeaders: (res, path, stat) => {
          if (path.endsWith(".html")) {
            res.setHeader("Content-Type", "text/html; charset=utf-8");
          } else if (path.endsWith(".js")) {
            res.setHeader(
              "Content-Type",
              "application/javascript; charset=utf-8"
            );
          } else if (path.endsWith(".css")) {
            res.setHeader("Content-Type", "text/css; charset=utf-8");
          }
        },
      })
    );

    // Game launcher endpoint
    this.app.get("/launch/:type/:game", (req, res) => {
      const { type, game } = req.params;

      if (type !== "games" && type !== "emulators") {
        return res.status(400).json({ error: "Invalid game type" });
      }

      const gamePath = type === "games" ? this.gamesPath : this.emulatorsPath;
      const indexPath = path.join(gamePath, game, "index.html");

      try {
        if (!require("fs").existsSync(indexPath)) {
          return res.status(404).json({ error: "Game not found" });
        }

        res.redirect(`/${type}/${game}/`);
      } catch (error) {
        console.error("Error launching game:", error);
        res.status(500).json({ error: "Failed to launch game" });
      }
    });

    // Error handler
    this.app.use((err, req, res, next) => {
      console.error("Server error:", err);
      res.status(500).json({ error: "Internal server error" });
    });

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({ error: "Not found" });
    });
  }

  async start(port = 0) {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(port, "localhost", (err) => {
        if (err) {
          reject(err);
        } else {
          const actualPort = this.server.address().port;
          console.log(`Game server started on http://localhost:${actualPort}`);
          resolve(actualPort);
        }
      });
    });
  }

  stop() {
    if (this.server) {
      this.server.close();
      this.server = null;
      console.log("Game server stopped");
    }
  }
}

let gameServer;
let gameInstances = new Map(); // Track individual game servers

async function startServer(port) {
  if (!gameServer) {
    gameServer = new GameServer();
  }
  return await gameServer.start(port);
}

function stopServer() {
  if (gameServer) {
    gameServer.stop();
    gameServer = null;
  }
}

async function startGameInstance(gameId, gameType, gamePath) {
  // Create a unique key for this game instance
  const instanceKey = `${gameType}-${gameId}`;

  // If instance already exists, return its port
  if (gameInstances.has(instanceKey)) {
    return gameInstances.get(instanceKey).port;
  }

  // Create new server instance for this game
  const gameInstance = new GameServer();
  const port = await gameInstance.start(0); // Use random available port

  // Store the instance
  gameInstances.set(instanceKey, {
    server: gameInstance,
    port: port,
    gameId: gameId,
    gameType: gameType,
    gamePath: gamePath,
    createdAt: Date.now(),
  });

  console.log(`Started game instance for ${instanceKey} on port ${port}`);
  return port;
}

function stopGameInstance(gameId, gameType) {
  const instanceKey = `${gameType}-${gameId}`;

  if (gameInstances.has(instanceKey)) {
    const instance = gameInstances.get(instanceKey);
    instance.server.stop();
    gameInstances.delete(instanceKey);
    console.log(`Stopped game instance for ${instanceKey}`);
    return true;
  }

  return false;
}

function stopAllGameInstances() {
  for (const [key, instance] of gameInstances) {
    instance.server.stop();
    console.log(`Stopped game instance for ${key}`);
  }
  gameInstances.clear();
}

function getGameInstancePort(gameId, gameType) {
  const instanceKey = `${gameType}-${gameId}`;
  const instance = gameInstances.get(instanceKey);
  return instance ? instance.port : null;
}

module.exports = {
  startServer,
  stopServer,
  startGameInstance,
  stopGameInstance,
  stopAllGameInstances,
  getGameInstancePort,
};
