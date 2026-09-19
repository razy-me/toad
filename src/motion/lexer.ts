/**
 * src/motion/lexer.ts
 * Tokenizer for the "toad motion" (.toadm) DSL.
 */

import { Position, SourceLocation } from '../parser/ast.js';

export enum MotionTokenType {
  DIRECTIVE_IMPORT = 'DIRECTIVE_IMPORT', // @import
  KW_AS = 'KW_AS',                       // as
  KW_MOTION = 'KW_MOTION',               // motion
  KW_TIMELINE = 'KW_TIMELINE',           // timeline
  KW_SCENE = 'KW_SCENE',                 // scene
  KW_DURATION = 'KW_DURATION',           // duration
  KW_FPS = 'KW_FPS',                     // fps
  KW_DIMENSIONS = 'KW_DIMENSIONS',       // dimensions
  KW_BACKGROUND = 'KW_BACKGROUND',       // background
  KW_ALONG = 'KW_ALONG',                 // along
  KW_BORDER = 'KW_BORDER',               // border
  KW_PATH = 'KW_PATH',                   // path
  KW_OF = 'KW_OF',                       // of
  KW_PROGRESS = 'KW_PROGRESS',           // progress
  KW_OFFSET = 'KW_OFFSET',               // offset
  KW_AUTO_ROTATE = 'KW_AUTO_ROTATE',     // auto-rotate
  KW_STAGGER = 'KW_STAGGER',             // stagger
  KW_FROM = 'KW_FROM',                   // from
  KW_TO = 'KW_TO',                       // to
  KW_EASE = 'KW_EASE',                   // ease
  KW_SPRING = 'KW_SPRING',               // spring
  KW_CUBIC_BEZIER = 'KW_CUBIC_BEZIER',   // cubic-bezier
  KW_ANIMATION = 'KW_ANIMATION',         // animation

  // Identifiers & Values
  IDENTIFIER = 'IDENTIFIER',             // word
  ELEMENT_ID = 'ELEMENT_ID',             // #heroTitle
  STRING = 'STRING',                     // "..."
  NUMBER = 'NUMBER',                     // 123, 12.5, -5
  TIME = 'TIME',                         // 0.5s, 500ms
  PERCENT = 'PERCENT',                   // 50%
  DEGREE = 'DEGREE',                     // 90deg, 3.14rad
  PIXEL = 'PIXEL',                       // 16px, 1200px
  HEX_COLOR = 'HEX_COLOR',               // #ffffff, #3b82f6

  // Delimiters & Operators
  LBRACE = 'LBRACE',                     // {
  RBRACE = 'RBRACE',                     // }
  LPAREN = 'LPAREN',                     // (
  RPAREN = 'RPAREN',                     // )
  COLON = 'COLON',                       // :
  SEMICOLON = 'SEMICOLON',               // ;
  COMMA = 'COMMA',                       // ,
  GT = 'GT',                             // >
  STAR = 'STAR',                         // *

  EOF = 'EOF'
}

export interface MotionToken {
  type: MotionTokenType;
  value: string;
  numValue?: number; // parsed number if TIME, PERCENT, DEGREE, PIXEL, NUMBER
  loc: SourceLocation;
}

const KEYWORDS: Record<string, MotionTokenType> = {
  import: MotionTokenType.DIRECTIVE_IMPORT,
  as: MotionTokenType.KW_AS,
  motion: MotionTokenType.KW_MOTION,
  timeline: MotionTokenType.KW_TIMELINE,
  scene: MotionTokenType.KW_SCENE,
  duration: MotionTokenType.KW_DURATION,
  fps: MotionTokenType.KW_FPS,
  dimensions: MotionTokenType.KW_DIMENSIONS,
  background: MotionTokenType.KW_BACKGROUND,
  along: MotionTokenType.KW_ALONG,
  border: MotionTokenType.KW_BORDER,
  path: MotionTokenType.KW_PATH,
  of: MotionTokenType.KW_OF,
  progress: MotionTokenType.KW_PROGRESS,
  offset: MotionTokenType.KW_OFFSET,
  'auto-rotate': MotionTokenType.KW_AUTO_ROTATE,
  autorotate: MotionTokenType.KW_AUTO_ROTATE,
  stagger: MotionTokenType.KW_STAGGER,
  from: MotionTokenType.KW_FROM,
  to: MotionTokenType.KW_TO,
  ease: MotionTokenType.KW_EASE,
  spring: MotionTokenType.KW_SPRING,
  'cubic-bezier': MotionTokenType.KW_CUBIC_BEZIER,
  animation: MotionTokenType.KW_ANIMATION
};

export class MotionLexer {
  private src: string;
  private len: number;
  private pos = 0;
  private line = 1;
  private col = 1;
  private file?: string;

  constructor(source: string, file?: string) {
    this.src = source;
    this.len = source.length;
    this.file = file;
  }

  private currentPos(): Position {
    return { line: this.line, column: this.col, offset: this.pos };
  }

  private peek(): string {
    return this.pos < this.len ? this.src[this.pos]! : '';
  }

  private advance(): string {
    const ch = this.src[this.pos++]!;
    if (ch === '\n') {
      this.line++;
      this.col = 1;
    } else {
      this.col++;
    }
    return ch;
  }

  private skipWhitespaceAndComments(): void {
    while (this.pos < this.len) {
      const ch = this.src[this.pos];
      if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
        this.advance();
      } else if (ch === '/' && this.pos + 1 < this.len && this.src[this.pos + 1] === '/') {
        // Line comment
        while (this.pos < this.len && this.src[this.pos] !== '\n') {
          this.advance();
        }
      } else if (ch === '/' && this.pos + 1 < this.len && this.src[this.pos + 1] === '*') {
        // Block comment
        this.advance(); // /
        this.advance(); // *
        while (this.pos < this.len) {
          if (this.src[this.pos] === '*' && this.pos + 1 < this.len && this.src[this.pos + 1] === '/') {
            this.advance(); // *
            this.advance(); // /
            break;
          }
          this.advance();
        }
      } else {
        break;
      }
    }
  }

  public nextToken(): MotionToken {
    this.skipWhitespaceAndComments();

    if (this.pos >= this.len) {
      return {
        type: MotionTokenType.EOF,
        value: '',
        loc: { start: this.currentPos(), end: this.currentPos(), file: this.file }
      };
    }

    const start = this.currentPos();
    const ch = this.peek();

    // Directive @import
    if (ch === '@') {
      this.advance();
      let word = '';
      while (/[a-zA-Z]/.test(this.peek())) {
        word += this.advance();
      }
      if (word === 'import') {
        return {
          type: MotionTokenType.DIRECTIVE_IMPORT,
          value: '@import',
          loc: { start, end: this.currentPos(), file: this.file }
        };
      }
      return {
        type: MotionTokenType.IDENTIFIER,
        value: '@' + word,
        loc: { start, end: this.currentPos(), file: this.file }
      };
    }

    // Single-character delimiters
    if (ch === '{') {
      this.advance();
      return { type: MotionTokenType.LBRACE, value: '{', loc: { start, end: this.currentPos(), file: this.file } };
    }
    if (ch === '}') {
      this.advance();
      return { type: MotionTokenType.RBRACE, value: '}', loc: { start, end: this.currentPos(), file: this.file } };
    }
    if (ch === '(') {
      this.advance();
      return { type: MotionTokenType.LPAREN, value: '(', loc: { start, end: this.currentPos(), file: this.file } };
    }
    if (ch === ')') {
      this.advance();
      return { type: MotionTokenType.RPAREN, value: ')', loc: { start, end: this.currentPos(), file: this.file } };
    }
    if (ch === ':') {
      this.advance();
      return { type: MotionTokenType.COLON, value: ':', loc: { start, end: this.currentPos(), file: this.file } };
    }
    if (ch === ';') {
      this.advance();
      return { type: MotionTokenType.SEMICOLON, value: ';', loc: { start, end: this.currentPos(), file: this.file } };
    }
    if (ch === ',') {
      this.advance();
      return { type: MotionTokenType.COMMA, value: ',', loc: { start, end: this.currentPos(), file: this.file } };
    }
    if (ch === '>') {
      this.advance();
      return { type: MotionTokenType.GT, value: '>', loc: { start, end: this.currentPos(), file: this.file } };
    }
    if (ch === '*') {
      this.advance();
      return { type: MotionTokenType.STAR, value: '*', loc: { start, end: this.currentPos(), file: this.file } };
    }

    // Strings
    if (ch === '"' || ch === "'") {
      const quote = this.advance();
      let str = '';
      while (this.pos < this.len && this.peek() !== quote) {
        if (this.peek() === '\\') {
          this.advance();
          if (this.pos < this.len) str += this.advance();
        } else {
          str += this.advance();
        }
      }
      if (this.peek() === quote) this.advance();
      return {
        type: MotionTokenType.STRING,
        value: str,
        loc: { start, end: this.currentPos(), file: this.file }
      };
    }

    // Element ID (#foo) or Hex Color (#fff, #123456)
    if (ch === '#') {
      let raw = this.advance(); // consume '#'
      while (/[a-zA-Z0-9_-]/.test(this.peek())) {
        raw += this.advance();
      }
      const hexCandidate = raw.slice(1);
      // Valid hex color is 3, 4, 6, or 8 hex characters
      if (/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{4}$|^[0-9a-fA-F]{6}$|^[0-9a-fA-F]{8}$/.test(hexCandidate)) {
        return {
          type: MotionTokenType.HEX_COLOR,
          value: raw,
          loc: { start, end: this.currentPos(), file: this.file }
        };
      }
      return {
        type: MotionTokenType.ELEMENT_ID,
        value: raw,
        loc: { start, end: this.currentPos(), file: this.file }
      };
    }

    // Numbers, Times (0.5s, 200ms), Percentages (50%), Pixels (10px), Degrees (45deg)
    const isNumberStart = /[0-9]/.test(ch) ||
      ((ch === '-' || ch === '+') && (/[0-9]/.test(this.src[this.pos + 1] ?? '') || (this.src[this.pos + 1] === '.' && /[0-9]/.test(this.src[this.pos + 2] ?? '')))) ||
      (ch === '.' && /[0-9]/.test(this.src[this.pos + 1] ?? ''));

    if (isNumberStart) {
      let numStr = this.advance();
      while (/[0-9.]/.test(this.peek()) || ((this.peek() === 'e' || this.peek() === 'E') && /[0-9+-]/.test(this.src[this.pos + 1] ?? ''))) {
        if (this.peek() === 'e' || this.peek() === 'E') {
          numStr += this.advance();
          if (this.peek() === '+' || this.peek() === '-') {
            numStr += this.advance();
          }
        } else {
          numStr += this.advance();
        }
      }
      const rawNum = parseFloat(numStr);

      // Check unit suffix
      if (this.peek() === 's' && !/[a-zA-Z0-9_]/.test(this.src[this.pos + 1] ?? '')) {
        this.advance(); // consume 's'
        return {
          type: MotionTokenType.TIME,
          value: numStr + 's',
          numValue: rawNum, // seconds
          loc: { start, end: this.currentPos(), file: this.file }
        };
      }
      if (this.peek() === 'm' && this.src[this.pos + 1] === 's' && !/[a-zA-Z0-9_]/.test(this.src[this.pos + 2] ?? '')) {
        this.advance(); // m
        this.advance(); // s
        return {
          type: MotionTokenType.TIME,
          value: numStr + 'ms',
          numValue: rawNum / 1000, // convert ms to seconds
          loc: { start, end: this.currentPos(), file: this.file }
        };
      }
      if (this.peek() === '%') {
        this.advance(); // %
        return {
          type: MotionTokenType.PERCENT,
          value: numStr + '%',
          numValue: rawNum / 100, // normalized 0.0 to 1.0
          loc: { start, end: this.currentPos(), file: this.file }
        };
      }
      if (this.peek() === 'd' && this.src[this.pos + 1] === 'e' && this.src[this.pos + 2] === 'g' && !/[a-zA-Z0-9_]/.test(this.src[this.pos + 3] ?? '')) {
        this.advance(); // d
        this.advance(); // e
        this.advance(); // g
        return {
          type: MotionTokenType.DEGREE,
          value: numStr + 'deg',
          numValue: rawNum,
          loc: { start, end: this.currentPos(), file: this.file }
        };
      }
      if (this.peek() === 'p' && this.src[this.pos + 1] === 'x' && !/[a-zA-Z0-9_]/.test(this.src[this.pos + 2] ?? '')) {
        this.advance(); // p
        this.advance(); // x
        return {
          type: MotionTokenType.PIXEL,
          value: numStr + 'px',
          numValue: rawNum,
          loc: { start, end: this.currentPos(), file: this.file }
        };
      }

      return {
        type: MotionTokenType.NUMBER,
        value: numStr,
        numValue: rawNum,
        loc: { start, end: this.currentPos(), file: this.file }
      };
    }

    // Identifiers & Keywords (allows hyphens like 'auto-rotate', 'ease-in-out')
    if (/[a-zA-Z_]/.test(ch)) {
      let word = this.advance();
      while (/[a-zA-Z0-9_-]/.test(this.peek())) {
        word += this.advance();
      }

      const lower = word.toLowerCase();
      if (KEYWORDS[lower]) {
        return {
          type: KEYWORDS[lower]!,
          value: word,
          loc: { start, end: this.currentPos(), file: this.file }
        };
      }

      return {
        type: MotionTokenType.IDENTIFIER,
        value: word,
        loc: { start, end: this.currentPos(), file: this.file }
      };
    }

    // Fallback: single character identifier
    const unknown = this.advance();
    return {
      type: MotionTokenType.IDENTIFIER,
      value: unknown,
      loc: { start, end: this.currentPos(), file: this.file }
    };
  }

  public tokenizeAll(): MotionToken[] {
    const tokens: MotionToken[] = [];
    while (true) {
      const tok = this.nextToken();
      tokens.push(tok);
      if (tok.type === MotionTokenType.EOF) break;
    }
    return tokens;
  }
}
