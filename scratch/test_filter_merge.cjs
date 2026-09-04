const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fs = require('fs');

(async () => {
  const c = createCanvas(600, 200);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#101612';
  ctx.fillRect(0, 0, 600, 200);

  // SVG with feGaussianBlur + feOffset + feFlood + feComposite + feMerge
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="200">
    <defs>
      <filter id="fGlow" x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB">
        <feGaussianBlur in="SourceAlpha" stdDeviation="10" result="blur" />
        <feFlood flood-color="#87CC2E" flood-opacity="0.4" result="color" />
        <feComposite in="color" in2="blur" operator="in" result="shadow" />
        <feMerge>
          <feMergeNode in="shadow" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    <rect x="200" y="50" width="200" height="100" rx="14" fill="#19271D" stroke="#87CC2E" stroke-width="1.5" filter="url(#fGlow)" />
  </svg>`;
  const img = await loadImage(Buffer.from(svg));
  ctx.drawImage(img, 0, 0);

  fs.writeFileSync('C:/toad/vario-nova/dark/test_filter_merge.png', c.toBuffer('image/png'));
  console.log('Saved test_filter_merge.png');
})();
