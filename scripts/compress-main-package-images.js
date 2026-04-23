/**
 * 压缩主包/分包内 PNG，控制小程序代码包体积（主包 ≤2MB 需控制图片总大小）
 * 依赖: npm install sharp（项目 devDependencies 已有）
 */
const fs = require('fs');
const path = require('path');

let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.error('请先运行: npm install');
  process.exit(1);
}

const ROOT = path.join(__dirname, '..');

const DIRS = [
  path.join(ROOT, 'images'),
  path.join(ROOT, 'packageCook', 'images', 'seasonal')
];

const SKIP_DIR_NAMES = new Set(['tabbar']);
const MIN_SIZE_TO_PROCESS = 40 * 1024;

function collectPng(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      if (SKIP_DIR_NAMES.has(name)) continue;
      out.push(...collectPng(full));
    } else if (name.toLowerCase().endsWith('.png')) {
      out.push(full);
    }
  }
  return out;
}

async function compressOne(filePath) {
  const before = fs.statSync(filePath).size;
  if (before < MIN_SIZE_TO_PROCESS) return { filePath, before, after: before, skipped: true };

  let maxSide = 960;
  let buf;
  for (let attempt = 0; attempt < 6; attempt++) {
    buf = await sharp(filePath)
      .rotate()
      .resize(maxSide, maxSide, { fit: 'inside', withoutEnlargement: true })
      .png({ compressionLevel: 9, palette: true, effort: 10 })
      .toBuffer();

    if (buf.length <= 200 * 1024 || maxSide <= 320) break;
    maxSide = Math.floor(maxSide * 0.75);
  }

  if (buf.length > 220 * 1024) {
    buf = await sharp(filePath)
      .rotate()
      .resize(480, 480, { fit: 'inside', withoutEnlargement: true })
      .png({ compressionLevel: 9, palette: true, effort: 10 })
      .toBuffer();
  }

  fs.writeFileSync(filePath, buf);
  return { filePath, before, after: buf.length };
}

async function main() {
  const files = [];
  for (const d of DIRS) {
    files.push(...collectPng(d));
  }
  const unique = [...new Set(files)];
  let saved = 0;
  for (const f of unique) {
    try {
      const r = await compressOne(f);
      if (r.skipped) continue;
      saved += r.before - r.after;
      console.log(
        `${path.relative(ROOT, r.filePath)}  ${(r.before / 1024).toFixed(1)}KB → ${(r.after / 1024).toFixed(1)}KB`
      );
    } catch (e) {
      console.error('跳过', path.relative(ROOT, f), e.message || e);
    }
  }
  console.log(`\n约节省 ${(saved / 1024 / 1024).toFixed(2)} MB`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
