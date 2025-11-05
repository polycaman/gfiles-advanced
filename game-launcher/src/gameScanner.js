const fs = require("fs");
const path = require("path");

class GameScanner {
  constructor() {
    // Resolve paths differently when packaged. packaged-assets is copied by build step.
    const packagedRoot = path.join(
      process.resourcesPath || "",
      "packaged-assets"
    );
    const hasPackaged = process.resourcesPath && fs.existsSync(packagedRoot);
    if (hasPackaged) {
      this.gamesPath = path.join(packagedRoot, "games");
      this.emulatorsPath = path.join(packagedRoot, "emulators");
      console.log("[Scanner] Using packaged assets at", packagedRoot);
    } else {
      this.gamesPath = path.join(__dirname, "../../games");
      this.emulatorsPath = path.join(__dirname, "../../emulators");
      console.log("[Scanner] Using development asset paths");
    }
    this.ignoreList = this.loadIgnoreList();
  }

  async scanGames() {
    try {
      console.log("[Scanner] Scanning games path:", this.gamesPath);
      console.log("[Scanner] Scanning emulators path:", this.emulatorsPath);
      const games = await this.scanDirectory(this.gamesPath, "game");
      const emulators = await this.scanDirectory(
        this.emulatorsPath,
        "emulator"
      );

      return {
        games,
        emulators,
        total: games.length + emulators.length,
      };
    } catch (error) {
      console.error("Error scanning games:", error);
      return { games: [], emulators: [], total: 0 };
    }
  }

  async scanDirectory(dirPath, type) {
    if (!fs.existsSync(dirPath)) {
      console.warn(`Directory not found: ${dirPath}`);
      return [];
    }
    if (process.env.SCANNER_DEBUG === "1") {
      console.log(`[Scanner] Reading directory: ${dirPath}`);
    }

    const items = [];
    const folders = fs
      .readdirSync(dirPath, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

    for (const folder of folders) {
      // Skip ignored folders
      if (this.isIgnored(folder)) {
        continue;
      }
      const folderPath = path.join(dirPath, folder);
      const indexPath = path.join(folderPath, "index.html");

      if (fs.existsSync(indexPath)) {
        const gameInfo = await this.extractGameInfo(folderPath, folder, type);
        items.push(gameInfo);
      }
    }

    return items;
  }

  async extractGameInfo(folderPath, folderName, type) {
    const indexPath = path.join(folderPath, "index.html");

    let title = this.formatGameName(folderName);
    let description = "";
    let thumbnail = null;

    try {
      // Try to extract title from HTML
      const htmlContent = fs.readFileSync(indexPath, "utf8");
      const titleMatch = htmlContent.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch && titleMatch[1]) {
        title = titleMatch[1].trim();
      }

      // Look for common thumbnail/icon files
      const imageExtensions = [".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg"];
      const imageNames = [
        "icon",
        "thumbnail",
        "logo",
        "favicon",
        "preview",
        "cover",
      ];

      for (const name of imageNames) {
        for (const ext of imageExtensions) {
          const imagePath = path.join(folderPath, name + ext);
          if (fs.existsSync(imagePath)) {
            thumbnail = `${name}${ext}`;
            break;
          }
        }
        if (thumbnail) break;
      }

      // Look for meta description
      const descMatch = htmlContent.match(
        /<meta[^>]*name=["\']description["\'][^>]*content=["\']([^"']+)["\'][^>]*>/i
      );
      if (descMatch && descMatch[1]) {
        description = descMatch[1].trim();
      }
    } catch (error) {
      console.warn(`Error reading ${indexPath}:`, error.message);
    }

    return {
      id: folderName,
      title,
      description,
      type,
      path: folderName,
      thumbnail,
      lastModified: fs.statSync(folderPath).mtime,
      size: this.getFolderSize(folderPath),
    };
  }

  formatGameName(folderName) {
    return folderName
      .replace(/([a-z])([A-Z])/g, "$1 $2") // Add space before capital letters
      .replace(/[_-]/g, " ") // Replace underscores and hyphens with spaces
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  }

  getFolderSize(folderPath) {
    try {
      let totalSize = 0;
      const files = fs.readdirSync(folderPath);

      for (const file of files) {
        const filePath = path.join(folderPath, file);
        const stats = fs.statSync(filePath);

        if (stats.isDirectory()) {
          totalSize += this.getFolderSize(filePath);
        } else {
          totalSize += stats.size;
        }
      }

      return totalSize;
    } catch (error) {
      return 0;
    }
  }

  formatFileSize(bytes) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  loadIgnoreList() {
    try {
      const ignorePath = path.join(__dirname, "../config/ignore-games.json");
      if (!fs.existsSync(ignorePath)) {
        console.warn("Ignore list not found, proceeding without exclusions.");
        return [];
      }
      const raw = fs.readFileSync(ignorePath, "utf8");
      const data = JSON.parse(raw);
      if (Array.isArray(data)) {
        console.log(`Loaded ignore list with ${data.length} entries.`);
        return data.map((s) => String(s).trim()).filter(Boolean);
      } else {
        console.warn("Ignore list JSON is not an array; ignoring.");
        return [];
      }
    } catch (err) {
      console.warn("Failed to load ignore list:", err.message);
      return [];
    }
  }

  isIgnored(folderName) {
    return this.ignoreList.includes(folderName);
  }
}

module.exports = new GameScanner();
