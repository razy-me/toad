/**
 * A basic string-based formatter for toad code that preserves comments.
 * It normalizes indentation based on `{` and `}` braces and standardizes
 * whitespace around colons and semicolons.
 */

export interface FormatOptions {
  tabSize?: number;
  insertSpaces?: boolean;
}

export function formatToad(source: string, options: FormatOptions = {}): string {
  const tabSize = options.tabSize ?? 2;
  const indentChar = options.insertSpaces === false ? '\t' : ' '.repeat(tabSize);

  const lines = source.split(/\r?\n/);
  const formattedLines: string[] = [];
  let indentLevel = 0;
  let inBlockComment = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]!.trim();

    // Skip empty lines, but preserve one empty line between blocks
    if (line.length === 0) {
      if (formattedLines.length > 0 && formattedLines[formattedLines.length - 1] !== '') {
        formattedLines.push('');
      }
      continue;
    }

    // Decrease indent if line starts with closing brace (outside block comment)
    const lineStartsInBlockComment = inBlockComment;
    if (!inBlockComment && line.startsWith('}')) {
      indentLevel = Math.max(0, indentLevel - 1);
    }

    // Apply basic spacing normalization for properties: "key : value ;" -> "key: value;"
    let inD = false, inS = false, commentIdx = -1;
    let openBraces = 0, closeBraces = 0;
    let escapeRun = 0;
    for (let c = 0; c < line.length; c++) {
      const ch = line[c];

      if (inBlockComment) {
        if (ch === '*' && c + 1 < line.length && line[c + 1] === '/') {
          inBlockComment = false;
          c++;
        }
        continue;
      }

      // Count consecutive backslashes so `"a\\"` correctly CLOSES the string
      // (the quote after an escaped backslash is real), while `"a\\\"`
      // keeps it open.
      if (ch === '\\') {
        escapeRun++;
        continue;
      }
      const escaped = escapeRun % 2 === 1;
      escapeRun = 0;

      if (ch === '"' && !inS && !escaped) inD = !inD;
      else if (ch === "'" && !inD && !escaped) inS = !inS;
      else if (!inD && !inS && ch === '/' && c + 1 < line.length && line[c + 1] === '*') {
        inBlockComment = true;
        c++;
      } else if (!inD && !inS && ch === '/' && c + 1 < line.length && line[c + 1] === '/') {
        commentIdx = c;
        break;
      } else if (!inD && !inS) {
        if (ch === '{') openBraces++;
        else if (ch === '}') closeBraces++;
      }
    }

    const codePart = commentIdx !== -1 ? line.substring(0, commentIdx).trimEnd() : line;
    const commentPart = commentIdx !== -1 ? line.substring(commentIdx) : '';

    // NEVER rewrite text inside block comments — interior prose like
    // " * Design tokens : version 2 ;" is documentation, not a property.
    if (!lineStartsInBlockComment && !inBlockComment &&
        !line.startsWith('//') && !line.startsWith('/*') &&
        codePart.endsWith(';')) {
      const fixedCode = normalizePropertyStatement(codePart);
      line = commentPart ? `${fixedCode} ${commentPart}` : fixedCode;
    }

    // Construct the indented line
    const currentIndent = indentChar.repeat(indentLevel);
    formattedLines.push(currentIndent + line);

    // Update indentLevel for subsequent lines:
    // If the line started with '}', we already decremented once above.
    const remainingCloses = line.startsWith('}') ? Math.max(0, closeBraces - 1) : closeBraces;
    indentLevel = Math.max(0, indentLevel + openBraces - remainingCloses);
  }

  // Ensure file ends with a single newline
  let result = formattedLines.join('\n');
  if (!result.endsWith('\n')) {
    result += '\n';
  }

  return result;
}

function normalizePropertyStatement(code: string): string {
  // If it's a variable declaration like `>var = ...`, don't treat as property: value
  if (/^\s*>[a-zA-Z0-9_-]+\s*=/.test(code)) {
    return code.replace(/\s+;$/, ';');
  }

  let inDouble = false;
  let inSingle = false;
  let colonIdx = -1;

  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    if (ch === '"' && !inSingle && (i === 0 || code[i - 1] !== '\\')) {
      inDouble = !inDouble;
    } else if (ch === "'" && !inDouble && (i === 0 || code[i - 1] !== '\\')) {
      inSingle = !inSingle;
    } else if (!inDouble && !inSingle && ch === ':') {
      colonIdx = i;
      break;
    }
  }

  if (colonIdx !== -1) {
    const key = code.substring(0, colonIdx).trimEnd();
    const val = code.substring(colonIdx + 1).trimStart().replace(/\s+;$/, ';');
    return `${key}: ${val}`;
  }

  return code.replace(/\s+;$/, ';');
}
