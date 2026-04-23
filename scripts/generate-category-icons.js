/**
 * 首页功能图标 — 对齐参考首页：柔色底上的半扁平插画，仅极轻阴影/渐变
 * 运行：node scripts/generate-category-icons.js
 */
const fs = require('fs');
const path = require('path');

const SIZE = 176;
const RENDER = 704;
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'images', 'categories');

function svg(defs, body, scale = 1.12) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 81 81" width="81" height="81">${defs}<g transform="translate(40.5,40.5) scale(${scale}) translate(-40.5,-40.5)">${body}</g></svg>`;
}

const drawings = {
  cook: () =>
    svg(
      `<defs>
    <linearGradient id="panM" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#9ca3af"/><stop offset="0.5" stop-color="#4b5563"/><stop offset="1" stop-color="#1f2937"/>
    </linearGradient>
    <linearGradient id="yolk" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fef08a"/><stop offset="0.4" stop-color="#fbbf24"/><stop offset="1" stop-color="#d97706"/>
    </linearGradient>
  </defs>`,
      `
  <ellipse cx="40" cy="71" rx="22" ry="3.2" fill="#000000" opacity="0.05"/>
  <ellipse cx="40" cy="47" rx="24" ry="8" fill="url(#panM)" stroke="#111827" stroke-width="1.2"/>
  <ellipse cx="40" cy="45" rx="18" ry="4" fill="#ffffff" opacity="0.12"/>
  <ellipse cx="36" cy="42" rx="12" ry="9" fill="#f8fafc" stroke="#e5e7eb" stroke-width="0.8"/>
  <circle cx="36" cy="42" r="6.2" fill="url(#yolk)"/>
  <ellipse cx="33" cy="38.5" rx="2.8" ry="1.6" fill="#ffffff" opacity="0.95"/>
  <path d="M62 41h16" stroke="#d1d5db" stroke-width="4.5" stroke-linecap="round"/>
  <path d="M63 41h2" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" opacity="0.5"/>
`
    ),

  'smart-choice': () =>
    svg(
      `<defs>
    <linearGradient id="arr" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#60a5fa"/><stop offset="1" stop-color="#1d4ed8"/>
    </linearGradient>
  </defs>`,
      `
  <ellipse cx="40.5" cy="71" rx="24" ry="3" fill="#000000" opacity="0.05"/>
  <circle cx="40.5" cy="40.5" r="27" fill="#fca5a5" stroke="#dc2626" stroke-width="2.2"/>
  <circle cx="40.5" cy="40.5" r="19" fill="#ffffff" stroke="#ef4444" stroke-width="1.8"/>
  <circle cx="40.5" cy="40.5" r="11" fill="#fecaca" stroke="#b91c1c" stroke-width="1.5"/>
  <circle cx="40.5" cy="40.5" r="5.5" fill="#fde047" stroke="#eab308" stroke-width="0.8"/>
  <ellipse cx="37" cy="37" rx="8" ry="4" fill="#ffffff" opacity="0.22"/>
  <line x1="40.5" y1="10" x2="40.5" y2="32" stroke="url(#arr)" stroke-width="3.2" stroke-linecap="round"/>
  <polygon points="40.5,36 35.5,28 45.5,28" fill="url(#arr)"/>
  <ellipse cx="40.5" cy="28" rx="2" ry="1" fill="#ffffff" opacity="0.6"/>
`
    ),

  restaurant: () =>
    svg(
      `<defs>
    <linearGradient id="bike" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fca5a5"/><stop offset="0.5" stop-color="#ef4444"/><stop offset="1" stop-color="#991b1b"/>
    </linearGradient>
  </defs>`,
      `
  <ellipse cx="40" cy="71" rx="24" ry="3" fill="#000000" opacity="0.05"/>
  <circle cx="24" cy="56" r="8.5" fill="#111827"/>
  <circle cx="24" cy="56" r="3.5" fill="#e5e7eb"/>
  <circle cx="56" cy="56" r="8.5" fill="#111827"/>
  <circle cx="56" cy="56" r="3.5" fill="#e5e7eb"/>
  <path d="M24 56 L30 33 H52 L56 56" fill="none" stroke="url(#bike)" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M15 32 H38 L44 34" fill="none" stroke="#fecaca" stroke-width="5" stroke-linecap="round"/>
  <rect x="38" y="25" width="16" height="13" rx="2.5" fill="#fee2e2" stroke="#dc2626" stroke-width="1.8"/>
  <ellipse cx="46" cy="28" rx="5" ry="2" fill="#ffffff" opacity="0.45"/>
`
    ),

  'shopping-list': () =>
    svg(
      `<defs>
    <linearGradient id="cartB" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3b82f6"/><stop offset="1" stop-color="#1e3a8a"/>
    </linearGradient>
  </defs>`,
      `
  <ellipse cx="32" cy="71" rx="18" ry="2.8" fill="#000000" opacity="0.06"/>
  <path d="M14 24 H36 L34 56 H24" stroke="url(#cartB)" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M18 24 L20 16 H42" stroke="url(#cartB)" stroke-width="4" fill="none" stroke-linecap="round"/>
  <circle cx="28" cy="60" r="4.5" fill="#172554"/>
  <circle cx="44" cy="60" r="4.5" fill="#172554"/>
  <circle cx="28" cy="60" r="1.8" fill="#93c5fd" opacity="0.55"/>
  <circle cx="44" cy="60" r="1.8" fill="#93c5fd" opacity="0.55"/>
  <path d="M24 36h14M24 44h12" stroke="#60a5fa" stroke-width="2.6" stroke-linecap="round"/>
  <ellipse cx="28" cy="30" rx="8" ry="3" fill="#ffffff" opacity="0.2"/>
`
    ),

  challenge: () =>
    svg(
      `<defs>
    <linearGradient id="cup" x1="0.2" y1="0" x2="0.8" y2="1">
      <stop offset="0" stop-color="#fef9c3"/><stop offset="0.35" stop-color="#fde047"/><stop offset="0.7" stop-color="#ca8a04"/><stop offset="1" stop-color="#78350f"/>
    </linearGradient>
  </defs>`,
      `
  <ellipse cx="40.5" cy="71" rx="20" ry="3" fill="#000000" opacity="0.05"/>
  <path d="M24 24 H57 V37 C57 48 40.5 53 40.5 53 C40.5 53 24 48 24 37 V24Z" fill="url(#cup)" stroke="#92400e" stroke-width="1.4"/>
  <path d="M28 27 Q40.5 32 53 27" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" opacity="0.5"/>
  <path d="M24 26 H16 M57 26 H65" stroke="#ca8a04" stroke-width="3.5" stroke-linecap="round"/>
  <rect x="31" y="54" width="19" height="9" rx="2" fill="#92400e"/>
  <rect x="31" y="54" width="19" height="3" rx="1" fill="#ffffff" opacity="0.15"/>
  <rect x="26" y="61" width="29" height="6" rx="2" fill="#78350f"/>
`
    ),

  remedy: () =>
    svg(
      `<defs>
    <linearGradient id="yL" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fde047"/><stop offset="1" stop-color="#ca8a04"/></linearGradient>
    <linearGradient id="rL" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f87171"/><stop offset="1" stop-color="#b91c1c"/></linearGradient>
  </defs>`,
      `
  <ellipse cx="40.5" cy="71" rx="24" ry="2.8" fill="#000000" opacity="0.05"/>
  <rect x="15" y="32" width="26" height="24" rx="12" fill="url(#yL)"/>
  <rect x="40.5" y="32" width="26.5" height="24" rx="12" fill="url(#rL)"/>
  <ellipse cx="27" cy="37" rx="11" ry="5" fill="#ffffff" opacity="0.3"/>
  <ellipse cx="54" cy="37" rx="10" ry="5" fill="#ffffff" opacity="0.22"/>
  <line x1="40.5" y1="32" x2="40.5" y2="56" stroke="#ffffff" stroke-width="1.2" opacity="0.35"/>
`
    ),

  'ai-nutritionist': () =>
    svg(
      `<defs>
    <linearGradient id="bot" x1="0.2" y1="0" x2="0.8" y2="1">
      <stop offset="0" stop-color="#ddd6fe"/><stop offset="0.45" stop-color="#8b5cf6"/><stop offset="1" stop-color="#5b21b6"/>
    </linearGradient>
    <linearGradient id="face" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#ede9fe"/>
    </linearGradient>
  </defs>`,
      `
  <ellipse cx="40.5" cy="72" rx="22" ry="3" fill="#000000" opacity="0.05"/>
  <line x1="40.5" y1="8" x2="40.5" y2="17" stroke="#a855f7" stroke-width="4" stroke-linecap="round"/>
  <circle cx="40.5" cy="5" r="5" fill="#f472b6"/>
  <circle cx="40.5" cy="5" r="2" fill="#ffffff" opacity="0.5"/>
  <rect x="16" y="18" width="49" height="46" rx="19" fill="url(#bot)" stroke="#4c1d95" stroke-width="1.8"/>
  <rect x="22" y="24" width="37" height="34" rx="14" fill="url(#face)"/>
  <ellipse cx="40.5" cy="32" rx="14" ry="6" fill="#ffffff" opacity="0.5"/>
  <circle cx="30" cy="42" r="4.5" fill="#f472b6"/>
  <circle cx="51" cy="42" r="4.5" fill="#f472b6"/>
  <circle cx="30" cy="42" r="2.2" fill="#ec4899"/>
  <circle cx="51" cy="42" r="2.2" fill="#ec4899"/>
  <circle cx="30.5" cy="41" r="1.3" fill="#ffffff" opacity="0.95"/>
  <circle cx="51.5" cy="41" r="1.3" fill="#ffffff" opacity="0.95"/>
  <path d="M28 52 Q40.5 58 53 52" stroke="#7c3aed" stroke-width="2.8" fill="none" stroke-linecap="round"/>
  <circle cx="24" cy="48" r="2.5" fill="#fda4af" opacity="0.7"/>
  <circle cx="57" cy="48" r="2.5" fill="#fda4af" opacity="0.7"/>
`
    ),

  'snap-scan': () =>
    svg(
      `<defs>
    <radialGradient id="lens" cx="38%" cy="38%" r="65%">
      <stop offset="0" stop-color="#93c5fd"/><stop offset="0.45" stop-color="#2563eb"/><stop offset="1" stop-color="#0f172a"/>
    </radialGradient>
  </defs>`,
      `
  <ellipse cx="41" cy="72" rx="24" ry="3" fill="#000000" opacity="0.06"/>
  <rect x="16" y="24" width="50" height="36" rx="9" fill="#ffffff" stroke="#e2e8f0" stroke-width="2"/>
  <rect x="17" y="25" width="48" height="7" rx="2" fill="#f8fafc"/>
  <rect x="24" y="14" width="34" height="12" rx="3.5" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5"/>
  <circle cx="41" cy="42" r="14" fill="url(#lens)" stroke="#2563eb" stroke-width="2"/>
  <circle cx="41" cy="42" r="7" fill="#1e40af"/>
  <circle cx="41" cy="42" r="3.5" fill="#93c5fd"/>
  <ellipse cx="37" cy="37" rx="4" ry="3" fill="#ffffff" opacity="0.55"/>
  <rect x="64" y="31" width="5" height="10" rx="1.5" fill="#e2e8f0" stroke="#cbd5e1" stroke-width="0.8"/>
`
    ),

  'carbon-tracker': () =>
    svg('', `
  <ellipse cx="40" cy="71" rx="16" ry="2.5" fill="#000000" opacity="0.05"/>
  <path d="M41 18c15 1 18 18 15 30-3 12-17 18-30 14C12 58 12 42 26 28c8-7 10-11 15-10z" fill="#22c55e" stroke="#14532d" stroke-width="2"/>
  <ellipse cx="34" cy="28" rx="8" ry="5" fill="#ffffff" opacity="0.25"/>
  <path d="M52 16l12-2v12" stroke="#0ea5e9" stroke-width="3" stroke-linecap="round" fill="none"/>
`),

  seasonal: () =>
    svg('', `
  <circle cx="40.5" cy="42" r="14" fill="#fde047" stroke="#ca8a04" stroke-width="2"/>
  <path d="M40.5 22v-12M40.5 62v12M20 42h-12M64 42h12" stroke="#fb7185" stroke-width="3" stroke-linecap="round"/>
`),

  favorites: () =>
    svg('', `
  <path d="M40.5 58L22 32c-4-7 2-16 14-16 7 0 11 6 11 6s4-6 11-6c12 0 18 9 14 16L40.5 58z" fill="#fb7185" stroke="#9f1239" stroke-width="2" stroke-linejoin="round"/>
`),

  community: () =>
    svg('', `
  <rect x="12" y="24" width="34" height="28" rx="7" fill="#7dd3fc" stroke="#0369a1" stroke-width="2.2"/>
  <rect x="34" y="34" width="32" height="28" rx="7" fill="#c4b5fd" stroke="#6d28d9" stroke-width="2.2"/>
`)
};

async function cleanAlphaEdge(sharpMod, input) {
  const { data, info } = await sharpMod(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const channels = info.channels;
  const px = data.length / channels;
  for (let i = 0; i < px; i++) {
    const o = i * channels;
    if (data[o + 3] < 10) {
      data[o] = data[o + 1] = data[o + 2] = data[o + 3] = 0;
    }
  }
  return sharpMod(data, {
    raw: { width: info.width, height: info.height, channels: 4 }
  }).png({ compressionLevel: 9, effort: 10 });
}

async function main() {
  const sharp = require('sharp');
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

  for (const [key, fn] of Object.entries(drawings)) {
    const svgStr = fn();
    const large = await sharp(Buffer.from(svgStr), { density: 400 })
      .resize(RENDER, RENDER, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .ensureAlpha()
      .png()
      .toBuffer();
    const resized = await sharp(large)
      .resize(SIZE, SIZE, { fit: 'fill', kernel: sharp.kernel.lanczos3, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .ensureAlpha()
      .png()
      .toBuffer();
    const buf = await (await cleanAlphaEdge(sharp, resized)).toBuffer();
    fs.writeFileSync(path.join(OUT, `${key}.png`), buf);
    console.log(`生成: categories/${key}.png (${(buf.length / 1024).toFixed(2)} KB)`);
  }
  console.log('\n完成: images/categories/*.png');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
