<div align="center">

# toad

### Design graphics at the speed of code.

[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.0.0-339933.svg?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![Tests](https://img.shields.io/badge/Tests-Passing-10b981.svg?style=flat-square&logo=vitest&logoColor=white)](./tests)
[![Formats](https://img.shields.io/badge/Export-PNG%20%7C%20SVG%20%7C%20PSD%20%7C%20PDF%20%7C%20WebP%20%7C%20JPG%20%7C%20MP4-38bdf8.svg?style=flat-square)](https://github.com/razy-me/toad)

<p align="center">
  A declarative design language, layout compiler, and visual studio that turns code into crisp images (<b>PNG, JPG, WebP</b>), scalable vectors (<b>SVG</b>), print documents (<b>PDF</b>), animations (<b>MP4, WebM, GIF</b>), and fully layered, editable Photoshop documents (<b>PSD</b>).
</p>

</div>

---

## ⚡ Highlights

- 🎨 **Code to PSD**: Generates native Photoshop documents with editable text layers, vector paths, layer masks, and adjustment styles.
- 🖨️ **Multi-Format Export**: PNG, JPG, WebP, SVG, print-ready PDF (bleed margins & crop marks), and motion animations.
- 🐸 **TOAD Studio (Web-GUI)**: Built-in visual studio with 6 interactive command wizard columns, interactive file picker with ghost suggestions, live preview, and dark UI.
- ✂️ **100% Local AI Background Removal**: Zero-cloud neural segmentation (BiRefNet / BiRefNet Lite / DYB Ensemble + Guided Filter) with CPU AVX2 & DirectML GPU acceleration.
- 🔄 **Universal Converter & Optimizer**: Two-way PSD-to-TOAD DSL code generation, plus smart image resizing, format conversion, and web compression.
- 🎬 **TOAD Motion Engine**: Declarative keyframe animations (`.toadm`) rendered directly to MP4, WebM, or GIF.
- 📦 **Asset Bundler**: Instant generation of multi-resolution icon sets, favicons, social share cards, and `site.webmanifest`.
- 📐 **Vector, Barcodes & QR**: Built-in 1D barcodes (`code128`, `ean13`, `upc`, `code39`) and 2D QR codes with logo embedding.
- 🎯 **Deep Quality & Accessibility Audit**: WCAG 2.2 contrast checking, APCA validation, and anti-AI-slop heuristics with 1-click clipboard fix plans.
- ⚙️ **Persistent Workspaces & Settings**: Global configuration (`~/.toadrc.json`), preferred directory indexing, and smart depth-limited document resolution.

---

## 🚀 Quickstart

### 📦 One-Line Installation (No Node.js or Git required!)

**Windows (PowerShell):**
```powershell
irm https://raw.githubusercontent.com/razy-me/toad/main/install.ps1 | iex
```

**macOS / Linux (Bash):**
```bash
curl -fsSL https://raw.githubusercontent.com/razy-me/toad/main/install.sh | bash
```

*The installer automatically configures `toad` in your PATH and bundles a lightweight runtime if you don't already have Node.js installed.*

### 🛠️ Developer Setup (Manual)
```bash
git clone https://github.com/razy-me/toad.git
cd toad && npm install && npm run build && npm link
```

---

## ⌨️ CLI Commands Overview

Invoking `toad` without any arguments automatically launches **TOAD Studio** in your browser with update checks.

```bash
# 🐸 TOAD Studio & Live Dev
toad                        # Opens TOAD Studio Web-GUI in browser (with update checker)
toad studio                 # Start TOAD Studio as detached background daemon
toad studio --foreground    # Run Studio directly attached to current terminal
toad stop                   # Stop running background Studio daemon
toad dev design.toad        # Start live preview server on port 3000 with SSE hot reload

# 🏗️ Build & Compilation
toad init my-project        # Scaffold a new project (starter template + package.json)
toad design.toad            # Compile .toad file (auto-detects canvas export formats)
toad design.toad -f psd     # Export as native layered Photoshop PSD
toad design.toad -f "png, svg, pdf" -s 2 # Multi-format export at 2x scale
toad design.toad -w         # Watch mode with live reload & clickable file link

# ✂️ On-Device AI Background Removal (100% Local, Zero Cloud)
toad remove-bg photo.jpg out.png            # Standard high-precision BiRefNet model
toad remove-bg photo.jpg out.png --fast     # BiRefNet Lite fast-path (4x concurrency)
toad remove-bg photo.jpg out.png --dyb      # Do-Your-Best: multi-model ensemble + guided filter
toad remove-bg ./raw-photos ./cutouts -r    # Batch process whole folder recursively

# 🔄 Universal Converter & PSD Importer
toad convert design.psd                     # Reverse-engineer PSD into clean TOAD DSL code
toad convert photo.png -f webp -c           # Convert image to WebP with web compression
toad convert icon.png --width 512 --scale 2 # Resize and scale images

# 📦 Asset Bundler & Motion Graphics
toad bundle logo.toad -p favicons           # Generate favicon suite & webmanifest tags
toad bundle banner.toad -p social           # Export social share dimensions (OG, Twitter)
toad motion anim.toadm -f mp4 --fps 60      # Render motion script to 60fps MP4 video

# 🎯 Quality, Linting & Auditing
toad audit design.toad      # Run WCAG 2.2, contrast, and anti-slop design audit
toad report design.toad --fixes # Detailed report with copyable quick-fix action plan
toad lint design.toad       # Static code analysis & syntax verification
toad format design.toad     # Auto-format indentation and layout rules (alias: toad fmt)

# ⚙️ Workspaces, Configuration & Updates
toad list                   # Scan system and list all discovered .toad files
toad workspace add ./designs# Add preferred workspace for priority file resolution
toad workspace list         # Show registered workspaces
toad config                 # View global settings (~/.toadrc.json)
toad config set defaultFormat psd # Set default compilation target
toad update                 # Update TOAD directly to the latest version from GitHub
```

---

## 🎨 Example (.toad DSL)

```toad
>bg = #0f172a;
>accent = #10b981;

canvas "Social Card" {
    size: 1200px 630px;
    background: >bg;
    export: png, svg, psd;
}

stack #card {
    at: center of canvas;
    size: 720px hug;
    direction: vertical;
    gap: 20px;
    padding: 40px;
    fill: #1e293b;
    radius: 20px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    shadow: 0px 20px 40px rgba(0, 0, 0, 0.5);

    text #tagline {
        content: "DECLARATIVE DESIGN ENGINE";
        font-size: 14px;
        font-weight: 700;
        letter-spacing: 2px;
        color: >accent;
    }

    text #title {
        content: "Design Graphics at the Speed of Code";
        font-size: 36px;
        font-weight: 800;
        color: #ffffff;
    }

    text #body {
        content: "Compile to crisp PNGs, scalable SVGs, print PDFs, and layered Photoshop PSDs.";
        font-size: 18px;
        line-height: 1.6;
        color: #94a3b8;
    }
}
```

---

## 🐸 TOAD Studio Web-GUI

Launch the visual workspace anytime with `toad` or `toad studio`:

1. **✂️ Freistellen**: AI-powered background remover with interactive before/after split slider, speed & quality presets, and direct download.
2. **🎨 Design exportieren**: Full build parameter control deck (Scale, Vector Scale, DPI, Bleed margins, Formats) with instant live preview.
3. **🎬 Video exportieren**: TOAD Motion renderer with interactive HTML5 video preview player, timeline scrubber, and format options (`mp4`, `webm`, `gif`).
4. **🔄 Konvertieren**: Universal file converter with drag-and-drop support, format switching, bicubic/pixel-art resampling, and PSD-to-TOAD reverse compiler.
5. **🛡️ Auditieren**: Real-time design quality and accessibility dashboard with dimension scores, WCAG contrast breakdown, and 1-click clipboard fixes.
6. **⚙️ Einstellungen**: Drag-and-drop workspace manager, global default formats, output naming patterns, and AI acceleration settings.

---

## 🛠️ Tech Stack & Architecture

| Layer | Technologies | Details & Purpose |
| :--- | :--- | :--- |
| **Runtime & Core** | [![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org) [![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org) | Native ECMAScript Modules (ESM), strict type safety across compiler & engine |
| **Graphics & Rendering** | [![Rust NAPI Canvas](https://img.shields.io/badge/Rust_NAPI-Canvas-DEA584?style=flat-square&logo=rust&logoColor=white)](https://github.com/Brooooooklyn/canvas) | High-performance 2D rasterizer powered by Skia for ultra-crisp output & layout measurements |
| **PSD Composition** | [![ag-psd](https://img.shields.io/badge/PSD_Engine-ag--psd-31A8FF?style=flat-square&logo=adobephotoshop&logoColor=white)](https://github.com/Agamnentzar/ag-psd) | Native Photoshop document engine (generates layered PSDs, vector masks, text styles) |
| **On-Device AI / ML** | [![Hugging Face Transformers.js](https://img.shields.io/badge/HF-Transformers-FFD21E?style=flat-square&logo=huggingface&logoColor=black)](https://github.com/huggingface/transformers.js) [![ONNX Runtime](https://img.shields.io/badge/ONNX-Runtime-005CED?style=flat-square&logo=onnx&logoColor=white)](https://onnxruntime.ai) | Zero-cloud, local neural models (BiRefNet, BiRefNet Lite, DirectML & multi-threaded CPU) |
| **CLI & Watch Engine** | [![Commander.js](https://img.shields.io/badge/CLI-Commander.js-black?style=flat-square&logo=gnubash&logoColor=white)](https://github.com/tj/commander.js) [![Chokidar](https://img.shields.io/badge/Watcher-Chokidar-2ecc71?style=flat-square)](https://github.com/paulmillr/chokidar) | Command-line dispatching, interactive flags, daemon management, and reactive file watching |
| **Testing & Quality** | [![Vitest](https://img.shields.io/badge/Vitest-2.0-729B1B?style=flat-square&logo=vitest&logoColor=white)](https://vitest.dev) | Fast, modern test runner with snapshot, visual regression, and unit test suites |

---

## 📄 License

MIT License • [razy-me](https://github.com/razy-me)
