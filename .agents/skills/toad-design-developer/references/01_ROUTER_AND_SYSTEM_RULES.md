# 01 — TOAD AI Documentation Router & Core System Rules

> **AI Agent & Developer Guide:** In environments with knowledge upload limits (such as **Gemini Gems** with a maximum of 10 knowledge files), this 10-module suite provides 100% comprehensive documentation for the declarative design DSL `toad`.

---

## 📂 The 10 Knowledge Modules Overview

| File | Topic / Domain | Contents & Highlights |
|---|---|---|
| ⭐ **[`01_ROUTER_AND_SYSTEM_RULES.md`](./01_ROUTER_AND_SYSTEM_RULES.md)** | **Master Router & System Rules** | Central routing table, AI system instructions, pre-flight syntax checklist, and canonical starter template (~400 tokens). |
| 📐 **[`02_GRAMMAR_AST_AND_PROPERTIES.md`](./02_GRAMMAR_AST_AND_PROPERTIES.md)** | **Grammar, AST & Properties** | Formal EBNF grammar, lexer tokens, TypeScript AST node interfaces, and 21-property default matrix. |
| 🧮 **[`03_LAYOUT_POSITIONING_AND_MATH.md`](./03_LAYOUT_POSITIONING_AND_MATH.md)** | **Layout, Positioning & Math** | Bounding boxes, ASCII spatial diagrams, relational anchors (`at:`), DAG topological sort, auto-layout stacks (`hug`/`fill`), grid, and step-by-step execution trace. |
| 🎨 **[`04_GRAPHICS_SHAPES_AND_EFFECTS.md`](./04_GRAPHICS_SHAPES_AND_EFFECTS.md)** | **Graphics, Shapes & Effects** | Color models (Hex, RGBA, HSLA, CMYK), gradients (linear, radial, conic), Lucide icons, shapes (`polygon`, `star`, `arrow`, `path`), 2D transforms, glassmorphism & masks. |
| 🔤 **[`05_TYPOGRAPHY_FONTS_AND_TEXT.md`](./05_TYPOGRAPHY_FONTS_AND_TEXT.md)** | **Typography, Fonts & Text** | Skia text measurement, `@font` directive, word-wrap (`size:` vs `font-size:`), OpenType features (`liga`, `smcp`, `tnum`), variable fonts & Photoshop type layers. |
| 🧩 **[`06_COMPONENTS_SLOTS_AND_IMPORTS.md`](./06_COMPONENTS_SLOTS_AND_IMPORTS.md)** | **Components, Slots & Imports** | Parameterized components, default parameters, content projection via `slot;`, `@import` hierarchies, and scope isolation. |
| 🎛️ **[`07_EXPORTERS_PSD_AND_PRINT.md`](./07_EXPORTERS_PSD_AND_PRINT.md)** | **Exporters, PSD & Prepress** | Multi-scale raster/SVG, native Photoshop ALI keys (`vmsk`, `keyOriginRRectRadii`, `GdFl`, `lrFX`, `TySh`) + print prepress (CMYK, bleed box geometry, safe zone, crop marks & registration crosshairs). |
| ⚙️ **[`08_CLI_LSP_AND_TOOLING.md`](./08_CLI_LSP_AND_TOOLING.md)** | **CLI, LSP & Tooling** | `toad init`, `toad build`, `toad lint`, `toad fmt`, watch mode with SSE hot-reload, VS Code extension & LSP server protocol. |
| 📚 **[`09_COOKBOOK_AND_TEMPLATES.md`](./09_COOKBOOK_AND_TEMPLATES.md)** | **Cookbook & Master Templates** | 100% test-verified templates: OpenGraph banners, front/back CMYK business cards, UI modals with slots, vector artwork. |
| 🔬 **[`10_INTERNALS_DEBUGGING_AND_PITFALLS.md`](./10_INTERNALS_DEBUGGING_AND_PITFALLS.md)** | **Internals, Pitfalls & Debugging** | 7-stage compiler pipeline deep-dive + top 15 anti-patterns with before/after corrections + troubleshooting playbook. |

---

## ✈️ AI Pre-Flight Syntax Checklist (Verify Before Generating)

Always verify these 7 core rules before outputting `.toad` code:
1. **Variables:** Declare and reference with `>`: `>primary = #3b82f6;` referenced as `color: >primary;` (never use `:` for variable assignment).
2. **Semicolons:** Every variable, property statement, directive, and `slot;` MUST terminate with `;`.
3. **Text Sizing:** `font-size: 24px;` sets glyph typography size. `size: 400px;` on `text` sets **ONLY** the maximum wrapping width (*Word-Wrap*).
4. **Font Weights:** Numeric `font-weight: 700;`, single-word keywords (`bold`, `normal`, `semibold`, `black`, …), or the `weight:` alias (`weight: bold;` is valid). Multi-word strings with a space (`semi bold`) are invalid.
5. **Center Position:** `at: center of canvas;` or `at: center of #id;`; the bare sugar `at: center;` is also valid (centers within the current parent/container).
6. **Relational Anchors:** Valid keywords are `right of`, `left of`, `above`, `below`, `inside`, `center of`, corner anchors (`top-left of`, `top-right of`, `bottom-left of`, `bottom-right of`), and `previous` (the immediately preceding sibling), each with optional `offset <dim>;`.
7. **Fill vs. Color:** Shapes (`rect`, `circle`, `star`, etc.) use `fill:`, text elements use `color:`.

---

## 📚 Canonical Master Template

```toad
>bg = #0f172a;
>primary = #38bdf8;

canvas "Hero" {
    preset: og-image; // 1200x630
    background: >bg;
    export: all;
}

stack #content {
    direction: vertical;
    gap: 16px;
    size: 800px hug;
    at: center of canvas;

    icon {
        iconName: "settings";
        size: 32px;
        fill: >primary;
    }

    text #title {
        content: "TOAD V2 Engine";
        font-size: 48px;
        font-weight: 800;
        color: #ffffff;
        size: 750px; // Wrap-Width
    }
}
```
