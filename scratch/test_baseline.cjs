const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fs = require('fs');

(async () => {
  const c = createCanvas(400, 200);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, 400, 200);

  ctx.font = '24px sans-serif';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
  ctx.fillText('Hello World', 50, 50);

  const svg1 = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><text x="50" y="50" font-family="sans-serif" font-size="24" dominant-baseline="hanging" fill="rgba(0, 255, 0, 0.8)">Hello World</text></svg>';
  const img1 = await loadImage(Buffer.from(svg1));
  ctx.drawImage(img1, 0, 0);

  fs.writeFileSync('C:/toad/vario-nova/dark/test_baseline.png', c.toBuffer('image/png'));
  console.log('Saved test_baseline.png');
})();
