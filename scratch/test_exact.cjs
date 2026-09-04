const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fs = require('fs');

(async () => {
  const c = createCanvas(400, 200);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, 400, 200);

  const fontSize = 24;
  ctx.font = `${fontSize}px sans-serif`;
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(255, 0, 0, 0.7)';
  ctx.fillText('Hello World', 50, 50);

  ctx.textBaseline = 'alphabetic';
  const m = ctx.measureText('Hello World');
  const baselineY = 50 + m.fontBoundingBoxAscent;

  // SVG with alphabetic baseline at baselineY
  const svgAlpha = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><text x="50" y="${baselineY}" font-family="sans-serif" font-size="${fontSize}" fill="rgba(0, 255, 0, 0.7)">Hello World</text></svg>`;
  const img1 = await loadImage(Buffer.from(svgAlpha));
  ctx.drawImage(img1, 0, 0);

  fs.writeFileSync('C:/toad/vario-nova/dark/test_baseline_exact.png', c.toBuffer('image/png'));
  console.log('baselineY:', baselineY);
})();
