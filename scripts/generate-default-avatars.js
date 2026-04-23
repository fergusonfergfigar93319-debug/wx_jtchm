/**
 * 默认头像配图：256×256 PNG，与「今天吃什么」清新风格一致
 * 运行：node scripts/generate-default-avatars.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'images', 'avatars');
const SIZE = 256;

const svgs = {
  salad: () => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#ECFDF5"/>
      <stop offset="100%" style="stop-color:#D1FAE5"/>
    </linearGradient>
  </defs>
  <circle cx="128" cy="128" r="120" fill="url(#bg)"/>
  <ellipse cx="128" cy="138" rx="72" ry="52" fill="#FFFFFF" stroke="#34D399" stroke-width="3"/>
  <path d="M88 118 Q128 88 168 118" fill="none" stroke="#10B981" stroke-width="4" stroke-linecap="round"/>
  <circle cx="108" cy="128" r="14" fill="#FBBF24"/>
  <circle cx="148" cy="132" r="12" fill="#F87171"/>
  <ellipse cx="128" cy="152" rx="40" ry="8" fill="#A7F3D0" opacity="0.7"/>
</svg>`,

  rice: () => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <defs>
    <linearGradient id="b" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#FFF7ED"/>
      <stop offset="100%" style="stop-color:#FFEDD5"/>
    </linearGradient>
  </defs>
  <circle cx="128" cy="128" r="120" fill="url(#b)"/>
  <ellipse cx="128" cy="142" rx="78" ry="48" fill="#FFFFFF" stroke="#FB923C" stroke-width="3"/>
  <path d="M78 130 Q128 95 178 130" fill="#FEF3C7" stroke="#F59E0B" stroke-width="2"/>
  <ellipse cx="128" cy="138" rx="56" ry="22" fill="#FFFBEB" opacity="0.95"/>
  <path d="M100 148 Q128 128 156 148" fill="none" stroke="#D97706" stroke-width="2" opacity="0.5"/>
</svg>`,

  citrus: () => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <defs>
    <linearGradient id="c" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#FEF9C3"/>
      <stop offset="100%" style="stop-color:#FDE68A"/>
    </linearGradient>
  </defs>
  <circle cx="128" cy="128" r="120" fill="url(#c)"/>
  <circle cx="128" cy="132" r="68" fill="#FBBF24" stroke="#F59E0B" stroke-width="4"/>
  <g stroke="#FFFDE7" stroke-width="3" opacity="0.9">
    <line x1="128" y1="78" x2="128" y2="186"/>
    <line x1="68" y1="132" x2="188" y2="132"/>
    <line x1="82" y1="92" x2="174" y2="172"/>
    <line x1="174" y1="92" x2="82" y2="172"/>
  </g>
  <circle cx="128" cy="132" r="12" fill="#FFFDE7" opacity="0.5"/>
</svg>`
};

async function main() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch (e) {
    console.error('请先运行: npm install');
    process.exit(1);
  }
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

  for (const [name, fn] of Object.entries(svgs)) {
    const svg = fn().trim();
    const buf = await sharp(Buffer.from(svg))
      .resize(SIZE, SIZE)
      .png({ compressionLevel: 9 })
      .toBuffer();
    const outPath = path.join(OUT, `default-${name}.png`);
    fs.writeFileSync(outPath, buf);
    console.log('生成:', path.relative(ROOT, outPath), `(${(buf.length / 1024).toFixed(1)} KB)`);
  }
  console.log('完成。请确保 default-penguin.png 已放入同目录（用户提供的企鹅形象）。');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
