# 🌿 THE SEED — Machine-Optimized Knowledge Base

> [!WARNING]
> ### 🤖 FOR LLMs & AI CODING AGENTS ONLY — NOT FOR HUMAN READING
> **This directory is not formatted for human consumption.**
> It is an exhaustive, deterministic technical specification and rule set built specifically for **Autonomous AI Agents & Large Language Models** (Gemini, Claude, GPT-4, Cursor) to generate 100% valid `.toad` code without hallucinations.
>
> 📖 Humans should read [`../README.md`](../README.md) or open [`../wiki.html`](../wiki.html).

---

## 🗺️ Navigation Map

| Module | Contents |
|:---|:---|
| [01_CORE_SYNTAX_AND_LANGUAGE](./01_CORE_SYNTAX_AND_LANGUAGE/) | EBNF grammar, token lexer, variables, canvas |
| [02_LAYOUT_AND_POSITIONING](./02_LAYOUT_AND_POSITIONING/) | Relational DAG placement, flex stacks, bento grids |
| [03_GRAPHICS_SHAPES_AND_EFFECTS](./03_GRAPHICS_SHAPES_AND_EFFECTS/) | Vector paths, gradients, shadows, filters |
| [04_TYPOGRAPHY_AND_FONTS](./04_TYPOGRAPHY_AND_FONTS/) | Text measurement, line wrapping, OpenType features |
| [05_COMPONENTS_AND_MODULARITY](./05_COMPONENTS_AND_MODULARITY/) | Reusable components, slot projections, `@import` |
| [06_EXPORTERS_AND_RENDERING](./06_EXPORTERS_AND_RENDERING/) | Skia rasterizer, SVG, Photoshop PSD layer engine |
| [07_LLM_RULES_AND_PITFALLS](./07_LLM_RULES_AND_PITFALLS/) | Top anti-patterns, troubleshooting playbook |
| [08_PRODUCTION_TEMPLATES](./08_PRODUCTION_TEMPLATES/) | 4 verified production `.toad` templates |

---

## ⚡ Core Rules (Quick Reference)

1. **Variables**: `>var = value;` (never `:`).
2. **Termination**: Every statement ends with a semicolon `;`.
3. **Typography**: `font-size: 24px;` sets glyph scale; `size: 400px;` sets word-wrap container.
4. **Font Stacks**: Must be a single quoted string (`>font = "Inter, sans-serif";`).
5. **Anchoring**: `at: below #target offset 16px;` (space after `offset`, never a colon).
6. **Shapes vs Text**: Shapes use `fill:`, text uses `color:`.
7. **Negative Constraints**: No CSS flexbox (`display: flex`), no HTML (`<div>`), no `rgba()`. Use `stack`, `rect`, and `alpha(#hex, a)`.
