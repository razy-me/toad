# TOAD Website & Documentation Showcase

A modern, high-performance web application built with **Next.js 14**, **Tailwind CSS**, and **Lucide React** serving as the official showcase, interactive playground, and documentation viewer for the **TOAD DSL** (Declarative Visual Design Language & Compiler).

---

## Features

- 🎮 **Interactive Playground**: Test and edit `.toad` design snippets directly in the browser with live feedback.
- 🖼️ **Visual Showcase**: Side-by-side gallery of real-world production outputs exported across formats (**SVG**, **PNG**, **PSD**, **WebP**).
- 📖 **Embedded Documentation**: Complete searchable documentation viewer covering language syntax, layout systems, typography, and exporters.
- ⚡ **Tailwind & Dark Theme**: Sleek dark-mode aesthetic tuned with TOAD's official brand design tokens.

---

## Project Structure

```
website/
├── public/              # Static assets, brand icons, and rendered showcase fixtures
│   ├── brand/           # Official TOAD app icons & master logos (PNG, SVG, PSD)
│   └── fixtures/        # Pre-rendered production outputs (posters, banners, mockups)
├── src/
│   ├── app/             # Next.js App Router pages
│   │   ├── page.tsx          # Landing page with hero, terminal demo, and features
│   │   ├── docs/             # Searchable documentation viewer
│   │   ├── playground/       # Interactive online code editor & preview
│   │   └── showcase/         # Multi-format production gallery
│   ├── components/      # UI components (Hero, TerminalDemo, Navbar, Footer, etc.)
│   ├── lib/             # Brand tokens, documentation data, and sample snippets
│   └── styles/          # Tailwind globals and typography styles
├── package.json
└── tailwind.config.ts
```

---

## Getting Started

### Prerequisites
- Node.js `>=20.0.0`
- npm (or yarn / pnpm)

### Development

Install dependencies and start the local development server:

```bash
# Inside the website/ directory
npm install
npm run dev
```

Open [http://localhost:3030](http://localhost:3030) in your browser.

### Production Build

```bash
npm run build
npm run start
```
