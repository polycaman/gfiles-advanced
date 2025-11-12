const path = require("path");
const fs = require("fs");
const sharp = require("sharp");
const iconGen = require("icon-gen");

async function run() {
  const svgPath = path.join(__dirname, "..", "public", "logo.svg");
  const outDir = path.join(__dirname, "..", "public", "icons");
  if (!fs.existsSync(svgPath)) {
    console.error("[icons] logo.svg bulunamadı:", svgPath);
    process.exit(1);
  }
  fs.mkdirSync(outDir, { recursive: true });
  const sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024];
  console.log("[icons] Kaynak SVG:", svgPath);
  const basePng = path.join(outDir, "icon.png");
  await sharp(svgPath).resize(1024, 1024).png().toFile(basePng);
  console.log("[icons] Base 1024 PNG oluşturuldu");
  await Promise.all(
    sizes.map((size) =>
      sharp(svgPath)
        .resize(size, size)
        .png()
        .toFile(path.join(outDir, `icon-${size}.png`))
        .then(() => console.log(`[icons] PNG ${size}x${size}`))
    )
  );
  await iconGen(basePng, outDir, {
    modes: ["ico", "icns"],
    ico: { sizes: [16, 24, 32, 48, 64, 128, 256] },
    icns: { sizes: [16, 32, 64, 128, 256, 512] },
    report: false,
  });
  console.log("[icons] ICO & ICNS oluşturuldu");

  // Standardize names expected by electron-builder config (app.ico / app.icns)
  const icoSource = path.join(outDir, "icon.ico");
  const icnsSource = path.join(outDir, "icon.icns");
  const icoTarget = path.join(outDir, "app.ico");
  const icnsTarget = path.join(outDir, "app.icns");
  try {
    if (fs.existsSync(icoSource)) {
      fs.copyFileSync(icoSource, icoTarget);
      console.log("[icons] app.ico hazır");
    } else {
      console.warn("[icons] icon.ico bulunamadı, app.ico oluşturulamadı");
    }
    if (fs.existsSync(icnsSource)) {
      fs.copyFileSync(icnsSource, icnsTarget);
      console.log("[icons] app.icns hazır");
    } else {
      console.warn("[icons] icon.icns bulunamadı, app.icns oluşturulamadı");
    }
  } catch (e) {
    console.warn("[icons] Yeniden adlandırma sırasında hata:", e);
  }

  console.log("[icons] Tamamlandı:", outDir);
}

if (require.main === module) {
  run().catch((e) => {
    console.error("[icons] Hata:", e);
    process.exit(1);
  });
}
