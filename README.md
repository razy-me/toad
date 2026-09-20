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

</div>

---

## ⚡ Highlights

- 🎨 **Code to PSD**: Generates native Photoshop documents with editable text layers, vector paths, and layer styles.
- 🖨️ **Multi-Format Export**: PNG, JPG, WebP, SVG, and print-ready PDF (bleed margins & crop marks).
- 📐 **Vector & Barcodes**: 1D barcodes (`code128`, `ean13`, `upc`, `code39`) and 2D QR codes out of the box.
- 🎯 **Quality Built-In**: Linter, formatter, WCAG/APCA contrast checker, and anti-slop rules.
- 🔄 **Live Preview**: Instant browser reloads via Server-Sent Events.

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

### ⌨️ Commands
```bash
toad init my-project     # New starter project
toad design.toad         # Compile
toad design.toad -w      # Live browser preview
toad audit design.toad   # Quality & accessibility audit
toad format design.toad  # Auto-format
toad remove-bg <img> <target> # 100% on-device AI background remover (commercial MIT BiRefNet)
toad update                 # Update TOAD to latest version from GitHub
```

---

## 🎨 Example

```toad
>bg = #0f172a;

canvas "Hero" {
    size: 1200px 630px;
    background: >bg;
    export: all;
}

stack #card {
    at: center of canvas;
    size: 600px hug;
    direction: vertical;
    gap: 16px;
    padding: 32px;
    fill: #1e293b;
    radius: 16px;

    text #title {
        content: "Code to Photoshop PSD";
        font-size: 28px;
        font-weight: 800;
        color: #ffffff;
    }

    text #body {
        content: "Editable text, vector curves, and layer styles.";
        font-size: 16px;
        color: #94a3b8;
    }
}
```

---

## 🛠️ Tech Stack & Architecture

| Layer | Technologies | Details & Purpose |
| :--- | :--- | :--- |
| **Runtime & Core** | [![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org) [![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org) | Native ECMAScript Modules (ESM), strict type safety across compiler & engine |
| **Graphics & Rendering** | [![Rust NAPI Canvas](https://img.shields.io/badge/Rust_NAPI-Canvas-DEA584?style=flat-square&logo=rust&logoColor=white)](https://github.com/Brooooooklyn/canvas) | High-performance 2D rasterizer powered by Skia for ultra-crisp output & layout measurements |
| **PSD Composition** | [![ag-psd](https://img.shields.io/badge/PSD_Engine-ag--psd-31A8FF?style=flat-square&logo=adobephotoshop&logoColor=white)](https://github.com/Agamennon/ag-psd) | Native Photoshop document engine (generates layered PSDs, vector masks, text styles) |
| **On-Device AI / ML** | [![Hugging Face Transformers.js](https://img.shields.io/badge/HF-Transformers-FFD21E?style=flat-square&logo=huggingface&logoColor=black)](https://github.com/huggingface/transformers.js) [![ONNX Runtime](https://img.shields.io/badge/ONNX-Runtime-005CED?style=flat-square&logo=onnx&logoColor=white)](https://onnxruntime.ai) | Zero-cloud, local neural models (e.g., commercial MIT BiRefNet for instant background removal) |
| **CLI & Watch Engine** | [![Commander.js](https://img.shields.io/badge/CLI-Commander.js-black?style=flat-square&logo=gnubash&logoColor=white)](https://github.com/tj/commander.js) [![Chokidar](https://img.shields.io/badge/Watcher-Chokidar-2ecc71?style=flat-square)](https://github.com/paulmillr/chokidar) | Command-line dispatching, interactive flags, and reactive file watching for live previews |
| **Testing & Quality** | [![Vitest](https://img.shields.io/badge/Vitest-2.0-729B1B?style=flat-square&logo=vitest&logoColor=white)](https://vitest.dev) | Fast, modern test runner with snapshot, visual regression, and unit test suites |

---

## 📄 License

MIT License • [razy-me](https://github.com/razy-me)

