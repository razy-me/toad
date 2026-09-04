# 05 — Typography, Fonts & OpenType System

This module covers font loading, Skia headless text metrics, OpenType features, variable fonts, and Photoshop Type Layer mapping.

---

## 1. Registering Local Fonts (`@font`)

```toad
// Labeled forms
@font "./fonts/Inter-Regular.ttf" as "Inter" weight: 400 style: normal;
@font "./fonts/Inter-Bold.ttf" as "Inter" weight: 700 style: normal;

// Bare-keyword / numeric forms
@font "./fonts/Inter-Bold.ttf" as "Inter" bold;
@font "./fonts/Inter-Black.ttf" as "Inter" 900;
@font "./fonts/PlayfairDisplay-Italic.ttf" as "Playfair" italic;
@font "./fonts/Inter-Oblique.ttf" as "Inter" oblique;

// Named source with explicit path
@font "Inter" as "UI" from "./fonts/Inter-Medium.ttf" weight: 500;
```

---

## 2. Text Declaration & Word-Wrapping

```toad
text #headline {
    content: "Future of Declarative UI";
    font-family: "Inter";
    font-size: 48px;          // ⚠️ Sets glyph font size
    font-weight: 800;         // Number (100-900) or 'bold', 'normal'
    color: #ffffff;
    letter-spacing: -0.5px;   // Tracking
    line-height: 1.2;         // Line height multiplier
    text-transform: none;     // 'uppercase', 'lowercase', 'capitalize', 'none'
    align: center;            // 'left', 'center', 'right', 'justify'
    size: 600px;              // ⚠️ size: sets MAXIMUM wrap width (Word-Wrap)
    at: (50px, 100px);
}
```

> [!IMPORTANT]
> **Critical Distinction:**
> * `font-size: 48px;` defines typographic glyph height and size.
> * `size: 600px;` sets the container bounding box width for automatic multi-line **word-wrapping**. Without `size:`, text flows on a single continuous line.
> * `size: 600px auto;` measures the **wrapped height** automatically. Negative `letter-spacing` shrinks the measured width (wrap-aware), and wrapped text uses real ascent/descent font metrics.

### Descriptive Weight Keywords

Single-word keywords map to numeric weights: `thin`→100, `extralight`/`ultralight`→200, `light`→300, `regular`→400, `medium`→500, `semibold`/`demibold`→600, `bold`→700, `extrabold`/`ultrabold`→800, `black`/`heavy`→900. Multi-word forms with a space (`semi bold`) are invalid.

---

## 3. OpenType Font Features (`font-features`)

```toad
text #priceTag {
    content: "0123456789 — fi fl";
    font-size: 24px;
    font-features: "tnum" 1, "zero" 1, "liga" 1;
}
```

### Essential OpenType Feature Tags:
| Tag | Feature Name | Description |
|---|---|---|
| `"liga" 1` | Standard Ligatures | Connects glyph pairs such as `fi`, `fl`, `ffi` |
| `"smcp" 1` | Small Capitals | True typographic small caps |
| `"tnum" 1` | Tabular Figures | Monospaced digits with identical widths (tables, prices) |
| `"onum" 1` | Oldstyle Figures | Numerals with varying ascenders and descenders |
| `"zero" 1` | Slashed Zero | Slashed zero to distinguish from letter `O` |
| `"frac" 1` | Fractions | True typographic diagonal fractions (e.g. $1/2 \to ½$) |

---

## 4. Variable Fonts (`font-variation`)

```toad
text #dynamicHero {
    content: "Ultra Adaptive";
    font-family: "RobotoFlex";
    font-size: 64px;
    font-variation: "wght" 750 "wdth" 85 "opsz" 36;
}
```

---

## 5. Photoshop PSD Type Layer Mapping

During PSD export, `toad` generates native Photoshop Type Layers (`TySh` object) instead of rasterized pixels:
* **PostScript Font Names:** Weight and style resolve to PostScript names such as `ArialMT`, `Arial-BoldMT`, `Arial-ItalicMT`, and `Arial-BoldItalicMT`.
* **Live Text:** Text remains fully editable with the Type Tool in Photoshop.
* **Tracking Preservation:** `letter-spacing` is written in thousandths of an em (1/1000) inside the text style.
* **Faux Styles:** `fauxBold` / `fauxItalic` derive from the resolved weight/style; leading scales with layer scale, and the flattened composite honors weight and style.
* **Paragraph Justification:** `align` (including `justify`) is preserved.

---

## 6. Document-Level Defaults & SVG Font Embedding

### Canvas-Level `font-family`
Instead of repeating `font-family:` on every text element, declare it once on the `canvas` block. All child text elements automatically inherit it:

```toad
canvas "Banner" {
    size: 1200px 630px;
    font-family: "Inter", sans-serif;
}

text #headline {
    content: "Inherits Inter automatically";
    font-size: 32px;
}
```

### Standalone SVG Font Embedding (`@font-face`)
When local fonts are registered via `@font`:
```toad
@font "./fonts/MyFont.ttf" as "MyFont" normal;
```
The TOAD SVG exporter automatically embeds the `.ttf` / `.otf` binary into the SVG `<defs><style>` section as a Base64 `@font-face` data URL. The exported SVG is completely standalone and renders with pixel-perfect typography in any web browser, Figma, Illustrator, or mobile device without requiring the font to be pre-installed on the client machine.

### Font Stack Syntax
Font fallback stacks must always be enclosed in a single string literal:
* ✅ `font-family: "Agency FB, 'Segoe UI', sans-serif";`
* ✅ `>mainFont = "Inter, sans-serif";`
* ❌ `>mainFont = "Inter", sans-serif;` *(Syntax error: unquoted commas in variable declarations)*

