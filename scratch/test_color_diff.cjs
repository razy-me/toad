const { loadImage } = require('@napi-rs/canvas');

(async () => {
  const png = await loadImage('C:/toad/vario-nova/dark/vario-nova-dark@2x.png');
  const svg = await loadImage('C:/toad/vario-nova/dark/svg_rasterized_test.png');

  const getPixel = (img, x, y) => {
    const c = require('@napi-rs/canvas').createCanvas(1, 1);
    const ctx = c.getContext('2d');
    ctx.drawImage(img, -x, -y);
    return Array.from(ctx.getImageData(0, 0, 1, 1).data);
  };

  // Sample points:
  // 1. Glow Side 2 center: (450*2, 900*2) = (900, 1800)
  console.log('Glow2 (900, 1800):');
  console.log('  PNG:', getPixel(png, 900, 1800));
  console.log('  SVG:', getPixel(svg, 900, 1800));

  // 2. Green badge "PROGRAMM & TIMELINE" at (450*2, 660*2) = (900, 1320)
  console.log('Badge (900, 1320):');
  console.log('  PNG:', getPixel(png, 900, 1320));
  console.log('  SVG:', getPixel(svg, 900, 1320));

  // 3. CTA button "vario.de/nova" green at (168*2, 107*2)
  console.log('CTA Pill (336, 214):');
  console.log('  PNG:', getPixel(png, 336, 214));
  console.log('  SVG:', getPixel(svg, 336, 214));

  // 4. White title "Was Dich auf der VARIO Nova erwartet" at (900, 1390)
  console.log('Title (900, 1390):');
  console.log('  PNG:', getPixel(png, 900, 1390));
  console.log('  SVG:', getPixel(svg, 900, 1390));
})();
