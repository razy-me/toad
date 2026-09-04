/**
 * tests/review_fixes_tools.test.ts
 * Regression coverage for tooling fixes: strict CLI auto-run detection,
 * scaffold error handling, preview server hardening (405 + escaping) and
 * formatter idempotency / string safety.
 */
import { describe, it, expect, afterEach } from 'vitest';
import * as http from 'node:http';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { shouldAutoRun } from '../src/cli.js';
import { runInit } from '../src/scaffold.js';
import { formatToad } from '../src/tools/formatter.js';
import { createPreviewServer, generatePreviewHtml, PreviewServerInstance } from '../src/engine/previewServer.js';

function httpStatus(url: string, method: string, headers: Record<string, string> = {}): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method, headers }, (res) => {
      res.resume();
      resolve(res.statusCode ?? 0);
    });
    req.on('error', reject);
    req.end();
  });
}

describe('Review fixes: CLI auto-run detection', () => {
  it('accepts the real module path and package bin shims', () => {
    // This module itself (src/cli.ts loaded by vitest) is a valid entry.
    expect(shouldAutoRun(fileURLToPath(import.meta.url))).toBe(false); // different file
    const cliModulePath = fileURLToPath(new URL('../src/cli.js', import.meta.url));
    void cliModulePath;
    expect(shouldAutoRun('C:\\tools\\toad\\dist\\cli.js')).toBe(true);
    expect(shouldAutoRun('/usr/local/bin/toad')).toBe(true);
    expect(shouldAutoRun('/usr/local/bin/toad.js')).toBe(true);
    expect(shouldAutoRun('C:\\x\\y\\cli.cjs')).toBe(true);
    expect(shouldAutoRun('C:\\x\\y\\cli.mjs')).toBe(true);
    expect(shouldAutoRun('C:\\x\\y\\cli.js')).toBe(true);
  });

  it("rejects launchers that merely start with 'cli' or unrelated binaries", () => {
    expect(shouldAutoRun('C:\\apps\\mycli.js')).toBe(false);
    expect(shouldAutoRun('C:\\apps\\client.exe')).toBe(false);
    expect(shouldAutoRun('/opt/toolbox/toadgui.js')).toBe(false);
    expect(shouldAutoRun('/opt/toolbox/clippy.ts')).toBe(false);
    expect(shouldAutoRun(undefined)).toBe(false);
    expect(shouldAutoRun('')).toBe(false);
  });

  it('accepts the exact compiled module path via URL equivalence', () => {
    // Path equality branch: resolving the CLI source itself must match,
    // regardless of separator style.
    const p = fileURLToPath(new URL('../src/cli.ts', import.meta.url));
    expect(shouldAutoRun(p)).toBe(true);
  });
});

describe('Review fixes: scaffold error handling', () => {
  it('throws a descriptive error for existing directories instead of hard-exiting', () => {
    // node_modules always exists inside the project root (vitest cwd).
    expect(() => runInit('node_modules')).toThrow(/already exists/i);
  });
});

describe('Review fixes: formatter', () => {
  it('is idempotent', () => {
    const src = `canvas { size:   100px  100px; }
rect #a{size:40px   40px;fill:  #ff0000}
group #g { rect #b { size : 10px 10px } }`;
    const once = formatToad(src);
    const twice = formatToad(once);
    expect(twice).toBe(once);
  });

  it('never touches braces that appear inside string literals', () => {
    const src = 'canvas { size: 100px 100px; }\n text #t { content: "keep {these} braces"; }';
    const out = formatToad(src);
    expect(out).toContain('keep {these} braces');
    // Quote parity must be preserved so the document stays parseable.
    const quotes = (out.match(/"/g) ?? []).length;
    expect(quotes % 2).toBe(0);
    // The literal braces inside the string must not be re-indented away.
    expect(out.match(/\{/g)!.length).toBeGreaterThanOrEqual(3);
  });

  it('preserves color values verbatim while keeping output stable', () => {
    const out = formatToad('rect #r { size:20px   30px ; fill:#00ff00 }');
    expect(out.toLowerCase()).toContain('#00ff00');
    expect(formatToad(out)).toBe(out);
  });
});

describe('Review fixes: preview server hardening', () => {
  const servers: PreviewServerInstance[] = [];

  afterEach(async () => {
    while (servers.length) {
      await servers.pop()!.close();
    }
  });

  it('rejects cross-origin / GET open-folder requests with 405', async () => {
    const entryFile = path.resolve('tests/fixtures/sample_banner.toad');
    const srv = await createPreviewServer(null, entryFile, 0);
    servers.push(srv);
    const base = `http://127.0.0.1:${srv.port}`;
    // GET without Origin header: previously executed explorer.exe!
    const getSt = await httpStatus(base + '/api/open-folder', 'GET');
    expect(getSt).toBe(405);
    // Cross-site origin must never trigger OS actions either.
    expect(await httpStatus(base + '/api/open-folder', 'POST', { Origin: 'https://evil.example' })).toBe(405);
  });

  it('still serves the preview page on the loopback interface', async () => {
    const entryFile = path.resolve('tests/fixtures/sample_banner.toad');
    const srv = await createPreviewServer(null, entryFile, 0);
    servers.push(srv);
    const status = await new Promise<number>((resolve, reject) => {
      http.get(`http://127.0.0.1:${srv.port}/`, (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      }).on('error', reject);
    });
    expect(status).toBe(200);
  });

  it('escapes HTML-significant characters in generated filenames', () => {
    const hostile = '"><img src=x onerror=alert(1)>.toad';
    const html = generatePreviewHtml(hostile);
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img');
    // Benign names pass through unchanged.
    expect(generatePreviewHtml('card.toad')).toContain('card.toad');
  });
});
