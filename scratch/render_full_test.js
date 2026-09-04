import { createCanvas, Path2D } from '@napi-rs/canvas';
import fs from 'fs';

const svgData = fs.readFileSync('C:/toad/scratch_test_poster.svg', 'utf8');
const dMatches = [...svgData.matchAll(/d="([^"]+)"/g)].map(m => m[1]);

const canvas = createCanvas(1000, 1400);
const ctx = canvas.getContext('2d');

// 1. Background
ctx.fillStyle = '#f0f3f6';
ctx.fillRect(0, 0, 1000, 1400);

// 2. Inner Frame Border
ctx.strokeStyle = '#1a3258';
ctx.lineWidth = 1.5;
ctx.strokeRect(40, 40, 920, 1156);

// 3. Graphic Area (Clipped to inner frame)
ctx.save();
ctx.beginPath();
ctx.rect(40, 40, 920, 1156);
ctx.clip();

ctx.translate(40, 40);
ctx.fillStyle = '#1a3258';
ctx.fill(new Path2D(dMatches[0]));

ctx.fillStyle = '#f0f3f6';
for (let i = 1; i < dMatches.length; i++) {
  ctx.fill(new Path2D(dMatches[i]));
}

// Draw fine crease lines inside graphic
ctx.strokeStyle = '#f0f3f6';
ctx.lineWidth = 1.8;
// Line 1: top left rounded tip
ctx.beginPath();
ctx.moveTo(175, 130);
ctx.lineTo(215, 95);
ctx.stroke();

// Line 2: upper middle
ctx.beginPath();
ctx.moveTo(495, 305);
ctx.lineTo(510, 275);
ctx.stroke();

// Line 3: lower middle
ctx.beginPath();
ctx.moveTo(270, 650);
ctx.lineTo(255, 620);
ctx.stroke();

// Line 4: bottom loop
ctx.beginPath();
ctx.moveTo(180, 930);
ctx.lineTo(175, 900);
ctx.stroke();

ctx.restore();

// 4. Typography
const inkColor = '#1a3258';
ctx.fillStyle = inkColor;

// Line 1: Small category
ctx.font = '500 15px "Yu Gothic", "MS Gothic", sans-serif';
ctx.fillText('第48回 デザインギャラリー展', 42, 1238);

// Line 2: Title
ctx.font = 'bold 30px "Yu Gothic", "MS Gothic", sans-serif';
ctx.fillText('東京オリンピックの公式ポスタ (亀倉 雄策)', 42, 1276);

// Line 3: Subtitle
ctx.font = '400 13px "Yu Gothic", "MS Gothic", sans-serif';
ctx.fillText('第48回　第48回　かめくら ゆうさく、1915年4月6日 - 1997年5月11日。', 42, 1306);

// 5. Logo on right: circle (60px), semicircle 1 (30x60), semicircle 2 (30x60)
const logoY = 1248;
const D = 58;
const R = D / 2;
// Circle
ctx.beginPath();
ctx.arc(828 + R, logoY + R, R, 0, Math.PI * 2);
ctx.fill();

// Semicircle 1: curved on left, flat vertical on right
ctx.beginPath();
ctx.arc(894 + R, logoY + R, R, Math.PI * 0.5, Math.PI * 1.5, false);
ctx.lineTo(894 + R, logoY + D);
ctx.fill();

// Semicircle 2: curved on left, flat vertical on right
ctx.beginPath();
ctx.arc(930 + R, logoY + R, R, Math.PI * 0.5, Math.PI * 1.5, false);
ctx.lineTo(930 + R, logoY + D);
ctx.fill();

fs.writeFileSync('C:/toad/scratch_full_poster_test.png', canvas.toBuffer('image/png'));
console.log('Saved scratch_full_poster_test.png');
