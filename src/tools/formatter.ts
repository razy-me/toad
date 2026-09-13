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

    // Decrease indent if line starts with closing braces (outside block comment)
    const lineStartsInBlockComment = inBlockComment;
    let leadingCloses = 0;
    if (!inBlockComment) {
      while (leadingCloses < line.length && line[leadingCloses] === '}') {
        leadingCloses++;
      }
      if (leadingCloses > 0) {
        indentLevel = Math.max(0, indentLevel - leadingCloses);
      }
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
        !line.startsWith('//') && !line.startsWith('/*')) {
      let formattedCode = codePart;
      if (formattedCode.endsWith('{') && formattedCode.length > 1 && !/\s$/.test(formattedCode.slice(0, -1))) {
        formattedCode = formattedCode.slice(0, -1) + ' {';
      }
      if (formattedCode.endsWith(';')) {
        const fixedCode = normalizePropertyStatement(formattedCode);
        line = commentPart ? `${fixedCode} ${commentPart}` : fixedCode;
      } else {
        line = commentPart ? `${formattedCode} ${commentPart}` : formattedCode;
      }
    }

    // Construct the indented line
    const currentIndent = indentChar.repeat(indentLevel);
    formattedLines.push(currentIndent + line);

    // Update indentLevel for subsequent lines:
    // If the line started with '}', we already decremented leadingCloses above.
    const remainingCloses = Math.max(0, closeBraces - leadingCloses);
    indentLevel = Math.max(0, indentLevel + openBraces - remainingCloses);
  }

  // Strip leading empty lines
  while (formattedLines.length > 0 && formattedLines[0] === '') {
    formattedLines.shift();
  }

  // Ensure file ends with matching newline format
  const isCrlf = source.includes('\r\n');
  const eol = isCrlf ? '\r\n' : '\n';
  let result = formattedLines.join(eol);

  // Strip leading newlines and collapse 3+ consecutive newlines to at most 1 empty line
  result = result.replace(/^(\r?\n)+/, '');
  result = result.replace(/(\r?\n){3,}/g, '$1$1');

  if (!result.endsWith(eol)) {
    result += eol;
  }

  return result;
}

function normalizePropertyStatement(code: string): string {
  // If it's a variable declaration like `>var = ...`, don't treat as property: value
  if (/^\s*>[a-zA-Z0-9_.-]+\s*=/.test(code)) {
    return code.replace(/\s+;$/, ';');
  }

  let inDouble = false;
  let inSingle = false;
  let inBlockComment = false;
  let colonIdx = -1;

  let escapeRun = 0;
  for (let i = 0; i < code.length; i++) {
    const ch = code[i];

    if (inBlockComment) {
      if (ch === '*' && i + 1 < code.length && code[i + 1] === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }

    if (ch === '\\') {
      escapeRun++;
      continue;
    }
    const escaped = escapeRun % 2 === 1;
    escapeRun = 0;

    if (ch === '"' && !inSingle && !escaped) {
      inDouble = !inDouble;
    } else if (ch === "'" && !inDouble && !escaped) {
      inSingle = !inSingle;
    } else if (!inDouble && !inSingle && ch === '/' && i + 1 < code.length && code[i + 1] === '*') {
      inBlockComment = true;
      i++;
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
