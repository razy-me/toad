import { describe, it, expect } from 'vitest';
import { Lexer, TokenType, tokenizeToad } from '../src/parser/lexer.js';

describe('Lexer / Tokenizer', () => {
  it('tokenizes directives and string literals', () => {
    const src = `@import "./tokens.toad";\n@font "./Inter.ttf" as "Inter";`;
    const tokens = tokenizeToad(src);

    expect(tokens[0].type).toBe(TokenType.DIRECTIVE_IMPORT);
    expect(tokens[1].type).toBe(TokenType.STRING);
    expect(tokens[1].value).toBe('./tokens.toad');
    expect(tokens[2].type).toBe(TokenType.SEMICOLON);

    expect(tokens[3].type).toBe(TokenType.DIRECTIVE_FONT);
    expect(tokens[4].type).toBe(TokenType.STRING);
    expect(tokens[4].value).toBe('./Inter.ttf');
    expect(tokens[5].type).toBe(TokenType.KW_AS);
    expect(tokens[6].type).toBe(TokenType.STRING);
    expect(tokens[6].value).toBe('Inter');
    expect(tokens[7].type).toBe(TokenType.SEMICOLON);
    expect(tokens[8].type).toBe(TokenType.EOF);
  });

  it('disambiguates hex colors from element IDs', () => {
    const src = `#fff #ffffff #3b82f6 #12345678 #face #header #button_1 #card-bg`;
    const tokens = tokenizeToad(src);

    expect(tokens[0].type).toBe(TokenType.HEX_COLOR);
    expect(tokens[0].value).toBe('#fff');

    expect(tokens[1].type).toBe(TokenType.HEX_COLOR);
    expect(tokens[1].value).toBe('#ffffff');

    expect(tokens[2].type).toBe(TokenType.HEX_COLOR);
    expect(tokens[2].value).toBe('#3b82f6');

    expect(tokens[3].type).toBe(TokenType.HEX_COLOR);
    expect(tokens[3].value).toBe('#12345678');

    expect(tokens[4].type).toBe(TokenType.HEX_COLOR);
    expect(tokens[4].value).toBe('#face');

    expect(tokens[5].type).toBe(TokenType.ELEMENT_ID);
    expect(tokens[5].value).toBe('header');

    expect(tokens[6].type).toBe(TokenType.ELEMENT_ID);
    expect(tokens[6].value).toBe('button_1');

    expect(tokens[7].type).toBe(TokenType.ELEMENT_ID);
    expect(tokens[7].value).toBe('card-bg');
  });

  it('tokenizes numbers, dimensions, and negative values', () => {
    const src = `10 3.14 -5 100px -20.5px 50% 45deg 1.5rad 2em 12pt 50vw`;
    const tokens = tokenizeToad(src);

    expect(tokens[0].type).toBe(TokenType.NUMBER);
    expect(tokens[0].numberValue).toBe(10);

    expect(tokens[1].type).toBe(TokenType.NUMBER);
    expect(tokens[1].numberValue).toBe(3.14);

    expect(tokens[2].type).toBe(TokenType.NUMBER);
    expect(tokens[2].numberValue).toBe(-5);

    expect(tokens[3].type).toBe(TokenType.DIMENSION);
    expect(tokens[3].numberValue).toBe(100);
    expect(tokens[3].unit).toBe('px');

    expect(tokens[4].type).toBe(TokenType.DIMENSION);
    expect(tokens[4].numberValue).toBe(-20.5);
    expect(tokens[4].unit).toBe('px');

    expect(tokens[5].type).toBe(TokenType.DIMENSION);
    expect(tokens[5].numberValue).toBe(50);
    expect(tokens[5].unit).toBe('%');

    expect(tokens[6].type).toBe(TokenType.DIMENSION);
    expect(tokens[6].numberValue).toBe(45);
    expect(tokens[6].unit).toBe('deg');

    expect(tokens[7].type).toBe(TokenType.DIMENSION);
    expect(tokens[7].numberValue).toBe(1.5);
    expect(tokens[7].unit).toBe('rad');

    expect(tokens[8].type).toBe(TokenType.DIMENSION);
    expect(tokens[8].numberValue).toBe(2);
    expect(tokens[8].unit).toBe('em');

    expect(tokens[9].type).toBe(TokenType.DIMENSION);
    expect(tokens[9].numberValue).toBe(12);
    expect(tokens[9].unit).toBe('pt');

    expect(tokens[10].type).toBe(TokenType.DIMENSION);
    expect(tokens[10].numberValue).toBe(50);
    expect(tokens[10].unit).toBe('vw');
  });

  it('tokenizes variables and relational keywords', () => {
    const src = `>primary = #00f; >secondary = #f00; at: right of #header offset 20px;`;
    const tokens = tokenizeToad(src);

    expect(tokens[0].type).toBe(TokenType.VARIABLE);
    expect(tokens[0].value).toBe('primary');
    expect(tokens[1].type).toBe(TokenType.EQUALS);
    expect(tokens[2].type).toBe(TokenType.HEX_COLOR);
    expect(tokens[3].type).toBe(TokenType.SEMICOLON);

    expect(tokens[4].type).toBe(TokenType.VARIABLE);
    expect(tokens[4].value).toBe('secondary');
    expect(tokens[5].type).toBe(TokenType.EQUALS);
    expect(tokens[6].type).toBe(TokenType.HEX_COLOR);
    expect(tokens[7].type).toBe(TokenType.SEMICOLON);

    expect(tokens[8].type).toBe(TokenType.KW_AT);
    expect(tokens[9].type).toBe(TokenType.COLON);
    expect(tokens[10].type).toBe(TokenType.KW_RIGHT);
    expect(tokens[11].type).toBe(TokenType.KW_OF);
    expect(tokens[12].type).toBe(TokenType.ELEMENT_ID);
    expect(tokens[12].value).toBe('header');
    expect(tokens[13].type).toBe(TokenType.KW_OFFSET);
    expect(tokens[14].type).toBe(TokenType.DIMENSION);
    expect(tokens[14].value).toBe('20px');
    expect(tokens[15].type).toBe(TokenType.SEMICOLON);
  });

  it('skips line comments and block comments with accurate line counting', () => {
    const src = `// Single-line comment\nrect {\n  /* Multi-line\n     block comment */\n  size: 100px 50px;\n}`;
    const tokens = tokenizeToad(src);

    expect(tokens[0].type).toBe(TokenType.KW_RECT);
    expect(tokens[0].loc.start.line).toBe(2);

    expect(tokens[1].type).toBe(TokenType.LBRACE);

    expect(tokens[2].type).toBe(TokenType.IDENTIFIER);
    expect(tokens[2].value).toBe('size');
    expect(tokens[2].loc.start.line).toBe(5);

    expect(tokens[3].type).toBe(TokenType.COLON);
    expect(tokens[4].type).toBe(TokenType.DIMENSION);
    expect(tokens[5].type).toBe(TokenType.DIMENSION);
    expect(tokens[6].type).toBe(TokenType.SEMICOLON);
    expect(tokens[7].type).toBe(TokenType.RBRACE);
  });

  it('handles string escape sequences', () => {
    const src = `"Line 1\\nLine 2\\tTabbed \\"Quotes\\" \\\\ \\u0041"`;
    const tokens = tokenizeToad(src);

    expect(tokens[0].type).toBe(TokenType.STRING);
    expect(tokens[0].value).toBe('Line 1\nLine 2\tTabbed "Quotes" \\ A');
  });

  it('tokenizes gradient and filter function keywords', () => {
    const src = `linear-gradient radial-gradient blur saturate brightness contrast grayscale sepia invert hue-rotate drop-shadow`;
    const tokens = tokenizeToad(src);

    expect(tokens[0].type).toBe(TokenType.KW_LINEAR_GRADIENT);
    expect(tokens[1].type).toBe(TokenType.KW_RADIAL_GRADIENT);
    expect(tokens[2].type).toBe(TokenType.KW_BLUR);
    expect(tokens[3].type).toBe(TokenType.KW_SATURATE);
    expect(tokens[4].type).toBe(TokenType.KW_BRIGHTNESS);
    expect(tokens[5].type).toBe(TokenType.KW_CONTRAST);
    expect(tokens[6].type).toBe(TokenType.KW_GRAYSCALE);
    expect(tokens[7].type).toBe(TokenType.KW_SEPIA);
    expect(tokens[8].type).toBe(TokenType.KW_INVERT);
    expect(tokens[9].type).toBe(TokenType.KW_HUE_ROTATE);
    expect(tokens[10].type).toBe(TokenType.KW_DROP_SHADOW);
  });

  it('handles empty input string and whitespace-only string', () => {
    const emptyTokens = tokenizeToad('');
    expect(emptyTokens).toHaveLength(1);
    expect(emptyTokens[0].type).toBe(TokenType.EOF);

    const wsTokens = tokenizeToad('   \t\n\r   ');
    expect(wsTokens).toHaveLength(1);
    expect(wsTokens[0].type).toBe(TokenType.EOF);
  });

  it('tokenizes boolean keywords and enum values', () => {
    const src = `true false fill cover contain none row column solid dashed dotted`;
    const tokens = tokenizeToad(src);

    expect(tokens[0].type).toBe(TokenType.KW_TRUE);
    expect(tokens[1].type).toBe(TokenType.KW_FALSE);
    expect(tokens[2].type).toBe(TokenType.KW_FILL);
    expect(tokens[3].type).toBe(TokenType.KW_COVER);
    expect(tokens[4].type).toBe(TokenType.KW_CONTAIN);
    expect(tokens[5].type).toBe(TokenType.KW_NONE);
    expect(tokens[6].type).toBe(TokenType.KW_ROW);
    expect(tokens[7].type).toBe(TokenType.KW_COLUMN);
    expect(tokens[8].type).toBe(TokenType.KW_SOLID);
    expect(tokens[9].type).toBe(TokenType.KW_DASHED);
    expect(tokens[10].type).toBe(TokenType.KW_DOTTED);
  });

  it('tokenizes various punctuation and operators', () => {
    const src = `{ } ( ) [ ] : ; , = + .`;
    const tokens = tokenizeToad(src);

    expect(tokens[0].type).toBe(TokenType.LBRACE);
    expect(tokens[1].type).toBe(TokenType.RBRACE);
    expect(tokens[2].type).toBe(TokenType.LPAREN);
    expect(tokens[3].type).toBe(TokenType.RPAREN);
    expect(tokens[4].type).toBe(TokenType.LBRACKET);
    expect(tokens[5].type).toBe(TokenType.RBRACKET);
    expect(tokens[6].type).toBe(TokenType.COLON);
    expect(tokens[7].type).toBe(TokenType.SEMICOLON);
    expect(tokens[8].type).toBe(TokenType.COMMA);
    expect(tokens[9].type).toBe(TokenType.EQUALS);
    expect(tokens[10].type).toBe(TokenType.PLUS);
  });
});

