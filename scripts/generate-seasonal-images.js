/**
 * 应季食材配图：SVG 矢量插画 → PNG（默认 600×600），风格统一、包体小
 * 运行：npm run generate-seasonal-images
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'images', 'seasonal');
const SIZE = 600;

/** 背景圆角矩形 + 柔和渐变 + 中心食物简笔画 */
const svgs = {
  bamboo_shoot: () => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#E8F8F0"/>
      <stop offset="100%" style="stop-color:#C5EBD5"/>
    </linearGradient>
    <linearGradient id="bamboo" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#C8E6C9"/>
      <stop offset="100%" style="stop-color:#81C784"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="48" fill="url(#bg)"/>
  <g transform="translate(256 280)">
    <ellipse cx="-40" cy="20" rx="28" ry="90" fill="url(#bamboo)" transform="rotate(-8)"/>
    <ellipse cx="35" cy="25" rx="26" ry="85" fill="url(#bamboo)" transform="rotate(6)"/>
    <path d="M-50 -60 Q-30 -95 0 -100 Q30 -95 50 -60" fill="none" stroke="#66BB6A" stroke-width="14" stroke-linecap="round"/>
    <ellipse cx="-55" cy="-75" rx="22" ry="10" fill="#66BB6A" transform="rotate(-25)"/>
    <ellipse cx="55" cy="-72" rx="22" ry="10" fill="#66BB6A" transform="rotate(25)"/>
  </g>
</svg>`,

  spinach: () => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="sbg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#E8F5E9"/>
      <stop offset="100%" style="stop-color:#A5D6A7"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="48" fill="url(#sbg)"/>
  <g transform="translate(256 300)">
    <path d="M0 40 Q-80 -20 -60 -100 Q-20 -130 0 -90 Q20 -130 60 -100 Q80 -20 0 40" fill="#43A047"/>
    <path d="M0 35 Q-50 0 -35 -70 Q0 -95 0 -50 Q0 -95 35 -70 Q50 0 0 35" fill="#66BB6A"/>
    <path d="M-15 -95 Q0 -115 15 -95" fill="none" stroke="#2E7D32" stroke-width="4"/>
  </g>
</svg>`,

  strawberry: () => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="rbg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#FFEBEE"/>
      <stop offset="100%" style="stop-color:#FFCDD2"/>
    </linearGradient>
    <linearGradient id="berry" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#EF5350"/>
      <stop offset="100%" style="stop-color:#C62828"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="48" fill="url(#rbg)"/>
  <g transform="translate(256 268)">
    <path d="M-8 -120 L8 -120 L25 -95 L-25 -95 Z" fill="#43A047"/>
    <ellipse cx="0" cy="0" rx="95" ry="110" fill="url(#berry)"/>
    <circle cx="-35" cy="-25" r="6" fill="#FFCDD2" opacity="0.9"/>
    <circle cx="40" cy="10" r="5" fill="#FFCDD2" opacity="0.85"/>
    <circle cx="-15" cy="45" r="5" fill="#FFCDD2" opacity="0.8"/>
    <circle cx="25" cy="-40" r="4" fill="#FFCDD2" opacity="0.85"/>
  </g>
</svg>`,

  pea: () => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="pbg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#E8F5E9"/>
      <stop offset="100%" style="stop-color:#C8E6C9"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="48" fill="url(#pbg)"/>
  <g transform="translate(256 256) rotate(-15)">
    <path d="M-120 -20 Q-130 40 -100 90 Q0 120 100 90 Q130 40 120 -20 Q80 -50 0 -45 Q-80 -50 -120 -20 Z" fill="#81C784" stroke="#4CAF50" stroke-width="4"/>
    <ellipse cx="-45" cy="15" rx="22" ry="28" fill="#A5D6A7"/>
    <ellipse cx="0" cy="25" rx="22" ry="28" fill="#A5D6A7"/>
    <ellipse cx="45" cy="15" rx="22" ry="28" fill="#A5D6A7"/>
  </g>
</svg>`,

  toon: () => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="tbg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#FFF3E0"/>
      <stop offset="100%" style="stop-color:#FFCC80"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="48" fill="url(#tbg)"/>
  <g transform="translate(256 290)">
    <path d="M0 50 L-8 -100 Q0 -130 8 -100 Z" fill="#8D6E63" stroke="#6D4C41" stroke-width="6"/>
    <ellipse cx="-50" cy="-80" rx="35" ry="18" fill="#8BC34A" transform="rotate(-35 -50 -80)"/>
    <ellipse cx="50" cy="-75" rx="35" ry="18" fill="#9CCC65" transform="rotate(35 50 -75)"/>
    <ellipse cx="0" cy="-115" rx="40" ry="20" fill="#AED581"/>
  </g>
</svg>`,

  leek: () => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="lbg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#F1F8E9"/>
      <stop offset="100%" style="stop-color:#C5E1A5"/>
    </linearGradient>
    <linearGradient id="lstalk" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#1B5E20"/>
      <stop offset="35%" style="stop-color:#388E3C"/>
      <stop offset="65%" style="stop-color:#81C784"/>
      <stop offset="88%" style="stop-color:#E8F5E9"/>
      <stop offset="100%" style="stop-color:#FAFAFA"/>
    </linearGradient>
    <linearGradient id="lroot" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#EEEEEE"/>
      <stop offset="100%" style="stop-color:#BDBDBD"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="48" fill="url(#lbg)"/>
  <!-- 浅木台面 -->
  <ellipse cx="256" cy="418" rx="168" ry="32" fill="#8D6E63" opacity="0.18"/>
  <ellipse cx="256" cy="408" rx="152" ry="24" fill="#BCAAA4" opacity="0.35"/>
  <!-- 一捆韭菜：多根圆条 + 白色根茎 -->
  <g transform="translate(256 398)">
    <g transform="rotate(-26)">
      <rect x="-10" y="-175" width="20" height="185" rx="9" fill="url(#lstalk)"/>
      <rect x="-12" y="-40" width="24" height="48" rx="8" fill="url(#lroot)"/>
    </g>
    <g transform="rotate(-12)">
      <rect x="-9" y="-178" width="18" height="188" rx="8" fill="url(#lstalk)"/>
      <rect x="-11" y="-38" width="22" height="46" rx="7" fill="url(#lroot)"/>
    </g>
    <g>
      <rect x="-10" y="-182" width="20" height="192" rx="9" fill="url(#lstalk)"/>
      <rect x="-12" y="-36" width="24" height="50" rx="8" fill="url(#lroot)"/>
    </g>
    <g transform="rotate(12)">
      <rect x="-9" y="-176" width="18" height="186" rx="8" fill="url(#lstalk)"/>
      <rect x="-11" y="-39" width="22" height="47" rx="7" fill="url(#lroot)"/>
    </g>
    <g transform="rotate(26)">
      <rect x="-8" y="-170" width="16" height="178" rx="7" fill="url(#lstalk)"/>
      <rect x="-10" y="-37" width="20" height="44" rx="6" fill="url(#lroot)"/>
    </g>
    <!-- 叶尖略张开 -->
    <ellipse cx="-42" cy="-188" rx="22" ry="10" fill="#2E7D32" transform="rotate(-35 -42 -188)"/>
    <ellipse cx="38" cy="-186" rx="22" ry="10" fill="#2E7D32" transform="rotate(35 38 -186)"/>
    <ellipse cx="0" cy="-198" rx="26" ry="11" fill="#1B5E20"/>
  </g>
  <!-- 高光 -->
  <ellipse cx="220" cy="210" rx="80" ry="40" fill="#FFFFFF" opacity="0.12"/>
</svg>`,

  tomato: () => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="tom" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#EF5350"/>
      <stop offset="100%" style="stop-color:#B71C1C"/>
    </linearGradient>
    <linearGradient id="tmbg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#FFEBEE"/>
      <stop offset="100%" style="stop-color:#FFCDD2"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="48" fill="url(#tmbg)"/>
  <g transform="translate(256 268)">
    <path d="M-15 -95 L0 -115 L15 -95 L8 -85 L-8 -85 Z" fill="#43A047"/>
    <circle cx="0" cy="0" r="100" fill="url(#tom)"/>
    <ellipse cx="-25" cy="-25" rx="25" ry="18" fill="#FF8A80" opacity="0.5"/>
  </g>
</svg>`,

  asparagus: () => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="abg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#E8F5E9"/>
      <stop offset="100%" style="stop-color:#C8E6C9"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="48" fill="url(#abg)"/>
  <g transform="translate(256 300)">
    <path d="M-50 90 L-45 -80 L-35 -95 L-30 90 Z" fill="#7CB342"/>
    <path d="M-10 90 L-8 -95 L8 -100 L10 90 Z" fill="#8BC34A"/>
    <path d="M30 90 L35 -85 L45 -90 L50 90 Z" fill="#9CCC65"/>
    <path d="M-48 -75 L-32 -88" stroke="#558B2F" stroke-width="3"/>
    <path d="M-6 -88 L6 -92" stroke="#689F38" stroke-width="3"/>
    <path d="M38 -78 L48 -85" stroke="#7CB342" stroke-width="3"/>
  </g>
</svg>`,

  cherry: () => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="ch" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#E53935"/>
      <stop offset="100%" style="stop-color:#B71C1C"/>
    </linearGradient>
    <linearGradient id="cbg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#FFEBEE"/>
      <stop offset="100%" style="stop-color:#FFCDD2"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="48" fill="url(#cbg)"/>
  <g transform="translate(256 280)">
    <path d="M-60 -120 Q0 -40 60 -120" fill="none" stroke="#5D4037" stroke-width="8" stroke-linecap="round"/>
    <circle cx="-45" cy="15" r="55" fill="url(#ch)"/>
    <circle cx="55" cy="25" r="52" fill="url(#ch)"/>
    <ellipse cx="-55" cy="5" rx="15" ry="10" fill="#FF8A80" opacity="0.4"/>
    <ellipse cx="48" cy="15" rx="14" ry="9" fill="#FF8A80" opacity="0.4"/>
  </g>
</svg>`,

  broad_bean: () => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bbg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#E8F5E9"/>
      <stop offset="100%" style="stop-color:#DCEDC8"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="48" fill="url(#bbg)"/>
  <g transform="translate(256 256) rotate(12)">
    <path d="M-110 0 Q-120 50 -70 85 Q0 100 70 85 Q120 50 110 0 Q100 -40 0 -35 Q-100 -40 -110 0 Z" fill="#9CCC65" stroke="#7CB342" stroke-width="5"/>
    <ellipse cx="-35" cy="25" rx="28" ry="22" fill="#C5E1A5"/>
    <ellipse cx="35" cy="25" rx="28" ry="22" fill="#C5E1A5"/>
    <path d="M-5 -25 L5 -25" stroke="#558B2F" stroke-width="4"/>
  </g>
</svg>`,

  cucumber: () => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="cuc" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#A5D6A7"/>
      <stop offset="100%" style="stop-color:#66BB6A"/>
    </linearGradient>
    <linearGradient id="cbg2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#E8F5E9"/>
      <stop offset="100%" style="stop-color:#C8E6C9"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="48" fill="url(#cbg2)"/>
  <g transform="translate(256 268) rotate(-25)">
    <ellipse cx="0" cy="0" rx="45" ry="130" fill="url(#cuc)"/>
    <ellipse cx="-12" cy="-40" rx="8" ry="6" fill="#C8E6C9" opacity="0.6"/>
    <ellipse cx="10" cy="20" rx="7" ry="5" fill="#C8E6C9" opacity="0.55"/>
    <ellipse cx="-5" cy="60" rx="9" ry="6" fill="#C8E6C9" opacity="0.5"/>
  </g>
</svg>`,

  orange: () => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="org" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#FFB74D"/>
      <stop offset="100%" style="stop-color:#F57C00"/>
    </linearGradient>
    <linearGradient id="obg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#FFF3E0"/>
      <stop offset="100%" style="stop-color:#FFE0B2"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="48" fill="url(#obg)"/>
  <g transform="translate(256 268)">
    <path d="M-8 -105 L8 -105 L12 -95 L-12 -95 Z" fill="#8BC34A"/>
    <circle cx="0" cy="0" r="105" fill="url(#org)"/>
    <path d="M-30 -30 Q0 -50 30 -30" fill="none" stroke="#FFF8E1" stroke-width="6" opacity="0.5"/>
    <g transform="rotate(0)">
      <line x1="0" y1="-95" x2="0" y2="95" stroke="#E65100" stroke-width="2" opacity="0.15"/>
      <line x1="-82" y1="-47" x2="82" y2="47" stroke="#E65100" stroke-width="2" opacity="0.12"/>
      <line x1="-82" y1="47" x2="82" y2="-47" stroke="#E65100" stroke-width="2" opacity="0.12"/>
    </g>
  </g>
</svg>`
};

module.exports = { svgs };

async function main() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch (e) {
    console.error('请先运行: npm install');
    process.exit(1);
  }

  if (!fs.existsSync(OUT)) {
    fs.mkdirSync(OUT, { recursive: true });
  }

  const entries = Object.entries(svgs);
  for (const [name, svgFn] of entries) {
    const svg = svgFn().trim();
    const outPath = path.join(OUT, `${name}.png`);
    const buf = await sharp(Buffer.from(svg))
      .resize(SIZE, SIZE)
      .png({ compressionLevel: 9 })
      .toBuffer();
    fs.writeFileSync(outPath, buf);
    console.log(`生成: ${name}.png (${(buf.length / 1024).toFixed(2)} KB)`);
  }
  console.log(`\n共 ${entries.length} 张，输出目录: images/seasonal/`);
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
