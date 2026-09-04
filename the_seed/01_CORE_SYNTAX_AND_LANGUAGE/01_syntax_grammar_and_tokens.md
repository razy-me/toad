# 01 — Syntax, Grammar & Token Specifications

This manual details the lexical architecture, EBNF grammar, token streams, and structural conventions of the TOAD declarative design language.

---

## 1. Document Structure & Grammar Overview

A `.toad` document is composed of four top-level declaration categories:
1. **Directives**: `@import`, `@font`
2. **Variable Declarations**: `>varName = value;`
3. **Canvas Declarations**: `canvas "Name" { ... }`
4. **Element & Component Declarations**: `rect`, `circle`, `text`, `stack`, `grid`, `component`, etc.

### Simplified EBNF Grammar

```ebnf
Document        ::= ( Directive | VariableDecl | ComponentDecl | CanvasDecl | Element )*

Directive       ::= ImportDirective | FontDirective
ImportDirective ::= "@import" STRING ";"
FontDirective   ::= "@font" STRING "as" IDENTIFIER ( FontOption )* ";"
FontOption      ::= ( "weight:" ( NUMBER | IDENTIFIER ) )
                  | ( "style:" IDENTIFIER )
                  | ( "normal" | "bold" | "italic" | "oblique" | NUMBER )

VariableDecl    ::= ">" IDENTIFIER "=" Value ";"

CanvasDecl      ::= "canvas" ( STRING )? "{" ( Property )* ( Element )* "}"

ComponentDecl   ::= "component" IDENTIFIER ( "(" ParameterList? ")" )? "{" ( Property )* ( Element )* "}"
ParameterList   ::= Parameter ( "," Parameter )*
Parameter       ::= IDENTIFIER ( ":" Type )? ( "=" Value )?

Element         ::= ElementType ( "#" IDENTIFIER )? "{" ( Property )* ( Element )* "}"
ElementType     ::= "rect" | "circle" | "ellipse" | "text" | "path" | "shape" 
                  | "icon" | "image" | "stack" | "grid" | "group" | "polygon"
                  | "star" | "triangle" | "arrow" | "cross" | "slot"

Property        ::= IDENTIFIER ":" Value ";"
```

---

## 2. Lexical Tokens & Keywords

The tokenizer (`src/parser/lexer.ts`) scans source text with regex patterns and tracks precise line, column, and byte offsets.

### Lexer Token Types

| Token Type | Representation / Pattern | Example |
|---|---|---|
| `DIRECTIVE_IMPORT` | `@import` | `@import "./tokens.toad";` |
| `DIRECTIVE_FONT` | `@font` | `@font "./inter.ttf" as "Inter";` |
| `KW_CANVAS` | `canvas` | `canvas "Main" { ... }` |
| `KW_COMPONENT` | `component` | `component Card(title = "Default") { ... }` |
| `KW_SLOT` | `slot` | `slot;` |
| `IDENTIFIER` | `[a-zA-Z_][a-zA-Z0-9_-]*` | `cardBorder`, `font-size` |
| `VARIABLE_NAME` | `>[a-zA-Z_][a-zA-Z0-9_-]*` | `>brandGreen`, `>textDim` |
| `COLOR` | `#([0-9a-fA-F]{3,8})` | `#87cc2e`, `#ffffff80` |
| `NUMBER` | `[0-9]+(\.[0-9]+)?` | `16`, `1.25`, `0.75` |
| `DIMENSION` | `NUMBER + (px\|%\|em\|rem\|mm\|cm\|in\|pt\|deg)` | `24px`, `50%`, `1.5rem`, `45deg` |
| `STRING` | `"..."` or `'...'` | `"Hello World"`, `'Agency FB'` |

### Reserved Keywords

* **Element primitives**: `rect`, `circle`, `ellipse`, `text`, `path`, `shape`, `icon`, `image`, `stack`, `grid`, `group`, `polygon`, `star`, `triangle`, `arrow`, `cross`, `slot`.
* **Directives & Declarations**: `canvas`, `component`, `@import`, `@font`, `as`, `from`.
* **Relational Anchoring**: `at`, `position`, `center`, `of`, `below`, `above`, `right`, `left`, `inside`, `offset`, `align`, `previous`.
* **Layout & Dimensions**: `hug`, `fill`, `auto`, `size`, `width`, `height`, `gap`, `padding`, `direction`.
* **Color Transforms**: `alpha`, `mix`, `lighten`, `darken`, `saturate`, `desaturate`.

---

## 3. Punctuation & Semicolon Discipline

Every statement in TOAD **MUST** terminate with a semicolon:

```toad
// ✅ Correct:
>primary = #3b82f6;
rect #box {
    size: 200px 100px;
    fill: >primary;
}

// ❌ Syntax Errors:
>primary = #3b82f6       // Missing semicolon
rect #box {
    size: 200px 100px    // Missing semicolon
    fill: >primary       // Parser will report [TOAD-E001]
}
```

### Comma Rules in Value Tuples & Function Arguments

* **Inside coordinate tuples `(x, y)`**: Commas are **mandatory**:
  * ✅ `at: (100px, 200px);`
  * ❌ `at: (100px 200px);`
* **Inside dimension pairs `size: W H;`**: Commas are **forbidden** (whitespace delimited):
  * ✅ `size: 900px 1200px;`
  * ❌ `size: 900px, 1200px;`
* **Inside transform functions**: Commas separate arguments:
  * ✅ `fill: alpha(>brandColor, 0.35);`
  * ✅ `fill: mix(#ff0000, #0000ff, 0.5);`

---

## 4. Comments & Whitespace

TOAD supports C-style comments:

```toad
// Single-line comment: ignored during tokenization

/* 
   Multi-line block comment
   Can span multiple lines and document sections
*/
```

Comments are cleanly stripped by the lexer before AST generation. Whitespace (spaces, tabs, newlines) is non-significant except as token delimiters.
