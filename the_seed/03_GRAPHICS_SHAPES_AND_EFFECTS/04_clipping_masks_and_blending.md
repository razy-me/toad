# 04 — Clipping Masks & Blend Modes

This manual details clipping architectures, sibling masking mechanisms, and layer blend mode compositing in the TOAD compiler.

---

## 1. The Sibling Clipping Mask Model

TOAD implements a dedicated sibling clip model (analogous to Adobe Illustrator and Photoshop clipping masks):
* An element marked with `clip: true;` acts as a stencil/mask for the **immediately following sibling element**.

```toad
// Mask stencil shape
circle #userAvatarMask {
    at: (40px, 40px);
    size: 96px;
    clip: true; // Marks this circle as a clipping mask
}

// Target image clipped to the circle
image #userPhoto {
    at: (40px, 40px);
    size: 96px 96px;
    src: "./assets/portrait.jpg";
}
```

### SVG & Skia Pipeline Mapping:
* **In SVG**: Generates a `<clipPath id="clip_N">` containing the geometry of the mask, and attaches `clip-path="url(#clip_N)"` to the masked sibling.
* **In Skia**: Executes `ctx.save()`, builds the vector path, calls `ctx.clip()`, renders the sibling, and calls `ctx.restore()`.
* **In PSD**: Attaches a native vector mask (`vmsk`) to the target layer.

---

## 2. Container Inset Masks (`overflow: hidden;`)

Groups and Stacks can automatically clip overflowing children:

```toad
group #clippedCard {
    size: 400px 300px;
    radius: 20px;
    overflow: hidden; // Automatically clips any internal child artwork

    image #heroBackground {
        size: 500px 400px;
        at: (-20px, -20px);
        src: "./landscape.jpg";
    }
}
```

---

## 3. Blend Modes (`blend-mode`)

The `blend-mode:` property dictates how pixel luminance and chroma composite with elements underneath.

```toad
rect #multiplyOverlay {
    size: 600px 800px;
    fill: #ff3366;
    blend-mode: multiply;
    opacity: 0.85;
}
```

### Supported Blend Modes:

| Blend Mode | Mathematical Behavior | Typical UI / Graphics Use Case |
|---|---|---|
| `multiply` | $C = A \times B$ | Darkening overlays, risograph posters, duotone graphics. |
| `screen` | $C = 1 - (1 - A)(1 - B)$ | Light rays, lens flares, glowing particles on dark backgrounds. |
| `overlay` | Combines Multiply & Screen | High-contrast cinematic image grading. |
| `darken` | $C = \min(A, B)$ | Preserves only the darker pixels between layers. |
| `lighten` | $C = \max(A, B)$ | Preserves only the brighter pixels between layers. |
| `color-dodge` | $C = B / (1 - A)$ | High-intensity neon accents and metallic glows. |
| `color-burn` | $C = 1 - (1 - B) / A$ | Rich, saturated shadow deepening. |
| `difference` | $C = |A - B|$ | Inverted geometric artboards, psychedelic posters. |
| `exclusion` | Softer difference | Subtle modernist editorial contrast. |

---

## 4. Photoshop PSD Blend Mode Mapping

During PSD export, blend modes map directly to Photoshop's internal 4-character ALI codes:
* `multiply` $\to$ `'mul '`
* `screen` $\to$ `'scrn'`
* `overlay` $\to$ `'over'`
* `darken` $\to$ `'dark'`
* `lighten` $\to$ `'lite'`
* `color-dodge` $\to$ `'div '`
* `color-burn` $\to$ `'idiv'`
* `difference` $\to$ `'diff'`
* `exclusion` $\to$ `'smud'`
