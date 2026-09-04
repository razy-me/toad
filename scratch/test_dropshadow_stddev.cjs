const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fs = require('fs');

(async () => {
  const c = createCanvas(600, 200);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, 600, 200);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="200">
    <defs>
      <filter id="fShadow" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="10" dy="10" stdDeviation="5" flood-color="#ff0000" flood-opacity="1" />
      </filter>
    </defs>
    <rect x="100" y="50" width="100" height="80" fill="#0000ff" filter="url(#fShadow)" />
  </svg>`;
  const img = await loadImage(Buffer.from(svg));
  ctx.drawImage(img, 0, 0);

  fs.writeFileSync('C:/toad/vario-nova/dark/test_dropshadow_stddev.png', c.toBuffer('image/png'));
  console.log('Saved test_dropshadow_stddev.png');
})();
