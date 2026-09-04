/**
 * src/parser/lexer.ts
 * Single-pass tokenizer for the "toad" declarative design DSL.
 */

import { Position, SourceLocation } from './ast.js';

export enum TokenType {
  // Directives
  DIRECTIVE_IMPORT = 'DIRECTIVE_IMPORT', // @import
  DIRECTIVE_FONT = 'DIRECTIVE_FONT',     // @font

  // Keywords
  KW_AS = 'KW_AS',                       // as
  KW_CANVAS = 'KW_CANVAS',               // canvas
  KW_COMPONENT = 'KW_COMPONENT',         // component
  KW_RECT = 'KW_RECT',                   // rect
  KW_CIRCLE = 'KW_CIRCLE',               // circle
  KW_TEXT = 'KW_TEXT',                   // text
  KW_POLYGON = 'KW_POLYGON',             // polygon
  KW_PATH = 'KW_PATH',                   // path
  KW_IMAGE = 'KW_IMAGE',                 // image
  KW_ADJUST = 'KW_ADJUST',               // adjust
  KW_PHOTO = 'KW_PHOTO',                 // photo
  KW_GROUP = 'KW_GROUP',                 // group
  KW_GRID = 'KW_GRID',                   // grid
  KW_STACK = 'KW_STACK',                 // stack
  KW_ICON = 'KW_ICON',                   // icon
  KW_STAR = 'KW_STAR',                   // star
  KW_TRIANGLE = 'KW_TRIANGLE',           // triangle
  KW_ARROW = 'KW_ARROW',                 // arrow
  KW_CROSS = 'KW_CROSS',                 // cross
  KW_SLOT = 'KW_SLOT',                   // slot
  KW_CHILDREN = 'KW_CHILDREN',           // children

  // Relational & Spatial Keywords
  KW_AT = 'KW_AT',                       // at
  KW_OF = 'KW_OF',                       // of
  KW_RIGHT = 'KW_RIGHT',                 // right
  KW_LEFT = 'KW_LEFT',                   // left
  KW_ABOVE = 'KW_ABOVE',                 // above
  KW_BELOW = 'KW_BELOW',                 // below
  KW_CENTER = 'KW_CENTER',               // center
  KW_INSIDE = 'KW_INSIDE',               // inside
  KW_OFFSET = 'KW_OFFSET',               // offset
  KW_TO = 'KW_TO',                       // to

  // Gradient & Filter Function Keywords
  KW_LINEAR_GRADIENT = 'KW_LINEAR_GRADIENT', // linear-gradient
  KW_RADIAL_GRADIENT = 'KW_RADIAL_GRADIENT', // radial-gradient
  KW_CONIC_GRADIENT = 'KW_CONIC_GRADIENT',   // conic-gradient
  KW_BLUR = 'KW_BLUR',                   // blur
  KW_SATURATE = 'KW_SATURATE',           // saturate
  KW_BRIGHTNESS = 'KW_BRIGHTNESS',       // brightness
  KW_CONTRAST = 'KW_CONTRAST',           // contrast
  KW_GRAYSCALE = 'KW_GRAYSCALE',         // grayscale
  KW_SEPIA = 'KW_SEPIA',                 // sepia
  KW_INVERT = 'KW_INVERT',               // invert
  KW_HUE_ROTATE = 'KW_HUE_ROTATE',       // hue-rotate
  KW_DROP_SHADOW = 'KW_DROP_SHADOW',     // drop-shadow
  KW_CALC = 'KW_CALC',                   // calc

  // Values & Enum Keywords
  KW_CURRENT_COLOR = 'KW_CURRENT_COLOR', // currentColor
  KW_TRUE = 'KW_TRUE',                   // true
  KW_FALSE = 'KW_FALSE',                 // false
  KW_FILL = 'KW_FILL',                   // fill
  KW_HUG = 'KW_HUG',                     // hug
  KW_PRESET = 'KW_PRESET',               // preset
  KW_COVER = 'KW_COVER',                 // cover
  KW_CONTAIN = 'KW_CONTAIN',             // contain
  KW_NONE = 'KW_NONE',                   // none
  KW_ROW = 'KW_ROW',                     // row
  KW_COLUMN = 'KW_COLUMN',               // column
  KW_SOLID = 'KW_SOLID',                 // solid
  KW_DASHED = 'KW_DASHED',               // dashed
  KW_DOTTED = 'KW_DOTTED',               // dotted

  // Identifiers & References
  IDENTIFIER = 'IDENTIFIER',             // color, size, Arrow, my-var
  VARIABLE = 'VARIABLE',                 // >primary, >spacing
  ELEMENT_ID = 'ELEMENT_ID',             // #header, #btn_1

  // Literals
  NUMBER = 'NUMBER',                     // 10, 3.14, -5
  DIMENSION = 'DIMENSION',               // 100px, 50%, 45deg, 1.5rad, 2em, 12pt
  HEX_COLOR = 'HEX_COLOR',               // #ffffff, #fff, #3b82f680
  STRING = 'STRING',                     // "Hello World", 'Inter'

  // Punctuation & Delimiters
  LBRACE = 'LBRACE',                     // {
  RBRACE = 'RBRACE',                     // }
  LPAREN = 'LPAREN',                     // (
  RPAREN = 'RPAREN',                     // )
  LBRACKET = 'LBRACKET',                 // [
  RBRACKET = 'RBRACKET',                 // ]
  COLON = 'COLON',                       // :
  SEMICOLON = 'SEMICOLON',               // ;
  COMMA = 'COMMA',                       // ,
  EQUALS = 'EQUALS',                     // =
  DOT = 'DOT',                           // .
  PLUS = 'PLUS',                         // +

  // Stream Control
  EOF = 'EOF'
}

export interface Token {
  type: TokenType;
  value: string;
  numberValue?: number;
  unit?: string;
  loc: SourceLocation;
}

const KEYWORDS: Record<string, TokenType> = {
  as: TokenType.KW_AS,
  canvas: TokenType.KW_CANVAS,
  component: TokenType.KW_COMPONENT,
  rect: TokenType.KW_RECT,
  circle: TokenType.KW_CIRCLE,
  text: TokenType.KW_TEXT,
  polygon: TokenType.KW_POLYGON,
  path: TokenType.KW_PATH,
  image: TokenType.KW_IMAGE,
  adjust: TokenType.KW_ADJUST,
  photo: TokenType.KW_PHOTO,
  group: TokenType.KW_GROUP,
  grid: TokenType.KW_GRID,
  stack: TokenType.KW_STACK,
  icon: TokenType.KW_ICON,
  star: TokenType.KW_STAR,
  triangle: TokenType.KW_TRIANGLE,
  arrow: TokenType.KW_ARROW,
  cross: TokenType.KW_CROSS,
  slot: TokenType.KW_SLOT,
  children: TokenType.KW_CHILDREN,

  at: TokenType.KW_AT,
  of: TokenType.KW_OF,
  right: TokenType.KW_RIGHT,
  left: TokenType.KW_LEFT,
  above: TokenType.KW_ABOVE,
  below: TokenType.KW_BELOW,
  center: TokenType.KW_CENTER,
  inside: TokenType.KW_INSIDE,
  offset: TokenType.KW_OFFSET,
  to: TokenType.KW_TO,

  'linear-gradient': TokenType.KW_LINEAR_GRADIENT,
  'radial-gradient': TokenType.KW_RADIAL_GRADIENT,
  'conic-gradient': TokenType.KW_CONIC_GRADIENT,
  blur: TokenType.KW_BLUR,
  saturate: TokenType.KW_SATURATE,
  brightness: TokenType.KW_BRIGHTNESS,
  contrast: TokenType.KW_CONTRAST,
  grayscale: TokenType.KW_GRAYSCALE,
  sepia: TokenType.KW_SEPIA,
  invert: TokenType.KW_INVERT,
  'hue-rotate': TokenType.KW_HUE_ROTATE,
  'drop-shadow': TokenType.KW_DROP_SHADOW,
  calc: TokenType.KW_CALC,

  currentColor: TokenType.KW_CURRENT_COLOR,
  true: TokenType.KW_TRUE,
  false: TokenType.KW_FALSE,
  fill: TokenType.KW_FILL,
  hug: TokenType.KW_HUG,
  preset: TokenType.KW_PRESET,
  cover: TokenType.KW_COVER,
  contain: TokenType.KW_CONTAIN,
  none: TokenType.KW_NONE,
  row: TokenType.KW_ROW,
  column: TokenType.KW_COLUMN,
  solid: TokenType.KW_SOLID,
  dashed: TokenType.KW_DASHED,
  dotted: TokenType.KW_DOTTED
};

const DIRECTIVES: Record<string, TokenType> = {
  '@import': TokenType.DIRECTIVE_IMPORT,
  '@font': TokenType.DIRECTIVE_FONT
};

const UNITS = new Set(['px', '%', 'deg', 'rad', 'em', 'rem', 'pt', 'vw', 'vh', 'mm', 'cm', 'in']);

export class Lexer {
  private source: string;
  private filename: string;
  private offset = 0;
  private line = 1;
  private column = 1;

  constructor(source: string, filename = 'inline.toad') {
    this.source = source.replace(/^\uFEFF/, '');
    this.filename = filename;
  }

  public tokenize(): Token[] {
    const tokens: Token[] = [];
    while (this.offset < this.source.length) {
      this.skipWhitespaceAndComments();
      if (this.offset >= this.source.length) break;

      const token = this.scanToken();
      if (token) {
        tokens.push(token);
      }
    }

    const eofPos = this.currentPosition();
    tokens.push({
      type: TokenType.EOF,
      value: '',
      loc: {
        start: eofPos,
        end: eofPos,
        file: this.filename
      }
    });

    return tokens;
  }

  private currentPosition(): Position {
    return {
      line: this.line,
      column: this.column,
      offset: this.offset
    };
  }

  private advance(): string {
    const char = this.source[this.offset];
    this.offset++;
    if (char === '\n') {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
    return char;
  }

  private peek(offset = 0): string {
    const idx = this.offset + offset;
    if (idx >= this.source.length) return '\0';
    return this.source[idx];
  }

  private skipWhitespaceAndComments(): void {
    while (this.offset < this.source.length) {
      const c = this.peek();

      // Whitespace
      if (c === ' ' || c === '\t' || c === '\r' || c === '\n') {
        this.advance();
        continue;
      }

      // Single-line comment //
      if (c === '/' && this.peek(1) === '/') {
        this.advance();
        this.advance();
        while (this.offset < this.source.length && this.peek() !== '\n') {
          this.advance();
        }
        continue;
      }

      // Multi-line block comment /* ... */
      if (c === '/' && this.peek(1) === '*') {
        this.advance();
        this.advance();
        while (this.offset < this.source.length) {
          if (this.peek() === '*' && this.peek(1) === '/') {
            this.advance();
            this.advance();
            break;
          }
          this.advance();
        }
        continue;
      }

      break;
    }
  }

  private scanToken(): Token | null {
    const start = this.currentPosition();
    const char = this.peek();

    // 1. Directives @import, @font
    if (char === '@') {
      return this.scanDirective(start);
    }

    // 2. Variables >foo
    if (char === '>') {
      return this.scanVariable(start);
    }
    if (char === '$') {
      this.advance(); // consume '$'
      let name = '$';
      while (this.offset < this.source.length && (this.isIdentifierChar(this.peek()) || this.peek() === '-' || this.peek() === '.')) {
        name += this.advance();
      }
      return {
        type: TokenType.IDENTIFIER,
        value: name,
        loc: { start, end: this.currentPosition(), file: this.filename }
      };
    }

    // 3. Element IDs / Hex Colors #foo / #fff
    if (char === '#') {
      return this.scanHash(start);
    }

    // 4. Strings
    if (char === '"' || char === "'") {
      return this.scanString(start, char);
    }

    // 5. Delimiters & Single characters
    if (char === '{') {
      this.advance();
      return { type: TokenType.LBRACE, value: '{', loc: { start, end: this.currentPosition(), file: this.filename } };
    }
    if (char === '}') {
      this.advance();
      return { type: TokenType.RBRACE, value: '}', loc: { start, end: this.currentPosition(), file: this.filename } };
    }
    if (char === '(') {
      this.advance();
      return { type: TokenType.LPAREN, value: '(', loc: { start, end: this.currentPosition(), file: this.filename } };
    }
    if (char === ')') {
      this.advance();
      return { type: TokenType.RPAREN, value: ')', loc: { start, end: this.currentPosition(), file: this.filename } };
    }
    if (char === '[') {
      this.advance();
      return { type: TokenType.LBRACKET, value: '[', loc: { start, end: this.currentPosition(), file: this.filename } };
    }
    if (char === ']') {
      this.advance();
      return { type: TokenType.RBRACKET, value: ']', loc: { start, end: this.currentPosition(), file: this.filename } };
    }
    if (char === ':') {
      this.advance();
      return { type: TokenType.COLON, value: ':', loc: { start, end: this.currentPosition(), file: this.filename } };
    }
    if (char === ';') {
      this.advance();
      return { type: TokenType.SEMICOLON, value: ';', loc: { start, end: this.currentPosition(), file: this.filename } };
    }
    if (char === ',') {
      this.advance();
      return { type: TokenType.COMMA, value: ',', loc: { start, end: this.currentPosition(), file: this.filename } };
    }
    if (char === '=') {
      this.advance();
      return { type: TokenType.EQUALS, value: '=', loc: { start, end: this.currentPosition(), file: this.filename } };
    }
    if (char === '+') {
      this.advance();
      return { type: TokenType.PLUS, value: '+', loc: { start, end: this.currentPosition(), file: this.filename } };
    }

    // 6. Numbers & Dimensions (including negative numbers e.g. -10px, -5, -.5)
    if (this.isDigit(char) || (char === '-' && (this.isDigit(this.peek(1)) || (this.peek(1) === '.' && this.isDigit(this.peek(2))))) || (char === '.' && this.isDigit(this.peek(1)))) {
      return this.scanNumberOrDimension(start);
    }

    // 7. Identifiers, Keywords, Gradient / Filter names
    if (this.isIdentifierStart(char)) {
      return this.scanIdentifierOrKeyword(start);
    }

    // Unrecognized character -> advance and produce single-character identifier or continue
    this.advance();
    return {
      type: TokenType.IDENTIFIER,
      value: char,
      loc: { start, end: this.currentPosition(), file: this.filename }
    };
  }

  private scanDirective(start: Position): Token {
    this.advance(); // consume '@'
    let name = '@';
    while (this.offset < this.source.length && this.isLetter(this.peek())) {
      name += this.advance();
    }

    const directiveType = DIRECTIVES[name];
    if (directiveType) {
      return {
        type: directiveType,
        value: name,
        loc: { start, end: this.currentPosition(), file: this.filename }
      };
    }

    return {
      type: TokenType.IDENTIFIER,
      value: name,
      loc: { start, end: this.currentPosition(), file: this.filename }
    };
  }

  private scanVariable(start: Position): Token {
    this.advance(); // consume '>'
    let name = '';
    while (this.offset < this.source.length && (this.isIdentifierChar(this.peek()) || this.peek() === '-' || this.peek() === '.')) {
      name += this.advance();
    }
    return {
      type: TokenType.VARIABLE,
      value: name, // variable name without prefix
      loc: { start, end: this.currentPosition(), file: this.filename }
    };
  }

  private scanHash(start: Position): Token {
    this.advance(); // consume '#'
    let content = '';
    while (this.offset < this.source.length && (this.isIdentifierChar(this.peek()) || this.peek() === '-')) {
      content += this.advance();
    }

    // Check if valid hex color (3, 4, 6, 8 hex digits)
    const isHex = /^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{4}$|^[0-9a-fA-F]{6}$|^[0-9a-fA-F]{8}$/.test(content);
    if (isHex) {
      return {
        type: TokenType.HEX_COLOR,
        value: '#' + content,
        loc: { start, end: this.currentPosition(), file: this.filename }
      };
    }

    return {
      type: TokenType.ELEMENT_ID,
      value: content, // ID without '#'
      loc: { start, end: this.currentPosition(), file: this.filename }
    };
  }

  private scanString(start: Position, quoteChar: string): Token {
    this.advance(); // consume quote
    let str = '';
    while (this.offset < this.source.length) {
      const char = this.peek();
      if (char === quoteChar) {
        this.advance(); // closing quote
        break;
      }
      if (char === '\\') {
        this.advance();
        if (this.offset >= this.source.length) break;
        const esc = this.advance();
        if (esc === 'n') str += '\n';
        else if (esc === 'r') str += '\r';
        else if (esc === 't') str += '\t';
        else if (esc === '\\') str += '\\';
        else if (esc === '"') str += '"';
        else if (esc === "'") str += "'";
        else if (esc === 'u') {
          let hex = '';
          for (let i = 0; i < 4 && this.offset < this.source.length; i++) {
            const c = this.peek();
            if (!/[0-9a-fA-F]/.test(c)) break;
            hex += this.advance();
          }
          // Guarantee scanner progress on malformed escapes and never emit a
          // silent NUL from parseInt('') — use the replacement character.
          if (hex.length === 0 && this.offset < this.source.length) this.advance();
          const code = parseInt(hex, 16);
          str += Number.isFinite(code) && code > 0 ? String.fromCharCode(code) : '\uFFFD';
        } else if (esc) {
          str += esc;
        }
      } else {
        str += this.advance();
      }
    }

    return {
      type: TokenType.STRING,
      value: str,
      loc: { start, end: this.currentPosition(), file: this.filename }
    };
  }

  private scanNumberOrDimension(start: Position): Token {
    let raw = '';
    if (this.peek() === '-') {
      raw += this.advance();
    }

    while (this.offset < this.source.length && this.isDigit(this.peek())) {
      raw += this.advance();
    }

    if (this.peek() === '.' && this.isDigit(this.peek(1))) {
      raw += this.advance(); // '.'
      while (this.offset < this.source.length && this.isDigit(this.peek())) {
        raw += this.advance();
      }
    }

    // Check for unit suffix: px, %, deg, rad, em, rem, pt, vw, vh
    let unit = '';
    if (this.peek() === '%') {
      unit = this.advance();
    } else if (this.isLetter(this.peek())) {
      // Letter runs are consumed leniently so compound suffixes used by
      // resolution/scale strings (`4k`, `2x`) keep tokenizing. The linter
      // reports units outside the known set.
      let unitCandidate = '';
      while (this.offset < this.source.length && this.isLetter(this.peek())) {
        unitCandidate += this.peek();
        this.advance();
      }
      unit = unitCandidate;
    }

    const numVal = parseFloat(raw);

    if (unit) {
      return {
        type: TokenType.DIMENSION,
        value: raw + unit,
        numberValue: numVal,
        unit,
        loc: { start, end: this.currentPosition(), file: this.filename }
      };
    }

    return {
      type: TokenType.NUMBER,
      value: raw,
      numberValue: numVal,
      loc: { start, end: this.currentPosition(), file: this.filename }
    };
  }

  private scanIdentifierOrKeyword(start: Position): Token {
    let name = '';
    while (this.offset < this.source.length && (this.isIdentifierChar(this.peek()) || this.peek() === '-')) {
      name += this.advance();
    }

    const kw = KEYWORDS[name];
    if (kw) {
      return {
        type: kw,
        value: name,
        loc: { start, end: this.currentPosition(), file: this.filename }
      };
    }

    return {
      type: TokenType.IDENTIFIER,
      value: name,
      loc: { start, end: this.currentPosition(), file: this.filename }
    };
  }

  private isDigit(c: string): boolean {
    return c >= '0' && c <= '9';
  }

  private isLetter(c: string): boolean {
    return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');
  }

  private isIdentifierStart(c: string): boolean {
    return this.isLetter(c) || c === '_';
  }

  private isIdentifierChar(c: string): boolean {
    return this.isLetter(c) || this.isDigit(c) || c === '_';
  }
}

export function tokenizeToad(source: string, filename?: string): Token[] {
  const lexer = new Lexer(source, filename);
  return lexer.tokenize();
}

export const tokenize = tokenizeToad;
