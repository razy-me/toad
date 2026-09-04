<div align="center">

# toad

### Design graphics at the speed of code.

[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.0.0-339933.svg?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![Tests](https://img.shields.io/badge/Tests-929%20Passing-10b981.svg?style=flat-square&logo=vitest&logoColor=white)](./tests)
[![Formats](https://img.shields.io/badge/Export-PNG%20%7C%20SVG%20%7C%20PSD%20%7C%20WebP%20%7C%20JPG-38bdf8.svg?style=flat-square)](https://github.com/razy-me/toad)

<p align="center">
  <b>TOAD</b> is a modern design language and standalone compiler for makers, developers, and visual designers.<br/>
  Write clean, declarative code and compile directly into crisp images (<b>PNG, JPG, WebP</b>), scalable vectors (<b>SVG</b>), and fully-layered Photoshop files (<b>PSD</b>) with native vector shapes, gradients, and editable text.
</p>

[Why TOAD?](#-why-toad) • [Quickstart](#-quickstart) • [Syntax at a Glance](#-syntax-at-a-glance) • [CLI Commands](#-cli-commands) • [Documentation](#-the-seed-machine-knowledge-base)

</div>

---

## 🤔 Why TOAD?

Design tools like Figma and Photoshop are great for freeform exploration, but they quickly fall short when you want **version control, programmatic automation, reusable design tokens, and reproducible assets**. 

HTML/CSS rendering (like Puppeteer or headless Chrome) is heavy, memory-hungry, and can't produce native Photoshop documents or clean vector layers.

**TOAD gives you the best of both worlds:**
- 🤖 **Gateway to AI-Generated .PSD Files**: Large Language Models (LLMs) can easily write text and code, but they cannot directly create binary `.psd` files. TOAD acts as the bridge: an AI generates simple `.toad` code, and the compiler turns it into a **fully-layered, native Photoshop document** with editable text layers, vector Bézier paths, and real layer styles.
- ✍️ **Code-first simplicity**: Design with clean, intuitive syntax instead of wrestling with heavy GUI apps.
- ⚡ **Lightning-fast compilation**: Powered by high-speed native 2D rendering (@napi-rs/canvas) without needing a browser.
- 📂 **True native Photoshop export**: Exports real `.psd` files with editable vector shapes, live rounded corners, gradient layers, and real text layers — ready to open and refine in Adobe Photoshop.
- 🔄 **Delightful developer experience**: Built-in hot reload, live browser preview via Server-Sent Events, instant project scaffolding, and intelligent file finding.

---

## ✨ Highlights

- 🤖 **AI-Ready PSD Pipeline:** Enables AI agents & LLMs to synthesize complete, production-grade Photoshop files with non-destructive, fully editable layers.
- 🎨 **Declarative & Modular:** Variables (`>primary = #3b82f6;`), reusable components (`component Button(...)`), slot projections (`slot;`), and multi-canvas pages in a single file.
- 🚀 **Instant Setup:** Run `toad init` to generate a ready-to-run template in seconds.
- ⚡ **Zero-Fuss CLI:** Just run `toad hero` — it automatically finds `hero.toad` in your project, builds it, and outputs your files.
- 🔄 **Live Hot Reload:** Run `toad hero -w` or `toad dev hero` to preview changes in real time in your browser as you type.
- 📐 **Intuitive Layout Engine:** Position things naturally (`at: below #title offset 16px;`, `at: center of canvas;`), or stack and grid elements with automatic flex sizing (`hug` / `fill`).
- 🖨️ **Print-Ready (Prepress):** Works in real physical units (`mm`, `cm`, `in`, `pt`), automated bleed margins, and precision crop marks.
- ⭐ **Rich Graphics Toolkit:** Built-in primitives (`rect`, `circle`, `star`, `polygon`, Bézier `path`), Lucide icons, 2D transforms, and smooth gradients.
- 🔤 **Deep Typography:** Multi-line text wrapping, custom fonts (`@font`), OpenType features, variable font axes, and justification.
- 📸 **Photo Grading:** Drop in photos (`canvas photo "image.jpg"`), adjust exposure, contrast, saturation, and add dodge & burn spots directly in code.
- 📦 **One-Command Exports:** Generate PNG, JPG, WebP, SVG, and PSD side-by-side with a single build command.

---

## 🚀 Quickstart

### 1. Installation
```bash
git clone https://github.com/razy-me/toad.git
cd toad
npm install
npm run build
npm link
```

### 2. Initializing a New Project
```bash
# Creates a new folder (e.g. toad-project-1/) with a ready-to-run template
toad init

# Or give it a custom name
toad init my-banner
```

---

## 🎨 Syntax at a Glance

Here is what a complete `.toad` file looks like (`hero.toad`):

```toad
>bg = #0f172a;
>primary = #38bdf8;
>accent = #f59e0b;

// Artboard setup with platform preset
canvas "Hero-Banner" {
    preset: og-image;         // 1200x630
    background: >bg;
    export: all;              // Exports PNG, JPG, WebP, SVG, and PSD
}

// Reusable component with slot injection
component Card(title = "Featured", bg = #1e293b) {
    group {
        rect {
            size: 100% 100%;
            fill: >bg;
            radius: 16px;
            shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
        }
        text {
            at: inside parent offset 20px;
            content: >title;
            font-size: 20px;
            font-weight: bold;
            color: #ffffff;
            letter-spacing: 0.5px;
        }
        slot; // Injected children render here
    }
}

stack #content {
    direction: vertical;
    gap: 20px;
    at: center of canvas;
    size: 800px hug;

    group #header {
        icon {
            iconName: "settings";
            size: 32px;
            fill: >primary;
        }
        text {
            at: right of previous offset 12px;
            content: "Declarative Design System";
            font-size: 32px;
            font-weight: 800;
            color: #ffffff;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
    }

    Card("Quick Overview", #1e293b) {
        star {
            size: 40px;
            fill: >accent;
            at: inside parent offset 20px;
            margin: 40px 0 0 0;
            rotation: 15deg;
        }
        text {
            at: right of previous offset 16px;
            content: "Components, slots, shapes, and auto-layout combined.";
            font-size: 16px;
            color: #94a3b8;
            size: calc(100% - 100px);
        }
    }
}
```

### 4. Photo Editing & Grading Example (`photo.toad`)
```toad
// Photo Canvas: Dimensions automatically detected from photo.jpg
canvas photo "./assets/photo.jpg" {
    exposure: 0.2;
    contrast: 1.15;
    saturation: 1.1;
    warmth: 0.08;
    vignette: 25%;
}

// Local Dodge & Burn Retouching
adjust #faceLighting {
    at: (520px, 340px);
    radius: 120px;
    feather: 50px;
    exposure: 0.35;
    warmth: 0.05;
}

// Composited Typography
text #caption {
    at: bottom center of canvas offset (0px, -40px);
    content: "Golden Hour in Iceland";
    color: #ffffff;
    font-size: 24px;
    font-weight: 600;
}
```

### Compiling & Previewing
```bash
# Build automatically in all formats declared in the .toad file
toad hero

# Build specific formats or high-resolution scales
toad hero -f svg
toad hero -f "png, psd"
toad hero -f all -s 2

# Start watch mode with instant live browser preview
toad hero -w
```

---

## 💻 CLI Commands

Run `toad` from anywhere in your terminal:

| Command / Option | What It Does | Example |
|---|---|---|
| `toad init [name]` | Scaffolds a new project (`toad-project-X` or custom name) | `toad init` or `toad init banner` |
| `toad <name>` | Compiles entry file automatically finding it on disk | `toad hero` |
| `toad dev [name]` | Watch mode live preview server with Hot Reload (SSE) | `toad dev hero -p 4000` |
| `toad lint <name>` | Static linter checking for undeclared variables & syntax errors | `toad lint hero` |
| `toad format [name]` (alias `fmt`) | Formats code (`-c, --check` verifies formatting) | `toad fmt hero` |
| `-f, --format <formats>` | Formats: `png`, `jpg`, `webp`, `svg`, `psd`, `image`, `all` | `toad hero -f all` |
| `-s, --scale <number>` | Multi-scale multiplier (e.g. `1`, `2`, `4`) | `toad hero -s 2` |
| `-q, --quality <number>` | JPG / WebP quality (`1` to `100` or `0.85`) | `toad hero -q 90` |
| `-o, --out <dir>` | Output directory (defaults to directory of `.toad` file) | `toad hero -o ./dist` |
| `-w, --watch` | Watch mode with SSE hot-reload web preview & 1-click folder button | `toad hero -w` |
| `--dpi <number>` | Target DPI resolution for print conversion (e.g. `300`, `150`) | `toad flyer --dpi 300` |
| `--bleed <dimension>` | Print bleed margin override (e.g. `3mm`, `0.125in`) | `toad flyer --bleed 3mm` |
| `--fonts <dir>` | Load local `.ttf` / `.otf` font directory | `toad hero --fonts ./fonts` |

---

## Built-in Primitives & Features Overview

### 1. Shape Primitives
- `rect`: Rectangle with optional uniform `radius: 12px;` or individual `border-radius: [10px, 20px, 10px, 20px];`.
- `circle`: Perfect circle or ellipse (`size: 100px;` or `size: 120px 80px;`).
- `triangle`: Equilateral/isosceles triangle fitting the bounding box.
- `star`: 5-pointed star with golden-ratio inner vertices.
- `arrow`: Directional arrow shape.
- `cross`: Symmetrical plus/cross icon shape.
- `polygon`: Arbitrary point-based polygons with local coordinates and optional corner rounding (`points: [(-50, -50), (50, -50), (0, 50)]; radius: 8px;`).
- `path`: Freeform SVG path string (`d: "M 0 0 L 100 100 Z";`).

### 2. Built-in Icons (`icon`)
First-class support for Lucide vector icons:
```toad
icon {
    iconName: "search";  // search, check, x, arrow-right, arrow-left, arrow-up, arrow-down, home, user, settings
    size: 24px;
    fill: #38bdf8;
}
```

### 3. Canvas Platform Presets (`preset:`)
Named presets are passed via `preset:` only:
- `og-image`: 1200 x 630 px
- `banner`: 1920 x 1080 px
- `twitter-header`: 1500 x 500 px
- `instagram-post` / `insta-post`: 1080 x 1080 px
- `instagram-story` / `insta-story`: 1080 x 1920 px
- `youtube-thumbnail`: 1280 x 720 px
- `github-banner`: 1280 x 640 px
- `dribbble-shot`: 1600 x 1200 px
- `avatar`: 400 x 400 px
- `app-icon`: 1024 x 1024 px
- `favicon`: 32 x 32 px

Resolution values are passed via `resolution:` (not `preset:`) and size the canvas' short edge according to its ratio: `480p` / `sd` → 480, `720p` / `hd` → 720, `1080p` / `fhd` → 1080, `1440p` / `qhd` → 1440, `2160p` / `4k` → 2160, `4320p` / `8k` → 4320.

### 4. 2D Transformations
```toad
rect {
    size: 100px 100px;
    rotation: 45deg;
    scale: 1.2 0.8;
    skewX: 10deg;
    skewY: 5deg;
    transform-origin: center; // or 50% 50% or (50px, 50px)
}
```

### 5. Advanced Gradients
```toad
// Linear
fill: linear-gradient(135deg, #3b82f6, #9333ea);

// Radial
fill: radial-gradient(circle, #38bdf8 0%, #0f172a 100%);

// Conic
fill: conic-gradient(from 45deg, #f43f5e, #8b5cf6, #06b6d4, #f43f5e);
```

### 6. Component Slots
```toad
component Modal(title = "Notice") {
    group {
        rect { size: 400px 200px; fill: #ffffff; radius: 12px; }
        text { content: >title; font-weight: bold; at: inside parent offset 16px; }
        slot; // Child elements passed to Modal(...) render here
    }
}

Modal("Confirmation Dialog") {
    text { content: "Are you sure you want to proceed?"; at: inside parent offset 50px; }
    rect { size: 80px 32px; fill: #ef4444; at: inside parent offset 150px; }
}
```

---

## 🌿 The Seed (Machine Knowledge Base)

For developers and AI coding agents, the repository includes **[`the_seed/`](./the_seed/README.md)** — an exhaustive, deterministic technical specification and grammar manual:

- 📐 **[01. Core Syntax & Grammar](./the_seed/01_CORE_SYNTAX_AND_LANGUAGE/):** EBNF grammar, token streams, and AST definitions.
- 🧮 **[02. Layout & Positioning](./the_seed/02_LAYOUT_AND_POSITIONING/):** Relational anchors, DAG resolution, and bento grids.
- 🎨 **[03. Graphics & Shapes](./the_seed/03_GRAPHICS_SHAPES_AND_EFFECTS/):** Paths, gradients, shadows, and masks.
- 🔤 **[04. Typography & Fonts](./the_seed/04_TYPOGRAPHY_AND_FONTS/):** Font metrics, OpenType, and text layout.
- 🧩 **[05. Components & Slots](./the_seed/05_COMPONENTS_AND_MODULARITY/):** Parametric components and slot projection.
- 🎛️ **[06. Exporters & Rendering](./the_seed/06_EXPORTERS_AND_RENDERING/):** Skia rasterizer, SVG vectors, and PSD engine.
- 📚 **[08. Ready-to-Use Templates](./the_seed/08_PRODUCTION_TEMPLATES/):** Tested real-world examples (UI kits, analytics dashboards, and print cards).
- 🌐 **[Offline HTML Handbook (`wiki.html`)](./wiki.html):** Standalone single-file documentation with instant search.

---

## Production Templates

Battle-tested design templates are included in [`the_seed/08_PRODUCTION_TEMPLATES/`](./the_seed/08_PRODUCTION_TEMPLATES/):

1. **[UI Kit & Components (`01_ui_kit_components.toad`)](./the_seed/08_PRODUCTION_TEMPLATES/01_ui_kit_components.toad)**  
   - Comprehensive component library showcasing buttons, input fields, badges, and toggle switches built with auto-layout stacks.
2. **[SaaS Metrics Dashboard (`02_saas_metrics_dashboard.toad`)](./the_seed/08_PRODUCTION_TEMPLATES/02_saas_metrics_dashboard.toad)**  
   - Dark-mode analytics dashboard featuring bento grids, KPI cards, vector charts, and status indicators.
3. **[Event Tent Card Multi-Side (`03_event_tent_card_multiside.toad`)](./the_seed/08_PRODUCTION_TEMPLATES/03_event_tent_card_multiside.toad)**  
   - Multi-canvas print layout with physical dimensions, 180° rotated tent card panels, and CMYK/bleed prepress setup.
4. **[Marketing Hero Poster (`04_marketing_hero_poster.toad`)](./the_seed/08_PRODUCTION_TEMPLATES/04_marketing_hero_poster.toad)**  
   - High-impact promotional poster utilizing multi-stop radial gradients, glowing accents, and typography styling.

---

## Development & Testing

```bash
# Run full Vitest test suite (929 tests across 64 test files)
npm test

# Build TypeScript to dist/
npm run build
```

## License
MIT