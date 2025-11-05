[![Stars](https://img.shields.io/github/stars/polycaman/gfiles-advanced?style=for-the-badge)](https://github.com/polycaman/gfiles-advanced/stargazers) [![Issues](https://img.shields.io/github/issues/polycaman/gfiles-advanced?style=for-the-badge)](https://github.com/polycaman/gfiles-advanced/issues) [![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](LICENSE) ![Electron](https://img.shields.io/badge/Electron-Game%20Launcher-9cf?style=for-the-badge)

# GFiles Advanced Game Launcher

> A polished, offline-first Electron + React launcher for the classic GFiles game collection. Browse, search, and play hundreds of HTML5, canvas, WebGL, and emulator-backed titles locally with an integrated lightweight HTTP server.

---

## Table of Contents

1. Motivation & Vision
2. Features
3. Quick Start
4. Build From Source
5. Game & Emulator Management
6. Ignoring Broken / Unsupported Games
7. Folder Structure Overview
8. Contributing
9. License

---

## 1. Motivation & Vision

This project aims to preserve and make easily accessible a curated library of browser games. Running locally gives you:

- Zero dependency on remote hosting outages
- Faster load times (assets served from disk)
- Ability to package, ignore, or patch games
- A foundation to extend (themes, search, tagging, statistics, achievements, etc.)

## 2. Features

- Offline play backed by a local Express HTTP server
- Electron shell with React front-end
- Asset preparation pipeline (`prepare:assets`)
- Cross-platform build targets (macOS, Windows, Linux via electron-builder)
- Ignore list for broken or unwanted games (`config/ignore-games.json`)
- Packaged assets bundling for distribution
- MIT licensed, fork-friendly

## 3. Quick Start (Binary Usage)

If release binaries are provided:

1. Download the latest release for your OS from the GitHub Releases page.
2. Install/run the app.

## 4. Build From Source

Requires Node.js (prefer LTS) and npm.

```bash
git clone https://github.com/polycaman/gfiles-advanced.git
cd gfiles-advanced/game-launcher
npm install
# Development (React dev server + Electron)
npm run dev
# Production preview (no React hot reload)
npm run start
```

### Packaging

```bash
# Create distributable installers (platform-specific)
npm run dist
# Directory build (unpacked) for inspection
npm run pack
```

### macOS Specific

For unsigned builds on macOS, you may need to right-click > Open the first time to bypass Gatekeeper.

## 5. Game & Emulator Management

- Add game folders under `games/` (each isolated with its own assets).
- Add emulators under `emulators/` (e.g., Ruffle or RetroArch build integrations).
- The launcher scans folders dynamically (see `src/gameScanner.js` inside `game-launcher`).

## 6. Ignoring Broken / Unsupported Games

To hide specific folders from the UI, create or edit `game-launcher/config/ignore-games.json`:

```jsonc
[
  // Exact folder names only:
  "example-broken-game",
  "legacy-test"
]
```

Rules:

- Must match folder names under `games/` or `emulators/` exactly.
- File optional; if missing or malformed, nothing is excluded.
- Keep list small—logically prune rather than bulk ignore.

## 7. Folder Structure (High-Level)

```
gfiles-advanced/
├─ games/            # Individual game directories
├─ emulators/        # Emulator integrations (e.g., Ruffle)
├─ game-launcher/    # Electron + React launcher app
│  ├─ src/           # Front-end & backend helper scripts
│  ├─ public/        # Electron main process entry + static assets
│  ├─ config/        # Config files (ignore list, etc.)
│  ├─ packaged-assets/ # Assets prepared for distribution
│  ├─ scripts/       # Build utility scripts (icons, assets)
│  └─ dist/          # Output builds (after packaging)
```

## 8. Contributing

Contributions are welcome:

1. Fork the repo
2. Create a feature branch (`feat/<short-name>`)
3. Run lint & build locally
4. Open a Pull Request with a concise description

### Ideas for Contribution

- Tagging & filtering UI for games
- Game metadata ingestion (JSON descriptors)
- Achievements or playtime tracking
- Theme customization / dark mode refinements
- Search improvements (fuzzy, by genre)

## 9. License

This project is licensed under the MIT License. See the `license` field in `game-launcher/package.json`. (If desired, add a top-level `LICENSE` file for clarity.)

## FAQ

**Q: Are all games guaranteed to work offline?**  
Not always—some games might reference external CDNs. Those can be patched or mirrored.

**Q: Why an HTTP server?**  
Many older games rely on relative asset fetches or XHR; serving via Express avoids CORS/file:// pitfalls.

---

Enjoy exploring and extending the launcher. PRs & feedback welcome!
