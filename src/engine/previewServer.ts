/**
 * src/engine/previewServer.ts
 * Lightweight, zero-dependency HTTP server with Server-Sent Events (SSE) for live design preview and hot reload.
 */

import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawn } from 'node:child_process';
import { BuildResult } from '../build.js';
import { auditDesign } from '../tools/designAuditor.js';

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
  preferredPort = 3000,
  hostBinding?: string
): Promise<PreviewServerInstance> {
  return new Promise((resolve, reject) => {
    let currentResult = initialResult;
    let currentError: string | null = null;
    const sseClients = new Set<http.ServerResponse>();
    const host = hostBinding || process.env.TOAD_HOST || process.env.HOST || '127.0.0.1';

    const computeAuditSafe = (res: BuildResult | null) => {
      if (!res || !res.layout) return undefined;
      try {
        return auditDesign(res.layout, undefined, path.basename(entryFilePath));
      } catch {
        return undefined;
      }
    };

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
        const origin = req.headers.origin;
        let allowedOrigin = '';
        if (origin) {
          try {
            const parsedOrigin = new URL(origin);
            if (['localhost', '127.0.0.1', '::1', '[::1]'].includes(parsedOrigin.hostname.toLowerCase())) {
              allowedOrigin = origin;
            }
          } catch {}
        }
        const sseHeaders: Record<string, string> = {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive'
        };
        if (allowedOrigin) {
          sseHeaders['Access-Control-Allow-Origin'] = allowedOrigin;
        }
        res.writeHead(200, sseHeaders);
        res.write('\n');
        sseClients.add(res);

        if (currentResult) {
          res.write(`data: ${JSON.stringify({
            status: 'ok',
            time: Date.now(),
            duration: currentResult.durationMs,
            width: currentResult.canvas.width,
            height: currentResult.canvas.height,
            filename: path.basename(entryFilePath),
            audit: computeAuditSafe(currentResult)
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
      // Hardening: only same-origin loopback POST requests may trigger OS actions.
      if (url.pathname === '/api/open-folder' || url.pathname === '/open-folder') {
        const origin = req.headers.origin;
        const reqHost = req.headers.host || '';
        let originOk = true;

        // Verify Host header cannot be rebound to external domain
        const hostHostname = reqHost.split(':')[0]!.toLowerCase();
        const isLoopbackHost = ['localhost', '127.0.0.1', '::1', '[::1]', host.toLowerCase()].includes(hostHostname);
        if (!isLoopbackHost) {
          originOk = false;
        }

        if (origin) {
          try {
            const parsedOrigin = new URL(origin);
            const isLoopbackOrigin = ['localhost', '127.0.0.1', '::1', '[::1]', host.toLowerCase()].includes(parsedOrigin.hostname.toLowerCase());
            originOk = originOk && isLoopbackOrigin && Boolean(parsedOrigin.host.toLowerCase() === reqHost.toLowerCase());
          } catch {
            originOk = false;
          }
        }
        const secFetchSite = req.headers['sec-fetch-site'];
        if (secFetchSite === 'cross-site') {
          originOk = false;
        }
        if (req.method !== 'POST' || !originOk) {
          res.writeHead(405, {
            'Content-Type': 'application/json',
            'Allow': 'POST'
          });
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

      // 4. Design Audit API Endpoint
      if (url.pathname === '/api/audit') {
        const audit = computeAuditSafe(currentResult);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(audit || { status: 'no_data' }));
        return;
      }

      // 5. HTML Single Page Preview App
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
      server.listen(port, host, () => {
        // Honour ephemeral ports (port 0): report the OS-assigned port so
        // callers can actually reach the server.
        const addr = server.address();
        const actualPort = typeof addr === 'object' && addr ? addr.port : port;
        const displayHost = (host === '0.0.0.0' || host === '::') ? 'localhost' : host;
        const url = `http://${displayHost}:${actualPort}/`;
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
              filename: path.basename(entryFilePath),
              audit: computeAuditSafe(result)
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
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return;
    }
    // Prevent command injection: reject shell metacharacters
    if (/[\`\"\|\^\<\>\r\n\$\&\%]/.test(url)) {
      return;
    }

    let child;
    if (process.platform === 'win32') {
      child = spawn('cmd.exe', ['/c', 'start', '""', parsed.href], { detached: true, stdio: 'ignore' });
    } else if (process.platform === 'darwin') {
      child = spawn('open', [parsed.href], { detached: true, stdio: 'ignore' });
    } else {
      child = spawn('xdg-open', [parsed.href], { detached: true, stdio: 'ignore' });
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
<html lang="en">
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

    .view-tabs {
      display: flex;
      gap: 4px;
      background: rgba(0, 0, 0, 0.3);
      padding: 3px;
      border-radius: 8px;
      border: 1px solid var(--border);
    }
    .tab-btn {
      background: transparent;
      border: none;
      padding: 4px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      color: var(--text-dim);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s;
    }
    .tab-btn.active {
      background: rgba(255, 255, 255, 0.1);
      color: var(--text);
    }
    .audit-pill {
      font-size: 10px;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 10px;
      background: #10b981;
      color: #000;
    }
    .audit-card {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 18px;
      margin-bottom: 16px;
    }
    .audit-bar-bg {
      width: 100%;
      height: 8px;
      background: rgba(255, 255, 255, 0.08);
      border-radius: 4px;
      overflow: hidden;
      margin: 8px 0;
    }
    .audit-bar-fill {
      height: 100%;
      background: #10b981;
      border-radius: 4px;
      transition: width 0.3s;
    }
    .issue-item {
      padding: 10px 14px;
      border-radius: 6px;
      margin-top: 8px;
      font-size: 12px;
      background: rgba(255, 255, 255, 0.03);
      border-left: 3px solid #f59e0b;
    }
    .issue-error {
      border-left-color: #ef4444;
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

    <div class="view-tabs">
      <button id="tab-canvas" class="tab-btn active" onclick="switchTab('canvas')">🖼 Artboard</button>
      <button id="tab-audit" class="tab-btn" onclick="switchTab('audit')">📊 Design Audit <span id="audit-pill" class="audit-pill">--</span></button>
    </div>

    <div class="controls">
      <span class="info-badge" id="canvas-dims">-- × --</span>
      <span class="info-badge" id="render-time">-- ms</span>

      <button id="btn-fit" class="active" onclick="setZoom('fit')">Fit</button>
      <button id="btn-100" onclick="setZoom(1)">100%</button>
      <button onclick="zoomStep(0.2)">+</button>
      <button onclick="zoomStep(-0.2)">-</button>
      <button id="btn-grid" class="active" onclick="toggleGrid()">Grid</button>
      <button id="btn-open-folder" onclick="openFolder()" title="Open folder of the .toad file in File Explorer">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:2px"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>
        Folder
      </button>
    </div>
  </header>

  <main id="stage" class="checkerboard">
    <div class="preview-container" id="container">
      <img id="preview-img" src="/image" alt="toad render preview" />
    </div>
  </main>

  <div id="audit-view" style="display:none; flex:1; overflow-y:auto; padding:24px; background:var(--bg);">
    <div id="audit-content" style="max-width:920px; margin:0 auto; width:100%;">
      <p style="color:var(--text-dim); text-align:center;">Loading Design Audit...</p>
    </div>
  </div>

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

    // Tab Switching
    function switchTab(tab) {
      const stage = document.getElementById('stage');
      const auditView = document.getElementById('audit-view');
      const tabCanvas = document.getElementById('tab-canvas');
      const tabAudit = document.getElementById('tab-audit');

      if (tab === 'canvas') {
        stage.style.display = 'flex';
        auditView.style.display = 'none';
        tabCanvas.classList.add('active');
        tabAudit.classList.remove('active');
        applyZoom();
      } else {
        stage.style.display = 'none';
        auditView.style.display = 'block';
        tabCanvas.classList.remove('active');
        tabAudit.classList.add('active');
        if (!lastAuditData) {
          fetch('/api/audit').then(r => r.json()).then(renderAudit).catch(() => {});
        }
      }
    }

    let lastAuditData = null;

    function renderAudit(audit) {
      if (!audit || audit.status === 'no_data') return;
      lastAuditData = audit;

      const pill = document.getElementById('audit-pill');
      if (pill) {
        pill.innerText = audit.score + '%';
        pill.style.background = audit.score >= 90 ? '#10b981' : (audit.score >= 70 ? '#f59e0b' : '#ef4444');
        pill.style.color = '#000';
      }

      const container = document.getElementById('audit-content');
      if (!container) return;

      const scoreColor = audit.score >= 90 ? '#10b981' : (audit.score >= 70 ? '#f59e0b' : '#ef4444');

      let issuesHtml = '';
      if (!audit.issues || audit.issues.length === 0) {
        issuesHtml = '<div style="text-align:center; padding: 40px 20px; color: var(--success);">' +
          '<div style="font-size:36px; margin-bottom:8px;">✨</div>' +
          '<div style="font-weight:700; font-size:16px;">Excellent! No design or contrast issues found.</div>' +
          '<div style="color:var(--text-dim); font-size:13px; margin-top:4px;">All ' + (audit.stats ? audit.stats.elementsTotal : 0) + ' elements comply with visual design and WCAG 2.2 guidelines.</div>' +
          '</div>';
      } else {
        issuesHtml = audit.issues.map(function(iss) {
          const isErr = iss.type === 'error';
          const icon = isErr ? '⛔' : '⚠️';
          const borderCls = isErr ? 'issue-error' : '';
          const badgeBg = isErr ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)';
          const badgeColor = isErr ? '#ef4444' : '#f59e0b';
          const idPrefix = iss.elementId ? '<code>' + iss.elementId + '</code>: ' : '';
          const detailsSnippet = iss.details ? '<span>' + iss.details + '</span>' : '';
          const recoSnippet = iss.recommendation ? '<span style="display:block; margin-top:4px; color:#38bdf8;">💡 ' + iss.recommendation + '</span>' : '';

          return '<div class="issue-item ' + borderCls + '">' +
            '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">' +
              '<span style="font-weight:700; color:var(--text);">' + icon + ' ' + idPrefix + iss.message + '</span>' +
              '<span style="font-size:10px; font-weight:700; text-transform:uppercase; padding:2px 6px; border-radius:4px; background:' + badgeBg + '; color:' + badgeColor + ';">' + iss.category + '</span>' +
            '</div>' +
            '<div style="color:var(--text-dim); font-size:12px; margin-top:2px;">' +
              detailsSnippet + recoSnippet +
            '</div>' +
          '</div>';
        }).join('');
      }

      const totalElements = audit.stats ? audit.stats.elementsTotal : 0;
      const totalTexts = audit.stats ? audit.stats.textsTotal : 0;
      const totalErrors = audit.stats ? audit.stats.errors : 0;
      const totalWarnings = audit.stats ? audit.stats.warnings : 0;

      container.innerHTML = '<div class="audit-card">' +
        '<div style="display:flex; justify-content:space-between; align-items:baseline;">' +
          '<h2 style="font-size:18px; font-weight:700;">Design Quality &amp; Accessibility Score</h2>' +
          '<span style="font-size:28px; font-weight:800; color:' + scoreColor + ';">' + audit.score + '<span style="font-size:16px; font-weight:600; color:var(--text-dim);"> / 100</span></span>' +
        '</div>' +
        '<div class="audit-bar-bg">' +
          '<div class="audit-bar-fill" style="width: ' + audit.score + '%; background: ' + scoreColor + ';"></div>' +
        '</div>' +
        '<div style="display:flex; gap:16px; margin-top:12px; font-size:12px; color:var(--text-dim); flex-wrap: wrap;">' +
          '<span>Elements: <strong style="color:var(--text);">' + totalElements + '</strong></span>' +
          '<span>Texts: <strong style="color:var(--text);">' + totalTexts + '</strong></span>' +
          '<span>Errors: <strong style="color:#ef4444;">' + totalErrors + '</strong></span>' +
          '<span>Warnings: <strong style="color:#f59e0b;">' + totalWarnings + '</strong></span>' +
          (audit.metrics ? '<span>Whitespace: <strong style="color:#38bdf8;">' + audit.metrics.negativeSpacePercent + '%</strong></span>' : '') +
          (audit.metrics && audit.metrics.slopFindingsCount === 0 ? '<span style="color:#10b981; font-weight:700;">🛡 Slop-Free</span>' : '') +
        '</div>' +
      '</div>' +
      '<div class="audit-card">' +
        '<h3 style="font-size:14px; font-weight:700; margin-bottom:12px; color:var(--text);">Audit Details &amp; Anti-Slop Heuristics</h3>' +
        issuesHtml +
      '</div>';
    }

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

          if (data.audit) {
            renderAudit(data.audit);
          }

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

    // Initial audit fetch
    fetch('/api/audit').then(r => r.json()).then(renderAudit).catch(() => {});
  </script>
</body>
</html>`;
}
