const { createCanvas } = require('@napi-rs/canvas');
const fs = require('fs');

const fonts = ['Bahnschrift', 'Agency FB', 'Impact', 'Segoe UI', 'Arial'];
for (const f of fonts) {
  const c = createCanvas(600, 60);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, 600, 60);
  ctx.font = `800 28px "${f}"`;
  ctx.fillStyle = '#fff';
  ctx.fillText('Was Dich auf der VARIO Nova erwartet', 10, 40);
  fs.writeFileSync(`C:/toad/vario-nova/dark/font_${f}.png`, c.toBuffer('image/png'));
}
console.log('Saved candidate fonts');
