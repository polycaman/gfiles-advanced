# GFiles Game Launcher

GFiles Game Launcher; orijinal GFiles projesinin Electron tabanlı yerel (offline) çalıştırma sürümüdür. Bu uygulama bilgisayarındaki GFiles oyunlarını bir merkez (hub) gibi tarar, listeler ve internet bağlantısına gerek kalmadan tek tıkla açmanı sağlar. İstersen hazır bir sürümü indirip kullanabilir, istersen kaynak koddan kendin derleyebilirsin.

English summary: GFiles Game Launcher is an Electron-based application designed for playing the original GFiles games locally. This repository is a fork of the original GFiles project. The launcher works as a game hub, allowing you to browse and run the games offline on your computer. You can either download a release version or build it yourself from the source.

## Features

- 🎮 **Game Library**: Automatically scans and displays all games from your `games/` and `emulators/` folders (offline)
- 🔍 **Search & Filter**: Search games by name and filter by category (Games/Emulators)
- 📱 **Responsive Design**: Optimized for different screen sizes
- 🚀 **One-Click Launch**: Launch games directly in a new window
- 🎨 **Modern UI**: Dark theme with smooth animations and hover effects
- 📊 **Game Info**: Shows game metadata, file size, and last modified date
- 🖼️ **Thumbnails**: Automatically detects and displays game thumbnails

## Icon Assets

Artık temel kaynak ikon dosyamız `public/logo.svg`. Bu SVG'den otomatik olarak platform paketleme için gereken raster ikonlar üretilir:

- `public/icons/icon.ico` (Windows)
- `public/icons/icon.icns` (macOS)
- `public/icons/icon-256.png` / `icon-512.png` (Linux ve yedekler)

Oluşturma işlemi için bir script vardır:

```bash
npm run generate:icons
```

Bu script `logo.svg` üzerinden gerekli boyutları yeniden üretir. Eğer özel bir tasarımla güncellerseniz sadece `logo.svg` dosyasını değiştirip scripti çalıştırın.

Temizlik Yapılanlar:

- Eski `icon.svg` kaldırıldı.
- Build çıktısındaki gereksiz kopya ikon dosyaları temizlendi.

Notlar:

- Dağıtım yapılmadan önce ikonları değiştirmek isterseniz SVG'yi güncellemeniz yeterli.
- Linux dağıtımında electron-builder en büyük uygun PNG'yi seçebilir; hem 256 hem 512 tutulabilir. İhtiyaç duymazsanız fazlalıkları silebilirsiniz.

## Generated Artifacts & Cleanup

The following directories/files are generated and should not be committed. They are safe to delete at any time; scripts will recreate them when needed:

| Path               | Source                      | Recreated By                    | Purpose                                                       |
| ------------------ | --------------------------- | ------------------------------- | ------------------------------------------------------------- |
| `build/`           | CRA (`react-scripts build`) | `npm run build`                 | React production assets loaded by Electron in production mode |
| `dist/`            | electron-builder            | `npm run dist` / `npm run pack` | Packaged installer/output artifacts                           |
| `packaged-assets/` | `scripts/prepare-assets.js` | `npm run prepare:assets`        | Copied subset of `../games` and `../emulators` for bundling   |
| `public/icons/`    | `scripts/generate-icons.js` | `npm run generate:icons`        | Platform-specific icon raster/ICO/ICNS files                  |
| `node_modules/`    | npm                         | `npm install`                   | Dependency tree                                               |
| `.DS_Store`        | macOS Finder                | (auto)                          | Should be removed/ignored                                     |

Git ignore patterns already cover these. If any appear in version control, remove them:

```bash
rm -rf build dist packaged-assets public/icons .DS_Store
```

Then regenerate what you need:

```bash
npm run build            # React production build
npm run prepare:assets   # Copy filtered games/emulators
npm run generate:icons   # Regenerate icon set from logo.svg
```

Fast one-liner to fully reset generated state:

```bash
rm -rf build dist packaged-assets public/icons && npm run build && npm run prepare:assets && npm run generate:icons
```

If `npm start` fails after cleanup, ensure `build/` exists (run `npm run build`). For packaging, always run the asset and icon generation scripts first.

## Prerequisites

- Node.js (v16 or later)
- npm or yarn

## Installation

1. Navigate to the game-launcher directory:

   ```bash
   cd game-launcher
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Development

To run the app in development mode:

```bash
npm run dev
```

This will:

- Start the React development server on http://localhost:3000
- Launch the Electron app automatically
- Enable hot reloading for React components

## Building

To build the app for production:

```bash
npm run build
npm run pack
```

To create distributables:

```bash
npm run dist
```

## Project Structure

```
game-launcher/
├── public/
│   ├── electron.js          # Main Electron process
│   ├── preload.js          # Preload script for IPC
│   └── index.html          # HTML template
├── src/
│   ├── components/         # React components
│   │   ├── GameCard.js     # Individual game card
│   │   ├── GameGrid.js     # Grid layout for games
│   │   ├── Header.js       # App header
│   │   ├── SearchBar.js    # Search and filter controls
│   │   └── LoadingSpinner.js
│   ├── gameScanner.js      # Game detection logic
│   ├── server.js           # HTTP server for serving games
│   ├── App.js              # Main React component
│   └── index.js            # React entry point
└── package.json
```

## How It Works

1. **Game Detection**: The app scans the `../games/` and `../emulators/` directories for folders containing `index.html` files
2. **Metadata Extraction**: For each game, it extracts the title from the HTML, looks for thumbnails, and gathers file information
3. **HTTP Server**: A local Express server serves the game files with proper CORS headers
4. **Game Launch**: When you click on a game, it opens in a new Electron window with the game's URL

## Game Organization

Your games should be organized like this:

```
gfiles-advanced/
├── games/
│   ├── 2048/
│   │   ├── index.html
│   │   ├── icon.png        # Optional thumbnail
│   │   └── ...
│   ├── pacman/
│   │   ├── index.html
│   │   └── ...
│   └── ...
├── emulators/
│   ├── retroarch/
│   │   ├── index.html
│   │   └── ...
│   └── ...
└── game-launcher/          # This app
```

## Customization

### Adding Thumbnails

The app automatically looks for common image files in each game folder:

- `icon.png/jpg/gif`
- `thumbnail.png/jpg/gif`
- `logo.png/jpg/gif`
- `favicon.ico/png`
- `preview.png/jpg/gif`
- `cover.png/jpg/gif`

### Supported File Types

The launcher serves all file types commonly used in HTML5 games:

- HTML files
- JavaScript files
- CSS files
- Images (PNG, JPG, GIF, SVG)
- Audio files
- And more...

## Troubleshooting

### Games not loading?

- Check that each game folder has an `index.html` file
- Ensure your games don't require external resources that might be blocked

### Server errors?

- Make sure no other application is using the same port
- Check the console for detailed error messages

### Build issues?

- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Update Node.js to the latest LTS version

## Contributing

Feel free to submit issues and enhancement requests!

## License

MIT License
