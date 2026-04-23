/**
 * 将 AI 生成的应季食材大图裁切为 600×360 并写入 images/seasonal/（替换同名文件）
 *
 * 用法：
 *   set SEASONAL_AI_ASSETS=你的目录   （含 seasonal-bamboo_shoot.png 等）
 *   npm run import-seasonal-photos
 *
 * 命名对应：seasonal-<key>.png → <key>.png（与 seasonal.js 中路径一致）
 */
const fs = require('fs');
const path = require('path');
const { svgs } = require('./generate-seasonal-images.js');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'images', 'seasonal');

const W = 600;
const H = 360;

const MAP = {
  'seasonal-bamboo_shoot.png': 'bamboo_shoot.png',
  'seasonal-spinach.png': 'spinach.png',
  'seasonal-strawberry.png': 'strawberry.png',
  'seasonal-pea.png': 'pea.png',
  'seasonal-toon.png': 'toon.png',
  'seasonal-leek.png': 'leek.png',
  'seasonal-tomato.png': 'tomato.png',
  'seasonal-asparagus.png': 'asparagus.png',
  'seasonal-cherry.png': 'cherry.png',
  'seasonal-broad_bean.png': 'broad_bean.png',
  'seasonal-cucumber.png': 'cucumber.png',
  'seasonal-orange.png': 'orange.png'
};

function defaultSourceDir() {
  const env = process.env.SEASONAL_AI_ASSETS;
  if (env && fs.existsSync(env)) return env;
  const win = path.join(
    process.env.USERPROFILE || '',
    '.cursor',
    'projects',
    'c-Users-dxh53-Desktop-3-0-0',
    'assets'
  );
  if (fs.existsSync(win)) return win;
  return path.join(ROOT, 'assets', 'seasonal-ai-import');
}

async function main() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch (e) {
    console.error('请先执行: npm install');
    process.exit(1);
  }

  if (!fs.existsSync(OUT)) {
    fs.mkdirSync(OUT, { recursive: true });
  }

  const SRC = defaultSourceDir();
  console.log('来源目录:', SRC);

  let n = 0;
  let cherryFromAi = false;
  for (const [srcName, outName] of Object.entries(MAP)) {
    const srcPath = path.join(SRC, srcName);
    if (!fs.existsSync(srcPath)) {
      console.warn('  跳过（无文件）:', srcName);
      continue;
    }
    const buf = await sharp(srcPath)
      .resize(W, H, { fit: 'cover', position: 'attention' })
      .png({ compressionLevel: 9 })
      .toBuffer();
    fs.writeFileSync(path.join(OUT, outName), buf);
    console.log('  已写入', outName, `(${(buf.length / 1024).toFixed(1)} KB)`);
    n++;
    if (outName === 'cherry.png') cherryFromAi = true;
  }

  if (!cherryFromAi && svgs.cherry) {
    const svg = svgs.cherry().trim();
    const buf = await sharp(Buffer.from(svg))
      .resize(W, H, { fit: 'cover', position: 'center' })
      .png({ compressionLevel: 9 })
      .toBuffer();
    fs.writeFileSync(path.join(OUT, 'cherry.png'), buf);
    console.log('  已写入 cherry.png（SVG 矢量兜底）', `(${(buf.length / 1024).toFixed(1)} KB)`);
    n++;
  }

  console.log(`\n完成：共输出 ${n} 张 → ${path.relative(ROOT, OUT)}`);
  if (!cherryFromAi) {
    console.log('说明：未找到 seasonal-cherry.png 时已用矢量樱桃图兜底；可放入该文件后重跑以替换为实拍。');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
