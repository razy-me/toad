import { createCanvas, Path2D } from '@napi-rs/canvas';
import fs from 'fs';

const svgData = fs.readFileSync('C:/toad/scratch_test_poster.svg', 'utf8');
const dMatches = [...svgData.matchAll(/d="([^"]+)"/g)].map(m => m[1]);

const canvas = createCanvas(1000, 1400);
const ctx = canvas.getContext('2d');
ctx.fillStyle = '#f0f3f6';
ctx.fillRect(0, 0, 1000, 1400);

ctx.strokeStyle = '#1a3258';
ctx.lineWidth = 1.5;
ctx.strokeRect(40, 40, 920, 1156);

ctx.save();
ctx.translate(40, 40);
ctx.fillStyle = '#1a3258';
ctx.fill(new Path2D(dMatches[0]));

ctx.fillStyle = '#f0f3f6';
for (let i = 1; i < dMatches.length; i++) {
  ctx.fill(new Path2D(dMatches[i]));
}
ctx.restore();

fs.writeFileSync('C:/toad/scratch_test_poster.png', canvas.toBuffer('image/png'));
console.log('Successfully rendered with Path2D!');
