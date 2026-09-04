const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fs = require('fs');

(async () => {
  // Canvas radial gradient
  const c1 = createCanvas(700, 700);
  const ctx1 = c1.getContext('2d');
  ctx1.fillStyle = '#101612';
  ctx1.fillRect(0, 0, 700, 700);

  const grad = ctx1.createRadialGradient(350, 350, 0, 350, 350, 350);
  grad.addColorStop(0, 'rgba(135, 204, 46, 0.16)');
  grad.addColorStop(0.7, 'rgba(16, 22, 18, 0)');
  ctx1.fillStyle = grad;
  ctx1.beginPath();
  ctx1.arc(350, 350, 350, 0, Math.PI * 2);
  ctx1.fill();
  fs.writeFileSync('C:/toad/vario-nova/dark/test_glow_canvas.png', c1.toBuffer('image/png'));

  // SVG radial gradient
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="700" height="700">
    <rect width="100%" height="100%" fill="#101612" />
    <defs>
      <radialGradient id="rad" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
        <stop offset="0%" stop-color="rgba(135, 204, 46, 0.16)" />
        <stop offset="70%" stop-color="rgba(16, 22, 18, 0)" />
      </radialGradient>
    </defs>
    <circle cx="350" cy="350" r="350" fill="url(#rad)" />
  </svg>`;
  const img = await loadImage(Buffer.from(svg));
  const c2 = createCanvas(700, 700);
  const ctx2 = c2.getContext('2d');
  ctx2.drawImage(img, 0, 0);
  fs.writeFileSync('C:/toad/vario-nova/dark/test_glow_svg.png', c2.toBuffer('image/png'));

  // Sample center pixel of both
  const p1 = ctx1.getImageData(350, 350, 1, 1).data;
  const p2 = ctx2.getImageData(350, 350, 1, 1).data;
  console.log('Center Canvas:', Array.from(p1));
  console.log('Center SVG:', Array.from(p2));
})();
