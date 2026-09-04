import { createCanvas, loadImage } from '@napi-rs/canvas';
async function run() {
  const img = await loadImage('C:/Users/flori/Downloads/image.jpg');
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  for (let x = 600; x <= 1800; x += 100) {
    const d = ctx.getImageData(x, 2100, 1, 1).data;
    console.log('x=' + x + ' rgb(' + d[0] + ',' + d[1] + ',' + d[2] + ')');
  }
}
run();
