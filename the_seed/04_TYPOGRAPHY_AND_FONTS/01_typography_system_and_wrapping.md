# 01 — Typography System & Word-Wrapping

This manual specifies the text layout model, word-wrapping algorithms, tracking calculations, and typographic formatting options in the TOAD compiler.

---

## 1. The Fundamental Distinction: `font-size` vs. `size`

The most critical typographic concept in TOAD:

> [!IMPORTANT]
> * **`font-size: 24px;`**: Controls the typographic **glyph scale** (font metrics, ascent, descent).
> * **`size: 400px;`**: Defines the container bounding box width for **multi-line word-wrapping**.
>
> Without `size:`, text elements measure intrinsically and flow across a single continuous line.

```toad
// 1. Single-line title (no wrapping)
text #title {
    at: (40px, 40px);
    content: "Overview Dashboard";
    font-size: 32px;
    font-weight: 700;
    color: #ffffff;
}

// 2. Multi-line body paragraph (wraps at 500px, auto-calculates height)
text #body {
    at: below #title offset 12px;
    content: "The declarative compiler converts structured AST nodes into production raster images, standalone SVGs, and fully layered Photoshop PSD files.";
    font-size: 15px;
    line-height: 1.6;
    color: #9EB0A3;
    size: 500px hug; // ⚠️ Wraps text at 500px width; height hugs wrapped lines
}
```

---

## 2. Complete Typographic Property Reference

| Property | Values | Description |
|---|---|---|
| `content:` / `text:` | String (`"Hello"`) | Raw text string. Multi-line breaks supported via `\n`. |
| `font-family:` / `font:` | String (`"Inter"`) | PostScript or family name. |
| `font-size:` / `fontSize:` | Dimension (`16px`, `24px`) | Typographic glyph size. |
| `font-weight:` / `weight:` | Number (`400`-`900`) or Keyword | Weight alias (`normal`, `semibold`, `bold`, etc.). |
| `font-style:` / `style:` | `normal`, `italic`, `oblique` | Font slant variant. |
| `line-height:` / `lineHeight:` | Multiplier (`1.5`) or Dimension (`24px`) | Vertical distance between baselines. |
| `letter-spacing:` / `tracking:` | Dimension (`-0.5px`, `1.2px`) | Tracking distance between glyphs. |
| `align:` / `text-align:` | `left`, `center`, `right`, `justify` | Paragraph horizontal alignment. |
| `verticalAlign:` | `top`, `middle`, `bottom` | Vertical positioning inside fixed-height boxes. |
| `text-transform:` | `uppercase`, `lowercase`, `capitalize`, `none` | Casing transformation. |
| `maxLines:` | Integer (`2`, `3`) | Clamps maximum displayed lines. |
| `overflow:` | `ellipsis`, `clip` | Truncates text with an ellipsis (`...`). |

---

## 3. Letter-Spacing & Wrap Math (`math.ts`)

In the layout engine (`src/parser/math.ts`), tracking directly influences line-wrapping boundaries:
$$\text{width}(S) = \text{measure}(S) + (|S| - 1) \times \text{letterSpacing}$$

* **Negative tracking** (e.g. `-0.5px`) shrinks the measured width of words, allowing more text to fit per line before wrapping.
* **Positive tracking** (e.g. `1.2px` on uppercase badges) expands word width.

---

## 4. Descriptive Weight Aliases

TOAD automatically maps single-word descriptive aliases to numerical OpenType weights:

| Keyword Alias | Numeric OpenType Weight |
|---|---|
| `thin` | 100 |
| `extralight`, `ultralight` | 200 |
| `light` | 300 |
| `regular`, `normal` | 400 |
| `medium` | 500 |
| `semibold`, `demibold` | 600 |
| `bold` | 700 |
| `extrabold`, `ultrabold` | 800 |
| `black`, `heavy` | 900 |

* **Rule**: Multi-word string aliases like `semi bold` are invalid. Use `semibold` or `600`.
