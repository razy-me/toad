<div align="center">

# toad

### Design graphics at the speed of code.

[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.0.0-339933.svg?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![Tests](https://img.shields.io/badge/Tests-1234%20Passing-10b981.svg?style=flat-square&logo=vitest&logoColor=white)](./tests)
[![Formats](https://img.shields.io/badge/Export-PNG%20%7C%20SVG%20%7C%20PSD%20%7C%20PDF%20%7C%20WebP%20%7C%20JPG-38bdf8.svg?style=flat-square)](https://github.com/razy-me/toad)

<p align="center">
  A declarative design language and compiler that turns code into crisp images (<b>PNG, JPG, WebP</b>), scalable vectors (<b>SVG</b>), print documents (<b>PDF</b>), and fully layered, editable Photoshop documents (<b>PSD</b>).
</p>

[Why TOAD?](#-why-toad) • [Quickstart](#-quickstart) • [Syntax Example](#-syntax-example) • [CLI](#-cli-commands) • [Documentation](#-documentation)

</div>

---

## 🤔 Why TOAD?

- 🤖 **Gateway to AI-Generated .PSD Files**: LLMs can write code, but can't generate binary Photoshop files. TOAD bridges that gap: an AI writes simple `.toad` code, and TOAD compiles it into a **native Photoshop document with editable text layers, vector Bézier paths, and real layer styles**.
- ✍️ **Code-First Design**: Version-control your designs, use variables, and automate graphics generation without heavy GUI tools.
- 📐 **Vector & Barcode Subsystems**: Built-in 1D Barcodes (`code128`, `ean13`, `upc`, `code39`) and ISO/IEC 18004 2D QR codes rendered as crisp vector paths across SVG, PSD, PDF, and Canvas.
- 🎯 **Automated Design Auditor & Anti-Slop Guardrails**: Built-in accessibility auditing (WCAG 2.2 AA/AAA & APCA), typographic scale analysis, prepress TAC flightcheck, and 50+ Anti-AI-Slop design heuristics.
- ⚡ **Blazing Fast**: Native 2D raster engine (@napi-rs/canvas) with zero browser overhead.
- 🔄 **Live Hot Reload**: Run `toad <FILENAME.toad> -w` for instant browser preview with live reload on save.

---

## 🚀 Quickstart

```bash
git clone https://github.com/razy-me/toad.git
cd toad
npm install && npm run build && npm link
```

Create a new project or start compiling:

```bash
toad init my-banner       # Scaffolds a new ready-to-run project
toad hero                 # Auto-locates hero.toad and compiles declared formats
toad hero -w              # Watch mode with live browser preview (SSE)
toad hero -f "svg, psd"   # Compile specific formats
toad hero -s 2            # 2x high-resolution export
```

---

## 🎨 Syntax Example

A complete `.toad` file with components, relational layout, and multi-format export:

```toad
>bg = #0f172a;
>primary = #38bdf8;
>accent = #f59e0b;

canvas "Hero-Banner" {
    preset: og-image;         // 1200x630
    background: >bg;
    export: all;              // PNG, JPG, WebP, SVG, PDF, and layered PSD
}

component Card(title = "Featured") {
    group {
        rect {
            size: 100% 100%;
            fill: #1e293b;
            radius: 16px;
        }
        text {
            at: inside parent offset 20px;
            content: >title;
            font-size: 20px;
            font-weight: bold;
            color: #ffffff;
        }
        slot;
    }
}

stack #content {
    direction: vertical;
    gap: 16px;
    at: center of canvas;
    size: 700px hug;

    text #title {
        content: "Declarative Graphics";
        font-size: 32px;
        font-weight: 800;
        color: #ffffff;
    }

    Card("Quick Overview") {
        text {
            at: inside parent offset (20px, 60px);
            content: "Compiled to SVG and layered Photoshop PSD.";
            font-size: 16px;
            color: #94a3b8;
        }
    }
}
```

---

## 💻 CLI Commands

| Command | What It Does |
|---|---|
| `toad init [name]` | Scaffolds a new starter project with assets and configuration |
| `toad <name>` | Compiles `.toad` file (locates it automatically across workspaces) |
| `toad dev <name>` / `-w` | Live preview server with Hot Reload (SSE) and browser sync |
| `toad lint <name>` | Validates syntax, types, geometry, and undefined variables |
| `toad format <name>` | Formats code layout, indentation, and syntax (`alias: fmt`) |
| `toad audit <name>` | Runs deep visual quality, accessibility (WCAG/APCA), and anti-slop checks |
| `toad bundle <name>` | Generates favicons, app icons, and web manifest assets |
| `toad workspace` | Manages preferred design directories and search workspaces |
| `-f, --format <formats>` | Choose formats: `png`, `jpg`, `webp`, `svg`, `psd`, `pdf`, `all` |
| `-s, --scale <number>` | Resolution scale multiplier (e.g. `2`, `4`) |
| `--dpi <number>` | Target DPI for prepress print (e.g. `300`) |
| `--bleed <dim>` | Print bleed margin override (e.g. `3mm`) |

---

## 📚 Documentation & Ecosystem

- 📖 **[`wiki.html`](./wiki.html)**: Interactive documentation with syntax guide, layout engine specifications, and instant search.
- 🖼️ **[Showcases & Real-World Designs](https://github.com/razy-me/toad-designs)**: Production-grade design gallery, posters (Bauhaus, Kamekura Tokyo 1964, Soul), and banner showcases created in TOAD.
- 🛠️ **Developer Tooling**: Built-in CLI linter, code formatter, asset generator, and Language Server Protocol (LSP) support.

---

## 🧪 Testing

```bash
npm test    # Runs 1,234 tests across 98 test suites (Vitest)
```

## 📄 License
MIT License. Created by [razy-me](https://github.com/razy-me).

