# Toad CLI & Tooling

The `toad` CLI is built using Commander (`commander`) and acts as the entry point for compiling, developing, and scaffolding Toad design projects. 

## CLI Commands

### 1. `build [entry]`
The default command used to compile a `.toad` file into output formats.
- **Formats supported:** PNG, JPG, WebP, SVG, and PSD.
- **Flags & Configuration:**
  - `-s, --scale <number>`: Raster render scale factor.
  - `-f, --format <formats...>`: Defines the output format(s).
  - `-o, --out <dir>`: Output directory.
  - `--fonts <dir>`: Directory for custom fonts.
  - `-w, --watch`: Enables watch mode via `chokidar`.
  - `-q, --quality <number>`: JPEG/WebP compression quality.
  - `--dpi <number>`: Target output resolution.
  - `--bleed <dimension>`: Print bleed margin override.
- **Runtime Behavior:** Resolves the entry file, invokes `compileToad`, and logs output file sizes and dimensions. If `--watch` is passed, it transitions into watch mode.

### 2. `dev [entry]`
Starts a local development server for live previewing designs.
- **Flags:** Inherits all `build` flags and automatically enforces watch mode.
- **Preview Server:** Adds `-p, --port <number>` (default: 3000) to host the live preview server. It launches the browser automatically on start.

### 3. `init [name]`
Scaffolds a new toad project. Invokes `runInit(name)` from `scaffold.js`.

*(Additional commands include `format` / `fmt` for code formatting and `lint` for static analysis.)*

## Watch Mode Engine
When watch mode is enabled (either via `build -w` or `dev`), the CLI utilizes `chokidar` to monitor the entry file and its transitive dependencies.
- **Dependency Tracking:** On every successful build, it updates the `chokidar` watcher with any new file dependencies (and removes unused ones).
- **Hot Reload Integration:** It triggers `triggerBuild()` on file changes, recompiles the asset, and then calls `previewServer.broadcastUpdate(result)` or `broadcastError(err)` to push Server-Sent Events (SSE) to the browser.

## Package Tooling
The project relies on standard npm scripts (`build`, `watch`, `test`, `start`) and is built as a pure ESM Node module. It uses Vite (`vitest`) for testing. Key dependencies include `@napi-rs/canvas` for rendering, `ag-psd` for Photoshop export, and `chokidar` for file watching.
