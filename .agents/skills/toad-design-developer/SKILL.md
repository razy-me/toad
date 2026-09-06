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
9. **Explicit Fonts & Synchronized `fonts/` Directory (Photopea Drag & Drop)**:
   - Always declare `@font` directives or define `font-family:` on the `canvas` block. Do not rely on unconfigured OS-specific fallback fonts.
   - **MANDATORY**: Keep the local project `fonts/` folder completely up to date at all times. Every custom font family and weight used in the design MUST have its corresponding `.ttf` or `.otf` font binary in `fonts/`.
   - **Photopea Readiness**: Keeping `fonts/` synchronized allows the user to immediately drag and drop font files into **Photopea** (or Photoshop) so all live text layers, weights, and glyphs render natively without missing font errors or fallback replacement.
10. **Badge & Pill Margins**: Always provide 15% to 20% horizontal safety padding around text in pills, badges, and buttons to prevent clipping across different OS font metric engines.
11. **Vibrant Glow Alphas**: For neon or glowing radial gradients, center stop alphas MUST be $\ge 0.25$ (e.g., `alpha(>brandGreen, 0.35) 0%`) to remain vivid across sRGB displays.
12. **Transforms & Rotation**: Rotations use `rotation: 180;` or `rotation: 180deg;`. In rotated containers, adjust margins to account for inverted coordinate axes.
13. **Optical Vertical Centering in Badges & Pills (Cap-Height Offset)**:
    - In compact containers ($20\text{–}34\,\text{px}$ pills/badges), text aligns from `textBaseline = 'top'` in Skia. Descenderless text will mathematically center its box, but render optically $2\text{–}3\,\text{px}$ too high.
    - **MANDATORY**: Apply a Cap-Height Offset of $+1.5\,\text{px}$ to $+2.5\,\text{px}$ ($+3\text{–}5\,\text{px}$ at `@2x`) to align glyph centers to the container midline.
    - **Adjacent Icons**: Match the glyph optical center to the icon geometric center ($|\text{Icon}_{\text{center}} - \text{Text}_{\text{center}}| \le 0.5\,\text{px}$).

---

## 🚫 Universal Negative Constraints & Anti-AI-Slop Guardrails (All Media: Print, Web, Logos, Posters, Cards)

These negative constraints apply universally across every `.toad` visual design task without exception:
- ❌ **NO CSS Flexbox**: Do not write `display: flex; justify-content: space-between;`. Use `stack { direction: horizontal; justify: space-between; }`.
- ❌ **NO HTML Elements**: Do not write `<div>`, `<span>`, `<p>`, or `<h1>`. Use `rect`, `group`, `stack`, and `text`.
- ❌ **NO CSS `rgba(...)`**: Do not write `rgba(255, 0, 0, 0.5)`. Use `alpha(#FF0000, 0.5)` or 8-digit hex `#FF000080`.
- ❌ **NO Ambiguous Coordinates in Stacks**: Do not place explicit `at:` coordinates on children inside auto-layout `stack` elements.
- ❌ **NO AI-Slop "Purple Haze"**: Do not place arbitrary, unfocused radial purple/cyan blur clouds behind headlines (`the_seed/rules/anti_ai_slop_donts.yaml#SLOP-WEB-001`).
- ❌ **NO Meaningless Bento Overkill**: Do not force plain prose or 2-item lists into uniform glassmorphism bento boxes (`SLOP-WEB-002`).
- ❌ **NO Ubiquitous Glassmorphism & Extreme Corner Radii**: Do not turn every card and navbar into a frosted translucent glass slab with childish 24–36px soap-bar radii (`SLOP-WEB-007`). Use solid, opaque surfaces with disciplined 6–12px radii.
- ❌ **NO Floating 3D Geometric Debris**: Do not float purposeless glass toruses, chrome donuts, or confetti crosses into empty space (`SLOP-WEB-004`, `SLOP-GFX-002`).
- ❌ **NO Corporate Memphis Noodle Arms**: Never illustrate flat figures with giant purple pants, jointless noodle arms, and tiny heads (`SLOP-GFX-001`).
- ❌ **NO Centered Multi-Line Body Prose**: Never center-align body text longer than 2 lines (`SLOP-TYPE-002`). Always left-align paragraphs.
- ❌ **NO Hollow Buzzword Headlines**: Never write "Supercharge your workflow with next-gen synergy" (`SLOP-WEB-003`). Use concrete, domain-specific metrics and tools.
- ❌ **NO Horror Vacui & Clutter Overload**: Do not compulsively pack every square pixel with decorative elements, badges, and micro-cards (`SLOP-WEB-008`). **Weniger ist oft mehr:** Reserve 40–60% of canvas as generous negative space. Delete superfluous noise.

---

## 🎨 Visual Design & Layout Guidelines

- **8pt Grid**: Use standard multiples (`8px`, `16px`, `24px`, `32px`, `48px`, `64px`) for margins, padding, and gaps.
- **Glassmorphism & Lighting**: Use layered drop shadows, subtle border strokes (`alpha(#FFFFFF, 0.12)`), and backdrop blurs (`blur: 16px;`).
- **Color Palettes**: Build cohesive themes using variables for primary, surface, background, and accent colors.
- **Images & Vector Assets**: Use `image { src: "path/to/image.png"; size: 400px 300px; fit: cover; }` and `path { d: "..."; fill: ...; }` for visual artwork.

---

## 🧬 Mandatory Multi-DNA Inspiration Protocol (Minimum ≥ 3 Personas + ≥ 3 Corporate Systems, No Upper Limit)

To eradicate generic, mediocre "Mid-AI" designs and guarantee world-class visual aesthetics, **EVERY `.toad` design output MUST begin with an explicit Inspiration Header** before any code:

> **No Upper Limit & Asymmetric Combinations**: 3 is the strict floor for each category, but you are strongly encouraged to select more whenever relevant (e.g., 6 Personas + 4 Corporate Systems for editorial depth, or 3 Personas + 8 Corporate Systems for a complex multi-brand enterprise UI).

```toad
// ============================================================================
// 🧬 TOAD MULTI-DNA INSPIRATION MATRIX (Min 3 Personas + Min 3 Corporate Systems)
// ----------------------------------------------------------------------------
// 🎭 CREATIVE PERSONAS (the_seed/09_CREATIVE_PERSONAS_AND_STYLES/) [Min: 3, more encouraged]:
//   1. [id / Name] -> Inherited trait (e.g. typography pairing, lighting, linework)
//   2. [id / Name] -> Inherited trait (e.g. geometric rhythm, asymmetry, textures)
//   3. [id / Name] -> Inherited trait (e.g. color accents, micro-details)
//   4. [optional 4+] -> ...
//   5. [optional 5+] -> ...
// 🏢 CORPORATE DESIGN SYSTEMS (the_seed/10_CORPORATE_DESIGN_SYSTEMS/) [Min: 3, more encouraged]:
//   1. [id / Brand] -> Inherited trait (e.g. color tokens, primary/secondary hierarchy)
//   2. [id / Brand] -> Inherited trait (e.g. corner radius system, pill shapes, cards)
//   3. [id / Brand] -> Inherited trait (e.g. spacing tokens, typography scale, tone)
//   4. [optional 4+] -> ...
//   5. [optional 5+] -> ...
// ============================================================================
```

---

## 🎭 Creative Personas & Artistic Styling Engine (`the_seed/09_CREATIVE_PERSONAS_AND_STYLES/`)

To prevent generic, mediocre "Mid-AI" designs (gray/blue default boxes with Inter), **ALWAYS** consult the creative personas knowledge base before generating `.toad` code:

1. **Mandatory Multi-Persona Selection**: Select **at least 3 Personas** (more if fitting) from:
   - [`index.yaml`](../../the_seed/09_CREATIVE_PERSONAS_AND_STYLES/index.yaml) (Tag lookup: `#neon`, `#gotik`, `#cloud-software`, `#kinder`, `#mittelalter`, `#minimalistisch`, etc.)
   - [`router.xml`](../../the_seed/09_CREATIVE_PERSONAS_AND_STYLES/router.xml) (Decision-tree & semantic route matching)
2. **Inherit Full Visual DNA**:
   - Extract `<palette>` hex tokens (canvas, primary, accent) into variables (`>var = #HEX;`).
   - Adopt `<typography>` families, weights, and tracking rules.
   - Enforce `<geometry>` primitives, layout proportions, and effects.
   - Strictly heed `<no_gos>` to eliminate typical design sins.
3. **Use Verified Code Blueprints**:
   - Every persona file provides a 100% syntactically valid, pre-tested `<code_blueprint lang="toad">` as structural reference.
4. **Cross-Pollinate & Synthesize**:
   - Synthesize the distinct strengths of all 3+ selected personas (e.g., Elena Rostova's typography + Henrik Van Dijk's FinTech Bento-grid + Kaito Tanaka's circle geometry).

---

## 🏢 Corporate Design Systems & Brand Kits (`the_seed/10_CORPORATE_DESIGN_SYSTEMS/`)

When generating commercial UI, B2B software, corporate dashboards, or client brand assets, **ALWAYS** reference the Corporate Design Systems database:

1. **Mandatory Multi-Brand Selection**: Select **at least 3 Corporate Design Systems** (more if fitting) from:
   - [`index.yaml`](../../the_seed/10_CORPORATE_DESIGN_SYSTEMS/index.yaml) (Search by industry tag: `#cloud-erp`, `#fintech`, `#healthtech`, `#mittelstand`, `#ecommerce`, `#logistik`, etc.)
   - [`router.xml`](../../the_seed/10_CORPORATE_DESIGN_SYSTEMS/router.xml) (Corporate taxonomy and industry decision tree)
2. **Exact Design Token Inheritance**:
   - Extract exact brand colors, neutral scales, border radii, shadows, and spacing scales.
   - Inherit corporate typography (display, body, mono, weights).
   - Follow tone of voice (e.g., informal "Du" for modern SaaS vs. formal "Sie" for enterprise/finance).
3. **Pre-Tested Production Blueprints**:
   - Every corporate kit contains a fully compilable, production-ready `.toad` template (e.g. `01_velora_cloud_erp.xml` for family-led KMU cloud ERP).

---

## 🔤 Mandatory `fonts/` Directory & Photopea Drag-and-Drop Workflow

To guarantee zero friction when exporting designs to `.psd` and editing them in **Photopea** or Photoshop:

1. **Keep `fonts/` Synchronized at All Times**:
   - Whenever creating, updating, or refactoring any project, the AI MUST ensure that the project contains an active `fonts/` directory.
   - Every custom font referenced in `@font` directives or `font-family` styles MUST have its physical `.ttf` or `.otf` file stored in `./fonts/`.
2. **Photopea In-Browser Font Loading**:
   - Photopea runs inside the browser sandbox and cannot access the user's local operating system fonts automatically.
   - By keeping the `fonts/` folder complete and up to date, the user can simply **drag and drop** the font files (or the entire `fonts/` folder) directly into the Photopea window.
   - Photopea immediately loads the font binaries into memory, allowing native Type Layers (`TySh`), custom font weights, kerning, tracking, and OpenType features to render with 100% fidelity.
3. **No Missing Font Dialogs**:
   - Never use custom font family names in `.toad` code without providing the corresponding font binary in `fonts/` and mapping it with `@font`.

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
* [50 Creative Personas & Style Routing Engine (the_seed/09)](../../the_seed/09_CREATIVE_PERSONAS_AND_STYLES/index.yaml)
* [50 Corporate Design Systems & Brand Kits (the_seed/10)](../../the_seed/10_CORPORATE_DESIGN_SYSTEMS/index.yaml)
* [Anti-AI-Slop Exhaustive Heuristics Guide (the_seed/rules)](../../the_seed/rules/anti_ai_slop_heuristics.xml)
* [Anti-AI-Slop Quick-Lookup Don'ts Matrix (the_seed/rules)](../../the_seed/rules/anti_ai_slop_donts.yaml)
