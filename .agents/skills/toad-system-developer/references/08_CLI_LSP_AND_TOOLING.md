# 08 — CLI, Developer Tooling & LSP

This module covers the Command-Line Interface (CLI), watch mode with Server-Sent Events (SSE) live reload, the static linter, code formatter, and the Language Server Protocol (LSP).

---

## 1. CLI Command Reference

```bash
# 1. Initialize a new project (toad-project-X or custom name)
toad init [project-name]

# 2. Compile & export design (automatic file resolution)
toad banner
toad ./src/banner.toad -f "png, psd" -s 2

# 3. Start Live-Reload Watch Server with web browser preview
toad banner -w

# 4. Run static linter diagnostics
toad lint banner

# 5. Format code automatically — `format` is an alias of `fmt`;
#    lint and fmt accept document NAMES via tiered search
toad fmt banner
```

---

## 2. CLI Flags & Options

| Flag | Long Option | Description | Example |
|---|---|---|---|
| `-f` | `--format <list>` | Output formats: `png`, `jpg`, `webp`, `svg`, `psd`, `image`, `all`; unknown tokens emit a warning and are skipped | `-f all` |
| `-s` | `--scale <num>` | Scaling multiplier (e.g. `1`, `2`, `4`, `0.5`) | `-s 2` |
| `-q` | `--quality <num>` | Quality for JPG/WebP (`1`–`100` or `0.85`) | `-q 90` |
| `-o` | `--out <dir>` | Output directory (defaults to `.toad` file directory) | `-o ./dist` |
| `-w` | `--watch` | Watch mode with SSE hot-reload browser preview | `-w` |
| `-p` | `--port <num>` | Dev/preview server port — default `3000`, auto-increments when busy | `-p 8080` |
| `--dpi` | `--dpi <num>` | Target DPI resolution for physical unit conversion | `--dpi 300` |
| `--bleed`| `--bleed <dim>` | Print bleed margin — accepts `px`, `mm`, `cm`, `in`, `pt`, converted at the canvas `dpi` | `--bleed 3mm` |
| `--fonts`| `--fonts <dir>` | Load local font directory (`.ttf`, `.otf`) | `--fonts ./fonts` |

---

## 3. Live Watch Server & SSE Hot-Reload

When `toad <file> -w` is executed:
1. Engine launches a local HTTP preview server at `http://localhost:3000` (override with `-p/--port`; the port auto-increments when busy).
2. Opens an interactive browser preview with **zoom and pan controls**.
3. Monitors file changes across the entry file and all `@import` dependencies via `chokidar`.
4. Streams re-rendered assets over **Server-Sent Events (SSE)**.
5. Provides an integrated **"Open Folder"** button to open output directories in the OS file explorer.

---

## 4. Linter & Diagnostics Engine (`toad lint`)

### Parser & Linter Codes:
* **Parser errors:** reported with a line/column snippet and caret `^`.
* **`LINT-DUPLICATE-ID`**: Duplicate element ID (e.g. two elements with `#header`; last one wins).
* **`LINT-UNUSED-PARAM`**: Declared but unused component parameter.
* **`LINT-UNDECLARED-VAR`**: Undeclared variable reference (e.g. `color: >unknown;`).
* **`LINT-INVALID-RELATION`**: Invalid relational anchor/target.
* **`LINT-INVALID-MASK-TARGET`:** `mask:` references a non-existent or invalid target.
* **`LINT-UNUSED-VAR`**: Declared variable that is never referenced.
* **`LINT-UNKNOWN-UNIT`**: Unknown unit token.
* Unknown **properties** are not lint codes — the resolver emits a warning with a suggestion ("Did you mean …").
* **`CyclicDependencyError`**: Layout cycle — message format `Cyclic layout dependency cycle detected: #a -> #b -> #a`.

---

## 5. Language Server Protocol (LSP)

A real stdio JSON-RPC LSP server ships with the compiler — launch it with `node dist/tools/lsp/server.js` (source: `src/tools/lsp/server.ts`):
* **Diagnostics:** Pushed to the editor (syntax errors and lint findings) as wavy underlines.
* **Hover:** Resolved values for variables, `>` variable references, and properties.
* **Go-to-Definition:** Jumps from a variable reference (`>var`) to its declaration.
* **Auto-Completion:** Known property names plus declared variables.
