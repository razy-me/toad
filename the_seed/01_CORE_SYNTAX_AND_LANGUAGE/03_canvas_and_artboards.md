# 03 — Canvas & Artboards Specification

The `canvas` declaration defines the root viewport, dimensional boundaries, background fill, export targets, and default document styles in a `.toad` design.

---

## 1. Canvas Declaration Syntax

Every complete `.toad` script contains at least one `canvas` block:

```toad
canvas "VarioNovaTentCard_Dark" {
    size: 900px 1200px;
    background: #101612;
    font-family: "Agency FB", sans-serif;
    export: all;
    scales: [1, 2];
    quality: 100;
}
```

---

## 2. Comprehensive Canvas Properties

| Property | Type / Values | Description |
|---|---|---|
| `size:` / `dimensions:` | `W H` (e.g. `1200px 630px`) | Sets explicit canvas width and height. |
| `width:` / `height:` | Number or Dimension (`800px`) | Explicit width or height override. |
| `background:` / `fill:` | Hex, RGBA, or Gradient | Root canvas background fill. |
| `font-family:` / `font:` | String (e.g. `"Inter"`) | **Document default font**: Automatically inherited by all text elements that omit explicit font-family. |
| `export:` / `exports:` | `all`, `png`, `jpg`, `webp`, `svg`, `psd` | List of target export formats. |
| `scales:` / `scale:` | Number array (e.g. `[1, 2, 4]`) | Resolution multiplier exports (`@2x`, `@4x`). |
| `quality:` / `compression:` | `1` to `100` | JPEG and WebP export compression quality. |
| `dpi:` | Number (`72`, `96`, `300`) | Resolution metadata (default `96`). Essential for print workflows. |
| `bleed:` | Dimension (e.g. `3mm` or `12px`) | Extra edge margins outside the trim box. |
| `crop-marks:` | `true` / `false` | Emits professional print registration & trim marks. |
| `color-mode:` | `rgb` or `cmyk` | Color profile mode for prepress output. |
| `preset:` | String (`og-image`, `a4`, etc.) | Instant dimensions from standard industrial aspect ratios. |

---

## 3. Industrial Size Presets

When using `preset: "name";`, TOAD automatically configures width and height:

| Preset Name | Dimensions ($W \times H$) | Target Platform |
|---|---|---|
| `"og-image"` | $1200 \times 630\text{ px}$ | OpenGraph social preview card |
| `"banner"` | $1920 \times 1080\text{ px}$ | Standard 16:9 Full HD banner |
| `"github-banner"` | $1280 \times 640\text{ px}$ | GitHub repository social image (2:1) |
| `"avatar"` | $400 \times 400\text{ px}$ | Square profile picture |
| `"app-icon"` | $1024 \times 1024\text{ px}$ | App Store / Play Store icon asset |
| `"insta-post"` | $1080 \times 1080\text{ px}$ | Instagram Square Feed |
| `"insta-story"` | $1080 \times 1920\text{ px}$ | Vertical 9:16 Story / Reel / TikTok |
| `"twitter-header"` | $1500 \times 500\text{ px}$ | X / Twitter profile header (3:1) |
| `"a4"` | $2480 \times 3508\text{ px}$ | ISO A4 Portrait at 300 DPI |
| `"a4-landscape"` | $3508 \times 2480\text{ px}$ | ISO A4 Landscape at 300 DPI |

---

## 4. Multi-Canvas Artboards & Multi-Page Documents

TOAD supports multiple artboards in a single file:

```toad
canvas "Page 1 - Front Cover" {
    size: 1080px 1920px;
    background: #0f172a;
    rect #card1 { ... }
}

canvas "Page 2 - Inside Spread" {
    size: 1080px 1920px;
    background: #1e293b;
    rect #card2 { ... }
}
```

### Artboard Isolation Rules:
* Each `canvas` defines its own isolated coordinate space and element hierarchy.
* Shared global variables (`>theme`) and `@font` directives are accessible across all artboards in the document.
* The CLI builds each canvas as an individual set of export files matching the canvas name (e.g. `Page-1-Front-Cover.png`, `Page-2-Inside-Spread.png`).
