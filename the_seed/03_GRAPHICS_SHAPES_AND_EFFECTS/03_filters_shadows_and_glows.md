# 03 — Filters, Shadows & Glow Effects

This manual covers the CSS-compatible filter pipeline, hardware-accelerated drop shadows, and luminous outer glow effects across raster, SVG, and Photoshop targets.

---

## 1. Filter Functions & Syntax

The `filter:` property accepts one or more chained image processing filters:

```toad
rect #frostedCard {
    filter: blur(8px) brightness(1.1) drop-shadow(0 12px 32px alpha(#000000, 0.4));
}
```

### Complete Filter Function Reference:

| Filter Function | Arguments | Description |
|---|---|---|
| `blur()` | `<radius>` (e.g. `10px`) | Gaussian blur standard deviation. |
| `drop-shadow()` | `<dx> <dy> <blur> <color>` | Elevation shadow with independent offset, spread, and color. |
| `opacity()` | `<0.0 - 1.0>` or `<percent>` | Alpha attenuation of the element and its children. |
| `brightness()` | `<multiplier>` (e.g. `1.2`) | Linear brightness scaling. |
| `contrast()` | `<multiplier>` (e.g. `1.5`) | Contrast enhancement around the 0.5 midpoint. |
| `saturate()` | `<multiplier>` (e.g. `1.3`) | Chromatic saturation multiplier. |
| `grayscale()` | `<0.0 - 1.0>` or `<percent>` | Desaturates colors into monochrome luminance. |
| `sepia()` | `<0.0 - 1.0>` or `<percent>` | Applies classic photographic warm sepia matrix. |
| `invert()` | `<0.0 - 1.0>` or `<percent>` | Inverts color channels. |
| `hue-rotate()` | `<angle>` (e.g. `90deg`) | Rotates color hue around the chromatic wheel. |

---

## 2. Drop Shadows (`shadow:` and `filter: drop-shadow`)

TOAD supports two equivalent shadow declarations:
1. Shorthand: `shadow: 0 8px 24px alpha(#000000, 0.4);`
2. Filter: `filter: drop-shadow(0 8px 24px alpha(#000000, 0.4));`

### Elevation Scale Best Practices:
```toad
// Level 1: Subtle Border Elevation (Cards, Badges)
>shadowSm = "0 2px 4px alpha(#000000, 0.1)";

// Level 2: Interactive Hover / Floating Tiles
>shadowMd = "0 8px 20px alpha(#000000, 0.25)";

// Level 3: Modals, Popovers, Raised Keynotes
>shadowLg = "0 20px 48px alpha(#000000, 0.45)";
```

---

## 3. Outer Glow Effects

Glows are non-directional shadows ($dx = 0, dy = 0$) using brand-tinted luminous colors:

```toad
rect #neonPill {
    size: 140px 32px;
    fill: #87CC2E;
    radius: 16px;
    shadow: 0 0 20px alpha(#87CC2E, 0.45);
}
```

---

## 4. Cross-Engine SVG Filter Fidelity

In W3C SVG, `<filter>` elements have two critical defaults that often cause bugs if not handled properly by the compiler:

### 1. `color-interpolation-filters="sRGB"`
* **Default**: Standard SVG `<filter>` operates in `linearRGB` space. Linear gamma conversion ($C^{2.2}$) crushes transparent colors, causing shadows and glows to appear thin, dull, and grayish.
* **The Fix**: The TOAD compiler enforces `color-interpolation-filters="sRGB"` on all filter definitions.

### 2. Expanded Filter Subregions
* **Default**: Standard SVG clips filters outside `x="-10%" y="-10%" width="120%" height="120%"`. Large blurs (>16px) get clipped with harsh rectangular edges.
* **The Fix**: TOAD expands the filter bounding box to `x="-50%" y="-50%" width="200%" height="200%"`, preventing any edge clipping.
