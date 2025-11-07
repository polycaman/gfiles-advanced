const fs = require("fs");
const path = require("path");
const fse = require("fs-extra");

const root = path.join(__dirname, "..");
const gamesSrc = path.join(root, "../games");
const emulatorsSrc = path.join(root, "../emulators");
const configIgnorePath = path.join(root, "config/ignore-games.json");
const outDir = path.join(root, "packaged-assets");

function loadIgnoreList() {
  try {
    if (!fs.existsSync(configIgnorePath)) return [];
    const raw = fs.readFileSync(configIgnorePath, "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data)
      ? data.map((s) => String(s).trim()).filter(Boolean)
      : [];
  } catch (e) {
    console.warn("Failed to read ignore list:", e.message);
    return [];
  }
}

function copyFiltered(srcDir, targetDir, ignore) {
  if (!fs.existsSync(srcDir)) return;
  for (const entry of fs.readdirSync(srcDir)) {
    const full = path.join(srcDir, entry);
    if (!fs.statSync(full).isDirectory()) continue;
    if (ignore.includes(entry)) {
      console.log("Skipping ignored", entry);
      continue;
    }
    fse.copySync(full, path.join(targetDir, entry));
  }
}

function main() {
  const ignore = loadIgnoreList();
  if (fs.existsSync(outDir)) {
    fse.removeSync(outDir);
  }
  fs.mkdirSync(outDir);
  const gamesOut = path.join(outDir, "games");
  const emulatorsOut = path.join(outDir, "emulators");
  fs.mkdirSync(gamesOut);
  fs.mkdirSync(emulatorsOut);

  copyFiltered(gamesSrc, gamesOut, ignore);
  copyFiltered(emulatorsSrc, emulatorsOut, ignore);

  console.log("Prepared packaged assets. Ignored count:", ignore.length);
}

main();
