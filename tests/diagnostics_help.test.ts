import { describe, it, expect } from 'vitest';
import {
  generateHelpSuggestion,
  formatRustDiagnostic,
  inferErrorCode,
  suggestProperty
} from '../src/tools/diagnostics.js';

describe('Rich Clang/Rust-Style Compiler Diagnostics (Feature 7)', () => {
  it('generates actionable help for colon after offset', () => {
    const line = '  at: below #hero offset: 24px;';
    const help = generateHelpSuggestion(line, 'Syntax error');
    expect(help).toBeDefined();
    expect(help).toContain("Remove the colon after 'offset'");
    expect(help).toContain('offset 24px;');
  });

  it('generates actionable help for variable declared with colon', () => {
    const line = '>brandPrimary: #3b82f6;';
    const help = generateHelpSuggestion(line, 'Unexpected token');
    expect(help).toBeDefined();
    expect(help).toContain("Variables use '='");
    expect(help).toContain('>brandPrimary = #3b82f6;');
  });

  it('generates anti-slop help for display: flex and rgba()', () => {
    const flexHelp = generateHelpSuggestion('display: flex;', 'Parse error');
    expect(flexHelp).toContain('CSS Flexbox is not supported');
    expect(flexHelp).toContain('stack');

    const rgbaHelp = generateHelpSuggestion('fill: rgba(255, 0, 0, 0.5);', 'Parse error');
    expect(rgbaHelp).toContain("toad does not use 'rgba(...)'");
    expect(rgbaHelp).toContain('alpha(');
  });

  it('suggests closest property name for typos', () => {
    expect(suggestProperty('backgroud')).toBe('background');
    expect(suggestProperty('bordeRadius')).toBe('borderRadius');
    expect(suggestProperty('opcity')).toBe('opacity');

    const help = generateHelpSuggestion('  opcity: 0.8;', "Unknown property 'opcity'");
    expect(help).toContain("Did you mean 'opacity'?");
  });

  it('formats full Rust-style diagnostic with line numbers and pointers', () => {
    const source = `canvas {
  size: 800px 600px;
}
rect #box {
  at: below #nav offset: 16px;
  fill: #ff0000;
}`;

    const output = formatRustDiagnostic({
      file: 'src/header.toad',
      line: 5,
      col: 24,
      message: "Unexpected token ':' after 'offset'",
      code: 'TOAD-E001',
      sourceText: source
    });

    const cleanOutput = output.replace(/\x1b\[[0-9;]*m/g, '');
    expect(cleanOutput).toContain('error[TOAD-E001]:');
    expect(cleanOutput).toContain('--> src/header.toad:5:24');
    expect(cleanOutput).toContain('5 |');
    expect(cleanOutput).toContain('at: below #nav offset: 16px;');
    expect(cleanOutput).toContain('^');
    expect(cleanOutput).toContain('= help:');
    expect(cleanOutput).toContain("Remove the colon after 'offset'");
  });
});
