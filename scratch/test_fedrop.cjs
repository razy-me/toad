const fs = require('fs');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="200">
  <defs>
    <filter id="fSrgb" x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB">
      <feDropShadow dx="0" dy="0" stdDeviation="10" flood-color="rgba(135, 204, 46, 0.35)" />
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="#101612" />
  <rect x="200" y="50" width="200" height="100" rx="14" fill="#19271D" stroke="#87CC2E" stroke-width="1.5" filter="url(#fSrgb)" />
</svg>`;
fs.writeFileSync('C:/toad/vario-nova/dark/test_fedropshadow_srgb.svg', svg);
console.log('Saved test_fedropshadow_srgb.svg');
