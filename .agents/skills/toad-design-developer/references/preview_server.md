# Toad Preview Server

The Toad Preview Server (`src/engine/previewServer.ts`) is a zero-dependency, lightweight HTTP server using Node.js `node:http`. It is designed for local development, providing a live design preview with hot-reloading.

## Server-Sent Events (SSE) & Hot Reloading
- **Endpoint:** `/events`
- **Mechanism:** The server maintains a `Set` of connected `http.ServerResponse` clients. When a rebuild finishes or fails, the CLI invokes `broadcastUpdate()` or `broadcastError()`, iterating over connected clients to send a JSON payload.
- **Payloads:**
  - Success: `{ status: 'ok', time, duration, width, height, filename }`
  - Error: `{ status: 'error', time, message, filename }`
- **Client Behavior:** The frontend connects via `new EventSource('/events')`. On `status: 'ok'`, it refreshes the image by appending a cache-busting timestamp (`?t=...`) to the `<img>` src attribute, instantly hot-reloading the preview without refreshing the page.

## Endpoints and Routing
- `/` or `/index.html`: Serves the Single Page Application UI. The HTML string is dynamically generated via `generatePreviewHtml(filename)`, embedding CSS and JS for zooming, panning, and SSE connection.
- `/image`: Serves the primary rendered output. It scans the latest build output for browser-compatible formats (PNG, WebP, JPG, SVG) and streams the file from disk with a `no-store, no-cache` header. PSD files are deliberately excluded to prevent browser download prompts.
- `/api/open-folder`: A POST endpoint that uses Node's `child_process.spawn` (`explorer.exe`, `open`, or `xdg-open`) to open the design's directory in the OS file explorer. It includes hardening checks (CORS/Origin validation) to prevent CSRF attacks from external websites targeting `localhost`.

## Developer Tools & UI
The injected HTML UI includes a custom sleak design with:
- **Status Indicator:** Shows green ("Live") or red ("Error") based on SSE payloads.
- **Render Stats:** Displays render duration (`ms`) and output canvas dimensions.
- **Canvas Controls:** Built-in JS for panning (drag-and-drop), zooming (scroll wheel and buttons), and a toggleable checkerboard grid for transparency visualization.
- **Error Toast:** When a compiler error occurs, it surfaces the formatted ANSI-like error stack directly in the UI as a toast popup, rather than breaking the image view.
- **Network Binding:** Binds strictly to loopback (`127.0.0.1`) for security, falling back to ephemeral ports if the preferred port (3000) is occupied.
