const fs = require('fs');
const { loadImage, createCanvas } = require('@napi-rs/canvas');

(async () => {
  let svg = fs.readFileSync('C:/toad/vario-nova/dark/vario-nova-dark@2x.svg', 'utf-8');
  svg = svg.replace(/font-family="sans-serif"/g, 'font-family="\'Agency FB\', sans-serif"');

  const img = await loadImage(Buffer.from(svg));
  const c = createCanvas(img.width, img.height);
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  fs.writeFileSync('C:/toad/vario-nova/dark/test_svg_agency.png', c.toBuffer('image/png'));
  console.log('Saved test_svg_agency.png');
})();
