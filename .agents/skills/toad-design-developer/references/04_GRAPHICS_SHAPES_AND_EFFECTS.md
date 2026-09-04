# 04 — Graphics, Shapes, Vectors & Visual Effects

This module covers color models, gradients, geometric vector primitives, Lucide icons, 2D transforms, and visual effects (glassmorphism, masking, shadows).

---

## 1. Color Models & Color Modification Functions

| Format | Syntax | Example |
|---|---|---|
| **Hexadecimal** | `#RGB`, `#RGBA`, `#RRGGBB`, `#RRGGBBAA` (3/4/6/8 digits) | `#38bd`, `#38bdf8`, `#0f172a80` |
| **RGB / RGBA** | `rgb(r, g, b)`, `rgba(r, g, b, a)` | `rgba(15, 23, 42, 0.75)` |
| **HSL / HSLA** | `hsl(h, s%, l%)`, `hsla(h, s%, l%, a)` — alpha accepts a number **or `%`** (`50%` → `0.5`) | `hsla(210, 100%, 50%, 0.5)` |
| **CMYK** | `cmyk(c%, m%, y%, k%)` or `(c, m, y, k)` | `cmyk(0%, 100%, 100%, 0%)` |
| **Cascading** | `currentColor` | Inherits foreground color from parent scope |

```toad
>brand = #3b82f6;

fill: alpha(>brand, 0.4);      // Sets opacity to 40%
fill: lighten(>brand, 15%);    // Lightens color by 15%
fill: darken(>brand, 20%);     // Darkens color by 20%
```

---

## 2. Advanced Gradients

```toad
// Linear Gradient
fill: linear-gradient(135deg, #3b82f6 0%, #9333ea 50%, #f43f5e 100%);

// Radial Gradient
fill: radial-gradient(circle, #38bdf8 0%, #0f172a 100%);

// Conic Gradient (SVG export only — rendered as a 60-wedge approximation)
fill: conic-gradient(from 45deg, #f43f5e, #8b5cf6, #06b6d4, #f43f5e);
```

> **Gradient behavior notes:**
> * `linear-gradient` defaults to direction `to bottom` when no angle or keyword is given.
> * Radial gradients render as **centered circles**. CSS preamble tokens (`circle`, `ellipse`, `at center`, `closest-side`, `farthest-side`, `closest-corner`, `farthest-corner`) parse cleanly and are intentionally ignored — there is no ellipse geometry.
> * `conic-gradient` is approximated with 60 wedges and only in SVG export.

---

## 3. Vector Shapes & Primitives

```toad
// Rounded Rectangle
rect {
    size: 200px 100px;
    fill: #1e293b;
    radius: 16px; // or: border-radius: [16px, 16px, 0px, 0px];
}

// Geometric Shapes
star { size: 48px; fill: #f59e0b; rotation: 15deg; }
triangle { size: 60px 80px; fill: #ef4444; }
arrow { size: 40px; fill: #38bdf8; }
cross { size: 32px; fill: #10b981; }

// Polygon with local coordinates centered at (0, 0)
polygon {
    size: 120px 120px;
    points: [(-50px, -45px), (50px, -45px), (0px, 45px)];
    radius: 12px;
    fill: #10b981;
}

// Freeform SVG Path
path #wave {
    d: "M 0 50 Q 100 0 200 50 T 400 50";
    stroke: #38bdf8 3px;
    fill: transparent;
}
```

---

## 4. Lucide Icons (`icon`)

Supported registered icons: `search`, `check`, `x`, `arrow-right`, `arrow-left`, `arrow-up`, `arrow-down`, `home`, `user`, `settings`.

```toad
icon {
    iconName: "settings";
    size: 28px;
    fill: #ffffff;
}
```

---

## 5. 2D Transformations

```toad
rect #transformedCard {
    size: 200px 120px;
    rotation: -12deg;
    scale: 1.1;               // or scale: 1.1 0.9;
    skewX: 8deg;
    skewY: -4deg;
    transform-origin: center; // 'center', '50% 50%', or '(20px, 40px)'
    fill: #3b82f6;
}
```

---

## 6. Glassmorphism, Shadows & Masks

```toad
// Glassmorphism Panel
rect #glassPanel {
    size: 400px 240px;
    fill: rgba(255, 255, 255, 0.08);
    stroke: rgba(255, 255, 255, 0.2) 1px;
    radius: 20px;
    backdrop-filter: blur(24px) saturate(180%); // SVG-only — see note below
    shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
}

// Masking
circle #avatarMask { size: 80px; at: (50px, 50px); }
image #profilePic  { src: "./avatar.png"; size: 80px; at: (50px, 50px); mask: #avatarMask; }
```

> **Effects & filters (raster/Skia):**
> * Standard filter functions render normally; `drop-shadow()` and `opacity()` are applied at composite time.
> * Malformed filter strings safely degrade to `none`.
> * `backdrop-filter` is **unsupported** on raster (PNG/JPG/WebP) and PSD output — it safely degrades there; SVG export writes it as a CSS style hint.
> * Node `opacity` is applied exactly once even on filtered nodes; blur radii and shadow offsets scale with the `-s` zoom multiplier.
> * A `shadow` / outer glow on a `group`, `stack`, or `grid` draws **one** shadow around the union of its children (no per-descendant leak).

---

## 7. Photo Canvas Mode & Photographic Adjustments

TOAD supports photo editing documents where a base photograph serves as the canvas. In photo canvas mode, image dimensions are automatically detected from the image file header (PNG, JPEG, WebP) without needing manual width and height declarations.

### 7.1 Photo Canvas Declaration & Global Grading

```toad
canvas photo "portrait.jpg" {
    // Global photographic color and tone adjustments
    exposure: 0.3;         // EV exposure compensation (2^EV multiplier)
    contrast: 1.15;        // Contrast centered at mid-gray 128
    brightness: 1.05;      // Direct brightness multiplier
    saturation: 1.1;       // Rec.709 relative luminance color saturation
    warmth: 0.12;          // Temperature shift (+ warm amber, - cool blue)
    highlights: -0.2;      // Recover blown highlights (> 50% luminance)
    shadows: 0.15;         // Lift dark shadows (< 50% luminance)
    vignette: 25%;         // Radial edge darkening falloff (25% or 0.25)
}
```

### 7.2 Local Radial Adjustments (`adjust`)

Local dodge & burn adjustments can be applied to specific coordinates using `adjust`. Each adjustment spot defines a center coordinate, a radius, a feathered falloff distance, and local parameter offsets applied additively on top of global adjustments.

```toad
// Dodge (brighten) face area
adjust #faceDodge {
    at: (450px, 320px);
    radius: 120px;
    feather: 50px;
    exposure: 0.4;
    warmth: 0.08;
}

// Burn (darken / add contrast) background corner
adjust #cornerBurn {
    at: (120px, 100px);
    radius: 180px;
    feather: 80px;
    exposure: -0.5;
    contrast: 1.2;
}

// Regular design elements composite cleanly on top of photo canvases
text #title {
    at: center of canvas;
    color: #ffffff;
    font-size: 32px;
    font-weight: 700;
}
```
