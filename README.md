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
toad remove-bg <img> <dir> # Smart on-device AI background remover (files & folders)
toad update              # Update TOAD to latest version from GitHub
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

## 📄 License

MIT License • [razy-me](https://github.com/razy-me)

