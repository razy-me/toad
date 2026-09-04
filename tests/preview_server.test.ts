import { describe, it, expect, afterEach } from 'vitest';
import * as path from 'node:path';
import * as http from 'node:http';
import { createPreviewServer, PreviewServerInstance } from '../src/engine/previewServer.js';

describe('Preview Server & Live Reload UI', () => {
  let serverInstance: PreviewServerInstance | null = null;

  afterEach(async () => {
    if (serverInstance) {
      await serverInstance.close();
      serverInstance = null;
    }
  });

  it('serves HTML preview containing the Open Folder button', async () => {
    const entryFile = path.resolve('tests/fixtures/sample_banner.toad');
    serverInstance = await createPreviewServer(null, entryFile, 3456);

    const html = await new Promise<string>((resolve, reject) => {
      http.get(`http://localhost:${serverInstance!.port}/`, (res) => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => resolve(body));
      }).on('error', reject);
    });

    expect(html).toContain('id="btn-open-folder"');
    expect(html).toContain('Ordner');
    expect(html).toContain('/api/open-folder');
  });

  it('handles /api/open-folder endpoint and returns folder path', async () => {
    const entryFile = path.resolve('tests/fixtures/sample_banner.toad');
    serverInstance = await createPreviewServer(null, entryFile, 3457);

    const resData = await new Promise<{ status: string; folder: string }>((resolve, reject) => {
      const req = http.request(
        `http://localhost:${serverInstance!.port}/api/open-folder`,
        { method: 'POST' },
        (res) => {
          let body = '';
          res.on('data', chunk => { body += chunk; });
          res.on('end', () => resolve(JSON.parse(body)));
        }
      );
      req.on('error', reject);
      req.end();
    });

    expect(resData.status).toBe('ok');
    expect(resData.folder).toBe(path.dirname(entryFile));
  });
});
