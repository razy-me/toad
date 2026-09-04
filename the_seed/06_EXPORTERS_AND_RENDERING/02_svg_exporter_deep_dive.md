# SVG Exporter Deep Dive

The TOAD SVG Exporter transforms the resolved AST into clean, standards-compliant, standalone W3C SVG documents. These files render identically across web browsers (Chrome, Safari, Firefox), vector design tools (Figma, Adobe Illustrator, Inkscape), and print ingestion systems.

---

## 1. Core Architecture

The SVG exporter does not emit raw strings haphazardly. It builds a structured XML document tree with deterministic resource deduplication:

```
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 W H" width="W" height="H">
  <defs>
    <!-- Embedded Base64 Fonts -->
    <style>@font-face { ... }</style>
    <!-- Deduplicated Linear & Radial Gradients -->
    <linearGradient id="grad_1" color-interpolation="sRGB"> ... </linearGradient>
    <!-- Filter Effects (Shadows, Blurs, Glows) -->
    <filter id="shadow_1" color-interpolation-filters="sRGB"> ... </filter>
    <!-- Clip Paths -->
    <clipPath id="clip_1"> ... </clipPath>
  </defs>

  <!-- Render Graph Layer Hierarchy -->
  <g id="artboard_root">
    ...
  </g>
</svg>
```

---

## 2. Critical Engine Fixes & Visual Parity

Historically, SVG renderers in browsers and vector software displayed muted colors, clipped shadows, and misaligned text compared to Skia raster output. TOAD eliminates these discrepancies through four engine-level guarantees:

### 2.1 Explicit sRGB Color Interpolation
**The Problem**: The W3C SVG specification defaults `color-interpolation` on gradients and `color-interpolation-filters` on `<filter>` elements to `linearRGB`. This causes gradients (especially neon greens, cyber purples, and golden ambers) to lose saturation, appearing washed-out and muddy.

**The TOAD Engine Solution**:
Every `<linearGradient>`, `<radialGradient>`, and `<filter>` emitted by TOAD carries explicit sRGB interpolation directives:
```xml
<linearGradient id="grad_teal" x1="0%" y1="0%" x2="100%" y2="100%" color-interpolation="sRGB">
  <stop offset="0%" stop-color="#00F5A0" stop-opacity="1"/>
  <stop offset="100%" stop-color="#00D9F5" stop-opacity="1"/>
</linearGradient>

<filter id="glow_neon" x="-100%" y="-100%" width="300%" height="300%" color-interpolation-filters="sRGB">
  <feDropShadow dx="0" dy="8" stdDeviation="16" flood-color="#00F5A0" flood-opacity="0.4"/>
</filter>
```
This forces all SVG engines to blend color stops in gamma-corrected sRGB space, matching Skia raster pixel-for-pixel.

---

### 2.2 Expanded Filter Subregion Clipping
**The Problem**: The default SVG filter subregion is:
$$x = -10\%, \quad y = -10\%, \quad \text{width} = 120\%, \quad \text{height} = 120\%$$
Any drop shadow, outer glow, or gaussian blur with a radius $> 12\text{px}$ gets visibly sliced off at the bounding box edge.

**The TOAD Engine Solution**:
All filters automatically define an expanded calculation bounding box:
```xml
x="-100%" y="-100%" width="300%" height="300%"
```
This gives large, cinematic neon glows and diffuse ambient shadows $3\times$ the element dimension to decay naturally without clipping artifacts.

---

### 2.3 Alphabetic Baseline Parity
**The Problem**: 
- Skia Canvas positions text via alphabetic baseline: `ctx.fillText(str, x, baselineY)`.
- SVG `<text>` elements by default position text at the baseline, but naive SVG generators pass the top-left box coordinate $y$, causing the text to render completely above the intended container. If `dominant-baseline="hanging"` is used, cross-browser metric bugs in Safari/WebKit shift glyphs vertically by 2–4px.

**The TOAD Engine Solution**:
TOAD uses the mathematical font ascent from layout evaluation to calculate the exact alphabetic baseline coordinate:

$$y_{\text{baseline}} = y_{\text{node}} + \text{valignShift} + \text{ascent}$$

Where:
- $\text{ascent} = \text{node.textLayout.ascent}$ (derived from DirectWrite/FreeType font tables).
- Fallback heuristic when table metrics are unavailable:
  $$\text{ascent} \approx \text{round}(\text{font-size} \times 0.80)$$

This guarantees that text in SVG sits in the exact same vertical position as in raster PNG exports.

---

### 2.4 Autonomous Font Embedding (Base64)
**The Problem**: Standalone SVGs opened in Figma, Illustrator, or other machines fail to render custom typography if the specific font is not installed on the host OS. The browser falls back to Times New Roman or Arial, breaking word wrap and alignments.

**The TOAD Engine Solution**:
When `@font` directives are defined in `.toad`:
```toad
@font "Inter" {
    src: "./fonts/Inter-Variable.ttf";
}
```
The SVG exporter:
1. Reads the local font binary from disk.
2. Converts the binary buffer to Base64 data URI: `data:font/truetype;charset=utf-8;base64,...`
3. Injects the `@font-face` declaration into `<defs><style>`:
```xml
<defs>
  <style>
    @font-face {
      font-family: 'Inter';
      src: url('data:font/truetype;charset=utf-8;base64,AAEAAAASAQA...') format('truetype');
      font-weight: 100 900;
      font-style: normal;
    }
  </style>
</defs>
```
The resulting SVG is **100% self-contained**. It renders identically on any device without external network requests or font installation.

---

## 3. Vector Masking and Clipping

Complex geometries and card headers with curved corners use native `<clipPath>` definitions:

```xml
<defs>
  <clipPath id="card_clip_01">
    <rect x="100" y="100" width="400" height="300" rx="16" ry="16"/>
  </clipPath>
</defs>

<g clip-path="url(#card_clip_01)">
  <image href="cover.jpg" x="100" y="100" width="400" height="300" preserveAspectRatio="xMidYMid slice"/>
  <rect x="100" y="200" width="400" height="100" fill="url(#grad_overlay)"/>
</g>
```

---

## 4. Inspection and Debugging

To inspect the generated SVG output structure:
```bash
toad compile input.toad -o output.svg --pretty
```

The `--pretty` flag indents XML tags and formats attribute clusters for visual readability and Git diffing.
