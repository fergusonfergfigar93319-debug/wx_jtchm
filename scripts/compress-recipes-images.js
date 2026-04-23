/**
 * 僅壓縮 images/recipes 下 PNG，目標約 200–400KB（適配小程序包體）
 * 依賴: sharp（devDependencies）
 */
const fs = require('fs');
const path = require('path');

let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.error('請先執行: npm install');
  process.exit(1);
}

const ROOT = path.join(__dirname, '..');
const RECIPES_DIR = path.join(ROOT, 'images', 'recipes');

const MIN_BYTES = 200 * 1024;
const MAX_BYTES = 400 * 1024;

async function compressOne(filePath) {
  const before = fs.statSync(filePath).size;
  const meta = await sharp(filePath).metadata();
  const origMax = Math.max(meta.width || 0, meta.height || 0) || 1600;

  let maxSide = Math.min(1400, origMax);
  let buf = null;

  for (let i = 0; i < 28; i++) {
    buf = await sharp(filePath)
      .rotate()
      .resize(maxSide, maxSide, { fit: 'inside', withoutEnlargement: true })
      .png({ compressionLevel: 9, adaptiveFiltering: true, effort: 10 })
      .toBuffer();

    const len = buf.length;
    if (len >= MIN_BYTES && len <= MAX_BYTES) break;
    if (len > MAX_BYTES) {
      maxSide = Math.floor(maxSide * 0.82);
      if (maxSide < 420) break;
    } else {
      maxSide = Math.min(origMax, Math.floor(maxSide * 1.12));
      if (maxSide >= origMax - 2) break;
    }
  }

  if (buf.length > MAX_BYTES) {
    let ms = Math.min(maxSide, 900);
    while (buf.length > MAX_BYTES && ms >= 360) {
      buf = await sharp(filePath)
        .rotate()
        .resize(ms, ms, { fit: 'inside', withoutEnlargement: true })
        .png({ compressionLevel: 9, adaptiveFiltering: true, effort: 10 })
        .toBuffer();
      if (buf.length <= MAX_BYTES) break;
      ms = Math.floor(ms * 0.78);
    }
  }

  if (buf.length < MIN_BYTES && origMax > 400) {
    let ms = Math.min(origMax, Math.floor(maxSide * 1.25));
    while (buf.length < MIN_BYTES && ms <= origMax) {
      const tryBuf = await sharp(filePath)
        .rotate()
        .resize(ms, ms, { fit: 'inside', withoutEnlargement: true })
        .png({ compressionLevel: 9, adaptiveFiltering: true, effort: 10 })
        .toBuffer();
      buf = tryBuf;
      if (tryBuf.length >= MIN_BYTES || ms >= origMax) break;
      ms = Math.min(origMax, Math.floor(ms * 1.08));
    }
  }

  fs.writeFileSync(filePath, buf);
  return { filePath, before, after: buf.length };
}

async function main() {
  if (!fs.existsSync(RECIPES_DIR)) {
    console.error('目錄不存在:', RECIPES_DIR);
    process.exit(1);
  }
  const names = fs.readdirSync(RECIPES_DIR).filter((n) => n.toLowerCase().endsWith('.png'));
  if (!names.length) {
    console.log('無 PNG 檔案');
    return;
  }
  let saved = 0;
  for (const name of names) {
    const full = path.join(RECIPES_DIR, name);
    try {
      const r = await compressOne(full);
      saved += r.before - r.after;
      console.log(
        `${name}  ${(r.before / 1024).toFixed(1)} KB → ${(r.after / 1024).toFixed(1)} KB`
      );
    } catch (e) {
      console.error('失敗', name, e.message || e);
    }
  }
  console.log(`\n共節省約 ${(saved / 1024 / 1024).toFixed(2)} MB`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
