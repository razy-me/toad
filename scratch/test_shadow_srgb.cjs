const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fs = require('fs');

(async () => {
  const c = createCanvas(600, 200);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#101612';
  ctx.fillRect(0, 0, 600, 200);

  // 1. Canvas shadow
  ctx.save();
  ctx.shadowColor = 'rgba(135, 204, 46, 0.5)';
  ctx.shadowBlur = 20;
  ctx.fillStyle = '#19271D';
  ctx.strokeStyle = '#87CC2E';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(30, 50, 150, 100, 10);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // 2. SVG with default (linearRGB)
  const svgLinear = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="200">
    <defs>
      <filter id="fLinear" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="0" stdDeviation="10" flood-color="rgba(135, 204, 46, 0.5)" />
      </filter>
    </defs>
    <rect x="230" y="50" width="150" height="100" rx="10" fill="#19271D" stroke="#87CC2E" stroke-width="2" filter="url(#fLinear)" />
  </svg>`;
  const imgLinear = await loadImage(Buffer.from(svgLinear));
  ctx.drawImage(imgLinear, 0, 0);

  // 3. SVG with color-interpolation-filters="sRGB"
  const svgSrgb = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="200">
    <defs>
      <filter id="fSrgb" x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB">
        <feDropShadow dx="0" dy="0" stdDeviation="10" flood-color="rgba(135, 204, 46, 0.5)" />
      </filter>
    </defs>
    <rect x="420" y="50" width="150" height="100" rx="10" fill="#19271D" stroke="#87CC2E" stroke-width="2" filter="url(#fSrgb)" />
  </svg>`;
  const imgSrgb = await loadImage(Buffer.from(svgSrgb));
  ctx.drawImage(imgSrgb, 0, 0);

  fs.writeFileSync('C:/toad/vario-nova/dark/test_shadow_srgb.png', c.toBuffer('image/png'));
  console.log('Saved test_shadow_srgb.png');
})();
