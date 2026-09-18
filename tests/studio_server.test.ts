import { describe, it, expect, afterAll } from 'vitest';
import * as path from 'node:path';
import * as http from 'node:http';
import { createPreviewServer, PreviewServerInstance } from '../src/engine/previewServer.js';
import { generateStudioHtml } from '../src/engine/uiHtml.js';
import {
  saveDaemonInfo,
  getDaemonInfo,
  clearDaemonInfo,
  isStudioServerRunning
} from '../src/engine/studioDaemon.js';

describe('TOAD Studio Server & GUI Suite', () => {
  let serverInstance: PreviewServerInstance | null = null;
  const testPort = 3123;

  afterAll(async () => {
    if (serverInstance) {
      await serverInstance.close();
    }
    clearDaemonInfo();
  });

  it('generates HTML adhering to Anti-AI-Slop and includes parameter deck with 5 tabs', () => {
    const html = generateStudioHtml('test.toad');
    expect(html).toContain('TOAD Studio');
    expect(html).toContain('Grafik & Build');
    expect(html).toContain('Animation');
    expect(html).toContain('Freistellen');
    expect(html).toContain('Konvertieren');
    expect(html).toContain('Qualitäts-Audit');
    expect(html).toContain('Schnell');
    expect(html).toContain('Standard');
    expect(html).toContain('Höchste Präzision');
    expect(html).toContain('split-container');
    expect(html).toContain('progress-bar-wrap');
    // Ensure no purple slop tropes
    expect(html).not.toContain('#8B5CF6!important');
  });

  it('manages daemon info state in ~/.toad/studio-daemon.json', () => {
    clearDaemonInfo();
    expect(getDaemonInfo()).toBeNull();

    saveDaemonInfo({
      pid: 99999,
      port: 3000,
      url: 'http://localhost:3000/',
      startTime: Date.now()
    });

    const info = getDaemonInfo();
    expect(info).toBeDefined();
    expect(info?.pid).toBe(99999);
    expect(info?.port).toBe(3000);

    clearDaemonInfo();
    expect(getDaemonInfo()).toBeNull();
  });

  it('starts preview server in studioMode and handles /api/status, /api/files, /api/workspaces, and /image', async () => {
    const fixturePath = path.resolve('tests/fixtures/social_card.toad');
    serverInstance = await createPreviewServer(null, fixturePath, testPort, '127.0.0.1', true);
    expect(serverInstance.port).toBe(testPort);

    // 1. Check /api/status
    const statusRes = await new Promise<any>((resolve) => {
      http.get(`http://127.0.0.1:${testPort}/api/status`, (res) => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => resolve(JSON.parse(body)));
      });
    });
    expect(statusRes.status).toBe('ok');
    expect(statusRes.version).toBe('1.2.0');

    // 2. Check /api/files
    const filesRes = await new Promise<any>((resolve) => {
      http.get(`http://127.0.0.1:${testPort}/api/files`, (res) => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => resolve(JSON.parse(body)));
      });
    });
    expect(Array.isArray(filesRes.files)).toBe(true);

    // 3. Check /api/workspaces
    const wsRes = await new Promise<any>((resolve) => {
      http.get(`http://127.0.0.1:${testPort}/api/workspaces`, (res) => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => resolve(JSON.parse(body)));
      });
    });
    expect(Array.isArray(wsRes.workspaces)).toBe(true);

    // 4. Check /image?path=...
    const imgStatusCode = await new Promise<number>((resolve) => {
      http.get(`http://127.0.0.1:${testPort}/image?path=${encodeURIComponent(fixturePath)}`, (res) => {
        resolve(res.statusCode || 0);
      });
    });
    expect(imgStatusCode).toBe(200);

    // 5. Check daemon health probe
    const running = await isStudioServerRunning(testPort);
    expect(running).toBe(true);

    // 6. Check /api/image/convert
    const tinyPngBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAAPklEQVR42u3BAQ0AAADCoPdPbQ8HFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB4G9EwAAH5uFmFAAAAAElFTkSuQmCC'; // 100x100 transparent png
    const convertReqPayload = JSON.stringify({
      dataUrl: tinyPngBase64,
      filename: 'sample.png',
      format: 'webp',
      scale: 0.5,
      quality: 80,
      compress: true
    });

    const convertRes = await new Promise<any>((resolve) => {
      const req = http.request({
        hostname: '127.0.0.1',
        port: testPort,
        path: '/api/image/convert',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(convertReqPayload)
        }
      }, (res) => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => resolve(JSON.parse(body)));
      });
      req.write(convertReqPayload);
      req.end();
    });

    expect(convertRes.success).toBe(true);
    expect(convertRes.format).toBe('webp');
    expect(convertRes.width).toBe(50);
    expect(convertRes.height).toBe(50);
    expect(convertRes.dataUrl).toContain('data:image/webp;base64,');
  });
});
