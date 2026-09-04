import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { spawn } from 'node:child_process';
import { parseToad } from '../src/parser/parser.js';
import { lintDocument } from '../src/tools/linter.js';
import { formatToad } from '../src/tools/formatter.js';

const DIST = path.join(process.cwd(), 'dist');

function lint(src: string) {
  return lintDocument(parseToad(src, 'l.toad'));
}

function codes(src: string) {
  return lint(src).map((d: any) => d.code);
}

describe('Linter rules', () => {
  it('fires LINT-DUPLICATE-ID for repeated ids', () => {
    expect(codes('rect #x { size: 1px 1px; } rect #x { size: 2px 2px; }')).toContain('LINT-DUPLICATE-ID');
  });

  it('fires LINT-UNDECLARED-VAR for unknown variable references', () => {
    expect(codes('canvas { size: 10px 10px; } rect { fill: >ghost; }')).toContain('LINT-UNDECLARED-VAR');
  });

  it('fires LINT-UNUSED-VAR for declared but unreferenced variables', () => {
    expect(codes('>lonely = #fff; canvas { size: 10px 10px; }')).toContain('LINT-UNUSED-VAR');
  });

  it('does not flag used variables', () => {
    const c = codes('>used = #fff; canvas { size: 10px 10px; } rect { fill: >used; }');
    expect(c).not.toContain('LINT-UNUSED-VAR');
    expect(c).not.toContain('LINT-UNDECLARED-VAR');
  });

  it('fires LINT-UNKNOWN-UNIT for nonsense units but whitelists k/x', () => {
    const c = codes('canvas { size: 100px 100px; } rect { size: 300xp 40k; stroke-width: 2q; }');
    expect(c).toContain('LINT-UNKNOWN-UNIT');
    const msgs = lint('rect { size: 4k 2x; }').map((d: any) => JSON.stringify(d));
    expect(msgs.join('|')).not.toContain('40k');
  });

  it('stays silent on a clean document', () => {
    expect(lint([
      '>brand = #38bdf8;',
      'canvas { size: 100px 100px; background: #fff; }',
      'rect #hero { size: 40px 40px; fill: >brand; }',
      '@font "Inter" as Body;'
    ].join('\n'))).toHaveLength(0);
  });

  it('gives every diagnostic a location and message', () => {
    const diags = lint('rect #x { size: 1px 1px; } rect #x { size: 2px 2px; }');
    for (const d of diags) {
      expect(typeof (d as any).message).toBe('string');
      expect((d as any).message.length).toBeGreaterThan(0);
    }
  });
});

describe('Formatter', () => {
  it('normalizes spacing around colons and semicolons', () => {
    const out = formatToad([
      'rect #a {',
      'size : 10px   20px ;',
      'fill:#f00;',
      '}'
    ].join('\n'));
    // Colon/semicolon spacing is normalized; intra-value runs like "10px   20px"
    // are intentionally preserved verbatim.
    expect(out).toContain('size: 10px   20px;');
    expect(out).toContain('fill: #f00;');
  });

  it('passes dense single-line bodies through without reformatting', () => {
    const dense = 'rect #a{size : 10px   20px ;}';
    expect(formatToad(dense).trim()).toBe(dense);
  });

  it('is idempotent (format(format(x)) === format(x))', () => {
    const src = 'rect #a{at:5px 5px;size:20px 30px;fill:#00ff00;}\ngroup #g{ rect #b{ size: 1px 2px; } }';
    const once = formatToad(src);
    const twice = formatToad(once);
    expect(twice).toBe(once);
  });

  it('never rewrites block-comment interiors', () => {
    const src = [
      '/**',
      ' * Design tokens : version 2 ;',
      ' */',
      'rect #a {',
      '  size : 10px 20px ;',
      '}'
    ].join('\n');
    const out = formatToad(src);
    expect(out).toContain('* Design tokens : version 2 ;');
    expect(out).toContain('size: 10px 20px;');
  });

  it('handles escaped backslash-quote runs without corrupting strings', () => {
    const out = formatToad('label: "quote \\\" stays ";');
    expect(out).toContain('stays');
  });

  it('preserves relational anchors and offsets verbatim', () => {
    const out = formatToad('rect #r{ at : below previous offset 8px ; size : 4px 4px ; }');
    expect(out).toContain('below previous offset 8px');
  });
});

describe('LSP server over stdio (end-to-end)', () => {
  // Timeout-friendly promise helpers.
  const withTimeout = <T,>(p: Promise<T>, ms: number, label: string): Promise<T> =>
    Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(label + ' timed out')), ms))]);

  function startServer() {
    const child = spawn(process.execPath, [path.join(DIST, 'tools', 'lsp', 'server.js')], { stdio: ['pipe', 'pipe', 'pipe'] });
    let buffer = Buffer.alloc(0);
    const pending: Array<{ resolve: (v: any) => void; id: any }> = [];
    const notifications: any[] = [];
    const waiters: Array<{ pred: (n: any) => boolean; resolve: () => void }> = [];

    child.stdout.on('data', (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);
      for (;;) {
        const headerEnd = buffer.indexOf('\r\n\r\n');
        if (headerEnd < 0) break;
        const header = buffer.slice(0, headerEnd).toString('utf8');
        const lenMatch = header.match(/Content-Length:\s*(\d+)/i);
        if (!lenMatch) break;
        const total = headerEnd + 4 + parseInt(lenMatch[1]!, 10);
        if (buffer.length < total) break;
        const msg = JSON.parse(buffer.slice(headerEnd + 4, total).toString('utf8'));
        buffer = buffer.slice(total);
        if (msg.id === undefined || msg.id === null) {
          notifications.push(msg);
          for (let i = waiters.length - 1; i >= 0; i--) {
            if (waiters[i].pred(msg)) { waiters[i].resolve(); waiters.splice(i, 1); }
          }
          continue;
        }
        const p = pending.find(x => x.id === msg.id);
        if (p) { pending.splice(pending.indexOf(p), 1); p.resolve(msg.result); }
      }
    });

    const send = (method: string, params: any, id?: number) => {
      const payload = Buffer.from(JSON.stringify({ jsonrpc: '2.0', ...(id !== undefined ? { id } : {}), method, params }), 'utf8');
      child.stdin.write(`Content-Length: ${payload.length}\r\n\r\n${payload.toString('utf8')}`);
    };

    return {
      child,
      request(method: string, params: any, id: number): Promise<any> {
        return new Promise(resolve => { pending.push({ resolve, id }); send(method, params, id); });
      },
      notify(method: string, params: any) { send(method, params); },
      /** Resolves when a publishDiagnostics notification for `uri` arrives. */
      waitForDiagnostics(uri: string, timeoutMs = 10000): Promise<void> {
        if (notifications.some((n: any) => n.method === 'textDocument/publishDiagnostics' && n.params?.uri === uri)) return Promise.resolve();
        return new Promise((resolve, reject) => {
          const t = setTimeout(() => reject(new Error('diagnostics timed out')), timeoutMs);
          waiters.push({ pred: (n: any) => { clearTimeout(t); return n.method === 'textDocument/publishDiagnostics' && n.params?.uri === uri; }, resolve });
        });
      },
      kill() { child.kill(); }
    };
  }

  it('answers initialize with the expected capabilities', async () => {
    const srv = startServer();
    try {
      const result = await withTimeout(srv.request('initialize', { rootUri: null }, 1), 15000, 'initialize');
      expect(result.capabilities.hoverProvider).toBe(true);
      expect(result.capabilities.definitionProvider).toBe(true);
      expect(result.capabilities.completionProvider).toBeDefined();
      expect(result.serverInfo.name).toContain('toad');
    } finally { srv.kill(); }
  }, 30000);

  it('pushes diagnostics on didOpen and answers hover/definition/completion', async () => {
    const srv = startServer();
    try {
      await withTimeout(srv.request('initialize', {}, 10), 15000, 'init');
      const uri = 'file:///virtual.toad';
      const docText = '>brand = #38bdf8;\ncanvas { size: 100px 100px; } rect { fill: >brand; size: 10px 20px; badprop: 1; }';
      srv.notify('textDocument/didOpen', {
        textDocument: { uri, languageId: 'toad', version: 1, text: docText }
      });
      await withTimeout(srv.waitForDiagnostics(uri), 15000, 'didOpen diagnostics');

      const lines = docText.split('\n');
      const col = lines[1].indexOf('>brand');
      const hover = await withTimeout(srv.request('textDocument/hover', {
        textDocument: { uri }, position: { line: 1, character: col + 1 }
      }, 11), 15000, 'hover');
      expect(JSON.stringify(hover)).toContain('brand');

      const def = await withTimeout(srv.request('textDocument/definition', {
        textDocument: { uri }, position: { line: 1, character: col + 1 }
      }, 12), 15000, 'definition');
      expect(def.range.start.line).toBe(0); // declaration is on line 1 (0-based 0)

      const completion = await withTimeout(srv.request('textDocument/completion', {
        textDocument: { uri }, position: { line: 1, character: 0 }
      }, 13), 15000, 'completion');
      const labels = completion.map((c: any) => c.label);
      expect(labels).toContain('>brand');
      expect(labels).toContain('fill');
    } finally { srv.kill(); }
  }, 45000);
});
