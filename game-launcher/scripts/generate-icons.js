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
  console.log("[icons] Tamamlandı:", outDir);
}

if (require.main === module) {
  run().catch((e) => {
    console.error("[icons] Hata:", e);
    process.exit(1);
  });
}
