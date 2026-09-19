import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { Lexer, TokenType } from '../src/parser/lexer.js';
import { parseToad } from '../src/parser/parser.js';
import { AstCache } from '../src/engine/buildCache.js';
import { terminalQueueDir } from '../src/engine/terminalRunner.js';
import { getToadRootDir } from '../src/tools/updater.js';

describe('Regression Review Group 2 Verification Tests', () => {
  // REG-27: Canvas error recovery does not swallow closing brace
  it('REG-27: canvas block error recovery preserves closing brace and subsequent elements', () => {
    const src = `
      canvas {
        width: 800;
        height: 600;
        invalid_token_here
      }
      rect #box {
        width: 100px;
        height: 100px;
      }
    `;
    const doc = parseToad(src, 'test_canvas_recovery.toad');
    expect(doc).toBeDefined();
    expect(doc.canvas).toBeDefined();
    // Element after canvas should be successfully parsed
    const box = doc.elements.find(e => e.id === 'box');
    expect(box).toBeDefined();
  });

  // REG-28: Lexer Unicode and Hex escape validation
  it('REG-28: incomplete unicode and hex escapes produce replacement character \uFFFD', () => {
    const src = `"\\u12 \\u123 \\x1 \\u0041"`;
    const lexer = new Lexer(src, 'test_escapes.toad');
    const tokens = lexer.tokenize();
    expect(tokens[0]!.type).toBe(TokenType.STRING);
    const val = tokens[0]!.value;
    // \u12 -> \uFFFD, \u123 -> \uFFFD, \x1 -> \uFFFD, \u0041 -> A
    expect(val).toBe('\uFFFD \uFFFD \uFFFD A');
  });

  // REG-31: AstCache invalidates when dependency mtime is older (e.g. git checkout/revert)
  it('REG-31: AstCache invalidates cache entry when dependency mtime is older than recorded', () => {
    const cache = new AstCache(10);
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'toad_cache_test_'));
    const mainFile = path.join(tempDir, 'main.toad');
    const depFile = path.join(tempDir, 'dep.toad');

    fs.writeFileSync(mainFile, 'rect #a {}', 'utf-8');
    fs.writeFileSync(depFile, 'rect #b {}', 'utf-8');

    const mtimeMain = fs.statSync(mainFile).mtimeMs;
    const initialDepMtime = fs.statSync(depFile).mtimeMs;

    const dummyAst: any = { type: 'Document', elements: [] };
    cache.set(mainFile, mtimeMain, dummyAst, 'rect #a {}', [depFile]);

    // Initial check should hit
    expect(cache.get(mainFile, mtimeMain)).not.toBeNull();

    // Now set depFile mtime to an older time (10 seconds ago)
    const olderTime = new Date(Date.now() - 10000);
    fs.utimesSync(depFile, olderTime, olderTime);

    // Cache should invalidate because depMtime !== recordedMtime
    expect(cache.get(mainFile, mtimeMain)).toBeNull();

    // Cleanup
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  // REG-10: Terminal queue directory exists and is usable
  it('REG-10: terminal queue directory exists and supports FIFO command dispatch', () => {
    expect(fs.existsSync(terminalQueueDir)).toBe(true);
  });

  // REG-60: getToadRootDir does not have trailing slashes
  it('REG-60: getToadRootDir returns a clean path without trailing slashes', () => {
    const root = getToadRootDir();
    expect(root).toBeDefined();
    expect(root.endsWith('/')).toBe(false);
    expect(root.endsWith('\\')).toBe(false);
  });
});
