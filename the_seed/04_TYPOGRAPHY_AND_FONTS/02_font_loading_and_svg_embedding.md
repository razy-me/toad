# 02 — Font Loading & Standalone SVG Embedding

This manual covers custom font registration via `@font`, document-level font inheritance on `canvas`, and the automatic Base64 `@font-face` embedding system that guarantees 100% vector typography fidelity across browsers and platforms.

---

## 1. Registering Local Fonts (`@font`)

The `@font` directive registers local `.ttf` or `.otf` font binaries directly with the Skia raster engine, SVG exporter, and Photoshop metadata serializer:

```toad
// Labeled forms
@font "./fonts/Inter-Regular.ttf" as "Inter" weight: 400 style: normal;
@font "./fonts/Inter-Bold.ttf" as "Inter" weight: 700 style: normal;

// Bare keyword & numeric shorthand
@font "./fonts/AgencyFB-Regular.ttf" as "Agency FB" normal;
@font "./fonts/AgencyFB-Bold.ttf" as "Agency FB" bold;
@font "./fonts/FiraCode-Retina.ttf" as "Fira Code" 450;
```

---

## 2. Document-Level Canvas Font Inheritance

Rather than repeating `font-family: "MyFont";` on every single text element, declare it once on the `canvas` block:

```toad
canvas "Keynote" {
    size: 1920px 1080px;
    font-family: "Agency FB", sans-serif; // Inherited by all children
}

text #h1 { content: "Main Headline"; font-size: 48px; } // Uses Agency FB
text #h2 { content: "Subhead"; font-size: 24px; }       // Uses Agency FB
text #code { content: "npm run dev"; font-family: "Fira Code"; } // Explicit override
```

### Inheritance Resolution Priority:
1. Explicit `font-family:` declared on the individual `text` element.
2. `font-family:` declared on the root `canvas` block.
3. Family name of the first registered `@font` directive in the document.
4. Default engine fallback (`sans-serif`).

---

## 3. Standalone SVG Base64 `@font-face` Embedding

One of the most powerful features of the TOAD compiler:
* When an SVG is opened on an external device (e.g. mobile phone or Linux server) without the design's font installed, standard SVG engines fall back to system fonts (like Arial), causing badge overflow and text collisions.
* **TOAD's Solution**: When `@font` directives are defined, the SVG exporter automatically reads the local `.ttf`/`.otf` binary, encodes it into a Base64 data URL, and writes a standalone `@font-face` block into the SVG:

```xml
<defs>
  <style>
    @font-face {
      font-family: "Agency FB";
      font-style: normal;
      src: url("data:font/ttf;base64,AAEAAAASAQAABAAwR0RFRgA...");
    }
  </style>
</defs>
```

**Result**: The exported `.svg` file is 100% self-contained, portable, and renders with identical typography in Google Chrome, Safari, Figma, Adobe Illustrator, Inkscape, or headless test runners.

---

## 4. The "DirectWrite vs Arial" Pitfall Explained

### What Happens When Fonts Are Not Declared:
1. **In Skia (PNG/JPG on Windows)**: `@napi-rs/canvas` queries DirectWrite for the unspecified generic query. On many systems, DirectWrite returns the first indexed family (often a condensed font like `Agency FB`).
2. **In Browser (SVG)**: Web browsers resolve generic `sans-serif` to `Arial` or `Helvetica`.
3. **The Clash**: `Arial` is $\approx 70\%$ wider than `Agency FB`. Text sized to fit a 240px badge in Canvas immediately explodes past the badge borders when opened as an SVG in Chrome.

### The Rule for Developers & AI:
> **Always register fonts via `@font` or set `font-family` on `canvas`. Never leave font-family unassigned.**
