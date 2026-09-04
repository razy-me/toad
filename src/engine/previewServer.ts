/**
 * src/engine/previewServer.ts
 * Lightweight, zero-dependency HTTP server with Server-Sent Events (SSE) for live design preview and hot reload.
 */

import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawn } from 'node:child_process';
import { BuildResult } from '../build.js';

export interface PreviewServerInstance {
  server: http.Server;
  port: number;
  url: string;
  broadcastUpdate: (result: BuildResult) => void;
  broadcastError: (errorMessage: string) => void;
  close: () => Promise<void>;
}

export function createPreviewServer(
  initialResult: BuildResult | null,
  entryFilePath: string,
  preferredPort = 3000
): Promise<PreviewServerInstance> {
  return new Promise((resolve, reject) => {
    let currentResult = initialResult;
    let currentError: string | null = null;
    const sseClients = new Set<http.ServerResponse>();

    const getPrimaryOutputFile = (): string | null => {
      if (!currentResult || !currentResult.outputFiles || currentResult.outputFiles.length === 0) {
        return null;
      }
      const files = currentResult.outputFiles;
      const png = files.find(f => f.endsWith('.png'));
      if (png && fs.existsSync(png)) return png;
      const webp = files.find(f => f.endsWith('.webp'));
      if (webp && fs.existsSync(webp)) return webp;
      const jpg = files.find(f => f.endsWith('.jpg') || f.endsWith('.jpeg'));
      if (jpg && fs.existsSync(jpg)) return jpg;
      const svg = files.find(f => f.endsWith('.svg'));
      if (svg && fs.existsSync(svg)) return svg;
      // Only offer <img>-compatible outputs to the browser. A PSD-only build
      // must not leak binary bytes with an image content-type.
      const previewable = files.filter(f => /\.(png|jpe?g|webp|svg)$/i.test(f));
      return previewable.length > 0 && fs.existsSync(previewable[0]) ? previewable[0] : null;
    };

    const server = http.createServer((req, res) => {
      let url: URL;
      try {
        url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      } catch {
        try {
          url = new URL(req.url || '/', 'http://127.0.0.1');
        } catch {
          res.writeHead(400, { 'Content-Type': 'text/plain' });
          res.end('Bad Request');
          return;
        }
      }

      // 1. SSE Stream
      if (url.pathname === '/events') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*'
        });
        res.write('\n');
        sseClients.add(res);

        if (currentResult) {
          res.write(`data: ${JSON.stringify({
            status: 'ok',
            time: Date.now(),
            duration: currentResult.durationMs,
            width: currentResult.canvas.width,
            height: currentResult.canvas.height,
            filename: path.basename(entryFilePath)
          })}\n\n`);
        } else if (currentError) {
          res.write(`data: ${JSON.stringify({
            status: 'error',
            time: Date.now(),
            message: currentError,
            filename: path.basename(entryFilePath)
          })}\n\n`);
        }

        const cleanup = () => {
          sseClients.delete(res);
        };
        req.on('close', cleanup);
        res.on('close', cleanup);
        res.on('error', cleanup);
        return;
      }

      // 2. Image API Endpoint
      if (url.pathname === '/image') {
        const imgFile = getPrimaryOutputFile();
        if (!imgFile || !fs.existsSync(imgFile)) {
          const produced = (currentResult?.outputFiles || []).map(f => path.extname(f).replace('.', '') || '?').join(', ') || 'nothing yet';
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end(`No browser-previewable output. Current build produced: ${produced}. The live preview supports png, jpg, webp and svg.`);
          return;
        }

        const ext = path.extname(imgFile).toLowerCase();
        let mime = 'image/png';
        if (ext === '.svg') mime = 'image/svg+xml';
        else if (ext === '.webp') mime = 'image/webp';
        else if (ext === '.jpg' || ext === '.jpeg') mime = 'image/jpeg';

        try {
          const imgBuf = fs.readFileSync(imgFile);
          res.writeHead(200, {
            'Content-Type': mime,
            'Content-Length': imgBuf.length,
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
          });
          res.end(imgBuf);
        } catch {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Failed to read image.');
        }
        return;
      }

      // 3. Open Folder API Endpoint
      // Hardening: only same-origin POST requests may trigger OS actions.
      // Without this, any website could CSRF a GET against localhost, and
      // LAN peers could reach the endpoint when bound beyond loopback.
      if (url.pathname === '/api/open-folder' || url.pathname === '/open-folder') {
        const origin = req.headers.origin;
        const host = req.headers.host;
        const originOk = !origin || (host ? origin.endsWith('//'.concat(host)) : false);
        if (req.method !== 'POST' || !originOk) {
          res.writeHead(405, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'error', message: 'Method Not Allowed. Use POST from the preview page.' }));
          return;
        }
        const folderPath = path.dirname(path.resolve(entryFilePath));
        openFolderInExplorer(folderPath);
        res.writeHead(200, {
          'Content-Type': 'application/json'
        });
        res.end(JSON.stringify({ status: 'ok', folder: folderPath }));
        return;
      }

      // 4. HTML Single Page Preview App
      if (url.pathname === '/' || url.pathname === '/index.html') {
        const html = generatePreviewHtml(path.basename(entryFilePath));
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Length': Buffer.byteLength(html),
          'Cache-Control': 'no-cache'
        });
        res.end(html);
        return;
      }

      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    });

    let portAttempts = 0;
    const startListen = (port: number) => {
      // Bind to loopback explicitly: this is a local development preview and
      // must not be reachable from the network by default.
      server.listen(port, '127.0.0.1', () => {
        // Honour ephemeral ports (port 0): report the OS-assigned port so
        // callers can actually reach the server.
        const addr = server.address();
        const actualPort = typeof addr === 'object' && addr ? addr.port : port;
        const url = `http://localhost:${actualPort}/`;
        const instance: PreviewServerInstance = {
          server,
          port: actualPort,
          url,
          broadcastUpdate(result: BuildResult) {
            currentResult = result;
            currentError = null;
            const payload = JSON.stringify({
              status: 'ok',
              time: Date.now(),
              duration: result.durationMs,
              width: result.canvas.width,
              height: result.canvas.height,
              filename: path.basename(entryFilePath)
            });
            for (const client of sseClients) {
              try {
                client.write(`data: ${payload}\n\n`);
              } catch {
                sseClients.delete(client);
              }
            }
          },
          broadcastError(errorMessage: string) {
            currentError = errorMessage;
            const payload = JSON.stringify({
              status: 'error',
              time: Date.now(),
              message: errorMessage,
              filename: path.basename(entryFilePath)
            });
            for (const client of sseClients) {
              try {
                client.write(`data: ${payload}\n\n`);
              } catch {
                sseClients.delete(client);
              }
            }
          },
          close() {
            return new Promise(resClose => {
              for (const client of sseClients) {
                try { client.end(); } catch {}
              }
              sseClients.clear();
              if (typeof (server as any).closeAllConnections === 'function') {
                (server as any).closeAllConnections();
              }
              server.close(() => resClose());
            });
          }
        };
        resolve(instance);
      });
    };

    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE' && portAttempts < 25) {
        // Always advance: retrying the same incremented port forever would
        // spin if that port is also taken.
        portAttempts++;
        startListen(preferredPort + portAttempts);
      } else {
        reject(err);
      }
    });

    startListen(preferredPort);
  });
}

export function openBrowser(url: string): void {
  if (process.env.VITEST || process.env.CI || process.env.NODE_ENV === 'test') {
    return;
  }

  try {
    let child;
    if (process.platform === 'win32') {
      child = spawn('cmd.exe', ['/c', 'start', '""', url], { detached: true, stdio: 'ignore' });
    } else if (process.platform === 'darwin') {
      child = spawn('open', [url], { detached: true, stdio: 'ignore' });
    } else {
      child = spawn('xdg-open', [url], { detached: true, stdio: 'ignore' });
    }
    child?.unref?.();
  } catch {}
}

export function openFolderInExplorer(folderPath: string): void {
  if (process.env.VITEST || process.env.CI || process.env.NODE_ENV === 'test') {
    return;
  }

  try {
    let child;
    if (process.platform === 'win32') {
      child = spawn('explorer.exe', [folderPath], { detached: true, stdio: 'ignore' });
    } else if (process.platform === 'darwin') {
      child = spawn('open', [folderPath], { detached: true, stdio: 'ignore' });
    } else {
      child = spawn('xdg-open', [folderPath], { detached: true, stdio: 'ignore' });
    }
    child?.unref?.();
  } catch {}
}

export function generatePreviewHtml(rawFilename: string): string {
  // The filename is interpolated into HTML in several places; escape it so a
  // crafted file name cannot inject markup into the preview page.
  const filename = String(rawFilename)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>toad Live Preview — ${filename}</title>
  <style>
    :root {
      --bg: #090d16;
      --panel: #0f172a;
      --border: #1e293b;
      --accent: #38bdf8;
      --text: #f8fafc;
      --text-dim: #94a3b8;
      --success: #10b981;
      --error: #ef4444;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    /* Custom Sleek Scrollbars (Replaces native chunky scrollbars) */
    ::-webkit-scrollbar {
      width: 7px;
      height: 7px;
    }
    ::-webkit-scrollbar-track {
      background: transparent;
    }
    ::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.16);
      border-radius: 999px;
      border: 2px solid transparent;
      background-clip: padding-box;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: rgba(255, 255, 255, 0.35);
      background-clip: padding-box;
    }
    ::-webkit-scrollbar-corner {
      background: transparent;
    }

    * {
      scrollbar-width: thin;
      scrollbar-color: rgba(255, 255, 255, 0.18) transparent;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      user-select: none;
    }

    header {
      height: 52px;
      background: var(--panel);
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 16px;
      z-index: 10;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .logo-badge {
      background: linear-gradient(135deg, #38bdf8, #818cf8);
      color: #000;
      font-weight: 800;
      font-size: 11px;
      padding: 3px 8px;
      border-radius: 6px;
      letter-spacing: 0.5px;
    }

    .filename {
      font-size: 14px;
      font-weight: 600;
      color: var(--text);
    }

    .status-pill {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: var(--success);
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.2);
      padding: 3px 10px;
      border-radius: 12px;
    }

    .status-dot {
      width: 7px;
      height: 7px;
      background: var(--success);
      border-radius: 50%;
      box-shadow: 0 0 8px var(--success);
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }

    .controls {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .info-badge {
      font-size: 12px;
      color: var(--text-dim);
      background: rgba(255,255,255,0.05);
      padding: 4px 8px;
      border-radius: 6px;
      font-family: monospace;
    }

    button {
      background: rgba(255,255,255,0.06);
      border: 1px solid var(--border);
      color: var(--text);
      padding: 5px 10px;
      border-radius: 6px;
      font-size: 12px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 5px;
      transition: all 0.15s;
    }

    button:hover {
      background: rgba(255,255,255,0.12);
      border-color: rgba(255,255,255,0.2);
    }

    button.active {
      background: var(--accent);
      color: #000;
      font-weight: 600;
      border-color: var(--accent);
    }

    main {
      flex: 1;
      position: relative;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background-color: var(--bg);
      cursor: grab;
    }

    main:active {
      cursor: grabbing;
    }

    main.checkerboard {
      background-image: 
        linear-gradient(45deg, #111827 25%, transparent 25%), 
        linear-gradient(-45deg, #111827 25%, transparent 25%), 
        linear-gradient(45deg, transparent 75%, #111827 75%), 
        linear-gradient(-45deg, transparent 75%, #111827 75%);
      background-size: 24px 24px;
      background-position: 0 0, 0 12px, 12px -12px, -12px 0px;
    }

    .preview-container {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.08s ease-out;
      transform-origin: center center;
    }

    #preview-img {
      max-width: 100%;
      max-height: 100%;
      box-shadow: 0 25px 60px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.08);
      border-radius: 4px;
      display: block;
      pointer-events: none;
    }

    #error-toast {
      position: absolute;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: #1f1315;
      border: 1px solid var(--error);
      color: #fca5a5;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.8);
      max-width: 800px;
      font-size: 13px;
      display: none;
      z-index: 100;
      font-family: monospace;
      white-space: pre-wrap;
    }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <span class="logo-badge">TOAD</span>
      <span class="filename">${filename}</span>
      <div id="status-box" class="status-pill">
        <span class="status-dot"></span>
        <span id="status-text">Live</span>
      </div>
    </div>

    <div class="controls">
      <span class="info-badge" id="canvas-dims">-- × --</span>
      <span class="info-badge" id="render-time">-- ms</span>

      <button id="btn-fit" class="active" onclick="setZoom('fit')">Fit</button>
      <button id="btn-100" onclick="setZoom(1)">100%</button>
      <button onclick="zoomStep(0.2)">+</button>
      <button onclick="zoomStep(-0.2)">-</button>
      <button id="btn-grid" class="active" onclick="toggleGrid()">Grid</button>
      <button id="btn-open-folder" onclick="openFolder()" title="Ordner der .toad Datei im Datei-Explorer öffnen">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:2px"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>
        Ordner
      </button>
    </div>
  </header>

  <main id="stage" class="checkerboard">
    <div class="preview-container" id="container">
      <img id="preview-img" src="/image" alt="toad render preview" />
    </div>
  </main>

  <div id="error-toast"></div>

  <script>
    let currentZoom = 'fit';
    let scaleValue = 1;
    let panX = 0;
    let panY = 0;
    let isDragging = false;
    let startX = 0;
    let startY = 0;

    function openFolder() {
      const btn = document.getElementById('btn-open-folder');
      if (btn) {
        btn.style.opacity = '0.5';
        setTimeout(() => { btn.style.opacity = '1'; }, 350);
      }
      fetch('/api/open-folder', { method: 'POST' }).catch(err => {
        console.error('Failed to open folder:', err);
      });
    }

    function applyZoom() {
      const container = document.getElementById('container');
      const img = document.getElementById('preview-img');
      const stage = document.getElementById('stage');

      if (currentZoom === 'fit') {
        panX = 0;
        panY = 0;
        stage.style.overflow = 'hidden';
        img.style.maxWidth = (stage.clientWidth - 48) + 'px';
        img.style.maxHeight = (stage.clientHeight - 48) + 'px';
        container.style.transform = 'translate(0px, 0px) scale(1)';
        document.getElementById('btn-fit').classList.add('active');
        document.getElementById('btn-100').classList.remove('active');
      } else {
        stage.style.overflow = 'hidden';
        img.style.maxWidth = 'none';
        img.style.maxHeight = 'none';
        container.style.transform = 'translate(' + panX + 'px, ' + panY + 'px) scale(' + scaleValue + ')';
        document.getElementById('btn-fit').classList.remove('active');
        if (scaleValue === 1 && panX === 0 && panY === 0) {
          document.getElementById('btn-100').classList.add('active');
        } else {
          document.getElementById('btn-100').classList.remove('active');
        }
      }
    }

    function setZoom(mode) {
      if (mode === 'fit') {
        currentZoom = 'fit';
      } else {
        currentZoom = 'manual';
        scaleValue = mode;
        panX = 0;
        panY = 0;
      }
      applyZoom();
    }

    function zoomStep(delta) {
      currentZoom = 'manual';
      scaleValue = Math.max(0.1, Math.min(6, (scaleValue || 1) + delta));
      applyZoom();
    }

    function toggleGrid() {
      const stage = document.getElementById('stage');
      const btn = document.getElementById('btn-grid');
      stage.classList.toggle('checkerboard');
      btn.classList.toggle('active');
    }

    // Pan & Drag Handlers
    const stage = document.getElementById('stage');
    stage.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        isDragging = true;
        startX = e.clientX - panX;
        startY = e.clientY - panY;
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (isDragging) {
        currentZoom = 'manual';
        panX = e.clientX - startX;
        panY = e.clientY - startY;
        applyZoom();
      }
    });

    window.addEventListener('mouseup', () => {
      isDragging = false;
    });

    // Mouse Wheel Zoom
    stage.addEventListener('wheel', (e) => {
      e.preventDefault();
      currentZoom = 'manual';
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
      scaleValue = Math.max(0.1, Math.min(8, scaleValue * zoomFactor));
      applyZoom();
    }, { passive: false });

    window.addEventListener('resize', () => {
      if (currentZoom === 'fit') applyZoom();
    });

    // SSE Live Reload Stream
    const evtSource = new EventSource('/events');

    evtSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.status === 'ok') {
          const img = document.getElementById('preview-img');
          img.src = '/image?t=' + data.time;
          document.getElementById('render-time').innerText = data.duration + 'ms';
          document.getElementById('canvas-dims').innerText = data.width + ' × ' + data.height + ' px';

          document.getElementById('status-box').style.color = 'var(--success)';
          document.getElementById('status-box').style.borderColor = 'rgba(16, 185, 129, 0.2)';
          document.getElementById('status-box').style.background = 'rgba(16, 185, 129, 0.1)';
          document.querySelector('.status-dot').style.background = 'var(--success)';
          document.getElementById('status-text').innerText = 'Live';
          document.getElementById('error-toast').style.display = 'none';

          if (currentZoom === 'fit') {
            setTimeout(applyZoom, 30);
          }
        } else if (data.status === 'error') {
          document.getElementById('status-box').style.color = 'var(--error)';
          document.getElementById('status-box').style.borderColor = 'rgba(239, 68, 68, 0.2)';
          document.getElementById('status-box').style.background = 'rgba(239, 68, 68, 0.1)';
          document.querySelector('.status-dot').style.background = 'var(--error)';
          document.getElementById('status-text').innerText = 'Error';

          const toast = document.getElementById('error-toast');
          toast.innerText = data.message;
          toast.style.display = 'block';
        }
      } catch (err) {
        console.error('Failed to parse SSE message:', err);
      }
    };
  </script>
</body>
</html>`;
}
