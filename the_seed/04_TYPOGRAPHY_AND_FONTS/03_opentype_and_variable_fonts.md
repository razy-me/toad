# 03 — OpenType Features & Variable Fonts

TOAD provides first-class support for advanced OpenType typographic features and multi-axis Variable Fonts across Skia Canvas and SVG vector pipelines.

---

## 1. OpenType Feature Settings (`font-features`)

OpenType feature flags unlock specialized glyph alternates within professional typefaces.

```toad
text #financialTable {
    content: "0123456789 — $1,420,950.00";
    font-size: 20px;
    font-features: "tnum" 1, "zero" 1, "frac" 1;
}
```

### Essential OpenType Feature Reference:

| Feature Tag | Name | Description & Use Case |
|---|---|---|
| `"tnum" 1` | Tabular Figures | Monospaced digits with identical bounding widths. Essential for data tables, metrics, and pricing. |
| `"onum" 1` | Oldstyle Figures | Numerals with varying ascenders and descenders (harmonious in long-form editorial body text). |
| `"smcp" 1` | Small Capitals | Converts lowercase glyphs into true typographic small caps. |
| `"zero" 1` | Slashed Zero | Replaces `0` with a slashed zero to eliminate ambiguity with letter `O`. |
| `"frac" 1` | Diagonal Fractions | Automatically synthesizes diagonal fractions (e.g. $1/2 \to ½$). |
| `"liga" 1` | Standard Ligatures | Connects problematic character pairs (e.g. `fi`, `fl`, `ffi`). |
| `"dlig" 1` | Discretionary Ligatures | Decorative display ligatures (e.g. `ct`, `st`). |
| `"ss01" 1` | Stylistic Sets | Custom alternate glyph designs defined by the typeface designer. |

---

## 2. Variable Fonts (`font-variation`)

Variable fonts consolidate entire type families into a single font binary with continuously interpolatable design axes:

```toad
text #dynamicHero {
    content: "PRECISION UI";
    font-family: "RobotoFlex";
    font-size: 56px;
    font-variation: "wght" 750 "wdth" 85 "opsz" 48;
}
```

### Standard Registered Axes:
* `"wght"`: Weight axis ($100 \dots 900$).
* `"wdth"`: Width / condensation axis ($75\% \dots 125\%$).
* `"slnt"`: Slant angle ($-10\text{deg} \dots 0\text{deg}$).
* `"ital"`: Italic transition ($0.0 \dots 1.0$).
* `"opsz"`: Optical size adjustment ($8 \dots 72$).

---

## 3. Cross-Engine Pipeline Mapping

* **In Skia**: Configures native Skia font variation settings via `ctx.fontVariationSettings` and `ctx.fontFeatureSettings`.
* **In SVG**: Serializes into standard inline CSS attributes:
  ```xml
  <text style="font-feature-settings: &quot;tnum&quot; 1, &quot;zero&quot; 1; font-variation-settings: &quot;wght&quot; 750;">
  ```
* **In Photoshop PSD**: Stores font variation coordinates in the Type Tool ALI descriptor (`TySh`).
