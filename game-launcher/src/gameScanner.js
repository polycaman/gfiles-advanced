const fs = require("fs");
const fsp = fs.promises;
const path = require("path");

class GameScanner {
  constructor() {
    const { gamesPath, emulatorsPath } = this.resolveAssetRoots();
    this.gamesPath = gamesPath;
    this.emulatorsPath = emulatorsPath;
    this.ignoreList = this.loadIgnoreList();
    this._ignoreSet = new Set(
      this.ignoreList.map((n) => this.normalizeIgnoreName(n))
    );
    if (process.env.SCANNER_DEBUG === "1") {
      console.log("[Scanner] Ignore raw:", this.ignoreList);
      console.log("[Scanner] Ignore normalized:", [...this._ignoreSet]);
    }
  }

  resolveAssetRoots() {
    const packagedRoot = path.join(
      process.resourcesPath || "",
      "packaged-assets"
    );
    const hasPackaged = process.resourcesPath && fs.existsSync(packagedRoot);
    if (hasPackaged) {
      console.log("[Scanner] Using packaged assets at", packagedRoot);
      return {
        gamesPath: path.join(packagedRoot, "games"),
        emulatorsPath: path.join(packagedRoot, "emulators"),
      };
    }
    console.log("[Scanner] Using development asset paths");
    return {
      gamesPath: path.join(__dirname, "../../games"),
      emulatorsPath: path.join(__dirname, "../../emulators"),
    };
  }

  async scanGames() {
    try {
      const [games, emulators] = await Promise.all([
        this.scanDirectory(this.gamesPath, "game"),
        this.scanDirectory(this.emulatorsPath, "emulator"),
      ]);
      return { games, emulators, total: games.length + emulators.length };
    } catch (error) {
      console.error("Error scanning:", error);
      return { games: [], emulators: [], total: 0 };
    }
  }

  async scanDirectory(dirPath, type) {
    if (!fs.existsSync(dirPath)) {
      console.warn(`Directory not found: ${dirPath}`);
      return [];
    }
    const dirents = await fsp.readdir(dirPath, { withFileTypes: true });
    const folders = dirents.filter((d) => d.isDirectory()).map((d) => d.name);
    const tasks = folders
      .filter((folder) => !this.isIgnored(folder))
      .map((folder) =>
        this.extractGameInfo(path.join(dirPath, folder), folder, type)
      );

    const items = await Promise.all(tasks);
    items.sort((a, b) =>
      a.title.localeCompare(b.title, undefined, { sensitivity: "base" })
    );
    return items;
  }

  async extractGameInfo(folderPath, folderName, type) {
    const indexPath = path.join(folderPath, "index.html");
    let title = this.formatGameName(folderName);
    let description = "";
    let thumbnail = null;
    let thumbnailExternal = false;

    try {
      if (fs.existsSync(indexPath)) {
        const htmlContent = await fsp.readFile(indexPath, "utf8");
        const titleMatch = htmlContent.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch?.[1]) title = titleMatch[1].trim();
        const descMatch = htmlContent.match(
          /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i
        );
        if (descMatch?.[1]) description = descMatch[1].trim();
      }
    } catch (e) {
      if (process.env.SCANNER_DEBUG === "1") {
        console.warn(
          `(Debug) Failed reading index.html for ${folderName}: ${e.message}`
        );
      }
    }

    const thumbData = this.resolveThumbnail(folderName, folderPath);
    thumbnail = thumbData.thumbnail;
    thumbnailExternal = thumbData.external;

    return {
      id: folderName,
      title,
      description,
      type,
      path: folderName,
      thumbnail,
      thumbnailExternal,
      lastModified: this.safeStatMtime(folderPath),
      size: await this.getFolderSize(folderPath),
    };
  }

  resolveThumbnail(folderName, folderPath) {
    // External first
    const screenshotDirs = [
      path.join(__dirname, "../public/screenshots"),
      path.join(process.resourcesPath || "", "public", "screenshots"),
      path.join(process.cwd(), "public", "screenshots"),
    ].filter((p) => fs.existsSync(p));

    for (const dir of screenshotDirs) {
      const candidate = path.join(dir, `${folderName}.png`);
      if (fs.existsSync(candidate)) {
        return { thumbnail: `${folderName}.png`, external: true };
      }
    }

    const preferredOrder = [
      "thumbnail",
      "thumbnail@2x",
      "thumbnail-large",
      "cover",
      "preview",
      "icon",
      "logo",
      "favicon",
    ];
    const exts = [".png", ".webp", ".jpg", ".jpeg", ".gif", ".svg", ".ico"];
    for (const base of preferredOrder) {
      for (const ext of exts) {
        const full = path.join(folderPath, base + ext);
        if (fs.existsSync(full)) {
          return { thumbnail: base + ext, external: false };
        }
      }
    }
    return { thumbnail: null, external: false };
  }

  safeStatMtime(p) {
    try {
      return fs.statSync(p).mtime;
    } catch {
      return new Date(0);
    }
  }

  async getFolderSize(folderPath) {
    let total = 0;
    try {
      const entries = await fsp.readdir(folderPath, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(folderPath, entry.name);
        try {
          const stat = await fsp.stat(full);
          if (stat.isDirectory()) {
            total += await this.getFolderSize(full);
          } else {
            total += stat.size;
          }
        } catch {}
      }
    } catch {
      return 0;
    }
    return total;
  }

  formatGameName(name) {
    return name
      .replace(/[_-]/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  }

  loadIgnoreList() {
    try {
      const ignorePath = path.join(__dirname, "../config/ignore-games.json");
      if (!fs.existsSync(ignorePath)) return [];
      const data = JSON.parse(fs.readFileSync(ignorePath, "utf8"));
      return Array.isArray(data)
        ? data.map((s) => String(s).trim()).filter(Boolean)
        : [];
    } catch (e) {
      if (process.env.SCANNER_DEBUG === "1") {
        console.warn("[Scanner] Ignore list read error:", e.message);
      }
      return [];
    }
  }

  normalizeIgnoreName(name) {
    return name
      .toLowerCase()
      .replace(/[\s_-]+/g, "")
      .trim();
  }

  isIgnored(folderName) {
    const rawNorm = this.normalizeIgnoreName(folderName);
    const formattedNorm = this.normalizeIgnoreName(
      this.formatGameName(folderName)
    );
    const ignored =
      this._ignoreSet.has(rawNorm) || this._ignoreSet.has(formattedNorm);
    if (ignored && process.env.SCANNER_DEBUG === "1") {
      console.log(`[Scanner] Ignored folder: ${folderName} (norm=${rawNorm})`);
    }
    return ignored;
  }
}

module.exports = new GameScanner();
