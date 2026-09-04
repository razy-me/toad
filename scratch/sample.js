const { createCanvas, loadImage } = require('@napi-rs/canvas');
async function run() {
  const img = await loadImage('C:/Users/flori/Downloads/image.jpg');
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  for (let y = 1200; y <= 3400; y += 100) {
    const d = ctx.getImageData(1200, y, 1, 1).data;
    console.log('y=' + y + ' rgb(' + d[0] + ',' + d[1] + ',' + d[2] + ')');
  }
}
run();
