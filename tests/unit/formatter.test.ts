import { describe, it, expect } from 'vitest';
import { formatToad } from '../../src/tools/formatter.js';

describe('Unit Tests: Formatter (formatToad)', () => {
  it('formats unindented blocks with default 2-space indentation', () => {
    const unformatted = `
canvas {
size: 800px 600px;
background: #0f172a;
}
rect #box {
size: 100px 100px;
fill: #38bdf8;
}
`;
    const formatted = formatToad(unformatted);
    expect(formatted).toBe([
      'canvas {',
      '  size: 800px 600px;',
      '  background: #0f172a;',
      '}',
      'rect #box {',
      '  size: 100px 100px;',
      '  fill: #38bdf8;',
      '}',
      ''
    ].join('\n'));
  });

  it('supports custom tabSize configuration', () => {
    const unformatted = 'canvas {\nsize: 800px 600px;\n}';
    const formatted4 = formatToad(unformatted, { tabSize: 4 });
    expect(formatted4).toBe('canvas {\n    size: 800px 600px;\n}\n');
  });

  it('supports tab characters when insertSpaces is false', () => {
    const unformatted = 'canvas {\nsize: 800px 600px;\n}';
    const formattedTabs = formatToad(unformatted, { insertSpaces: false });
    expect(formattedTabs).toBe('canvas {\n\tsize: 800px 600px;\n}\n');
  });

  it('normalizes whitespace around colons in properties', () => {
    const unformatted = 'rect #box {\n  width   :   200px   ;\n  height:100px;\n}';
    const formatted = formatToad(unformatted);
    expect(formatted).toContain('  width: 200px;');
    expect(formatted).toContain('  height: 100px;');
  });

  it('preserves single-line comments with correct indentation', () => {
    const unformatted = `
// Main canvas artboard
canvas {
// Dimensions
size: 800px 600px; // full hd ratio
}
`;
    const formatted = formatToad(unformatted);
    expect(formatted).toContain('// Main canvas artboard');
    expect(formatted).toContain('  // Dimensions');
    expect(formatted).toContain('  size: 800px 600px; // full hd ratio');
  });

  it('preserves multi-line block comments and their content', () => {
    const unformatted = `
canvas {
/*
 * Multi-line banner config
 * { decorative braces inside }
 */
size: 1200px 630px;
}
`;
    const formatted = formatToad(unformatted);
    expect(formatted).toContain('  /*');
    expect(formatted).toContain('  size: 1200px 630px;');
    expect(formatted).toContain('}');
  });

  it('formats deeply nested elements, groups, and components', () => {
    const unformatted = `
component Header(>title = "Test") {
group #navBar {
rect #bg {
fill: #1e293b;
}
text #label {
content: >title;
}
}
}
`;
    const formatted = formatToad(unformatted);
    expect(formatted).toContain('component Header(>title = "Test") {');
    expect(formatted).toContain('  group #navBar {');
    expect(formatted).toContain('    rect #bg {');
    expect(formatted).toContain('      fill: #1e293b;');
    expect(formatted).toContain('    }');
    expect(formatted).toContain('    text #label {');
    expect(formatted).toContain('      content: >title;');
    expect(formatted).toContain('    }');
    expect(formatted).toContain('  }');
    expect(formatted).toContain('}');
  });

  it('preserves maximum of one empty line between blocks', () => {
    const unformatted = 'canvas {\n  size: 800px 600px;\n}\n\n\n\n\nrect #b {\n  size: 50px;\n}';
    const formatted = formatToad(unformatted);
    expect(formatted).not.toContain('\n\n\n');
    expect(formatted).toContain('}\n\nrect #b {');
  });

  it('ensures formatted output ends with exactly one newline', () => {
    const unformatted = 'canvas { size: 100px 100px; }';
    const formatted = formatToad(unformatted);
    expect(formatted.endsWith('\n')).toBe(true);
    expect(formatted.endsWith('\n\n')).toBe(false);
  });
});
