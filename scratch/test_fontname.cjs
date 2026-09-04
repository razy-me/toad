const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const c = createCanvas(200, 100);
const ctx = c.getContext('2d');
ctx.font = '800 48px sans-serif';
// Can we find what font was matched?
console.log('Families count:', GlobalFonts.families.length);
