# toad

> Declarative design language and compiler that compiles code into **PNG, JPG, WebP, SVG, PDF**, and fully layered, editable Photoshop **PSD** files.

[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.0.0-339933.svg?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![Tests](https://img.shields.io/badge/Tests-1234%20Passing-10b981.svg?style=flat-square&logo=vitest&logoColor=white)](./tests)
[![Formats](https://img.shields.io/badge/Export-PNG%20%7C%20SVG%20%7C%20PSD%20%7C%20PDF%20%7C%20WebP%20%7C%20JPG-38bdf8.svg?style=flat-square)](https://github.com/razy-me/toad)

---

## ⚡ Highlights

- 🤖 **AI to Layered PSD**: Turns declarative code into native Photoshop documents with editable text layers, vector Bézier paths, and real layer styles.
- 📐 **Vector & Barcode Subsystems**: Built-in 1D barcodes (`code128`, `ean13`, `upc`, `code39`) and 2D QR codes as native vector paths.
- 🖨️ **Prepress & Print-Ready**: PDF export with bleed margins, crop marks, and CMYK color space support.
- 🎯 **Design Quality Gate**: Built-in linter, formatter, WCAG/APCA contrast auditing, and 50+ Anti-AI-Slop heuristics.
- 🔄 **Live Hot Reload**: Instant browser preview via Server-Sent Events (SSE).

---

## 🚀 Quickstart

```bash
# Install
git clone https://github.com/razy-me/toad.git
cd toad && npm install && npm run build && npm link

# Usage
toad init my-project     # Scaffolds a new starter project
toad design.toad         # Compiles declared formats
toad design.toad -w      # Live browser preview with hot reload
toad design.toad -s 2    # Export at 2x resolution
toad audit design.toad   # Runs quality, accessibility & anti-slop audit
toad format design.toad  # Auto-formats source code
```

---

## 🎨 Example

```toad
>bg = #0f172a;
>accent = #38bdf8;

canvas "Hero" {
    size: 1200px 630px;
    background: >bg;
    export: all; // PNG, JPG, WebP, SVG, PDF, PSD
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

## 🧪 Verification

```bash
npm test    # 1,234 tests across 98 test suites (Vitest)
```

## 📄 License

MIT License • Created by [razy-me](https://github.com/razy-me)

