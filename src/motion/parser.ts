/**
 * src/motion/parser.ts
 * Recursive descent parser for the TOAD Motion (.toadm) language.
 */

import {
  MotionDocumentNode,
  MotionImportNode,
  MotionDeclarationNode,
  MotionTimelineNode,
  KeyframeNode,
  KeyframeProperties,
  EasingDefinition,
  AlongPathDefinition,
  StaggerDefinition
} from './ast.js';
import { MotionLexer, MotionToken, MotionTokenType } from './lexer.js';

export class MotionParser {
  private tokens: MotionToken[];
  private current = 0;
  private file?: string;

  constructor(tokens: MotionToken[], file?: string) {
    this.tokens = tokens;
    this.file = file;
  }

  private peek(): MotionToken {
    return this.tokens[this.current] ?? {
      type: MotionTokenType.EOF,
      value: '',
      loc: { start: { line: 0, column: 0, offset: 0 }, end: { line: 0, column: 0, offset: 0 } }
    };
  }

  private isAtEnd(): boolean {
    return this.peek().type === MotionTokenType.EOF;
  }

  private advance(): MotionToken {
    if (!this.isAtEnd()) this.current++;
    return this.tokens[this.current - 1]!;
  }

  private check(type: MotionTokenType): boolean {
    return this.peek().type === type;
  }

  private match(...types: MotionTokenType[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  private consume(type: MotionTokenType, message: string): MotionToken {
    if (this.check(type)) return this.advance();
    const tok = this.peek();
    throw new Error(
      `[toadm parse error] ${message} at line ${tok.loc.start.line}:${tok.loc.start.column} (got '${tok.value}')`
    );
  }

  public parse(): MotionDocumentNode {
    const imports: MotionImportNode[] = [];
    let motionDecl: MotionDeclarationNode | undefined;

    while (!this.isAtEnd()) {
      if (this.check(MotionTokenType.DIRECTIVE_IMPORT)) {
        imports.push(this.parseImport());
      } else if (this.check(MotionTokenType.KW_MOTION)) {
        if (motionDecl) {
          throw new Error(`Multiple 'motion' blocks found in single .toadm file: ${this.file ?? ''}`);
        }
        motionDecl = this.parseMotionDeclaration();
      } else {
        const unexpected = this.advance();
        throw new Error(
          `Unexpected token '${unexpected.value}' at line ${unexpected.loc.start.line}:${unexpected.loc.start.column}`
        );
      }
    }

    if (!motionDecl) {
      throw new Error(`Missing 'motion' declaration in ${this.file ?? 'motion file'}`);
    }

    const startLoc = imports[0]?.loc?.start ?? motionDecl.loc.start;
    const endLoc = motionDecl.loc.end;
    return {
      type: 'MotionDocument',
      imports,
      motion: motionDecl,
      loc: { start: startLoc, end: endLoc, file: this.file }
    };
  }

  private parseImport(): MotionImportNode {
    const importTok = this.consume(MotionTokenType.DIRECTIVE_IMPORT, "Expected '@import'");
    const pathTok = this.consume(MotionTokenType.STRING, "Expected path string after '@import'");

    this.consume(MotionTokenType.KW_AS, "Expected 'as' after import path");
    const aliasTok = this.consume(MotionTokenType.IDENTIFIER, "Expected alias identifier after 'as'");

    this.match(MotionTokenType.SEMICOLON); // optional trailing semicolon

    return {
      type: 'MotionImport',
      path: pathTok.value,
      alias: aliasTok.value,
      loc: { start: importTok.loc.start, end: aliasTok.loc.end, file: this.file }
    };
  }

  private parseMotionDeclaration(): MotionDeclarationNode {
    const motionTok = this.consume(MotionTokenType.KW_MOTION, "Expected 'motion'");
    const nameTok = this.consume(MotionTokenType.STRING, "Expected motion name string");

    this.consume(MotionTokenType.LBRACE, "Expected '{' after motion name");

    let scene: string | undefined;
    let duration = 3.0; // default 3s
    let fps = 60;       // default 60 fps
    let width: number | undefined;
    let height: number | undefined;
    let background: string | undefined;
    const timelines: MotionTimelineNode[] = [];

    while (!this.check(MotionTokenType.RBRACE) && !this.isAtEnd()) {
      if (this.match(MotionTokenType.KW_SCENE)) {
        this.consume(MotionTokenType.COLON, "Expected ':' after 'scene'");
        const sceneTok = this.consume(MotionTokenType.IDENTIFIER, 'Expected scene alias');
        scene = sceneTok.value;
        this.match(MotionTokenType.SEMICOLON);
      } else if (this.match(MotionTokenType.KW_DURATION)) {
        this.consume(MotionTokenType.COLON, "Expected ':' after 'duration'");
        const durTok = this.advance();
        duration = durTok.numValue ?? parseFloat(durTok.value);
        this.match(MotionTokenType.SEMICOLON);
      } else if (this.match(MotionTokenType.KW_FPS)) {
        this.consume(MotionTokenType.COLON, "Expected ':' after 'fps'");
        const fpsTok = this.consume(MotionTokenType.NUMBER, 'Expected fps number');
        fps = fpsTok.numValue ?? parseInt(fpsTok.value, 10);
        this.match(MotionTokenType.SEMICOLON);
      } else if (this.match(MotionTokenType.KW_DIMENSIONS)) {
        this.consume(MotionTokenType.COLON, "Expected ':' after 'dimensions'");
        const wTok = this.advance();
        const hTok = this.advance();
        width = wTok.numValue ?? parseFloat(wTok.value);
        height = hTok.numValue ?? parseFloat(hTok.value);
        this.match(MotionTokenType.SEMICOLON);
      } else if (this.match(MotionTokenType.KW_BACKGROUND)) {
        this.consume(MotionTokenType.COLON, "Expected ':' after 'background'");
        const bgTok = this.advance();
        background = bgTok.value;
        this.match(MotionTokenType.SEMICOLON);
      } else if (this.match(MotionTokenType.KW_TIMELINE)) {
        this.consume(MotionTokenType.LBRACE, "Expected '{' after 'timeline'");
        while (!this.check(MotionTokenType.RBRACE) && !this.isAtEnd()) {
          timelines.push(this.parseTimelineNode());
        }
        this.consume(MotionTokenType.RBRACE, "Expected '}' after timeline block");
      } else {
        const skipped = this.advance();
        throw new Error(
          `Unexpected property '${skipped.value}' in motion block at line ${skipped.loc.start.line}`
        );
      }
    }

    this.consume(MotionTokenType.RBRACE, "Expected '}' at end of motion declaration");

    return {
      type: 'MotionDeclaration',
      name: nameTok.value,
      scene,
      duration,
      fps,
      width,
      height,
      background,
      timelines,
      loc: { start: motionTok.loc.start, end: this.tokens[this.current - 1]!.loc.end, file: this.file }
    };
  }

  private parseTimelineNode(): MotionTimelineNode {
    let targetId = '';
    let isChildrenSelector = false;

    // Target identifier or element ID (e.g. #heroBadge or #ctaGroup > *)
    const firstTok = this.advance();
    targetId = firstTok.value;

    if (this.match(MotionTokenType.GT)) {
      this.consume(MotionTokenType.STAR, "Expected '*' after '>' in children selector");
      targetId += ' > *';
      isChildrenSelector = true;
    }

    this.consume(MotionTokenType.LBRACE, `Expected '{' after target '${targetId}'`);

    const keyframes: KeyframeNode[] = [];
    let stagger: StaggerDefinition | undefined;

    while (!this.check(MotionTokenType.RBRACE) && !this.isAtEnd()) {
      if (this.check(MotionTokenType.KW_STAGGER)) {
        stagger = this.parseStagger();
      } else if (
        this.check(MotionTokenType.TIME) ||
        this.check(MotionTokenType.NUMBER) ||
        this.check(MotionTokenType.IDENTIFIER)
      ) {
        keyframes.push(this.parseKeyframe());
      } else {
        this.advance();
      }
    }

    this.consume(MotionTokenType.RBRACE, `Expected '}' at end of target '${targetId}'`);

    // Sort keyframes chronologically
    keyframes.sort((a, b) => a.time - b.time);

    return {
      type: 'MotionTimeline',
      targetId,
      isChildrenSelector,
      keyframes,
      stagger,
      loc: { start: firstTok.loc.start, end: this.tokens[this.current - 1]!.loc.end, file: this.file }
    };
  }

  private parseKeyframe(): KeyframeNode {
    const timeTok = this.advance();
    let time = 0;
    if (timeTok.type === MotionTokenType.TIME && timeTok.numValue !== undefined) {
      time = timeTok.numValue;
    } else if (timeTok.value === '0s' || timeTok.value === '0') {
      time = 0;
    } else if (timeTok.numValue !== undefined) {
      time = timeTok.numValue;
    } else {
      time = parseFloat(timeTok.value) || 0;
    }

    this.consume(MotionTokenType.COLON, `Expected ':' after time '${timeTok.value}'`);
    this.consume(MotionTokenType.LBRACE, `Expected '{' after time '${timeTok.value}:'`);

    const properties = this.parseKeyframeProperties();

    this.consume(MotionTokenType.RBRACE, `Expected '}' at end of keyframe '${timeTok.value}'`);

    return {
      type: 'Keyframe',
      time,
      properties,
      loc: { start: timeTok.loc.start, end: this.tokens[this.current - 1]!.loc.end, file: this.file }
    };
  }

  private parseKeyframeProperties(): KeyframeProperties {
    const props: KeyframeProperties = {};

    while (!this.check(MotionTokenType.RBRACE) && !this.isAtEnd()) {
      const keyTok = this.advance();
      const key = keyTok.value.toLowerCase();

      this.consume(MotionTokenType.COLON, `Expected ':' after property '${key}'`);

      if (key === 'along') {
        props.along = this.parseAlongPath();
      } else if (key === 'ease') {
        props.ease = this.parseEasing();
      } else if (key === 'opacity') {
        const val = this.advance();
        props.opacity = val.numValue ?? parseFloat(val.value);
      } else if (key === 'translatex' || key === 'x') {
        const val = this.advance();
        props.translateX = val.numValue ?? parseFloat(val.value);
      } else if (key === 'translatey' || key === 'y') {
        const val = this.advance();
        props.translateY = val.numValue ?? parseFloat(val.value);
      } else if (key === 'scalex') {
        const val = this.advance();
        props.scaleX = val.numValue ?? parseFloat(val.value);
      } else if (key === 'scaley') {
        const val = this.advance();
        props.scaleY = val.numValue ?? parseFloat(val.value);
      } else if (key === 'scale') {
        const val = this.advance();
        const s = val.numValue ?? parseFloat(val.value);
        props.scaleX = s;
        props.scaleY = s;
      } else if (key === 'rotate' || key === 'rotation') {
        const val = this.advance();
        props.rotate = val.numValue ?? parseFloat(val.value);
      } else if (key === 'fill') {
        const val = this.advance();
        props.fill = val.value;
      } else if (key === 'stroke') {
        const val = this.advance();
        props.stroke = val.value;
      } else if (key === 'stroke-width' || key === 'strokewidth') {
        const val = this.advance();
        props.strokeWidth = val.numValue ?? parseFloat(val.value);
      } else if (key === 'blur') {
        const val = this.advance();
        props.blur = val.numValue ?? parseFloat(val.value);
      } else if (key === 'progress') {
        const val = this.advance();
        const p = val.numValue ?? parseFloat(val.value);
        if (!props.along) {
          props.along = { targetType: 'border', targetId: '', progress: p };
        } else {
          props.along.progress = p;
        }
      } else if (key === 'offset') {
        const val = this.advance();
        const off = val.numValue ?? parseFloat(val.value);
        if (props.along) props.along.offset = off;
      } else if (key === 'auto-rotate' || key === 'autorotate') {
        const val = this.advance();
        const auto = val.value === 'true' || val.value === '1';
        if (props.along) props.along.autoRotate = auto;
      } else {
        const val = this.advance();
        props[key] = val.numValue ?? val.value;
      }

      this.match(MotionTokenType.SEMICOLON); // optional semicolon
    }

    return props;
  }

  private parseAlongPath(): AlongPathDefinition {
    // Syntax: along: border of #element [offset 4px] [auto-rotate true]
    // or: along: path #element
    let targetType: 'border' | 'path' = 'border';
    if (this.match(MotionTokenType.KW_BORDER)) {
      targetType = 'border';
      this.consume(MotionTokenType.KW_OF, "Expected 'of' after 'border'");
    } else if (this.match(MotionTokenType.KW_PATH)) {
      targetType = 'path';
    }

    const targetTok = this.advance();
    const targetId = targetTok.value;

    const def: AlongPathDefinition = {
      targetType,
      targetId,
      progress: 0
    };

    return def;
  }

  private parseEasing(): EasingDefinition {
    // ease: ease-in | linear | spring(...) | cubic-bezier(...)
    const tok = this.advance();
    const val = tok.value.toLowerCase();

    if (val === 'spring' || tok.type === MotionTokenType.KW_SPRING) {
      let stiffness = 100;
      let damping = 10;
      let mass = 1;

      if (this.match(MotionTokenType.LPAREN)) {
        while (!this.check(MotionTokenType.RPAREN) && !this.isAtEnd()) {
          const argNameTok = this.advance();
          if (this.match(MotionTokenType.COLON)) {
            const num = this.advance();
            const n = num.numValue ?? parseFloat(num.value);
            if (argNameTok.value === 'stiffness' || argNameTok.value === 'stiff') stiffness = n;
            if (argNameTok.value === 'damping' || argNameTok.value === 'damp') damping = n;
            if (argNameTok.value === 'mass') mass = n;
          } else {
            // Positional argument
            const n = argNameTok.numValue ?? parseFloat(argNameTok.value);
            if (!isNaN(n)) stiffness = n;
          }
          this.match(MotionTokenType.COMMA);
        }
        this.consume(MotionTokenType.RPAREN, "Expected ')' after spring parameters");
      }

      return {
        type: 'spring',
        springArgs: { stiffness, damping, mass }
      };
    }

    if (val === 'cubic-bezier' || tok.type === MotionTokenType.KW_CUBIC_BEZIER) {
      const args: number[] = [];
      this.consume(MotionTokenType.LPAREN, "Expected '(' after cubic-bezier");
      while (!this.check(MotionTokenType.RPAREN) && !this.isAtEnd()) {
        const num = this.advance();
        args.push(num.numValue ?? parseFloat(num.value));
        this.match(MotionTokenType.COMMA);
      }
      this.consume(MotionTokenType.RPAREN, "Expected ')' after cubic-bezier arguments");

      return {
        type: 'cubic-bezier',
        bezierArgs: [args[0] ?? 0.25, args[1] ?? 0.1, args[2] ?? 0.25, args[3] ?? 1.0]
      };
    }

    if (['linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out'].includes(val)) {
      return { type: val as any };
    }

    return { type: 'ease-in-out' };
  }

  private parseStagger(): StaggerDefinition {
    this.consume(MotionTokenType.KW_STAGGER, "Expected 'stagger'");
    this.consume(MotionTokenType.COLON, "Expected ':' after 'stagger'");
    const delayTok = this.advance();
    const delay = delayTok.numValue ?? parseFloat(delayTok.value);
    this.match(MotionTokenType.SEMICOLON);

    let from = 0;
    let duration = 0.5;
    let properties: KeyframeProperties | undefined;

    while (
      !this.check(MotionTokenType.RBRACE) &&
      !this.check(MotionTokenType.TIME) &&
      !this.check(MotionTokenType.NUMBER) &&
      !this.isAtEnd()
    ) {
      if (this.match(MotionTokenType.KW_FROM)) {
        this.consume(MotionTokenType.COLON, "Expected ':' after 'from'");
        const tok = this.advance();
        from = tok.numValue ?? parseFloat(tok.value);
        this.match(MotionTokenType.SEMICOLON);
      } else if (this.match(MotionTokenType.KW_DURATION)) {
        this.consume(MotionTokenType.COLON, "Expected ':' after 'duration'");
        const tok = this.advance();
        duration = tok.numValue ?? parseFloat(tok.value);
        this.match(MotionTokenType.SEMICOLON);
      } else if (this.match(MotionTokenType.KW_ANIMATION)) {
        this.consume(MotionTokenType.COLON, "Expected ':' after 'animation'");
        this.consume(MotionTokenType.LBRACE, "Expected '{' for animation block");
        properties = this.parseKeyframeProperties();
        this.consume(MotionTokenType.RBRACE, "Expected '}' after animation block");
        this.match(MotionTokenType.SEMICOLON);
      } else {
        break;
      }
    }

    return {
      delay,
      from,
      duration,
      properties
    };
  }
}

export function parseMotion(source: string, file?: string): MotionDocumentNode {
  const lexer = new MotionLexer(source, file);
  const tokens = lexer.tokenizeAll();
  const parser = new MotionParser(tokens, file);
  return parser.parse();
}
