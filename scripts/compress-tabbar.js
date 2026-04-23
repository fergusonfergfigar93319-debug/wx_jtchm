/**
 * 将 tabBar 图标压缩到微信小程序要求的 40KB 以内
 * 输出到 images/tabbar/ 目录，需在 app.json 中引用该路径
 */
const fs = require('fs');
const path = require('path');

const SIZE_PX = 81;        // 微信推荐 tabBar 图标尺寸
const MAX_KB = 40;
const ROOT = path.join(__dirname, '..');
// 源图已改为仅保留 tabbar 成品；若需从大图重导，请将源 PNG 放到 images/tabbar-src/ 并改此处路径
const SRC = path.join(ROOT, 'images', 'tabbar');
const OUT = path.join(ROOT, 'images', 'tabbar');

const pairs = [
  ['home.png', 'home-active.png'],
  ['fridge.png', 'fridge-active.png'],
  ['report.png', 'report-active.png'],
  ['profile.png', 'profile-active.png'],
];

async function main() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch (e) {
    console.error('请先运行: npm install sharp');
    process.exit(1);
  }

  if (!fs.existsSync(OUT)) {
    fs.mkdirSync(OUT, { recursive: true });
  }

  const files = pairs.flat();
  for (const name of files) {
    const srcPath = path.join(SRC, name);
    const outPath = path.join(OUT, name);
    if (!fs.existsSync(srcPath)) {
      console.warn('跳过（不存在）:', name);
      continue;
    }

    let buf = await sharp(srcPath)
      .resize(SIZE_PX, SIZE_PX)
      .png({ compressionLevel: 9, palette: true })
      .toBuffer();

    // 若仍超 40KB，缩小尺寸再压
    let size = SIZE_PX;
    while (buf.length > MAX_KB * 1024 && size >= 40) {
      size = Math.max(40, size - 20);
      buf = await sharp(srcPath)
        .resize(size, size)
        .png({ compressionLevel: 9, palette: true })
        .toBuffer();
    }

    fs.writeFileSync(outPath, buf);
    const kb = (buf.length / 1024).toFixed(2);
    const ok = buf.length <= MAX_KB * 1024 ? '✓' : '✗ 仍超40KB';
    console.log(`${name}: ${kb} KB ${ok}`);
  }
  console.log('\n已输出到 images/tabbar/，请将 app.json 中 tabBar 的 iconPath 改为 images/tabbar/xxx.png');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
