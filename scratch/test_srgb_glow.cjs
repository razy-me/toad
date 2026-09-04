const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fs = require('fs');

(async () => {
  // Let's test with color-interpolation-filters="sRGB" on feDropShadow
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="200">
    <defs>
      <filter id="fSrgb" x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB">
        <feGaussianBlur in="SourceAlpha" stdDeviation="10" result="blur" />
        <feFlood flood-color="rgba(135, 204, 46, 0.25)" result="flood" />
        <feComposite in="flood" in2="blur" operator="in" result="shadow" />
        <feMerge>
          <feMergeNode in="shadow" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    <rect x="200" y="50" width="200" height="100" rx="14" fill="#19271D" stroke="#87CC2E" stroke-width="1.5" filter="url(#fSrgb)" />
  </svg>`;
  const img = await loadImage(Buffer.from(svg));
  const c = createCanvas(600, 200);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#101612';
  ctx.fillRect(0, 0, 600, 200);
  ctx.drawImage(img, 0, 0);
  fs.writeFileSync('C:/toad/vario-nova/dark/test_srgb_glow.png', c.toBuffer('image/png'));
  console.log('Saved test_srgb_glow.png');
})();
