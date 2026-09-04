# TOAD Design System & Best Practices

To write professional, visually stunning designs autonomously, strictly adhere to these Design System rules when generating `.toad` code.

## 1. The 8-Point Spacing Grid
Always use a rigid 8px grid (or 4px for tight spaces) for sizing, padding, and gaps. Never use arbitrary numbers like `13px` or `27px`.
- **Micro**: `4px`, `8px`
- **Small**: `12px`, `16px`, `24px`
- **Medium**: `32px`, `48px`
- **Large**: `64px`, `96px`, `128px`

**Example:**
```toad
stack #card {
    direction: vertical;
    gap: 16px;          // Aligned to 8pt grid
    padding: 24px;      // Aligned to 8pt grid
    radius: 12px;
}
```

## 2. Typography Scale & Hierarchy
Use a clear, contrasting typographic scale. Remember that `font-size:` sets the glyph size, while `size:` on a text node sets the word-wrap boundary.

- **Display/Hero**: `font-size: 64px; font-weight: 800; tracking: -0.02em;`
- **H1**: `font-size: 48px; font-weight: 700; tracking: -0.01em;`
- **H2**: `font-size: 32px; font-weight: 600;`
- **Body Large**: `font-size: 20px; font-weight: 400; line-height: 1.5;`
- **Body**: `font-size: 16px; font-weight: 400; line-height: 1.5;`
- **Caption**: `font-size: 14px; font-weight: 500; color: >text-muted;`

## 3. Color Tokens & Semantic Variables
Never hardcode hex values inside elements. Always define a semantic token palette at the top of the file or in an `@import` theme.

```toad
// Semantic Color Palette
>bg-base = #0f172a;
>bg-surface = #1e293b;
>text-main = #f8fafc;
>text-muted = #94a3b8;
>primary = #3b82f6;
>accent = #8b5cf6;
>border = alpha(>text-muted, 0.2); // Derived colors

canvas {
    background: >bg-base;
}
```

## 4. Visual Contrast & Hierarchy
- **Contrast:** Ensure text has at least 4.5:1 contrast against backgrounds. Use `alpha(>white, 0.7)` for secondary text.
- **Depth:** Use drop shadows to create elevation on floating elements.
  `filter: drop-shadow(0px 12px 24px alpha(#000, 0.25));`
