---
name: toad-design-developer
description: >-
  Use this skill whenever creating, designing, formatting, or troubleshooting TOAD DSL code (.toad), UI layouts, graphics, image manipulations, cards, banners, components, and visual designs.
---

# TOAD Design Developer — Visual Design & DSL Skill

> **Primary Focus**: Writing `.toad` code, designing UI layouts, social media graphics, posters, marketing cards, components, and handling image/vector visual assets using the **TOAD DSL**.

This skill provides expert guidance for producing visually stunning, syntactically flawless TOAD designs.

---

## ⚡ The 12 Non-Negotiable Syntax Rules

1. **Variables**: MUST use `>var = value;`. NEVER use CSS colon notation (`var: value;`). Reference using `>var`.
2. **Statement Termination**: Every property statement, directive, variable assignment, and slot MUST terminate with a semicolon (`;`).
3. **Typography vs Word Wrap**:
   - `font-size: 24px;` controls glyph size.
   - `size: 400px;` (or `width: 400px;`) controls the multiline word-wrap bounding box.
   - Text without an explicit wrapping width renders on a single unbounded line.
4. **Font Weights**: MUST be integer numbers (`400`, `500`, `600`, `700`, `800`, `900`) or valid single-word tokens (`normal`, `medium`, `semibold`, `bold`, `extrabold`). NEVER multi-word strings like `"semi bold"`.
5. **Relational Anchoring**:
   - MUST use explicit targets: `at: below #target offset 16px;` or `at: center of canvas;`.
   - NEVER put a colon after `offset` (`offset 16px;`, NOT `offset: 16px;`).
   - NEVER use naked `at: center;` without context.
6. **Shapes vs Text Styling**:
   - Shapes (`rect`, `circle`, `path`, `polygon`, `star`) take `fill:`.
   - Text elements (`text`) take `color:` (or `fill:`).
7. **Slot Statements**: Content projection slots MUST terminate with a semicolon: `slot;`.
8. **Font Stacks in Variables**: Font fallback chains MUST be a single string literal: `>font = "Inter, -apple-system, sans-serif";`. NEVER unquoted comma lists (`>font = "Inter", sans-serif;` is a syntax error).
9. **Explicit Fonts on Canvas**: Always declare `@font` directives or define `font-family:` on the `canvas` block. Do not rely on unconfigured OS-specific fallback fonts.
10. **Badge & Pill Margins**: Always provide 15% to 20% horizontal safety padding around text in pills, badges, and buttons to prevent clipping across different OS font metric engines.
11. **Vibrant Glow Alphas**: For neon or glowing radial gradients, center stop alphas MUST be $\ge 0.25$ (e.g., `alpha(>brandGreen, 0.35) 0%`) to remain vivid across sRGB displays.
12. **Transforms & Rotation**: Rotations use `rotation: 180;` or `rotation: 180deg;`. In rotated containers, adjust margins to account for inverted coordinate axes.

---

## 🚫 Negative Constraints & Hallucination Guardrails

- ❌ **NO CSS Flexbox**: Do not write `display: flex; justify-content: space-between;`. Use `stack { direction: horizontal; justify: space-between; }`.
- ❌ **NO HTML Elements**: Do not write `<div>`, `<span>`, `<p>`, or `<h1>`. Use `rect`, `group`, `stack`, and `text`.
- ❌ **NO CSS `rgba(...)`**: Do not write `rgba(255, 0, 0, 0.5)`. Use `alpha(#FF0000, 0.5)` or 8-digit hex `#FF000080`.
- ❌ **NO Ambiguous Coordinates in Stacks**: Do not place explicit `at:` coordinates on children inside auto-layout `stack` elements.

---

## 🎨 Visual Design & Layout Guidelines

- **8pt Grid**: Use standard multiples (`8px`, `16px`, `24px`, `32px`, `48px`, `64px`) for margins, padding, and gaps.
- **Glassmorphism & Lighting**: Use layered drop shadows, subtle border strokes (`alpha(#FFFFFF, 0.12)`), and backdrop blurs (`blur: 16px;`).
- **Color Palettes**: Build cohesive themes using variables for primary, surface, background, and accent colors.
- **Images & Vector Assets**: Use `image { src: "path/to/image.png"; size: 400px 300px; fit: cover; }` and `path { d: "..."; fill: ...; }` for visual artwork.

---

## 📚 Design References & Templates

* [Master Router & System Rules](./references/01_ROUTER_AND_SYSTEM_RULES.md)
* [Grammar, AST & Properties](./references/02_GRAMMAR_AST_AND_PROPERTIES.md)
* [Layout, Positioning & Math](./references/03_LAYOUT_POSITIONING_AND_MATH.md)
* [Graphics, Shapes & Effects](./references/04_GRAPHICS_SHAPES_AND_EFFECTS.md)
* [Typography, Fonts & Text](./references/05_TYPOGRAPHY_FONTS_AND_TEXT.md)
* [Components, Slots & Imports](./references/06_COMPONENTS_SLOTS_AND_IMPORTS.md)
* [Cookbook & Templates](./references/09_COOKBOOK_AND_TEMPLATES.md)
* [Design System Best Practices](./references/design_system_best_practices.md)
* [Advanced Layout Recipes](./references/advanced_layout_recipes.md)
* [Master UI Kit Library](./references/master_ui_kit_library.md)
* [Master Color & Lighting](./references/master_color_and_lighting.md)
* [Master Complex Layouts](./references/master_complex_layouts.md)
* [Master Full Templates](./references/master_full_templates.md)
