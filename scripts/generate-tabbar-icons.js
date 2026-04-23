/**
 * TabBar 图标生成：统一 2.5D 圆角线形语言
 * - 未选中：描边 #94A3B8，线宽一致、圆角端点
 * - 选中：填充品牌色 #4CD9A1 + 白色细节，与 tokens 一致
 * 输出：images/tabbar/*.png（81×81，符合微信体积建议）
 */
const fs = require('fs');
const path = require('path');

const SIZE = 81;
const GRAY = '#94A3B8';
const GREEN = '#4CD9A1';
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'images', 'tabbar');

/** @param {string} inner 81×81 viewBox 内 SVG 内容 */
function wrap(inner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 81 81" width="81" height="81">${inner}</svg>`;
}

const icons = {
  home: {
    normal: () =>
      wrap(`
  <path fill="none" stroke="${GRAY}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"
    d="M40.5 15 L14 36 V68 H27 V45 H54 V68 H67 V36 L40.5 15z"/>`),
    active: () =>
      wrap(`
  <path fill="${GREEN}" d="M40.5 15 L14 36 V68 H27 V45 H54 V68 H67 V36 L40.5 15z"/>
  <rect x="33" y="50" width="15" height="10" rx="2" fill="rgba(255,255,255,0.38)"/>`)
  },
  fridge: {
    normal: () =>
      wrap(`
  <rect x="18" y="6" width="45" height="69" rx="9" fill="none" stroke="${GRAY}" stroke-width="3.2"/>
  <line x1="40.5" y1="6" x2="40.5" y2="75" stroke="${GRAY}" stroke-width="3.2" stroke-linecap="round"/>
  <line x1="22" y1="24" x2="59" y2="24" stroke="${GRAY}" stroke-width="2.6" stroke-linecap="round" opacity="0.85"/>`),
    active: () =>
      wrap(`
  <rect x="18" y="6" width="45" height="69" rx="9" fill="${GREEN}"/>
  <line x1="40.5" y1="6" x2="40.5" y2="75" stroke="rgba(255,255,255,0.55)" stroke-width="2.8" stroke-linecap="round"/>
  <line x1="22" y1="24" x2="59" y2="24" stroke="rgba(255,255,255,0.45)" stroke-width="2.4" stroke-linecap="round"/>
  <circle cx="29" cy="48" r="2.8" fill="rgba(255,255,255,0.95)"/>
  <circle cx="52" cy="48" r="2.8" fill="rgba(255,255,255,0.95)"/>`)
  },
  report: {
    normal: () =>
      wrap(`
  <rect x="15" y="15" width="51" height="51" rx="12" fill="none" stroke="${GRAY}" stroke-width="3.2"/>
  <path fill="none" stroke="${GRAY}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"
    d="M22 44 H28 L32 30 L36 52 L40 34 L44 48 L48 44 H59"/>`),
    active: () =>
      wrap(`
  <rect x="15" y="15" width="51" height="51" rx="12" fill="${GREEN}"/>
  <path fill="none" stroke="rgba(255,255,255,0.95)" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"
    d="M22 44 H28 L32 30 L36 52 L40 34 L44 48 L48 44 H59"/>`)
  },
  profile: {
    normal: () =>
      wrap(`
  <circle cx="40.5" cy="27" r="13.5" fill="none" stroke="${GRAY}" stroke-width="3.2"/>
  <path fill="none" stroke="${GRAY}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"
    d="M18 71 C18 55 28 43 40.5 43 C53 43 63 55 63 71"/>`),
    active: () =>
      wrap(`
  <circle cx="40.5" cy="27" r="13.5" fill="${GREEN}"/>
  <path fill="${GREEN}" d="M18 71 C18 55 28 43 40.5 43 C53 43 63 55 63 71 H18z"/>`)
  }
};

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

  for (const [name, pair] of Object.entries(icons)) {
    const normalSvg = pair.normal();
    const activeSvg = pair.active();

    for (const [suffix, svg] of [
      ['', normalSvg],
      ['-active', activeSvg]
    ]) {
      const outPath = path.join(OUT, `${name}${suffix}.png`);
      const buf = await sharp(Buffer.from(svg))
        .resize(SIZE, SIZE)
        .png({ compressionLevel: 9 })
        .toBuffer();
      fs.writeFileSync(outPath, buf);
      console.log(`生成: ${name}${suffix}.png (${(buf.length / 1024).toFixed(2)} KB)`);
    }
  }
  console.log('\n图标已输出到 images/tabbar/');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
