/**
 * src/parser/parser.ts
 * Recursive-descent AST parser for the "toad" declarative design DSL with panic-mode error recovery.
 */

import {
  DocumentNode,
  DirectiveNode,
  ImportDirectiveNode,
  FontDirectiveNode,
  VariableDeclarationNode,
  ComponentDeclarationNode,
  ComponentParameterNode,
  ComponentArgumentNode,
  CanvasDeclarationNode,
  ElementNode,
  RectElementNode,
  CircleElementNode,
  TextElementNode,
  PolygonElementNode,
  ImageElementNode,
  GroupElementNode,
  GridElementNode,
  ComponentInstanceNode,
  PropertyNode,
  ValueNode,
  NumberLiteralNode,
  DimensionLiteralNode,
  StringLiteralNode,
  BooleanLiteralNode,
  ColorLiteralNode,
  IdentifierNode,
  VariableReferenceNode,
  ElementReferenceNode,
  CoordinateValueNode,
  RelationalPositionNode,
  RelationalRelation,
  GradientValueNode,
  LinearGradientNode,
  RadialGradientNode,
  ConicGradientNode,
  GradientStopNode,
  FilterValueNode,
  FilterFunctionNode,
  StrokeValueNode,
  FontValueNode,
  PointsValueNode,
  Point2DNode,
  ArrayLiteralNode,
  ExpressionListNode,
  ColorTransformNode,
  Diagnostic,
  SourceLocation,
  UnitType
} from './ast.js';
import { Lexer, Token, TokenType } from './lexer.js';

export class Parser {
  private tokens: Token[];
  private current = 0;
  private filename: string;
  public diagnostics: Diagnostic[] = [];

  constructor(tokensOrSource: Token[] | string, filename = 'inline.toad') {
    if (typeof tokensOrSource === 'string') {
      const lexer = new Lexer(tokensOrSource, filename);
      this.tokens = lexer.tokenize();
    } else {
      this.tokens = tokensOrSource;
    }
    this.filename = filename;
  }

  public parse(): DocumentNode {
    const startLoc = this.peek().loc.start;
    const directives: DirectiveNode[] = [];
    const variables: VariableDeclarationNode[] = [];
    const components: ComponentDeclarationNode[] = [];
    let canvas: CanvasDeclarationNode | undefined;
    const canvases: CanvasDeclarationNode[] = [];
    const elements: ElementNode[] = [];

    while (!this.isAtEnd()) {
      try {
        if (this.check(TokenType.DIRECTIVE_IMPORT)) {
          directives.push(this.parseImportDirective());
        } else if (this.check(TokenType.DIRECTIVE_FONT)) {
          directives.push(this.parseFontDirective());
        } else if (this.check(TokenType.VARIABLE)) {
          variables.push(this.parseVariableDeclaration());
        } else if (this.check(TokenType.KW_COMPONENT)) {
          components.push(this.parseComponentDeclaration());
        } else if (this.check(TokenType.KW_CANVAS)) {
          const c = this.parseCanvasDeclaration();
          canvases.push(c);
          if (!canvas) canvas = c;
        } else if (this.isElementStart()) {
          elements.push(this.parseElementDeclaration());
        } else {
          const tok = this.advance();
          if (tok.value && tok.value.startsWith('$')) {
            this.reportError(`Variables cannot be declared or referenced with '$'. Use '>' instead (e.g. >${tok.value.slice(1)}).`, tok.loc);
          } else {
            this.reportError(`Unexpected token '${tok.value}'`, tok.loc);
          }
          this.synchronizeStatement();
        }
      } catch (err) {
        if (err instanceof Error) {
          // Already recorded in diagnostics or catch unexpected
        }
        this.synchronizeStatement();
      }
    }

    const endLoc = this.previous().loc.end;
    return {
      type: 'Document',
      directives,
      variables,
      components,
      canvas,
      canvases: canvases.length > 0 ? canvases : (canvas ? [canvas] : undefined),
      elements,
      diagnostics: this.diagnostics,
      loc: { start: startLoc, end: endLoc, file: this.filename }
    };
  }

  // ==========================================================================
  // Directives & Declarations
  // ==========================================================================

  private parseImportDirective(): ImportDirectiveNode {
    const startLoc = this.consume(TokenType.DIRECTIVE_IMPORT, "Expected '@import'").loc.start;
    const pathTok = this.consume(TokenType.STRING, "Expected file path string after '@import'");
    this.consume(TokenType.SEMICOLON, "Expected ';' after @import directive");
    return {
      type: 'ImportDirective',
      path: pathTok.value,
      loc: { start: startLoc, end: this.previous().loc.end, file: this.filename }
    };
  }

  private parseFontDirective(): FontDirectiveNode {
    const startLoc = this.consume(TokenType.DIRECTIVE_FONT, "Expected '@font'").loc.start;
    const pathTok = this.consume(TokenType.STRING, "Expected font path string after '@font'");
    this.consume(TokenType.KW_AS, "Expected 'as' keyword in @font directive");
    const familyTok = this.consumeStringOrIdentifier("Expected font family name after 'as'");

    let weight: string | number | undefined;
    let style: 'normal' | 'italic' | 'oblique' | undefined;

    // Optional weight or style before semicolon. Accepts both bare keywords
    // (`@font "x" as Inter bold italic;`) and labeled forms
    // (`weight: 400 style: normal;`) as documented in the grammar reference.
    while (!this.check(TokenType.SEMICOLON) && !this.isAtEnd()) {
      const val = this.peek().value.toLowerCase();
      if ((val === 'weight' || val === 'style') && this.peek(1).type === TokenType.COLON) {
        const label = this.advance().value.toLowerCase();
        this.advance(); // ':'
        if (!this.isAtEnd()) {
          const valueTok = this.advance();
          const v = String(valueTok.value).toLowerCase();
          if (label === 'weight') {
            weight = /^\d+$/.test(v) ? Number(v) : v;
          } else {
            style = v as any;
          }
        }
        continue;
      }
      if (['normal', 'italic', 'oblique'].includes(val)) {
        style = val as any;
        this.advance();
      } else if ([
        'thin', 'hairline', 'extralight', 'extra-light', 'ultralight', 'ultra-light',
        'light', 'regular', 'normal', 'medium', 'semibold', 'semi-bold', 'demibold', 'demi-bold',
        'bold', 'bolder', 'extrabold', 'extra-bold', 'ultrabold', 'ultra-bold',
        'black', 'heavy', 'lighter',
        '100', '200', '300', '400', '500', '600', '700', '800', '900'
      ].includes(val)) {
        weight = isNaN(Number(val)) ? val : Number(val);
        this.advance();
      } else {
        break;
      }
    }

    this.consume(TokenType.SEMICOLON, "Expected ';' after @font directive");
    return {
      type: 'FontDirective',
      path: pathTok.value,
      family: familyTok.value,
      weight,
      style,
      loc: { start: startLoc, end: this.previous().loc.end, file: this.filename }
    };
  }

  private parseVariableDeclaration(): VariableDeclarationNode {
    const varTok = this.consume(TokenType.VARIABLE, 'Expected variable');
    
    if (this.match(TokenType.COLON)) {
      this.reportError(`Note: Variables are declared with '=' (e.g. >${varTok.value} = ...;)`, this.previous().loc);
    } else {
      this.consume(TokenType.EQUALS, "Expected '=' after variable name");
    }

    const value = this.parseValue();
    this.consume(TokenType.SEMICOLON, "Expected ';' after variable declaration");
    return {
      type: 'VariableDeclaration',
      name: varTok.value,
      value,
      loc: { start: varTok.loc.start, end: this.previous().loc.end, file: this.filename }
    };
  }

  private parseComponentDeclaration(): ComponentDeclarationNode {
    const startLoc = this.consume(TokenType.KW_COMPONENT, "Expected 'component'").loc.start;
    const nameTok = this.consume(TokenType.IDENTIFIER, 'Expected component name');
    const parameters: ComponentParameterNode[] = [];

    if (this.match(TokenType.LPAREN)) {
      if (!this.check(TokenType.RPAREN)) {
        do {
          const pStart = this.peek().loc.start;
          let pName = '';
          if (this.check(TokenType.VARIABLE)) {
            pName = this.advance().value;
          } else {
            pName = this.consume(TokenType.IDENTIFIER, 'Expected parameter name').value;
          }

          let defaultValue: ValueNode | undefined;
          if (this.match(TokenType.EQUALS)) {
            defaultValue = this.parseValue();
          } else if (this.match(TokenType.COLON)) {
            // Extended form: name: Type = default. Parse the type annotation,
            // then the real default when present, so the comma chain survives.
            const typeVal = this.parseValue();
            if (this.match(TokenType.EQUALS)) {
              defaultValue = this.parseValue();
            } else {
              defaultValue = typeVal;
            }
          }

          parameters.push({
            type: 'ComponentParameter',
            name: pName,
            defaultValue,
            loc: { start: pStart, end: this.previous().loc.end, file: this.filename }
          });
        } while (this.match(TokenType.COMMA) && !this.check(TokenType.RPAREN));
      }
      this.consume(TokenType.RPAREN, "Expected ')' after component parameters");
    }

    this.consume(TokenType.LBRACE, "Expected '{' before component body");
    const properties: PropertyNode[] = [];
    const elements: ElementNode[] = [];

    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      try {
        if (this.isElementStart()) {
          elements.push(this.parseElementDeclaration());
        } else if (this.isPropertyStart()) {
          properties.push(this.parseProperty());
        } else {
          const tok = this.advance();
          this.reportError(`Unexpected token '${tok.value}' in component body`, tok.loc);
          this.synchronizeStatement();
        }
      } catch (err) {
        this.synchronizeStatement();
      }
    }

    this.consume(TokenType.RBRACE, "Expected '}' after component body");

    return {
      type: 'ComponentDeclaration',
      name: nameTok.value,
      parameters,
      properties,
      elements,
      loc: { start: startLoc, end: this.previous().loc.end, file: this.filename }
    };
  }

  private parseCanvasDeclaration(): CanvasDeclarationNode {
    const startLoc = this.consume(TokenType.KW_CANVAS, "Expected 'canvas'").loc.start;
    let name: string | undefined;
    let mode: 'graphic' | 'photo' | undefined;
    let photoSrc: string | undefined;

    if (this.match(TokenType.KW_PHOTO)) {
      mode = 'photo';
      if (this.check(TokenType.STRING)) {
        photoSrc = this.advance().value;
      }
    }

    if (this.check(TokenType.STRING) || this.check(TokenType.IDENTIFIER)) {
      name = this.advance().value;
    }

    this.consume(TokenType.LBRACE, "Expected '{' after canvas");
    const properties: PropertyNode[] = [];
    const elements: ElementNode[] = [];

    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      try {
        if (this.isElementStart()) {
          elements.push(this.parseElementDeclaration());
        } else {
          properties.push(this.parseProperty());
        }
      } catch (err) {
        this.synchronizeStatement();
      }
    }

    this.consume(TokenType.RBRACE, "Expected '}' after canvas block");
    return {
      type: 'CanvasDeclaration',
      name,
      mode,
      photoSrc,
      properties,
      elements: elements.length > 0 ? elements : undefined,
      loc: { start: startLoc, end: this.previous().loc.end, file: this.filename }
    };
  }

  // ==========================================================================
  // Elements
  // ==========================================================================

  private parseElementDeclaration(): ElementNode {
    const startLoc = this.peek().loc.start;
    const typeTok = this.advance();
    let elemType = typeTok.value;
    let id: string | undefined;
    let name: string | undefined;
    let textShorthand: string | undefined;
    const args: ComponentArgumentNode[] = [];

    // Check for arguments on custom component e.g. Arrow(size: 240px)
    if (this.match(TokenType.LPAREN)) {
      if (!this.check(TokenType.RPAREN)) {
        do {
          const argStart = this.peek().loc.start;
          let argName: string | undefined;

          if (this.isIdentifier(this.peek()) && this.peek(1).type === TokenType.COLON) {
            argName = this.advance().value;
            this.advance(); // consume ':'
          }

          const val = this.parseValue();
          args.push({
            type: 'ComponentArgument',
            name: argName,
            value: val,
            loc: { start: argStart, end: this.previous().loc.end, file: this.filename }
          });
        } while (this.match(TokenType.COMMA) && !this.check(TokenType.RPAREN));
      }
      this.consume(TokenType.RPAREN, "Expected ')' after component arguments");
    }

    // Element headers: #id, "Layer Name", or text string for text element
    while (!this.check(TokenType.LBRACE) && !this.check(TokenType.SEMICOLON) && !this.isAtEnd()) {
      if (this.check(TokenType.ELEMENT_ID)) {
        id = this.advance().value;
      } else if (this.check(TokenType.HEX_COLOR)) {
        id = this.advance().value.replace(/^#/, '');
      } else if (this.check(TokenType.STRING)) {
        const strVal = this.advance().value;
        if (elemType === 'text' && !textShorthand) {
          textShorthand = strVal;
        } else if (!name) {
          name = strVal;
        }
      } else if (this.check(TokenType.VARIABLE)) {
        const varTok = this.advance();
        if (elemType === 'text' && !textShorthand) {
          textShorthand = `>${varTok.value}`;
        } else if (!name) {
          name = `>${varTok.value}`;
        }
      } else if (this.check(TokenType.IDENTIFIER)) {
        if (!name) {
          name = this.advance().value;
        } else {
          break;
        }
      } else {
        break;
      }
    }

    const properties: PropertyNode[] = [];
    const children: ElementNode[] = [];

    if (this.match(TokenType.LBRACE)) {
      while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
        try {
          if (this.isElementStart()) {
            children.push(this.parseElementDeclaration());
          } else if (this.isPropertyStart()) {
            properties.push(this.parseProperty());
          } else {
            const tok = this.advance();
            this.reportError(`Unexpected token '${tok.value}' in element body`, tok.loc);
            this.synchronizeStatement();
          }
        } catch (err) {
          this.synchronizeStatement();
        }
      }
      this.consume(TokenType.RBRACE, "Expected '}' after element body");
    } else if (this.match(TokenType.SEMICOLON)) {
      // Empty self-closing element e.g. Arrow(size: 240px) #a1;
    }

    const endLoc = this.previous().loc.end;
    const base = {
      id,
      name,
      properties,
      children: children.length > 0 ? children : undefined,
      loc: { start: startLoc, end: endLoc, file: this.filename }
    };

    switch (elemType) {
      case 'rect':
        return { type: 'RectElement', ...base };
      case 'circle':
        return { type: 'CircleElement', ...base };
      case 'text':
        return { type: 'TextElement', text: textShorthand, ...base };
      case 'polygon':
        return { type: 'PolygonElement', ...base };
      case 'path':
        return { type: 'PathElement', ...base };
      case 'image':
        return { type: 'ImageElement', ...base };
      case 'adjust':
        return { type: 'AdjustElement', ...base };
      case 'group':
        return { type: 'GroupElement', ...base, children };
      case 'grid':
        return { type: 'GridElement', ...base, children };
      case 'stack':
        return { type: 'StackElement', ...base, children };
      case 'icon':
        return { type: 'IconElement', ...base };
      case 'star':
      case 'triangle':
      case 'arrow':
      case 'cross':
        return { type: 'ShapeElement', shapeType: elemType, ...base };
      case 'slot':
        return { type: 'SlotElement', ...base };
      default:
        // Custom component instance
        return {
          type: 'ComponentInstance',
          componentName: elemType,
          arguments: args,
          ...base,
          children: children.length > 0 ? children : undefined
        };
    }
  }

  // ==========================================================================
  // Properties & Values
  // ==========================================================================

  private parseProperty(): PropertyNode {
    const nameTok = this.advance();
    const startLoc = nameTok.loc.start;
    this.consume(TokenType.COLON, `Expected ':' after property '${nameTok.value}'`);
    const value = this.parsePropertyValue(nameTok.value);
    this.consume(TokenType.SEMICOLON, `Expected ';' after property '${nameTok.value}'`);
    return {
      type: 'Property',
      name: nameTok.value,
      value,
      loc: { start: startLoc, end: this.previous().loc.end, file: this.filename }
    };
  }

  private parsePropertyValue(propName: string): ValueNode {
    // Specialized parsing based on property name
    if (propName === 'at') {
      return this.parseAtValue();
    }
    if (propName === 'points') {
      return this.parsePointsValue();
    }
    if (propName === 'filter' || propName === 'backdrop-filter' || propName === 'backdropFilter') {
      return this.parseFilterValue();
    }
    if (propName === 'font') {
      return this.parseFontValue();
    }
    if (propName === 'stroke') {
      return this.parseStrokeValue();
    }
    if (propName === 'ratio' || propName === 'aspect-ratio' || propName === 'aspectRatio') {
      const startLoc = this.peek().loc.start;
      if (this.check(TokenType.STRING)) {
        return this.parseSingleValue();
      }
      if (this.check(TokenType.NUMBER) && this.peek(1).type === TokenType.COLON && this.peek(2).type === TokenType.NUMBER) {
        const num1 = this.advance().value;
        this.advance(); // consume ':'
        const num2 = this.advance().value;
        return {
          type: 'StringLiteral',
          value: `${num1}:${num2}`,
          loc: { start: startLoc, end: this.previous().loc.end, file: this.filename }
        };
      }
    }
    if (['export', 'exports', 'format', 'formats'].includes(propName)) {
      const startLoc = this.peek().loc.start;
      if (this.check(TokenType.LBRACKET)) {
        return this.parseValue();
      }
      const items: ValueNode[] = [];
      while (!this.check(TokenType.SEMICOLON) && !this.isAtEnd()) {
        const tok = this.peek();
        if (tok.type === TokenType.IDENTIFIER || tok.type === TokenType.STRING || tok.type.startsWith('KW_')) {
          const itemLoc = tok.loc.start;
          const val = this.advance().value;
          items.push({
            type: 'StringLiteral',
            value: val,
            loc: { start: itemLoc, end: this.previous().loc.end, file: this.filename }
          });
          this.match(TokenType.COMMA);
        } else {
          break;
        }
      }
      if (items.length === 1) {
        return items[0];
      }
      if (items.length > 1) {
        return {
          type: 'ArrayLiteral',
          elements: items,
          loc: { start: startLoc, end: this.previous().loc.end, file: this.filename }
        };
      }
    }
    if (propName === 'scale' || propName === 'scales') {
      const startLoc = this.peek().loc.start;
      if (this.check(TokenType.LBRACKET)) {
        return this.parseValue();
      }
      const items: ValueNode[] = [];
      while (!this.check(TokenType.SEMICOLON) && !this.isAtEnd()) {
        const tok = this.peek();
        if (tok.type === TokenType.NUMBER || tok.type === TokenType.DIMENSION) {
          items.push(this.parseSingleValue());
          this.match(TokenType.COMMA);
        } else if (tok.type === TokenType.IDENTIFIER && tok.value.endsWith('x')) {
          const numVal = parseFloat(tok.value.replace(/x$/i, ''));
          items.push({
            type: 'NumberLiteral',
            value: numVal,
            raw: tok.value,
            loc: { start: tok.loc.start, end: tok.loc.end, file: this.filename }
          });
          this.advance();
          this.match(TokenType.COMMA);
        } else {
          break;
        }
      }
      if (items.length === 1) return items[0];
      if (items.length > 1) {
        return {
          type: 'ArrayLiteral',
          elements: items,
          loc: { start: startLoc, end: this.previous().loc.end, file: this.filename }
        };
      }
    }
    if (['font-features', 'fontFeatures', 'font-variation', 'fontVariation', 'guides', 'guide', 'shadows'].includes(propName)) {
      const startLoc = this.peek().loc.start;
      if (this.check(TokenType.LBRACKET)) {
        return this.parseValue();
      }
      const items: ValueNode[] = [];
      while (!this.check(TokenType.SEMICOLON) && !this.check(TokenType.RBRACE) && !this.isAtEnd()) {
        const before = this.peek().loc.start;
        const item = this.parseSingleValue();
        items.push(item);
        this.match(TokenType.COMMA);
        // Progress guarantee against pathological inputs.
        if (this.peek().loc.start.line === before.line &&
            this.peek().loc.start.column === before.column) break;
      }
      if (items.length === 1) return items[0];
      if (items.length > 1) {
        return {
          type: 'ArrayLiteral',
          elements: items,
          loc: { start: startLoc, end: this.previous().loc.end, file: this.filename }
        };
      }
    }

    return this.parseValue();
  }

  private parseAtValue(): ValueNode {
    const startLoc = this.peek().loc.start;

    // Check for relational positions: right of #id, below #id, center of canvas, etc.
    const relationalKeywords = ['right', 'left', 'above', 'below', 'center', 'inside', 'top', 'bottom', 'top-left', 'top-right', 'bottom-left', 'bottom-right'];
    const peekVal = this.peek().value;

    if (relationalKeywords.includes(peekVal)) {
      const relWord = this.advance().value;
      let relation: RelationalRelation;

      if (['right', 'left', 'center', 'top-left', 'top-right', 'bottom-left', 'bottom-right'].includes(relWord)) {
        this.match(TokenType.KW_OF); // optional 'of'
        relation = `${relWord} of` as RelationalRelation;
      } else if (['above', 'below', 'inside'].includes(relWord)) {
        this.match(TokenType.KW_OF);
        relation = relWord as RelationalRelation;
      } else if (relWord === 'top' || relWord === 'bottom') {
        this.match(TokenType.KW_OF);
        relation = (relWord === 'top' ? 'above' : 'below') as RelationalRelation;
      } else {
        relation = 'right of';
      }

      // Target: #id, canvas, parent, or identifier (default to 'parent' if none)
      let target = 'parent';
      if (this.check(TokenType.ELEMENT_ID)) {
        target = this.advance().value;
      } else if (this.check(TokenType.HEX_COLOR)) {
        target = this.advance().value.replace(/^#/, '');
      } else if (this.check(TokenType.KW_CANVAS) || this.check(TokenType.IDENTIFIER)) {
        if (!['offset', '+', ';'].includes(this.peek().value)) {
           target = this.advance().value;
        }
      }

      // Optional offset: offset 20px / offset 20px 40px / offset (20px, 40px)
      let offset: ValueNode | undefined;
      if (this.match(TokenType.KW_OFFSET) || this.match(TokenType.PLUS)) {
        if (this.check(TokenType.LPAREN)) {
          // offset: (16px, 24px)
          offset = this.parseValue(); // This parses a CoordinateValueNode
        } else {
          // offset: 16px 24px
          const x = this.parseSingleValue();
          if (this.isSingleValueStart() && !this.check(TokenType.SEMICOLON) && !this.check(TokenType.COMMA) && !this.check(TokenType.RBRACE)) {
            const y = this.parseSingleValue();
            offset = {
              type: 'CoordinateValue',
              x,
              y,
              loc: { start: x.loc.start, end: y.loc.end, file: this.filename }
            };
          } else {
            offset = x;
          }
        }
      } else if (this.check(TokenType.DIMENSION) || this.check(TokenType.NUMBER)) {
        offset = this.parseSingleValue();
      }

      return {
        type: 'RelationalPosition',
        relation,
        target,
        offset,
        loc: { start: startLoc, end: this.previous().loc.end, file: this.filename }
      };
    }

    const val = this.parseValue();
    if (val.type === 'DimensionLiteral' || val.type === 'NumberLiteral') {
      this.reportError("Property 'at' requires two coordinates (x y) or a relational position", {
        start: startLoc,
        end: this.previous().loc.end,
        file: this.filename
      });
    }
    return val;
  }

  private parsePointsValue(): ValueNode {
    const startLoc = this.peek().loc.start;
    if (this.check(TokenType.VARIABLE)) {
      return this.parseSingleValue();
    }
    const points: Point2DNode[] = [];
    const hasBracket = this.match(TokenType.LBRACKET);

    while (!this.check(TokenType.SEMICOLON) && !this.check(TokenType.RBRACKET) && !this.isAtEnd()) {
      const pStart = this.peek().loc.start;
      if (this.match(TokenType.LPAREN)) {
        const x = this.parseSingleValue();
        this.match(TokenType.COMMA);
        const y = this.parseSingleValue();
        this.consume(TokenType.RPAREN, "Expected ')' after point coordinates");
        points.push({
          type: 'Point2D',
          x,
          y,
          loc: { start: pStart, end: this.previous().loc.end, file: this.filename }
        });
      } else if (this.isSingleValueStart()) {
        const x = this.parseSingleValue();
        this.match(TokenType.COMMA);
        const y = this.parseSingleValue();
        points.push({
          type: 'Point2D',
          x,
          y,
          loc: { start: pStart, end: this.previous().loc.end, file: this.filename }
        });
      } else {
        break;
      }
      this.match(TokenType.COMMA);
    }

    if (hasBracket) {
      this.consume(TokenType.RBRACKET, "Expected ']' after points array");
    }

    return {
      type: 'PointsValue',
      points,
      loc: { start: startLoc, end: this.previous().loc.end, file: this.filename }
    };
  }

  private parseFilterValue(): ValueNode {
    const startLoc = this.peek().loc.start;
    const filters: FilterFunctionNode[] = [];
    const filterNames = new Set([
      'blur', 'saturate', 'brightness', 'contrast', 'grayscale', 'sepia', 'invert', 'hue-rotate', 'drop-shadow', 'opacity'
    ]);

    while (!this.check(TokenType.SEMICOLON) && !this.isAtEnd()) {
      const tok = this.peek();
      if (filterNames.has(tok.value) || this.isFilterFunctionToken(tok.type)) {
        const fnStart = this.advance().loc.start;
        this.consume(TokenType.LPAREN, `Expected '(' after filter function '${tok.value}'`);
        const args: ValueNode[] = [];
        while (!this.check(TokenType.RPAREN) && !this.isAtEnd()) {
          // An unterminated function must never swallow the rest of the
          // document: stop at statement boundaries.
          if (this.check(TokenType.SEMICOLON) || this.check(TokenType.RBRACE)) break;
          args.push(this.parseSingleValue());
          this.match(TokenType.COMMA);
        }
        if (!this.match(TokenType.RPAREN)) {
          if (filters.length === 0 && args.length === 0 &&
              !this.check(TokenType.SEMICOLON) && !this.check(TokenType.RBRACE)) {
            // Completely malformed first function with junk arguments:
            // degrade to the generic value parser.
            return this.parseValue();
          }
          // Unterminated but recoverable (e.g. "blur(4px }"): keep the
          // parsed arguments and leave the stream at the statement boundary
          // so the enclosing element can still close cleanly.
        }
        filters.push({
          type: 'FilterFunction',
          name: tok.value,
          arguments: args,
          loc: { start: fnStart, end: this.previous().loc.end, file: this.filename }
        });
      } else {
        break;
      }
    }

    if (filters.length === 0) {
      return this.parseValue();
    }

    return {
      type: 'FilterValue',
      filters,
      loc: { start: startLoc, end: this.previous().loc.end, file: this.filename }
    };
  }

  private parseFontValue(): ValueNode {
    const startLoc = this.peek().loc.start;
    let style: 'normal' | 'italic' | 'oblique' | undefined;
    let weight: string | number | undefined;
    let size: ValueNode | undefined;
    let family: string | undefined;

    while (!this.check(TokenType.SEMICOLON) && !this.isAtEnd()) {
      const tok = this.peek();
      const val = tok.value.toLowerCase();

      if (['normal', 'italic', 'oblique'].includes(val) && !style) {
        style = val as any;
        this.advance();
      } else if (['bold', 'bolder', 'lighter', '100', '200', '300', '400', '500', '600', '700', '800', '900'].includes(val) && !weight) {
        weight = isNaN(Number(val)) ? val : Number(val);
        this.advance();
      } else if ((tok.type === TokenType.DIMENSION || tok.type === TokenType.NUMBER || tok.type === TokenType.VARIABLE) && !size) {
        size = this.parseSingleValue();
      } else if (tok.type === TokenType.VARIABLE && !family) {
        family = '>' + this.advance().value;
      } else if (tok.type === TokenType.STRING || tok.type === TokenType.IDENTIFIER) {
        family = this.advance().value;
      } else {
        break;
      }
    }

    if (!size && !family) {
      return this.parseValue();
    }

    return {
      type: 'FontValue',
      style,
      weight,
      size,
      family,
      loc: { start: startLoc, end: this.previous().loc.end, file: this.filename }
    };
  }

  private parseStrokeValue(): ValueNode {
    const startLoc = this.peek().loc.start;
    let color: ValueNode | undefined;
    let width: ValueNode | undefined;
    let style: 'solid' | 'dashed' | 'dotted' | undefined;

    while (!this.check(TokenType.SEMICOLON) && !this.isAtEnd()) {
      const tok = this.peek();
      if (['solid', 'dashed', 'dotted'].includes(tok.value)) {
        style = tok.value as any;
        this.advance();
      } else if (tok.type === TokenType.DIMENSION || (tok.type === TokenType.NUMBER && width === undefined)) {
        width = this.parseSingleValue();
      } else if (this.isColorToken(tok) || tok.type === TokenType.VARIABLE) {
        color = this.parseSingleValue();
      } else {
        break;
      }
    }

    if (!color && !width && !style) {
      return this.parseValue();
    }

    return {
      type: 'StrokeValue',
      color,
      width,
      style,
      loc: { start: startLoc, end: this.previous().loc.end, file: this.filename }
    };
  }

  public parseValue(): ValueNode {
    const startLoc = this.peek().loc.start;

    // Object literal: { colors: { ... }, spacing: ... }
    if (this.check(TokenType.LBRACE)) {
      this.advance();
      const properties: Record<string, ValueNode> = {};
      while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
        const keyTok = this.consumeStringOrIdentifier("Expected property key in object literal");
        const key = keyTok.value;
        this.consume(TokenType.COLON, "Expected ':' after property key");
        const value = this.parseValue();
        properties[key] = value;
        if (this.check(TokenType.COMMA)) {
          this.advance();
        }
      }
      this.consume(TokenType.RBRACE, "Expected '}' after object properties");
      return {
        type: 'ObjectLiteral',
        properties,
        loc: { start: startLoc, end: this.previous().loc.end, file: this.filename }
      };
    }

    // Parenthesized coordinate tuple: (x, y)
    if (this.check(TokenType.LPAREN)) {
      this.advance();
      const x = this.parseValue();
      this.consume(TokenType.COMMA, "Expected ',' in coordinate tuple");
      const y = this.parseValue();
      this.consume(TokenType.RPAREN, "Expected ')' after coordinate tuple");
      return {
        type: 'CoordinateValue',
        x,
        y,
        loc: { start: startLoc, end: this.previous().loc.end, file: this.filename }
      };
    }

    // Array literal: [a, b, c] or [a b c]
    if (this.check(TokenType.LBRACKET)) {
      this.advance();
      let elements: ValueNode[] = [];
      if (!this.check(TokenType.RBRACKET)) {
        do {
          const val = this.parseValue();
          if (val.type === 'ExpressionList') {
            elements.push(...val.expressions);
          } else {
            elements.push(val);
          }
          this.match(TokenType.COMMA); // consume optional comma
        } while (!this.check(TokenType.RBRACKET) && !this.isAtEnd());
      }
      this.consume(TokenType.RBRACKET, "Expected ']' after array elements");
      return {
        type: 'ArrayLiteral',
        elements,
        loc: { start: startLoc, end: this.previous().loc.end, file: this.filename }
      };
    }

    const first = this.parseSingleValue();

    // Check for expression list (multiple space-separated values e.g. "size: 200px 100px;")
    const items: ValueNode[] = [first];
    while (this.isSingleValueStart() && !this.check(TokenType.SEMICOLON) && !this.check(TokenType.COMMA) && !this.check(TokenType.RBRACE) && !this.check(TokenType.RPAREN) && !this.check(TokenType.RBRACKET)) {
      items.push(this.parseSingleValue());
    }

    if (items.length === 1) {
      return first;
    }

    // If exactly 2 dimension/number/size-keyword values, treat as coordinate / size tuple
    if (items.length === 2 &&
      (items[0].type === 'DimensionLiteral' || items[0].type === 'NumberLiteral' || (items[0].type === 'Identifier' && ['hug', 'fill', 'auto'].includes(items[0].name))) &&
      (items[1].type === 'DimensionLiteral' || items[1].type === 'NumberLiteral' || (items[1].type === 'Identifier' && ['hug', 'fill', 'auto'].includes(items[1].name)))) {
      return {
        type: 'CoordinateValue',
        x: items[0],
        y: items[1],
        loc: { start: startLoc, end: items[1].loc.end, file: this.filename }
      };
    }

    return {
      type: 'ExpressionList',
      expressions: items,
      loc: { start: startLoc, end: items[items.length - 1].loc.end, file: this.filename }
    };
  }

  private parseSingleValue(): ValueNode {
    const tok = this.peek();
    const startLoc = tok.loc.start;

    // Number literal
    if (tok.type === TokenType.NUMBER) {
      this.advance();
      return {
        type: 'NumberLiteral',
        value: tok.numberValue ?? parseFloat(tok.value),
        raw: tok.value,
        loc: { start: startLoc, end: this.previous().loc.end, file: this.filename }
      };
    }

    // Dimension literal
    if (tok.type === TokenType.DIMENSION) {
      this.advance();
      return {
        type: 'DimensionLiteral',
        value: tok.numberValue ?? parseFloat(tok.value),
        unit: (tok.unit as UnitType) || 'px',
        raw: tok.value,
        loc: { start: startLoc, end: this.previous().loc.end, file: this.filename }
      };
    }

    // String literal
    if (tok.type === TokenType.STRING) {
      this.advance();
      return {
        type: 'StringLiteral',
        value: tok.value,
        loc: { start: startLoc, end: this.previous().loc.end, file: this.filename }
      };
    }

    // Boolean literal
    if (tok.type === TokenType.KW_TRUE || tok.type === TokenType.KW_FALSE) {
      this.advance();
      return {
        type: 'BooleanLiteral',
        value: tok.type === TokenType.KW_TRUE,
        loc: { start: startLoc, end: this.previous().loc.end, file: this.filename }
      };
    }

    // Hex Color
    if (tok.type === TokenType.HEX_COLOR) {
      this.advance();
      return {
        type: 'ColorLiteral',
        format: 'hex',
        value: tok.value,
        loc: { start: startLoc, end: this.previous().loc.end, file: this.filename }
      };
    }

    // currentColor
    if (tok.type === TokenType.KW_CURRENT_COLOR) {
      this.advance();
      return {
        type: 'ColorLiteral',
        format: 'currentColor',
        value: 'currentColor',
        loc: { start: startLoc, end: this.previous().loc.end, file: this.filename }
      };
    }

    // Variable reference
    if (tok.type === TokenType.VARIABLE) {
      this.advance();
      return {
        type: 'VariableReference',
        name: tok.value,
        loc: { start: startLoc, end: this.previous().loc.end, file: this.filename }
      };
    }

    // Element ID reference
    if (tok.type === TokenType.ELEMENT_ID) {
      this.advance();
      return {
        type: 'ElementReference',
        targetId: tok.value,
        loc: { start: startLoc, end: this.previous().loc.end, file: this.filename }
      };
    }

    // Linear gradient: linear-gradient(...)
    if (tok.type === TokenType.KW_LINEAR_GRADIENT) {
      return this.parseLinearGradient();
    }

    // Radial gradient: radial-gradient(...)
    if (tok.type === TokenType.KW_RADIAL_GRADIENT) {
      return this.parseRadialGradient();
    }

    // Conic gradient: conic-gradient(...)
    if (tok.type === TokenType.KW_CONIC_GRADIENT) {
      return this.parseConicGradient();
    }

    // Calc: calc(...)
    if (tok.type === TokenType.KW_CALC) {
      return this.parseCalcValue();
    }

    // Functional colors: rgb(), rgba(), hsl(), hsla()
    if (this.isColorFunction(tok)) {
      return this.parseColorFunction();
    }

    // Color transform functions: alpha(), lighten(), darken()
    if (this.isColorTransformFunction(tok)) {
      return this.parseColorTransformFunction();
    }

    // Terminator reached where a VALUE was expected: report it and consume
    // the token so callers always make progress instead of swallowing the
    // next property.
    if ([TokenType.SEMICOLON, TokenType.RBRACE, TokenType.RPAREN, TokenType.RBRACKET, TokenType.COMMA].includes(tok.type)) {
      this.reportError(`Expected a value but found '${tok.value}'`, tok.loc);
      this.advance();
      return {
        type: 'Identifier',
        name: '',
        loc: { start: tok.loc.start, end: tok.loc.end, file: this.filename }
      };
    }

    // General identifier / keyword
    const identTok = this.advance();
    if (identTok.value && identTok.value.startsWith('$')) {
      this.reportError(`Variables cannot be declared or referenced with '$'. Use '>' instead (e.g. >${identTok.value.slice(1)}).`, identTok.loc);
    }
    return {
      type: 'Identifier',
      name: identTok.value,
      loc: { start: startLoc, end: this.previous().loc.end, file: this.filename }
    };
  }

  private parseCalcValue(): ValueNode {
    const startLoc = this.consume(TokenType.KW_CALC, "Expected 'calc'").loc.start;
    this.consume(TokenType.LPAREN, "Expected '(' after calc");
    
    // Simplistic capture of calc expression tokens until matching RPAREN
    let parenCount = 1;
    let expression = '';
    
    while (!this.isAtEnd()) {
      const tok = this.peek();
      if (tok.type === TokenType.LPAREN) parenCount++;
      if (tok.type === TokenType.RPAREN) {
        parenCount--;
        if (parenCount === 0) break;
      }
      if (tok.type === TokenType.VARIABLE) {
        expression += '>' + tok.value + ' ';
      } else {
        expression += tok.value + ' ';
      }
      this.advance();
    }
    
    this.consume(TokenType.RPAREN, "Expected ')' after calc expression");
    return {
      type: 'CalcValue',
      expression: expression.trim(),
      loc: { start: startLoc, end: this.previous().loc.end, file: this.filename }
    };
  }

  private parseConicGradient(): ConicGradientNode {
    const startLoc = this.consume(TokenType.KW_CONIC_GRADIENT, "Expected 'conic-gradient'").loc.start;
    this.consume(TokenType.LPAREN, "Expected '(' after conic-gradient");
    let angle: ValueNode | undefined;
    const stops: GradientStopNode[] = [];

    if (this.peek().value === 'from') {
      this.advance(); // consume 'from'
      angle = this.parseSingleValue();
      this.match(TokenType.COMMA);
    } else if (this.peek().type === TokenType.DIMENSION) {
      angle = this.parseSingleValue();
      this.match(TokenType.COMMA);
    }

    while (!this.check(TokenType.RPAREN) && !this.isAtEnd()) {
      const stopStart = this.peek().loc.start;
      const color = this.parseSingleValue();
      let position: ValueNode | undefined;
      if (this.isSingleValueStart() && !this.check(TokenType.COMMA) && !this.check(TokenType.RPAREN)) {
        position = this.parseSingleValue();
      }
      stops.push({
        type: 'GradientStop',
        color,
        position,
        loc: { start: stopStart, end: this.previous().loc.end, file: this.filename }
      });
      this.match(TokenType.COMMA);
    }

    this.consume(TokenType.RPAREN, "Expected ')' after conic-gradient");
    return {
      type: 'ConicGradient',
      angle,
      stops,
      loc: { start: startLoc, end: this.previous().loc.end, file: this.filename }
    };
  }

  private parseLinearGradient(): LinearGradientNode {
    const startLoc = this.consume(TokenType.KW_LINEAR_GRADIENT, "Expected 'linear-gradient'").loc.start;
    this.consume(TokenType.LPAREN, "Expected '(' after linear-gradient");
    let direction: ValueNode | undefined;
    const stops: GradientStopNode[] = [];

    // Check if first arg is direction (e.g. 'to right', '45deg', etc.)
    if (this.peek().value === 'to' || this.peek().type === TokenType.DIMENSION) {
      if (this.peek().value === 'to') {
        const dirStart = this.advance().loc.start;
        let dirStr = 'to';
        while (this.peek().type !== TokenType.COMMA && !this.check(TokenType.RPAREN) && !this.isAtEnd()) {
          dirStr += ' ' + this.advance().value;
        }
        direction = {
          type: 'StringLiteral',
          value: dirStr,
          loc: { start: dirStart, end: this.previous().loc.end, file: this.filename }
        };
      } else {
        direction = this.parseSingleValue();
      }
      this.match(TokenType.COMMA);
    }

    // Parse stops
    while (!this.check(TokenType.RPAREN) && !this.isAtEnd()) {
      const stopStart = this.peek().loc.start;
      const color = this.parseSingleValue();
      let position: ValueNode | undefined;
      if (this.isSingleValueStart() && !this.check(TokenType.COMMA) && !this.check(TokenType.RPAREN)) {
        position = this.parseSingleValue();
      }
      stops.push({
        type: 'GradientStop',
        color,
        position,
        loc: { start: stopStart, end: this.previous().loc.end, file: this.filename }
      });
      this.match(TokenType.COMMA);
    }

    this.consume(TokenType.RPAREN, "Expected ')' after linear-gradient");
    return {
      type: 'LinearGradient',
      direction,
      stops,
      loc: { start: startLoc, end: this.previous().loc.end, file: this.filename }
    };
  }

  private parseRadialGradient(): RadialGradientNode {
    const startLoc = this.consume(TokenType.KW_RADIAL_GRADIENT, "Expected 'radial-gradient'").loc.start;
    this.consume(TokenType.LPAREN, "Expected '(' after radial-gradient");
    let shape: 'circle' | 'ellipse' | undefined;
    const stops: GradientStopNode[] = [];

    if (this.peek().value === 'circle' || this.peek().value === 'ellipse') {
      shape = this.advance().value as any;
    }

    // Optional CSS preamble ("at center", "closest-side", "farthest-corner",
    // position keywords...). Radial gradients are always centered on the
    // element box, so these hints are parsed and intentionally ignored rather
    // than being mis-read as gradient stops.
    const PREAMBLE_WORDS = new Set([
      'at', 'center', 'top', 'bottom', 'left', 'right',
      'closest-side', 'farthest-side', 'closest-corner', 'farthest-corner',
      'circle', 'ellipse'
    ]);
    let guard = 0;
    while (!this.check(TokenType.RPAREN) && !this.isAtEnd() && guard++ < 16) {
      const v = this.peek().value;
      if (typeof v === 'string' && PREAMBLE_WORDS.has(v.toLowerCase())) {
        this.advance();
        continue;
      }
      break;
    }
    this.match(TokenType.COMMA);

    while (!this.check(TokenType.RPAREN) && !this.isAtEnd()) {
      const stopStart = this.peek().loc.start;
      const color = this.parseSingleValue();
      let position: ValueNode | undefined;
      if (this.isSingleValueStart() && !this.check(TokenType.COMMA) && !this.check(TokenType.RPAREN)) {
        position = this.parseSingleValue();
      }
      stops.push({
        type: 'GradientStop',
        color,
        position,
        loc: { start: stopStart, end: this.previous().loc.end, file: this.filename }
      });
      this.match(TokenType.COMMA);
    }

    this.consume(TokenType.RPAREN, "Expected ')' after radial-gradient");
    return {
      type: 'RadialGradient',
      shape,
      stops,
      loc: { start: startLoc, end: this.previous().loc.end, file: this.filename }
    };
  }

  private parseColorFunction(): ColorLiteralNode {
    const startLoc = this.peek().loc.start;
    const fnName = this.advance().value.toLowerCase() as 'rgb' | 'rgba' | 'hsl' | 'hsla' | 'cmyk';
    this.consume(TokenType.LPAREN, `Expected '(' after ${fnName}`);
    const rawArgs: string[] = [];
    const args: number[] = [];

    while (!this.check(TokenType.RPAREN) && !this.isAtEnd()) {
      const argTok = this.advance();
      rawArgs.push(argTok.value);
      let num = parseFloat(argTok.value);
      if (argTok.value.endsWith('%')) {
        num = parseFloat(argTok.value.slice(0, -1)) / 100;
      }
      if (!isNaN(num)) {
        args.push(num);
      }
      this.match(TokenType.COMMA);
    }

    this.consume(TokenType.RPAREN, `Expected ')' after ${fnName} arguments`);
    const rawVal = `${fnName}(${rawArgs.join(', ')})`;

    if (fnName === 'cmyk') {
      const c = Math.max(0, Math.min(1, args[0] ?? 0));
      const m = Math.max(0, Math.min(1, args[1] ?? 0));
      const y = Math.max(0, Math.min(1, args[2] ?? 0));
      const k = Math.max(0, Math.min(1, args[3] ?? 0));
      // Standard CMYK -> sRGB conversion
      const r = Math.round(255 * (1 - c) * (1 - k));
      const g = Math.round(255 * (1 - m) * (1 - k));
      const b = Math.round(255 * (1 - y) * (1 - k));
      return {
        type: 'ColorLiteral',
        format: 'cmyk',
        value: rawVal,
        c,
        m,
        y,
        k,
        r,
        g,
        b,
        a: 1,
        loc: { start: startLoc, end: this.previous().loc.end, file: this.filename }
      };
    }

    return {
      type: 'ColorLiteral',
      format: fnName,
      value: rawVal,
      r: args[0],
      g: args[1],
      b: args[2],
      a: args[3],
      loc: { start: startLoc, end: this.previous().loc.end, file: this.filename }
    };
  }

  private parseColorTransformFunction(): ColorTransformNode {
    const startLoc = this.peek().loc.start;
    const fnName = this.advance().value.toLowerCase() as 'alpha' | 'lighten' | 'darken';
    this.consume(TokenType.LPAREN, `Expected '(' after ${fnName}`);
    const color = this.parseSingleValue();
    this.consume(TokenType.COMMA, `Expected ',' after color in ${fnName}()`);
    const amount = this.parseSingleValue();
    this.consume(TokenType.RPAREN, `Expected ')' after ${fnName}() arguments`);

    return {
      type: 'ColorTransform',
      functionName: fnName,
      color,
      amount,
      loc: { start: startLoc, end: this.previous().loc.end, file: this.filename }
    };
  }

  // ==========================================================================
  // Helper Matchers & Stream Queries
  // ==========================================================================

  private isElementStart(): boolean {
    if (this.peek(1).type === TokenType.COLON) return false;
    const tok = this.peek();
    const elementKeywords = [
      TokenType.KW_RECT,
      TokenType.KW_CIRCLE,
      TokenType.KW_TEXT,
      TokenType.KW_POLYGON,
      TokenType.KW_PATH,
      TokenType.KW_IMAGE,
      TokenType.KW_ADJUST,
      TokenType.KW_GROUP,
      TokenType.KW_GRID,
      TokenType.KW_STACK,
      TokenType.KW_ICON,
      TokenType.KW_STAR,
      TokenType.KW_TRIANGLE,
      TokenType.KW_ARROW,
      TokenType.KW_CROSS,
      TokenType.KW_SLOT
    ];
    if (elementKeywords.includes(tok.type)) return true;

    // Fallback for custom components starting with uppercase
    if (tok.type === TokenType.IDENTIFIER && !tok.value.startsWith('$')) {
      if (/^[A-Z]/.test(tok.value)) {
        return true;
      }
    }
    return false;
  }

  private isPropertyStart(): boolean {
    return this.peek(1).type === TokenType.COLON;
  }

  private isSingleValueStart(): boolean {
    const tok = this.peek();
    return (
      tok.type === TokenType.NUMBER ||
      tok.type === TokenType.DIMENSION ||
      tok.type === TokenType.STRING ||
      tok.type === TokenType.KW_TRUE ||
      tok.type === TokenType.KW_FALSE ||
      tok.type === TokenType.HEX_COLOR ||
      tok.type === TokenType.KW_CURRENT_COLOR ||
      tok.type === TokenType.VARIABLE ||
      tok.type === TokenType.ELEMENT_ID ||
      tok.type === TokenType.KW_LINEAR_GRADIENT ||
      tok.type === TokenType.KW_RADIAL_GRADIENT ||
      tok.type === TokenType.KW_CONIC_GRADIENT ||
      tok.type === TokenType.KW_CALC ||
      tok.type.startsWith('KW_') ||
      tok.type === TokenType.IDENTIFIER ||
      this.isColorFunction(tok) ||
      this.isColorTransformFunction(tok)
    );
  }

  private isColorToken(tok: Token): boolean {
    return (
      tok.type === TokenType.HEX_COLOR ||
      tok.type === TokenType.KW_CURRENT_COLOR ||
      this.isColorFunction(tok) ||
      this.isColorTransformFunction(tok)
    );
  }

  private isColorFunction(tok: Token): boolean {
    if (tok.type !== TokenType.IDENTIFIER) return false;
    const val = tok.value.toLowerCase();
    return (val === 'rgb' || val === 'rgba' || val === 'hsl' || val === 'hsla' || val === 'cmyk') && this.peek(1).type === TokenType.LPAREN;
  }

  private isColorTransformFunction(tok: Token): boolean {
    if (tok.type !== TokenType.IDENTIFIER) return false;
    const val = tok.value.toLowerCase();
    return (val === 'alpha' || val === 'lighten' || val === 'darken') && this.peek(1).type === TokenType.LPAREN;
  }

  private isFilterFunctionToken(type: TokenType): boolean {
    return (
      type === TokenType.KW_BLUR ||
      type === TokenType.KW_SATURATE ||
      type === TokenType.KW_BRIGHTNESS ||
      type === TokenType.KW_CONTRAST ||
      type === TokenType.KW_GRAYSCALE ||
      type === TokenType.KW_SEPIA ||
      type === TokenType.KW_INVERT ||
      type === TokenType.KW_HUE_ROTATE ||
      type === TokenType.KW_DROP_SHADOW
    );
  }

  private isIdentifier(tok: Token): boolean {
    return tok.type === TokenType.IDENTIFIER;
  }

  private peek(offset = 0): Token {
    const idx = this.current + offset;
    if (idx >= this.tokens.length) {
      return this.tokens[this.tokens.length - 1];
    }
    return this.tokens[idx];
  }

  private previous(): Token {
    return this.tokens[this.current - 1] ?? this.tokens[0];
  }

  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  private match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance();
    this.reportError(message, this.peek().loc);
    return this.peek();
  }

  private consumeStringOrIdentifier(message: string): Token {
    if (this.check(TokenType.STRING) || this.check(TokenType.IDENTIFIER) || this.peek().type.startsWith('KW_')) {
      return this.advance();
    }
    this.reportError(message, this.peek().loc);
    return this.peek();
  }

  private reportError(message: string, loc: SourceLocation, code = 'TOAD-E001'): void {
    this.diagnostics.push({
      code,
      message,
      severity: 'error',
      loc
    });
  }

  private synchronizeStatement(): void {
    while (!this.isAtEnd()) {
      if (this.previous().type === TokenType.SEMICOLON || this.previous().type === TokenType.RBRACE) {
        return;
      }
      const tok = this.peek();
      if (
        tok.type === TokenType.KW_CANVAS ||
        tok.type === TokenType.KW_COMPONENT ||
        tok.type === TokenType.DIRECTIVE_IMPORT ||
        tok.type === TokenType.DIRECTIVE_FONT ||
        tok.type === TokenType.VARIABLE ||
        this.isElementStart()
      ) {
        return;
      }
      this.advance();
    }
  }
}

export function parseToad(source: string, filename?: string): DocumentNode {
  const tokens = new Lexer(source, filename).tokenize();
  const parser = new Parser(tokens, filename);
  return parser.parse();
}
