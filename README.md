[![Stars](https://img.shields.io/github/stars/polycaman/gfiles-advanced?style=for-the-badge)](https://github.com/polycaman/gfiles-advanced/stargazers) [![Issues](https://img.shields.io/github/issues/polycaman/gfiles-advanced?style=for-the-badge)](https://github.com/polycaman/gfiles-advanced/issues) [![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](LICENSE) ![Electron](https://img.shields.io/badge/Electron-Game%20Launcher-9cf?style=for-the-badge)

# GFiles Advanced Game Launcher

> An electron launcher that lets you place gfiles HTML5 game collection offline. Technically, it gives you the option to search through games, play them full screen while they are atuomatically served by a HTTP server in the background.

# How to install?

Go ahead and download the app from the releases.

# How to use?
Open the app, click on a game and play. On windows, click <code>Ctrl + W</code> to close games or select <code>Window -> Close</code> from the top menu. Each game has it's own control set.

If you have any issues with any games, please open up an issue on GitHub.

# How can I build it myself?
It is quite simple, you need to have NodeJS installed locally.
1. Clone the repository to your local. 
2. The project is in the game-launcher folder, so run <code>cd game-launcher</code> in your terminal.
3. Run <code>npm install</code> first.
4. Depending on you OS, either run:
 - <code>npm run dist:win</code> for Windows
 - <code>npm run dist:linux</code> for Linux
 - <code>npm run dist:mac</code> for MacOS
5. You are done, it is in <code>dist</code> folder.

Note: For Windows you need to have the Developer Mode open.

# Ignored Games
Currently 37 games are ignored and not included in the releases. This is due to either the games are not working or the games are buggy. <code>game-launcher/config/ignore-games.json</code> is where we set the ignored games, the names has to match the folder name of the games or emulators from the original repository.
If new games are added and some of them are fixed, we can add or remove games from this list. 
Original repository owncer can also have a look at this list to understand which games are not working.

# Folder Structure (High-Level)

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

## Contributing

Contributions are welcome:

1. Fork the repo
2. Create a feature branch (`feat/<short-name>`)
3. Run build locally
4. Open a Pull Request with a concise description

### Ideas for Contribution

- Tagging & filtering UI for games
- Game metadata ingestion (JSON descriptors)
- Achievements or playtime tracking
- Theme customization / dark mode refinements
- Search improvements (fuzzy, by genre)