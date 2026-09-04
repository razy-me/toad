# 07 — Exporter Architecture, Photoshop PSD & Prepress (CMYK/Bleed)

This module documents the multi-format export pipeline (Raster, SVG, native Photoshop PSD) and print prepress features (CMYK color space, bleed geometry, and crop marks).

---

## 1. Export Formats & Multi-Scale Rendering

| Format | Flag / Property | Highlights |
|---|---|---|
| **PNG** | `export: png;` | Lossless raster compression with full alpha channel |
| **JPG** | `export: jpg;` | Photographic compression with adjustable `quality: 85%;` |
| **WebP** | `export: webp;` | Modern web format with high compression efficiency |
| **SVG** | `export: svg;` | Clean vector XML with structured `<defs>`, gradients & paths |
| **PSD** | `export: psd;` | Native Photoshop layers with vector masks & layer styles; `colorMode` is always RGB (CMYK requests convert to sRGB output) |
| **image** | `export: image;` | Bundle macro: exports PNG, JPG, WebP, and SVG simultaneously |
| **all** | `export: all;` | Exports all raster, vector, and layered PSD files |

* **Multi-Scale Multiplier (`-s, --scale 2`)**: Linearly scales canvas dimensions, coordinates, vector paths, and shadow blurs for High-DPI / Retina displays.

---

## 2. Photoshop PSD Vector & Layer FX Architecture

The PSD exporter (`src/engine/psdExporter.ts`) leverages `ag-psd` to synthesize native Adobe Photoshop data structures rather than flattened pixels:

### Photoshop Additional Layer Information (ALI) Keys:

| TOAD Property | Photoshop ALI Key | Photoshop UI & Behavior |
|---|---|---|
| `rect`, `circle`, `polygon`, `star`, `triangle`, `arrow`, `cross` | `vmsk` / `vsms` | **True Bézier Vector Mask**: Editable with the Direct Selection Tool (`A`) in Photoshop. |
| `path { d: ... }`, `icon` | — (rasterized) | Generic paths and Lucide icons have no native vector mask — they are rasterized into the composite. |
| `rect { radius: 12px; }` | `keyOriginRRectRadii` | **Live Rounded Rectangle**: Corner radii remain dynamically editable in Photoshop's Properties panel. |
| `fill: linear-gradient(...)` | `GdFl` | **Native Gradient Fill**: Fully editable in Photoshop's Gradient Editor. |
| `fill: #3b82f6;` | `SoCo` | **Solid Color Layer** (fill layer). |
| `shadow: 0 10px 20px ...` | `lrFX` / `lmfx` (`toad`) | **Native Drop Shadow** layer style. |
| `stroke: #000 2px;` (element property) | `vectorStroke` | **Vector Stroke** painted on the shape layer itself. |
| `layer-stroke: #000 2px;` | `lrFX` (`FrFX`) | **Native Stroke** layer style effect. |
| `inner-shadow: ...` | `lrFX` (`isds`) | **Native Inner Shadow** layer style. |
| `text { ... }` | `TySh` | **Native Type Layer**: PostScript font mapping (`ArialMT`, `Arial-BoldMT`, …), tracking in 1/1000 em, `fauxBold`/`fauxItalic` from weight/style, editable live text, paragraph justification. |
| `clip: true;` | `clipping: true` | **Sibling Clipping**: the node masks its **next** sibling (parity with raster/SVG rendering). |

---

## 3. Print Prepress (CMYK, Bleed & Dimensions)

```toad
canvas "BusinessCard-Front" {
    size: 85mm 55mm;          // Finished trimmed size (Trim Box)
    dpi: 300;                 // Print metadata (drives only the --bleed CLI override conversion)
    color-mode: cmyk;         // Accepted; colors convert to sRGB output — PSD stays RGB
    bleed: 3mm;               // 3mm bleed margin on all 4 edges
    crop-marks: true;         // Renders crop marks & registration crosshairs
    background: cmyk(0%, 0%, 0%, 95%);
    export: all;
}
```

### Physical Print Units (fixed CSS-reference 96 DPI):
$$\text{Pixels} = \frac{\text{Dimension Value}}{\text{Units per Inch}} \times 96$$
Physical units always convert at the CSS-reference **96 DPI**, independent of the canvas `dpi:` value (which is print metadata and only drives the `--bleed` CLI override).
* $1\text{ in} = 96.0\text{ px}$
* $1\text{ mm} \approx 3.7795\text{ px}$
* $1\text{ cm} \approx 37.795\text{ px}$
* $1\text{ pt} \approx 1.3333\text{ px}$

---

## 4. Bleed Geometry & Crop Marks

```
┌──────────────────────────── Media Box (with Bleed & Margins) ─────────────────┐
│  ✂️ Crop Mark                                                    ✂️ Crop Mark  │
│      ┌───────────────────── Bleed Box (+2x Bleed) ────────────────────┐       │
│      │  Bleed allowance (e.g. 3mm) for full-bleed background artwork  │       │
│      │      (0, 0)                                                    │       │
│      │      ┌────────────── Trim Box (Finished Size) ──────────┐      │       │
│      │      │                                                  │      │       │
│      │      │   ┌────────── Safe Zone (Inner Safety Margin) ┐  │      │       │
│      │      │   │                                           │  │      │       │
│      │      │   │  Essential Content (Text, Logos, Icons)   │  │      │       │
│      │      │   │                                           │  │      │       │
│      │      │   └───────────────────────────────────────────┘  │      │       │
│      │      │                                                  │      │       │
│      │      └──────────────────────────────────────────────────┘      │       │
│      │                                                                │       │
│      └────────────────────────────────────────────────────────────────┘       │
│  ✂️ Crop Mark                                                    ✂️ Crop Mark  │
└───────────────────────────────────────────────────────────────────────────────┘
```

* **Trim Box**: The final dimensions after cutting. The coordinate origin $(0, 0)$ is situated on the top-left corner of the Trim Box.
* **Bleed Box**: Expands canvas bounds by $2 \times \text{Bleed}$ ($\text{width} + 2 \cdot \text{bleed}$, $\text{height} + 2 \cdot \text{bleed}$). Full-bleed backgrounds automatically span outward to $(-3\text{mm}, -3\text{mm})$.
* **Crop Marks (`crop-marks: true;`)**: Renders corner trim indicators and registration segments drawn in CMYK-colored registration color, positioned in the margin gutter **outside** the bleed area.
