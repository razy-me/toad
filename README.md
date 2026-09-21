<div align="center">

# 🐸 toad

### Design graphics, motion & prepress at the speed of code.

[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.0.0-339933.svg?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![Tests](https://img.shields.io/badge/Tests-Passing-10b981.svg?style=flat-square&logo=vitest&logoColor=white)](https://github.com/razy-me/toad)
[![Formats](https://img.shields.io/badge/Export-PNG%20%7C%20SVG%20%7C%20PSD%20%7C%20PDF%20%7C%20WebP%20%7C%20JPG%20%7C%20MP4-38bdf8.svg?style=flat-square)](https://github.com/razy-me/toad)

<p align="center">
  A high-performance declarative design language, layout compiler, and visual studio that turns code into crisp images (<b>PNG, JPG, WebP, AVIF</b>), scalable vectors (<b>SVG</b>), print prepress documents (<b>PDF</b>), animations & motion videos (<b>MP4, WebM, GIF</b>), and fully layered, editable Photoshop documents (<b>PSD</b>) with 100% on-device AI tools.
</p>

</div>

---

## ⚡ Highlights

- 🎨 **Code to Photoshop PSD**: Generates native Photoshop documents with editable text layers, vector masks, layer effects, drop shadows, and adjustment layers.
- 🖨️ **Multi-Format Compilation**: Instant export to PNG, JPG, WebP, AVIF, SVG (with optional text-to-path outlines), and print-ready PDF (bleed margins, trim marks & CMYK TAC safe).
- 🐸 **TOAD Studio (Web-GUI & Live Suite)**: Zero-dependency interactive web dashboard with 6 specialized workspaces, interactive visual parameter deck, ghost file suggestions, live preview, and dark UI.
- ✂️ **100% Local AI Background Removal**: Zero cloud uploads. Features **BiRefNet** & **BiRefNet Lite** (MIT commercial), **Do-Your-Best (DYB)** dual-model neural ensemble with native Guided Filtering, AVX2 CPU acceleration, and DirectML GPU inference.
- 🔄 **Universal Converter & PSD Importer**: Two-way reverse compiler: decompile Photoshop PSD files into clean `.toad` DSL code, or convert, resize, and compress any raster image into modern web formats with bicubic or nearest-neighbor pixel-art resampling.
- 🎬 **TOAD Motion Engine**: Declarative keyframe animations (`.toadm`) rendered directly to 60fps MP4, WebM, or GIF via FFmpeg hardware acceleration (NVENC enabled).
- 📦 **Asset Bundler & App Manifests**: Generate complete favicon suites, multi-resolution app icons, social media share cards (OG / Twitter), and valid `site.webmanifest` files with embed tags.
- 📐 **Vector Shapes, Barcodes & QR Codes**: Built-in 1D barcodes (`code128`, `ean13`, `upc`, `code39`), 2D QR codes with logo embedding, Lucide vector icon registry, and custom SVG paths.
- 🎯 **Deep Quality & Anti-AI-Slop Audit**: 8-dimension design flightchecker covering WCAG 2.2, APCA contrast, modular typographic scales, whitespace distribution, optical centroid balance, and anti-AI-slop heuristics with 1-click clipboard fix plans.
- ⚙️ **Persistent Workspaces & Configuration**: Global configuration (`~/.toadrc.json`), preferred workspace directory indexing, and smart depth-limited document resolution.

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

Invoking `toad` without any arguments automatically checks for updates and launches **TOAD Studio** in your default browser.

```bash
# 🐸 TOAD Studio Web-GUI & Live Dev
toad                        # Launch TOAD Studio in browser with automatic update checker
toad studio                 # Start Studio as detached background daemon (CMD can be closed!)
toad studio --foreground    # Run Studio directly attached to current terminal
toad studio status          # Check if Studio daemon is currently running and show URL/PID
toad stop                   # Stop running background Studio daemon
toad dev design.toad        # Start live preview server on port 3000 with SSE hot reload

# 🏗️ Build & Compilation
toad init my-project        # Scaffold a new project (starter template + package.json)
toad design.toad            # Compile .toad file (auto-detects canvas export formats)
toad design.toad -f psd     # Export as native layered Photoshop PSD
toad design.toad -f "png, svg, pdf" -s 2 # Multi-format export at 2x scale
toad design.toad -w         # Watch mode with live reload & clickable file link
toad design.toad -t         # Convert text elements to vector path outlines in SVG

# ✂️ On-Device AI Background Removal (100% Local, Zero Cloud)
toad remove-bg photo.jpg out.png            # Standard high-precision BiRefNet model
toad remove-bg photo.jpg out.png --fast     # BiRefNet Lite fast-path (4x concurrency)
toad remove-bg photo.jpg out.png --dyb      # Do-Your-Best: multi-model ensemble + guided filter
toad remove-bg ./raw-photos ./cutouts -r    # Batch process whole folder recursively

# 🔄 Universal Converter & PSD Importer
toad convert design.psd                     # Reverse-engineer PSD into clean TOAD DSL code
toad convert photo.png -f webp -c           # Convert image to WebP with web compression
toad convert icon.png --width 512 --scale 2 # Resize and scale images with bicubic filter
toad convert sprite.png -f png --filter nearest # Pixel-art crisp nearest-neighbor resampling

# 📦 Asset Bundler & Motion Graphics
toad bundle logo.toad -p favicons           # Generate favicon suite & webmanifest tags
toad bundle banner.toad -p social           # Export social share dimensions (OG, Twitter)
toad motion anim.toadm -f mp4 --fps 60      # Render motion script to 60fps MP4 video

# 🎯 Quality, Linting & Auditing
toad audit design.toad      # Run WCAG 2.2, contrast, and anti-slop design audit
toad report design.toad --fixes # Detailed report with copyable quick-fix action plan
toad report design.toad --strict --min-score 90 # Enforce strict CI quality gate
toad lint design.toad       # Static code analysis & syntax verification
toad format design.toad     # Auto-format indentation and layout rules (alias: toad fmt)

# ⚙️ Workspaces, Configuration & Updates
toad list                   # Scan system and list all discovered .toad files
toad workspace add ./designs# Add preferred workspace for priority file resolution
toad workspace list         # Show registered workspaces
toad config                 # View global settings (~/.toadrc.json)
toad config set defaultFormat psd # Set default compilation target
toad config set defaultFps 60     # Configure default animation framerate
toad update                 # Update TOAD directly to the latest version from GitHub
```

---

## 🎨 Example (.toad DSL)

```toad
>bg = #0f172a;
>accent = #10b981;
>fontSans = "Inter, -apple-system, BlinkMacSystemFont, sans-serif";

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
        font-family: >fontSans;
        font-size: 14px;
        font-weight: 700;
        letter-spacing: 2px;
        color: >accent;
    }

    text #title {
        content: "Design Graphics at the Speed of Code";
        font-family: >fontSans;
        font-size: 36px;
        font-weight: 800;
        color: #ffffff;
    }

    text #body {
        content: "Compile to crisp PNGs, scalable SVGs, print PDFs, and layered Photoshop PSDs.";
        font-family: >fontSans;
        font-size: 18px;
        line-height: 1.6;
        color: #94a3b8;
    }

    stack #footer {
        direction: horizontal;
        justify: space-between;
        align: center;
        margin-top: 10px;

        text #author {
            content: "by razy-me";
            font-size: 14px;
            color: #64748b;
        }

        qrcode #qr {
            content: "https://github.com/razy-me/toad";
            size: 64px 64px;
            fill: #ffffff;
        }
    }
}
```

---

## 🎬 TOAD Motion (.toadm)

Animate any element across time using physics-based transitions and keyframes:

```toad
@import "./design.toad" as scene;

motion "Hero Entrance" {
    scene: scene;
    duration: 3s;
    fps: 60;
}

animate #card {
    0s {
        opacity: 0;
        transform: translateY(40px) scale(0.95);
    }
    1.2s {
        opacity: 1;
        transform: translateY(0px) scale(1.0);
        easing: cubic-bezier(0.16, 1, 0.3, 1);
    }
}
```

Render directly to high-framerate MP4 or WebM:
```bash
toad motion hero.toadm -f mp4 --fps 60
```

---

## 🐸 TOAD Studio Web-GUI

Launch the visual workspace anytime with `toad` or `toad studio`:

1. **✂️ Freistellen (AI Background Remover)**:
   - On-device segmentation powered by BiRefNet & BiRefNet Lite.
   - **DYB Mode**: Multi-model neural ensemble combined with native-resolution Guided Filtering.
   - Interactive before/after split slider, speed & quality presets, direct download.
   - Hardware detection: DirectML GPU & AVX2 Multi-Threaded CPU Tensor Engine.
2. **🎨 Design exportieren (Graphic & Build Deck)**:
   - Interactive parameter deck (Scale multipliers, Vector Scale, DPI, Bleed margins, Text-to-Path).
   - Instant live preview with Server-Sent Events (SSE) hot reloading.
   - Smart file picker with ghost suggestions and recent workspace files.
3. **🎬 Video exportieren (TOAD Motion)**:
   - TOAD Motion animation renderer with interactive HTML5 video preview player.
   - Timeline scrubber, frame stepping, and format selection (`mp4`, `webm`, `gif`).
4. **🔄 Konvertieren (Universal Image & PSD Converter)**:
   - PSD-to-TOAD reverse compiler: deconstructs Photoshop files into clean declarative code.
   - Batch image format switcher (`png`, `webp`, `jpg`, `avif`, `svg`, `pdf`, `ico`).
   - Resampling modes: bicubic smooth or nearest-neighbor pixel-art.
5. **🛡️ Auditieren (Design Quality & Prepress Deck)**:
   - Real-time 8-dimension design quality and accessibility audit dashboard.
   - WCAG 2.2 contrast checking, APCA validation, and optical centroid telemetry.
   - Anti-AI-Slop heuristics analysis with 1-click clipboard fix plans.
6. **⚙️ Einstellungen (Workspaces & Global Settings)**:
   - Drag-and-drop workspace manager and priority directory search paths.
   - Global default compilation target (`png`, `psd`, `svg`, `pdf`), quality, and scale.
   - Output naming patterns (`{name}{suffix}{scale}`), AI acceleration device selector, and auto-save.

---

## 🛠️ Tech Stack & Architecture

| Layer | Technologies | Details & Purpose |
| :--- | :--- | :--- |
| **Runtime & Core** | [![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org) [![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org) | Native ECMAScript Modules (ESM), strict type safety across compiler & engine |
| **Graphics & Rendering** | [![Rust NAPI Canvas](https://img.shields.io/badge/Rust_NAPI-Canvas-DEA584?style=flat-square&logo=rust&logoColor=white)](https://github.com/Brooooooklyn/canvas) | High-performance 2D rasterizer powered by Skia for ultra-crisp output & layout measurements |
| **PSD Composition** | [![ag-psd](https://img.shields.io/badge/PSD_Engine-ag--psd-31A8FF?style=flat-square&logo=adobephotoshop&logoColor=white)](https://github.com/Agamnentzar/ag-psd) | Native Photoshop document engine (generates layered PSDs, vector masks, text styles, effects) |
| **On-Device AI / ML** | [![Hugging Face Transformers.js](https://img.shields.io/badge/HF-Transformers-FFD21E?style=flat-square&logo=huggingface&logoColor=black)](https://github.com/huggingface/transformers.js) [![ONNX Runtime](https://img.shields.io/badge/ONNX-Runtime-005CED?style=flat-square&logo=onnx&logoColor=white)](https://onnxruntime.ai) | Zero-cloud local neural models (BiRefNet, BiRefNet Lite, Guided Filter, DirectML GPU & multi-threaded CPU) |
| **CLI & Watch Engine** | [![Commander.js](https://img.shields.io/badge/CLI-Commander.js-black?style=flat-square&logo=gnubash&logoColor=white)](https://github.com/tj/commander.js) [![Chokidar](https://img.shields.io/badge/Watcher-Chokidar-2ecc71?style=flat-square)](https://github.com/paulmillr/chokidar) | Command-line dispatching, interactive flags, daemon management, and reactive file watching |
| **Testing & Quality** | [![Vitest](https://img.shields.io/badge/Vitest-2.0-729B1B?style=flat-square&logo=vitest&logoColor=white)](https://vitest.dev) | Fast, modern test runner with snapshot, visual regression, and unit test suites |

---

## 📄 License

MIT License • [razy-me](https://github.com/razy-me)
