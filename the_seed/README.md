# 🌿 THE SEED — The Ultimate TOAD DSL Knowledge Base & Engineering Manual

Welcome to **THE SEED**, the definitive, exhaustive engineering manual, architectural specification, and production cookbook for the **TOAD DSL** (Declarative Visual Design Language & Compiler).

This directory is designed as a fully self-contained, standalone knowledge base. Whether you are a human graphics engineer, a compiler maintainer, or an autonomous LLM coding assistant, this manual contains everything needed to write flawless, production-ready `.toad` designs and understand every internal stage of the compilation pipeline.

---

> [!IMPORTANT]
> ### 🤖 LLM System Prompt Snippet (Copy-Paste for AI Models)
> When initializing an AI coding assistant (Gemini, Claude, GPT-4, Cursor) to generate TOAD code, include this system prompt:
> ```text
> You are an expert TOAD DSL code generator. You MUST strictly follow these rules:
> 1. Variables: Declare with `>name = value;`. NEVER use `:` for assignment.
> 2. Termination: Every statement, property, and `slot;` MUST end with a semicolon `;`.
> 3. Typography: `font-size: 24px;` sets glyph size; `size: 400px;` sets word-wrap width.
> 4. Font Stacks: MUST be a single string literal: `>font = "Inter, sans-serif";`.
> 5. Anchoring: `at: below #target offset 16px;` (space after offset, NEVER a colon).
> 6. Fill vs Color: Shapes use `fill:`, text elements use `color:`.
> 7. Badges: Always allocate 15-20% horizontal safety padding around badge text.
> 8. Neon Glows: Center stop opacity MUST be >= 0.25 (e.g. `alpha(>cyan, 0.35)`).
> 9. Negative Constraints: NEVER output CSS flexbox (`display: flex`), HTML tags (`<div>`), or CSS `rgba()`.
> ```

---

## 🗺️ Master Navigation & AI Routing Map

If an AI model or developer needs to solve a specific problem, route directly to the target manual:

| AI Task / Intent | Target Manual | What It Explains |
|:---|:---|:---|
| **Declare variables, math, canvas** | [01_CORE_SYNTAX_AND_LANGUAGE](./01_CORE_SYNTAX_AND_LANGUAGE/) | Token grammar, `calc()`, variable scoping, canvas dimensions |
| **Position elements, create stacks/grids** | [02_LAYOUT_AND_POSITIONING](./02_LAYOUT_AND_POSITIONING/) | `at:` relational anchors, DAG topology, flex stacks, bento grids |
| **Draw shapes, gradients, glows, masks** | [03_GRAPHICS_SHAPES_AND_EFFECTS](./03_GRAPHICS_SHAPES_AND_EFFECTS/) | Vector paths, sRGB gradients, drop shadows, blend modes |
| **Format multiline text & custom fonts** | [04_TYPOGRAPHY_AND_FONTS](./04_TYPOGRAPHY_AND_FONTS/) | Word-wrapping, OpenType features, Base64 font embedding |
| **Build reusable components & design systems** | [05_COMPONENTS_AND_MODULARITY](./05_COMPONENTS_AND_MODULARITY/) | `component`, `slot;`, `@import`, token sharing |
| **Debug raster, SVG, PSD, or Print output** | [06_EXPORTERS_AND_RENDERING](./06_EXPORTERS_AND_RENDERING/) | Skia Canvas, SVG sRGB fix, Photoshop TySh/vmsk, 300 DPI prepress |
| **Avoid LLM bugs, fix compiler errors** | [07_LLM_RULES_AND_PITFALLS](./07_LLM_RULES_AND_PITFALLS/) | Top 20 anti-patterns, troubleshooting trees, 8pt grid rules |
| **Start from tested, production templates** | [08_PRODUCTION_TEMPLATES](./08_PRODUCTION_TEMPLATES/) | 4 production-grade, 100% verified `.toad` templates |

---

## ⚡ The 12 Golden Commandments of TOAD DSL

Every developer and AI model writing `.toad` code must strictly abide by these immutable rules:

1. **Variables Use Assignment (`=`)**: Declare variables as `>brandPrimary = #3b82f6;`. Never use colons for variable declaration. Reference variables with `>var`.
2. **Every Statement Ends in Semicolon (`;`)**: Properties, directives, slot declarations (`slot;`), and variable statements must terminate with a semicolon.
3. **Typography Glyph Size vs. Word-Wrap Boundary**: `font-size: 24px;` controls the glyph scale. `size: 400px;` (or `size: 400px hug;`) defines the multi-line word-wrap container. Without `size:`, text flows on a single infinite line.
4. **Font Stacks Must Be a Single String Literal**: When chaining fonts or fallbacks, write `>fontStack = "Inter, 'Segoe UI', sans-serif";`. Never use unquoted comma lists (`>font = "Inter", sans-serif;` is a fatal syntax error).
5. **Declare Fonts Explicitly**: Always use `@font "./fonts/..." as "Name" normal;` or specify `font-family:` on the `canvas` block. Never rely on OS-specific default fallbacks (e.g. Windows DirectWrite defaulting to condensed `Agency FB` while browsers default to wide `Arial`).
6. **Badge & Pill Safety Margins**: Always plan 15–20% horizontal safety padding around text in pills, tags, and buttons. Never hardcode container width to the bare glyph boundary.
7. **Relational Anchoring Syntax**: Anchor elements with explicit contexts: `at: below #hero offset 16px;` or `at: center of canvas;`. Never put a colon after `offset`.
8. **Shapes Use `fill:`, Texts Use `color:`**: Rectangles, circles, and paths take `fill:`; text elements take `color:`.
9. **Glow Center Alphas $\ge 0.25$**: For neon/glow effects on dark backgrounds, use center stop alphas of at least $0.25$ (e.g. `alpha(>brandGreen, 0.35) 0%`) so they remain vibrant across sRGB screens without gamma attenuation.
10. **180°-Rotated Containers Require Extra Top Margin**: In groups with `rotation: 180deg;`, positive $Y$ coordinates push elements upward toward the card boundary on screen. Double the top/bottom boundary margins to prevent collisions.
11. **Slots Must Terminate with Semicolon**: Content projection insertion points MUST be written as `slot;`. Omitting the semicolon causes a parse error on the enclosing closing brace.
12. **Negative Constraints**: NEVER hallucinate CSS flexbox (`display: flex`), HTML elements (`<div>`), or CSS `rgba(...)` syntax. Use `stack`, `rect`, and `alpha(#hex, a)`.

---

## 🚀 Quick Start & CLI Invocations

```bash
# 1. Compile a document to all supported formats (PNG, JPG, WebP, SVG, PSD)
toad "design.toad"

# 2. Build specific scale and format
toad "design.toad" -s 2 -f "svg, png"

# 3. Start live preview server with Hot Reload (SSE)
toad dev "design.toad" --port 3000

# 4. Format and lint TOAD code
toad format "design.toad"
toad lint "design.toad"
```

Dive into the module directories above to explore the complete documentation!
