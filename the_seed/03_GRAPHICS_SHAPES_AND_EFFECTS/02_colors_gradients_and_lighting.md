# 02 — Colors, Gradients & Lighting Engine

This manual covers the color representation models, multi-stop gradient architectures (linear, radial, conic), and lighting simulations within the TOAD engine.

---

## 1. Color Representation Models

TOAD natively parses four color syntax variants:
1. **Hexadecimal**: `#fff`, `#87CC2E`, `#10161280` (8-digit hex with alpha channel).
2. **RGB & RGBA**: `rgb(135, 204, 46)`, `rgba(16, 22, 18, 0.65)`.
3. **HSL & HSLA**: `hsl(86, 63%, 49%)`, `hsla(86, 63%, 49%, 0.8)`.
4. **Named Keywords**: `transparent`, `current`, standard CSS color names.

---

## 2. Linear Gradients (`linear-gradient`)

Linear gradients interpolate colors along an angled vector across the element's bounding box.

### Syntax Variations:
```toad
// Numeric angle in degrees (0deg = to top, 90deg = to right, 180deg = to bottom)
rect #angledGrad {
    fill: linear-gradient(135deg, #0C120E 0%, #152018 50%, #87CC2E 100%);
}

// Directional keywords
rect #directionalGrad {
    fill: linear-gradient(to bottom right, #00d2ff, #3a7bd5);
}
```

### Stop Distribution Math (`distributeGradientStops`)
When stop offsets are omitted, the compiler evenly distributes intermediate stops:
$$\text{offset}_i = \frac{i}{N - 1}$$
* `linear-gradient(#ff0000, #0000ff)` $\to$ `0%` and `100%`.
* `linear-gradient(#f00, #0f0, #00f)` $\to$ `0%`, `50%`, and `100%`.

---

## 3. Radial Gradients (`radial-gradient`)

Radial gradients generate circular or elliptical radiance emanating from a focal origin out to a boundary radius.

```toad
circle #ambientGlow {
    size: 700px;
    at: (100px, -50px);
    fill: radial-gradient(circle, alpha(#87CC2E, 0.35) 0%, alpha(#101612, 0) 70%);
}
```

### Critical Radiance Rule for Dark Interfaces:
> [!IMPORTANT]
> **Vibrant Glow Alphas $\ge 0.25$:**
> In sRGB display profiles, very low alpha values (e.g. `0.08` or `0.12`) are visually crushed by display gamma. Always use an initial stop alpha $\ge 0.25$ for vibrant, luminous neon ambient glows.

---

## 4. Conic Gradients (`conic-gradient`)

Conic gradients sweep colors angularly around a center point (ideal for color wheels, loading spinners, and circular charts):

```toad
circle #pieGauge {
    size: 240px;
    fill: conic-gradient(from 0deg, #87CC2E 0%, #F59E0B 70%, #EF4444 100%);
}
```

### SVG Fallback Architecture:
Because native SVG lacks a W3C `<conicGradient>` element, the TOAD SVG exporter automatically synthesizes an equivalent high-resolution **6-degree polygonal wedge pattern** with color-interpolated slices, guaranteeing 100% visual parity across web browsers.

---

## 5. sRGB Color Interpolation Parity

A vital discovery in the TOAD compiler:
* By default, W3C SVG gradients can interpolate in `linearRGB` space if unspecified, resulting in dark, desaturated bands between vibrant stops.
* The TOAD SVG exporter explicitly sets `color-interpolation="sRGB"` on all `<linearGradient>` and `<radialGradient>` definitions, ensuring exact 1:1 color parity with the Skia 2D raster engine.
