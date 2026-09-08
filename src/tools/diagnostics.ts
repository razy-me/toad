export const KNOWN_PROPERTIES = [
  'size', 'dimensions', 'width', 'height', 'fill', 'color', 'background', 'background-color', 'backgroundColor',
  'radius', 'borderRadius', 'border-radius', 'corner-radius', 'cornerRadius', 'shadow', 'box-shadow', 'drop-shadow', 'inner-shadow', 'innerShadow',
  'glow', 'outer-glow', 'outerGlow', 'inner-glow', 'innerGlow', 'bevel', 'bevel-emboss', 'bevelEmboss',
  'layer-stroke', 'layerStroke', 'overlay', 'color-overlay', 'colorOverlay', 'gradient-overlay', 'gradientOverlay',
  'opacity', 'stroke', 'stroke-width', 'strokeWidth', 'stroke-style', 'strokeStyle',
  'stroke-cap', 'strokeCap', 'cap', 'stroke-join', 'strokeJoin', 'join',
  'font', 'font-family', 'fontFamily', 'font-size', 'fontSize', 'font-weight', 'fontWeight', 'weight',
  'font-style', 'fontStyle', 'style', 'line-height', 'lineHeight', 'letter-spacing', 'letterSpacing', 'tracking',
  'text-transform', 'textTransform', 'content', 'text', 'wrap-width', 'wrapWidth', 'max-lines', 'maxLines', 'overflow',
  'vertical-align', 'verticalAlign', 'trim', 'text-box-trim', 'textBoxTrim', 'font-features', 'fontFeatures', 'font-variation', 'fontVariation',
  'hanging-punctuation', 'hangingPunctuation',
  'margin', 'padding', 'gap', 'column-gap', 'columnGap', 'row-gap', 'rowGap', 'flow',
  'direction', 'align', 'text-align', 'distribution', 'justify', 'columns', 'at', 'position', 'rotation', 'scale', 'scales',
  'skewX', 'skewY', 'skew-x', 'skew-y',
  'transform-origin', 'transformOrigin', 'clip', 'mask', 'blend-mode', 'blendMode',
  'filter', 'backdrop-filter', 'backdropFilter', 'export', 'exports', 'format', 'formats',
  'ratio', 'aspect-ratio', 'aspectRatio', 'resolution', 'density', 'quality', 'compress', 'compression', 'preset',
  'bleed', 'crop-marks', 'cropMarks', 'dpi', 'color-mode', 'colorMode',
  'src', 'fit', 'points', 'd', 'path', 'iconName', 'icon-name', 'shapeType', 'z-index', 'zIndex',
  'layer-color', 'layerColor', 'fill-opacity', 'fillOpacity', 'lock', 'protected', 'knockout', 'shadows', 'shadows-adjust',
  'photo-src', 'photoSrc', 'photo-params', 'photoParams', 'feather', 'vignette', 'exposure', 'warmth', 'temperature', 'highlights',
  'guides', 'guide', 'global-light', 'globalLight'
];

/**
 * Calculates the Levenshtein distance between two strings.
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          )
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Given an unknown property name, returns the closest matching known property,
 * or null if no reasonable match is found.
 */
export function suggestProperty(unknownProp: string, threshold = 3): string | null {
  let closestMatch: string | null = null;
  let minDistance = Infinity;

  const normalizedUnknown = unknownProp.toLowerCase().replace(/[^a-z0-9]/g, '');

  for (const prop of KNOWN_PROPERTIES) {
    const normalizedProp = prop.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // Quick skip for very different lengths to save compute, unless prefixes match
    const lenDelta = Math.abs(normalizedProp.length - normalizedUnknown.length);
    const prefixMatch = normalizedProp.startsWith(normalizedUnknown) || normalizedUnknown.startsWith(normalizedProp);
    if (lenDelta > threshold && !prefixMatch) {
      continue;
    }

    const distance = levenshteinDistance(normalizedUnknown, normalizedProp);
    if (distance < minDistance && distance <= threshold) {
      minDistance = distance;
      closestMatch = prop;
    }
  }

  // If the suggestion is exactly the same after normalization, it was just a casing/dash issue!
  return closestMatch;
}

/**
 * Infers an appropriate TOAD error code based on message and source content.
 */
export function inferErrorCode(message: string, sourceLine?: string): string {
  const m = (message || '').toLowerCase();
  const s = (sourceLine || '').toLowerCase();

  if (s.includes('offset:') || (s.trim().startsWith('>') && s.includes(':')) || m.includes('syntax') || m.includes('unexpected token') || m.includes('expected')) {
    return 'TOAD-E001';
  }
  if (m.includes('cycle') || m.includes('circular') || m.includes('anchor') || m.includes('cannot find') || m.includes('not found')) {
    return 'TOAD-E002';
  }
  if (m.includes('property') || m.includes('unknown') || s.includes('display: flex') || s.includes('rgba(')) {
    return 'TOAD-E003';
  }
  if (m.includes('variable') || s.trim().startsWith('>')) {
    return 'TOAD-E004';
  }
  return 'TOAD-E001';
}

/**
 * Generates an actionable "= help:" hint for common DSL syntax and anti-slop violations.
 */
export function generateHelpSuggestion(sourceLine: string, message: string): string | null {
  const line = sourceLine.trim();

  // Rule 5: Colon after offset: "at: below #target offset: 16px;"
  if (/\boffset\s*:\s*\d+/i.test(line)) {
    const fixed = line.replace(/\boffset\s*:\s*/i, 'offset ');
    return `Remove the colon after 'offset'. In toad, write: \`${fixed}\``;
  }

  // Rule 1: Variable declaration with CSS colon: ">brandColor: #ff0000;"
  if (/^>\w+\s*:\s*/.test(line)) {
    const fixed = line.replace(/^>(\w+)\s*:\s*/, '>$1 = ');
    return `Variables use '=' for assignment. Did you mean: \`${fixed}\`?`;
  }

  // Anti-slop / Rule: CSS flexbox display: flex
  if (/display\s*:\s*flex/i.test(line)) {
    return `CSS Flexbox is not supported. Use auto-layout 'stack { direction: horizontal; distribution: space-between; }' instead.`;
  }

  // Anti-slop / Rule: CSS rgba(...)
  if (/rgba\s*\(/i.test(line)) {
    return `toad does not use 'rgba(...)'. Use 'alpha(#hex, opacity)' or 8-digit hex '#RRGGBBAA'.`;
  }

  // Rule 8: Unquoted font fallback list: >font = "Inter", sans-serif;
  if (/^>\w+\s*=\s*("[^"]*"\s*,\s*[^;"]+)/.test(line) || /(font|font-family)\s*:\s*("[^"]*"\s*,\s*[^;"]+)/.test(line)) {
    return `Wrap font fallback chains in a single string literal: \`>font = "Inter, -apple-system, sans-serif";\``;
  }

  // Missing semicolon
  if (/expected ';'/i.test(message) || /missing semicolon/i.test(message)) {
    return `Every statement and property in toad must terminate with a semicolon ';'.`;
  }

  // Unknown property suggestion
  const propMatch = message.match(/unknown property ['"]([^'"]+)['"]/i);
  if (propMatch && propMatch[1]) {
    const suggestion = suggestProperty(propMatch[1]);
    if (suggestion) {
      return `Did you mean '${suggestion}'?`;
    }
  }

  return null;
}

export interface DiagnosticOptions {
  file?: string;
  line?: number;
  col?: number;
  message: string;
  code?: string;
  sourceText?: string;
  help?: string;
}

/**
 * Formats a compiler error into a Clang/Rust-style gutter output with pointers and actionable help hints.
 */
export function formatRustDiagnostic(opts: DiagnosticOptions): string {
  const useColor = !process.env.NO_COLOR && (process.stdout?.isTTY || process.env.FORCE_COLOR !== '0');
  const c = {
    bold: (s: string) => useColor ? `\x1b[1m${s}\x1b[22m` : s,
    dim: (s: string) => useColor ? `\x1b[2m${s}\x1b[22m` : s,
    red: (s: string) => useColor ? `\x1b[31m${s}\x1b[39m` : s,
    cyan: (s: string) => useColor ? `\x1b[36m${s}\x1b[39m` : s,
    yellow: (s: string) => useColor ? `\x1b[33m${s}\x1b[39m` : s,
    bgRed: (s: string) => useColor ? `\x1b[41m\x1b[37m\x1b[1m${s}\x1b[0m` : s,
  };

  const line = opts.line || 1;
  const col = opts.col || 1;
  const file = opts.file || 'input.toad';

  let targetLineContent = '';
  let lines: string[] = [];
  if (opts.sourceText) {
    lines = opts.sourceText.split(/\r?\n/);
    if (line > 0 && line <= lines.length) {
      targetLineContent = lines[line - 1] || '';
    }
  }

  const code = opts.code || inferErrorCode(opts.message, targetLineContent);
  const helpText = opts.help || generateHelpSuggestion(targetLineContent, opts.message);

  let out = `\n${c.bold(c.red(`error[${code}]:`))} ${c.bold(opts.message)}\n`;
  out += `  ${c.dim('-->')} ${c.cyan(`${file}:${line}:${col}`)}\n`;
  out += `   ${c.dim('|')}\n`;

  if (lines.length > 0 && line > 0 && line <= lines.length) {
    const startLine = Math.max(1, line - 1);
    const endLine = Math.min(lines.length, line + 1);

    for (let i = startLine; i <= endLine; i++) {
      const lNum = String(i).padStart(3, ' ');
      const lText = lines[i - 1] || '';
      if (i === line) {
        out += `${c.dim(`${lNum} |`)} ${c.bold(lText)}\n`;
        const indent = ' '.repeat(Math.max(0, col - 1));
        out += `   ${c.dim('|')} ${indent}${c.bold(c.red('^'))}\n`;
      } else {
        out += `${c.dim(`${lNum} |`)} ${c.dim(lText)}\n`;
      }
    }
  }

  out += `   ${c.dim('|')}\n`;
  if (helpText) {
    out += `   ${c.bold(c.cyan('='))} ${c.bold('help')}: ${helpText}\n`;
  }
  out += '\n';

  return out;
}

