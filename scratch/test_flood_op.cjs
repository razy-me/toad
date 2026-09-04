const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fs = require('fs');

(async () => {
  const c = createCanvas(600, 200);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#101612';
  ctx.fillRect(0, 0, 600, 200);

  // SVG with flood-opacity
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="200">
    <defs>
      <filter id="fFloodOp" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="0" stdDeviation="10" flood-color="#87CC2E" flood-opacity="0.5" />
      </filter>
      <filter id="fRgba" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="0" stdDeviation="10" flood-color="rgba(135, 204, 46, 0.5)" />
      </filter>
    </defs>
    <rect x="100" y="50" width="150" height="100" rx="10" fill="#19271D" stroke="#87CC2E" stroke-width="2" filter="url(#fFloodOp)" />
    <rect x="350" y="50" width="150" height="100" rx="10" fill="#19271D" stroke="#87CC2E" stroke-width="2" filter="url(#fRgba)" />
  </svg>`;
  const img = await loadImage(Buffer.from(svg));
  ctx.drawImage(img, 0, 0);

  fs.writeFileSync('C:/toad/vario-nova/dark/test_flood_op.png', c.toBuffer('image/png'));
  console.log('Saved test_flood_op.png');
})();
