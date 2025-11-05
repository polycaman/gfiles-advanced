# GFiles Game Launcher

A responsive Electron application that serves as a game library for your local HTML5 games and emulators. This launcher scans your games and emulators folders, displays them in a beautiful grid layout, and allows you to launch any game with a single click.

## Features

- 🎮 **Game Library**: Automatically scans and displays all games from your `games/` and `emulators/` folders
- 🔍 **Search & Filter**: Search games by name and filter by category (Games/Emulators)
- 📱 **Responsive Design**: Optimized for different screen sizes
- 🚀 **One-Click Launch**: Launch games directly in a new window
- 🎨 **Modern UI**: Dark theme with smooth animations and hover effects
- 📊 **Game Info**: Shows game metadata, file size, and last modified date
- 🖼️ **Thumbnails**: Automatically detects and displays game thumbnails
  
## Icon Simplification

Bu sürümde karmaşık ikon üretim sistemi (PNG, ICO, ICNS oluşturma) kaldırıldı. Artık tek bir `public/icon.svg` dosyası tüm uygulama için kullanılıyor.

Notlar:
- Electron paketlerken platforma özel (`.icns`, `.ico`, `.png`) ikon gereksinimleri varsa varsayılan Electron ikonu kullanılabilir.
- Eğer dağıtımda özel platform ikonları istenirse manuel dönüştürme (ör: bir tasarım aracıyla) yapıp ilgili dosyaları tekrar `build` ayarlarına ekleyebilirsiniz.

Avantajlar:
- Daha az bağımlılık (sharp, icon-gen kaldırıldı)
- Daha hızlı kurulum
- Daha basit yapı betikleri

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
