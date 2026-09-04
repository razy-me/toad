# DSL Grammar, AST Specification, and Resolver Architecture for "TOAD"

**Author**: `spec_miner_syntax_1`  
**Date**: 2026-08-18  
**Target Modules**: `src/parser/ast.ts`, `src/parser/lexer.ts`, `src/parser/parser.ts`, `src/parser/importResolver.ts`  
**Document Status**: Authoritative Specification Document  

---

## Table of Contents
1. [Executive Summary & Language Overview](#1-executive-summary--language-overview)
2. [Lexical Grammar & Token Specification](#2-lexical-grammar--token-specification)
   - [2.1 Token Categories & Definitions](#21-token-categories--definitions)
   - [2.2 Trivia: Whitespace and Comments](#22-trivia-whitespace-and-comments)
   - [2.3 Identifiers, Variables, and Element IDs](#23-identifiers-variables-and-element-ids)
   - [2.4 Literals: Numbers, Dimensions, Strings, Colors](#24-literals-numbers-dimensions-strings-colors)
   - [2.5 Directives and Keywords](#25-directives-and-keywords)
   - [2.6 Punctuation and Operators](#26-punctuation-and-operators)
3. [Formal Syntactic Grammar (EBNF)](#3-formal-syntactic-grammar-ebnf)
   - [3.1 Top-Level Declarations](#31-top-level-declarations)
   - [3.2 Directives (@import, @font)](#32-directives-import-font)
   - [3.3 Variables & Expressions](#33-variables--expressions)
   - [3.4 Canvas Block](#34-canvas-block)
   - [3.5 Component Definitions](#35-component-definitions)
   - [3.6 Elements & Shapes](#36-elements--shapes)
   - [3.7 Properties and Complex Values](#37-properties-and-complex-values)
4. [Complete TypeScript AST Node Definitions (`ast.ts`)](#4-complete-typescript-ast-node-definitions-astts)
   - [4.1 Core Types & Source Location](#41-core-types--source-location)
   - [4.2 Root & Directive AST Nodes](#42-root--directive-ast-nodes)
   - [4.3 Variable & Component Declaration AST Nodes](#43-variable--component-declaration-ast-nodes)
   - [4.4 Canvas & Element AST Nodes](#44-canvas--element-ast-nodes)
   - [4.5 Property & Value AST Nodes](#45-property--value-ast-nodes)
   - [4.6 Resolved / Normalized AST Specification](#46-resolved--normalized-ast-specification)
5. [Parser Architecture & Error Recovery Strategy](#5-parser-architecture--error-recovery-strategy)
   - [5.1 Lexer Single-Pass Architecture](#51-lexer-single-pass-architecture)
   - [5.2 Recursive-Descent Parser Engine](#52-recursive-descent-parser-engine)
   - [5.3 Lexical & Syntactic Disambiguation Rules](#53-lexical--syntactic-disambiguation-rules)
   - [5.4 Error Recovery & Synchronization Points](#54-error-recovery--synchronization-points)
   - [5.5 Diagnostics & Error Reporting](#55-diagnostics--error-reporting)
6. [Import Resolver, Variable Scoping & Component Expansion](#6-import-resolver-variable-scoping--component-expansion)
   - [6.1 Multi-File Import Resolution & Cycle Detection](#61-multi-file-import-resolution--cycle-detection)
   - [6.2 Variable Scoping, Shadowing & Substitution](#62-variable-scoping-shadowing--substitution)
   - [6.3 Component Expansion & Parameter Mechanics](#63-component-expansion--parameter-mechanics)
   - [6.4 ID Mangling & Namespace Isolation](#64-id-mangling--namespace-isolation)
   - [6.5 Directives Aggregation (@font, @import)](#65-directives-aggregation-font-import)
7. [Features Discovered Table](#7-features-discovered-table)
8. [Edge Cases Matrix](#8-edge-cases-matrix)

---

## 1. Executive Summary & Language Overview

The **"TOAD"** language (extension `.TOAD`) is a declarative domain-specific language tailored for multi-layer visual design compilation, procedural canvas rasterization (`@napi-rs/canvas`), and native Photoshop (`.psd`) generation via `ag-psd`.

### Language Characteristics
- **Declarative & Block-Structured**: Hierarchical nesting of canvas, groups, grids, components, and primitive shapes (`rect`, `circle`, `polygon`, `text`, `image`).
- **Parametric Components**: Reusable parameterized visual templates with default arguments and call-site named parameter overrides.
- **Relational & Absolute Layout Coordinates**: Elements can be positioned with explicit pixel coordinates (`at: 100px 200px` or `at: (100px, 200px)`) or relative spatial constraints (`at: right of #header offset 20px`, `at: center of canvas`, `at: below #btn`).
- **Cascading Design Tokens & Variables**: Module-level and imported design tokens (`$primary = #3b82f6;`, `$spacing = 16px;`) with lexical scoping and component parameter shadowing.
- **Inherited Values**: `currentColor` cascades down the element hierarchy and is statically resolved during layout pass.
- **Modular Directives**: Supports `@import "path.TOAD";` for modular styling and `@font "path.ttf" as "FontFamily";` for inline typography registration.

---

## 2. Lexical Grammar & Token Specification

### 2.1 Token Categories & Definitions

The lexer scans UTF-8 text in a single pass, producing a continuous stream of strongly-typed `Token` objects with exact source tracking.

```typescript
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
  KW_IMAGE = 'KW_IMAGE',                 // image
  KW_GROUP = 'KW_GROUP',                 // group
  KW_GRID = 'KW_GRID',                   // grid

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
  KW_TO = 'KW_TO',                       // to (gradient direction: to right, to bottom left)

  // Gradient & Filter Function Keywords
  KW_LINEAR_GRADIENT = 'KW_LINEAR_GRADIENT', // linear-gradient
  KW_RADIAL_GRADIENT = 'KW_RADIAL_GRADIENT', // radial-gradient
  KW_BLUR = 'KW_BLUR',                   // blur
  KW_SATURATE = 'KW_SATURATE',           // saturate
  KW_BRIGHTNESS = 'KW_BRIGHTNESS',       // brightness
  KW_CONTRAST = 'KW_CONTRAST',           // contrast
  KW_GRAYSCALE = 'KW_GRAYSCALE',         // grayscale
  KW_SEPIA = 'KW_SEPIA',                 // sepia
  KW_INVERT = 'KW_INVERT',               // invert
  KW_HUE_ROTATE = 'KW_HUE_ROTATE',       // hue-rotate
  KW_DROP_SHADOW = 'KW_DROP_SHADOW',     // drop-shadow

  // Values & Enum Keywords
  KW_CURRENT_COLOR = 'KW_CURRENT_COLOR', // currentColor
  KW_TRUE = 'KW_TRUE',                   // true
  KW_FALSE = 'KW_FALSE',                 // false
  KW_FILL = 'KW_FILL',                   // fill (fit mode)
  KW_COVER = 'KW_COVER',                 // cover (fit mode)
  KW_CONTAIN = 'KW_CONTAIN',             // contain (fit mode)
  KW_NONE = 'KW_NONE',                   // none (fit mode)
  KW_ROW = 'KW_ROW',                     // row (grid flow)
  KW_COLUMN = 'KW_COLUMN',               // column (grid flow)
  KW_SOLID = 'KW_SOLID',                 // solid (stroke style)
  KW_DASHED = 'KW_DASHED',               // dashed (stroke style)
  KW_DOTTED = 'KW_DOTTED',               // dotted (stroke style)

  // Identifiers & References
  IDENTIFIER = 'IDENTIFIER',             // e.g. color, size, Arrow, myVar
  VARIABLE = 'VARIABLE',                 // $primary, $spacing ($ + identifier)
  ELEMENT_ID = 'ELEMENT_ID',             // #header, #btn_1 (# + identifier)

  // Literals
  NUMBER = 'NUMBER',                     // 10, 3.14159, -5
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

  // Stream Control
  EOF = 'EOF'                            // End of file
}
```

### 2.2 Trivia: Whitespace and Comments

- **Whitespace**: Standard whitespace characters (space `\u0020`, tab `\t`, carriage return `\r`, newline `\n`) are discarded by the lexer except as token separators, updating line and column counters.
- **Line Comments**: Start with `//` and extend to the end of the line (`\n` or EOF).
- **Block Comments**: Start with `/*` and extend until the matching `*/`. Nested block comments are treated as syntax errors or consumed up to the first `*/`.
- **Location Tracking**:
  - `line`: 1-based line number.
  - `column`: 1-based column number within the current line.
  - `offset`: 0-based character index in the source buffer.

### 2.3 Identifiers, Variables, and Element IDs

1. **Identifiers (`IDENTIFIER`)**:
   - Pattern: `[a-zA-Z_][a-zA-Z0-9_-]*`
   - Examples: `Arrow`, `titleText`, `stroke-width`, `font-family`, `background_card`.
   - Note: Hyphenated property names like `stroke-width` and `blend-mode` are valid identifiers.
2. **Variables (`VARIABLE`)**:
   - Pattern: `\$[a-zA-Z_][a-zA-Z0-9_-]*`
   - Examples: `$primary`, `$spacing_lg`, `$card-radius`, `$font-size-base`.
3. **Element IDs (`ELEMENT_ID`)**:
   - Pattern: `#[a-zA-Z_][a-zA-Z0-9_-]*`
   - Examples: `#header`, `#card_background`, `#hero-image`.
   - Disambiguation against `HEX_COLOR`: A token starting with `#` is a `HEX_COLOR` if and only if all characters following `#` are hexadecimal digits (`[0-9a-fA-F]`) AND the length of hex digits is either 3, 4, 6, or 8. Otherwise, it is lexed as `ELEMENT_ID`. (e.g. `#fff` -> `HEX_COLOR`, `#face` -> `HEX_COLOR`, `#face1` -> `ELEMENT_ID`, `#button` -> `ELEMENT_ID`).

### 2.4 Literals: Numbers, Dimensions, Strings, Colors

1. **Numbers (`NUMBER`)**:
   - Integer: `[0-9]+`
   - Float: `[0-9]+\.[0-9]+`
   - Negative numbers: Leading `-` attached directly or parsed via unary minus.
2. **Dimensions (`DIMENSION`)**:
   - Number immediately followed by a unit suffix without whitespace:
     - `px` (pixels, e.g. `100px`, `0.5px`)
     - `%` (percentage, e.g. `50%`, `100%`)
     - `deg` (degrees for rotation, e.g. `45deg`, `-90deg`)
     - `rad` (radians, e.g. `3.14rad`)
     - `em` / `rem` (font-relative, e.g. `1.5em`)
     - `pt` (points, e.g. `12pt`)
     - `vw` / `vh` (viewport relative, e.g. `50vw`)
3. **Strings (`STRING`)**:
   - Quoted with double `"` or single `'`.
   - Supports escape sequences: `\"`, `\'`, `\\`, `\n`, `\r`, `\t`, `\uXXXX`.
4. **Hex Colors (`HEX_COLOR`)**:
   - `#RGB`, `#RGBA`, `#RRGGBB`, `#RRGGBBAA`.
5. **Functional Colors / Expressions**:
   - `rgb(r, g, b)`, `rgba(r, g, b, a)`, `hsl(h, s, l)`, `hsla(h, s, l, a)` are lexed as `IDENTIFIER` followed by `LPAREN`, argument tokens, and `RPAREN`, and parsed by the parser into `ColorLiteralNode`.
6. **Inherited Color**:
   - `currentColor` keyword.

### 2.5 Directives and Keywords

- Directives start with `@`:
  - `@import`: File import directive.
  - `@font`: Font registration directive.
- Keywords are case-sensitive (lowercase standard).

### 2.6 Punctuation and Operators

- Delimiters: `{`, `}`, `(`, `)`, `[`, `]`, `:`, `;`, `,`, `=`, `.`.

---

## 3. Formal Syntactic Grammar (EBNF)

```ebnf
(* ========================================== *)
(* 3.1 Document & Top-Level Declarations     *)
(* ========================================== *)

Document ::= ( TopLevelItem )* EOF

TopLevelItem ::= Directive
               | VariableDeclaration
               | ComponentDeclaration
               | CanvasDeclaration
               | ElementDeclaration

(* ========================================== *)
(* 3.2 Directives                             *)
(* ========================================== *)

Directive ::= ImportDirective | FontDirective

ImportDirective ::= '@import' StringLiteral ';'

FontDirective   ::= '@font' StringLiteral 'as' StringLiteral ';'

(* ========================================== *)
(* 3.3 Variable Declarations & Expressions    *)
(* ========================================== *)

VariableDeclaration ::= Variable '=' Expression ';'

Expression ::= PrimitiveLiteral
             | VariableReference
             | ElementReference
             | ComplexValue

PrimitiveLiteral ::= NumberLiteral
                   | DimensionLiteral
                   | StringLiteral
                   | BooleanLiteral
                   | HexColorLiteral
                   | KeywordLiteral

VariableReference ::= Variable

ElementReference  ::= ElementId

(* ========================================== *)
(* 3.4 Canvas Block                           *)
(* ========================================== *)

CanvasDeclaration ::= 'canvas' ( StringLiteral | Identifier )? '{' CanvasBody '}'

CanvasBody ::= ( Property )*

(* ========================================== *)
(* 3.5 Component Declarations                 *)
(* ========================================== *)

ComponentDeclaration ::= 'component' Identifier ( '(' ParameterList? ')' )? '{' ComponentBody '}'

ParameterList ::= Parameter ( ',' Parameter )*

Parameter ::= Identifier ( '=' Expression )?

ComponentBody ::= ( Property | ElementDeclaration )*

(* ========================================== *)
(* 3.6 Element Declarations                   *)
(* ========================================== *)

ElementDeclaration ::= ElementType ElementHeader? '{' ElementBody '}'

ElementType ::= 'rect'
              | 'circle'
              | 'text'
              | 'polygon'
              | 'image'
              | 'group'
              | 'grid'
              | CustomComponentType

CustomComponentType ::= Identifier ( '(' ArgumentList? ')' )?

ElementHeader ::= ( ElementId | Identifier | StringLiteral )*

ArgumentList ::= Argument ( ',' Argument )*

Argument ::= ( Identifier ':' )? Expression

ElementBody ::= ( Property | ElementDeclaration )*

(* ========================================== *)
(* 3.7 Properties & Complex Values            *)
(* ========================================== *)

Property ::= PropertyName ':' PropertyValue ';'

PropertyName ::= Identifier

PropertyValue ::= PositionValue
                | SizeValue
                | ColorValue
                | GradientValue
                | FilterValue
                | StrokeValue
                | FontValue
                | PointsValue
                | FitValue
                | GridValue
                | ArrayValue
                | ExpressionList
                | Expression

(* Spatial / Positioning *)
PositionValue ::= CoordinateTuple
                | RelationalPosition

CoordinateTuple ::= DimensionLiteral DimensionLiteral
                  | '(' Expression ',' Expression ')'
                  | DimensionLiteral

RelationalPosition ::= RelationalKeyword 'of' ElementTarget ( 'offset' DimensionLiteral )?

RelationalKeyword ::= 'right' | 'left' | 'above' | 'below' | 'center' | 'inside'

ElementTarget ::= ElementId | 'canvas' | 'parent'

(* Size *)
SizeValue ::= DimensionLiteral DimensionLiteral
            | DimensionLiteral
            | '(' Expression ',' Expression ')'

(* Colors & Gradients *)
ColorValue ::= HexColorLiteral
             | 'currentColor'
             | ColorFunction
             | Identifier (* Named colors: red, blue, transparent *)

ColorFunction ::= ( 'rgb' | 'rgba' | 'hsl' | 'hsla' ) '(' ( Expression ( ',' Expression )* ) ')'

GradientValue ::= LinearGradient | RadialGradient

LinearGradient ::= 'linear-gradient' '(' GradientDirection? ( ',' GradientStop )+ ')'

RadialGradient ::= 'radial-gradient' '(' ( 'circle' | 'ellipse' )? ( ',' GradientStop )+ ')'

GradientDirection ::= 'to' ( 'top' | 'bottom' | 'left' | 'right' | 'top left' | 'top right' | 'bottom left' | 'bottom right' )
                    | DimensionLiteral (* e.g. 45deg, 90deg *)

GradientStop ::= ColorValue ( DimensionLiteral )?

(* Filters *)
FilterValue ::= ( FilterFunction )+

FilterFunction ::= FilterName '(' Expression ')'

FilterName ::= 'blur' | 'saturate' | 'brightness' | 'contrast' | 'grayscale' | 'sepia' | 'invert' | 'hue-rotate' | 'drop-shadow'

(* Stroke *)
StrokeValue ::= ColorValue ( DimensionLiteral )? ( StrokeStyle )?
              | DimensionLiteral

StrokeStyle ::= 'solid' | 'dashed' | 'dotted'

(* Font & Typography *)
FontValue ::= ( FontStyle )? ( FontWeight )? DimensionLiteral ( StringLiteral | Identifier )

FontStyle ::= 'normal' | 'italic' | 'oblique'

FontWeight ::= 'normal' | 'bold' | 'bolder' | 'lighter' | NumberLiteral

(* Polygon Points *)
PointsValue ::= '[' PointList? ']'
              | PointList

PointList ::= PointItem ( ( ',' | ';' )? PointItem )*

PointItem ::= '(' Expression ',' Expression ')'
            | Expression Expression

(* Fit Mode *)
FitValue ::= 'fill' | 'cover' | 'contain' | 'none'

(* Grid Layout *)
GridValue ::= NumberLiteral
            | DimensionLiteral
            | 'row'
            | 'column'

(* Arrays & Lists *)
ArrayValue ::= '[' ( Expression ( ',' Expression )* )? ']'

ExpressionList ::= Expression ( Expression )+
```

---

## 4. Complete TypeScript AST Node Definitions (`ast.ts`)

Below is the complete, exhaustive TypeScript AST interface specification for `src/parser/ast.ts`.

```typescript
/**
 * src/parser/ast.ts
 * Authoritative TypeScript AST Node Definitions for the "TOAD" language.
 */

// ============================================================================
// 1. Source Location & Metadata
// ============================================================================

export interface Position {
  line: number;    // 1-based line number
  column: number;  // 1-based column number
  offset: number;  // 0-based byte/character offset
}

export interface SourceLocation {
  start: Position;
  end: Position;
  file?: string;   // File path for multi-file ASTs
}

export interface BaseNode {
  type: string;
  loc: SourceLocation;
}

// ============================================================================
// 2. Document & Directives
// ============================================================================

export interface DocumentNode extends BaseNode {
  type: 'Document';
  directives: DirectiveNode[];
  variables: VariableDeclarationNode[];
  components: ComponentDeclarationNode[];
  canvas?: CanvasDeclarationNode;
  elements: ElementNode[];
}

export type DirectiveNode = ImportDirectiveNode | FontDirectiveNode;

export interface ImportDirectiveNode extends BaseNode {
  type: 'ImportDirective';
  path: string; // Quoted string value resolved, e.g. "./tokens.TOAD"
}

export interface FontDirectiveNode extends BaseNode {
  type: 'FontDirective';
  path: string;   // Path to font binary, e.g. "./fonts/Inter-Bold.ttf"
  family: string; // Registered family name, e.g. "Inter"
  weight?: string | number;
  style?: 'normal' | 'italic' | 'oblique';
}

// ============================================================================
// 3. Variables & Components
// ============================================================================

export interface VariableDeclarationNode extends BaseNode {
  type: 'VariableDeclaration';
  name: string; // Identifier without leading '$'
  value: ValueNode;
}

export interface ComponentParameterNode extends BaseNode {
  type: 'ComponentParameter';
  name: string;
  defaultValue?: ValueNode;
}

export interface ComponentDeclarationNode extends BaseNode {
  type: 'ComponentDeclaration';
  name: string;
  parameters: ComponentParameterNode[];
  properties: PropertyNode[];
  elements: ElementNode[];
}

// ============================================================================
// 4. Canvas & Elements
// ============================================================================

export interface CanvasDeclarationNode extends BaseNode {
  type: 'CanvasDeclaration';
  name?: string;
  properties: PropertyNode[];
}

export type ElementType =
  | 'rect'
  | 'circle'
  | 'text'
  | 'polygon'
  | 'image'
  | 'group'
  | 'grid'
  | 'component_instance';

export type ElementNode =
  | RectElementNode
  | CircleElementNode
  | TextElementNode
  | PolygonElementNode
  | ImageElementNode
  | GroupElementNode
  | GridElementNode
  | ComponentInstanceNode;

export interface BaseElementNode extends BaseNode {
  id?: string;            // e.g. "#header" -> "header"
  name?: string;          // Human-readable layer name
  properties: PropertyNode[];
  children?: ElementNode[];
}

export interface RectElementNode extends BaseElementNode {
  type: 'RectElement';
}

export interface CircleElementNode extends BaseElementNode {
  type: 'CircleElement';
}

export interface TextElementNode extends BaseElementNode {
  type: 'TextElement';
  text?: string;          // Extracted text content shorthand if specified in header
}

export interface PolygonElementNode extends BaseElementNode {
  type: 'PolygonElement';
}

export interface ImageElementNode extends BaseElementNode {
  type: 'ImageElement';
}

export interface GroupElementNode extends BaseElementNode {
  type: 'GroupElement';
  children: ElementNode[];
}

export interface GridElementNode extends BaseElementNode {
  type: 'GridElement';
  children: ElementNode[];
}

export interface ComponentArgumentNode extends BaseNode {
  type: 'ComponentArgument';
  name?: string;          // Named argument name, or undefined if positional
  value: ValueNode;
}

export interface ComponentInstanceNode extends BaseElementNode {
  type: 'ComponentInstance';
  componentName: string;
  arguments: ComponentArgumentNode[];
  children?: ElementNode[];
}

// ============================================================================
// 5. Properties & Values
// ============================================================================

export interface PropertyNode extends BaseNode {
  type: 'Property';
  name: string;           // e.g. 'at', 'size', 'fill', 'stroke', 'font', 'filter'
  value: ValueNode;
}

export type ValueNode =
  // Literals
  | NumberLiteralNode
  | DimensionLiteralNode
  | StringLiteralNode
  | BooleanLiteralNode
  | ColorLiteralNode
  | IdentifierNode
  | VariableReferenceNode
  | ElementReferenceNode
  // Complex values
  | CoordinateValueNode
  | RelationalPositionNode
  | GradientValueNode
  | FilterValueNode
  | StrokeValueNode
  | FontValueNode
  | PointsValueNode
  | ArrayLiteralNode
  | ExpressionListNode;

// --- Literal Nodes ---

export interface NumberLiteralNode extends BaseNode {
  type: 'NumberLiteral';
  value: number;
  raw: string;
}

export type UnitType = 'px' | '%' | 'deg' | 'rad' | 'em' | 'rem' | 'pt' | 'vw' | 'vh';

export interface DimensionLiteralNode extends BaseNode {
  type: 'DimensionLiteral';
  value: number;
  unit: UnitType;
  raw: string;
}

export interface StringLiteralNode extends BaseNode {
  type: 'StringLiteral';
  value: string;
}

export interface BooleanLiteralNode extends BaseNode {
  type: 'BooleanLiteral';
  value: boolean;
}

export interface ColorLiteralNode extends BaseNode {
  type: 'ColorLiteral';
  format: 'hex' | 'rgb' | 'rgba' | 'hsl' | 'hsla' | 'named' | 'currentColor';
  value: string;         // Canonical normalized string e.g. "#3b82f6" or "currentColor"
  r?: number;
  g?: number;
  b?: number;
  a?: number;
}

export interface IdentifierNode extends BaseNode {
  type: 'Identifier';
  name: string;
}

export interface VariableReferenceNode extends BaseNode {
  type: 'VariableReference';
  name: string;          // Variable name without '$'
}

export interface ElementReferenceNode extends BaseNode {
  type: 'ElementReference';
  targetId: string;      // ID string without '#'
}

// --- Complex Value Nodes ---

export interface CoordinateValueNode extends BaseNode {
  type: 'CoordinateValue';
  x: ValueNode;
  y: ValueNode;
}

export type RelationalRelation =
  | 'right of'
  | 'left of'
  | 'above'
  | 'below'
  | 'center of'
  | 'inside';

export interface RelationalPositionNode extends BaseNode {
  type: 'RelationalPosition';
  relation: RelationalRelation;
  target: string;        // Element ID without '#' or 'canvas' | 'parent'
  offset?: ValueNode;    // Optional offset dimension e.g. 20px
}

export type GradientValueNode = LinearGradientNode | RadialGradientNode;

export interface GradientStopNode extends BaseNode {
  type: 'GradientStop';
  color: ValueNode;
  position?: ValueNode;  // Optional position dimension/number (e.g. 0%, 50%, 100%, 0.5)
}

export interface LinearGradientNode extends BaseNode {
  type: 'LinearGradient';
  direction?: ValueNode; // Angle (e.g. 45deg) or Direction String ('to right')
  stops: GradientStopNode[];
}

export interface RadialGradientNode extends BaseNode {
  type: 'RadialGradient';
  shape?: 'circle' | 'ellipse';
  stops: GradientStopNode[];
}

export interface FilterFunctionNode extends BaseNode {
  type: 'FilterFunction';
  name: string;          // 'blur', 'saturate', 'brightness', etc.
  arguments: ValueNode[];
}

export interface FilterValueNode extends BaseNode {
  type: 'FilterValue';
  filters: FilterFunctionNode[];
}

export interface StrokeValueNode extends BaseNode {
  type: 'StrokeValue';
  color?: ValueNode;
  width?: ValueNode;
  style?: 'solid' | 'dashed' | 'dotted';
}

export interface FontValueNode extends BaseNode {
  type: 'FontValue';
  size?: ValueNode;
  family?: string;
  weight?: string | number;
  style?: 'normal' | 'italic' | 'oblique';
}

export interface Point2DNode extends BaseNode {
  type: 'Point2D';
  x: ValueNode;
  y: ValueNode;
}

export interface PointsValueNode extends BaseNode {
  type: 'PointsValue';
  points: Point2DNode[];
}

export interface ArrayLiteralNode extends BaseNode {
  type: 'ArrayLiteral';
  elements: ValueNode[];
}

export interface ExpressionListNode extends BaseNode {
  type: 'ExpressionList';
  expressions: ValueNode[];
}

// ============================================================================
// 6. Resolved / Canonical Element & Tree Nodes
// ============================================================================

/**
 * Output of import resolution, variable substitution, and component expansion.
 * Contains no VariableReferenceNode or ComponentInstanceNode.
 */
export interface ResolvedDocumentNode {
  canvas: ResolvedCanvasNode;
  fonts: FontDirectiveNode[];
  elements: ResolvedElementNode[];
}

export interface ResolvedCanvasNode {
  width: number;
  height: number;
  fill?: string | ResolvedGradient;
  aspectRatio: { w: number; h: number; gcd: number; str: string };
  properties: Record<string, any>;
}

export interface ResolvedGradientStop {
  color: string;         // Hex/RGBA
  offset: number;        // Normalized 0.0 to 1.0
}

export interface ResolvedGradient {
  type: 'linear' | 'radial';
  angleDeg?: number;     // 0 to 360
  direction?: string;
  shape?: 'circle' | 'ellipse';
  stops: ResolvedGradientStop[];
}

export interface ResolvedStroke {
  color: string;
  width: number;
  style: 'solid' | 'dashed' | 'dotted';
}

export interface ResolvedFont {
  family: string;
  size: number;
  weight: string | number;
  style: 'normal' | 'italic' | 'oblique';
  lineHeight?: number;
}

export interface ResolvedFilter {
  type: string;
  value: number | string;
}

export interface ResolvedElementNode {
  id?: string;
  name: string;
  type: 'rect' | 'circle' | 'text' | 'polygon' | 'image' | 'group' | 'grid';
  // Computed & resolved styling properties
  at?: {
    x?: number;
    y?: number;
    relational?: {
      relation: RelationalRelation;
      targetId: string;
      offset: number;
    };
  };
  size?: {
    w?: number;
    h?: number;
  };
  fill?: string | ResolvedGradient;
  stroke?: ResolvedStroke;
  opacity?: number;
  blendMode?: string;
  rotation?: number;     // In degrees
  radius?: number | [number, number, number, number];
  filter?: ResolvedFilter[];
  clip?: boolean;
  // Specific element fields
  text?: string;
  font?: ResolvedFont;
  align?: 'left' | 'center' | 'right' | 'justify';
  points?: Array<{ x: number; y: number }>; // Center-relative coordinates
  src?: string;
  fit?: 'fill' | 'cover' | 'contain' | 'none';
  // Grid properties
  columns?: number;
  gap?: number;
  rowGap?: number;
  columnGap?: number;
  flow?: 'row' | 'column';
  // Hierarchy
  children?: ResolvedElementNode[];
}
```

---

## 5. Parser Architecture & Error Recovery Strategy

### 5.1 Lexer Single-Pass Architecture

The Lexer in `src/parser/lexer.ts` implements a stateful cursor scanning the input string:
1. **Zero-Backtrack Scanning**: Advances `index`, `line`, and `column`.
2. **Contextual Token Disambiguation**:
   - When encountering `#`:
     - Checks if upcoming characters form valid hex color `[0-9a-fA-F]` of length 3, 4, 6, 8 followed by a delimiter/whitespace.
     - If so -> `HEX_COLOR`.
     - Otherwise -> `ELEMENT_ID`.
   - When encountering `-`:
     - Checks if followed immediately by a digit without space -> `NUMBER` (negative) or `DIMENSION`.
   - When encountering a number:
     - Scans integer and fractional parts.
     - If followed by `px`, `%`, `deg`, `rad`, `em`, `rem`, `pt`, `vw`, `vh` -> `DIMENSION`.
     - Otherwise -> `NUMBER`.
3. **String Escapes**: Translates `\n`, `\t`, `\"`, `\'`, `\\`, and `\uXXXX` into actual characters.
4. **Trivia Handling**: Skips `//` line comments and `/* ... */` block comments while updating line and column counters accurately.

### 5.2 Recursive-Descent Parser Engine

The Parser in `src/parser/parser.ts` implements an LL(1) / LL(k) recursive-descent engine with helper methods:
- `peek(offset = 0): Token`
- `check(type: TokenType): boolean`
- `match(...types: TokenType[]): boolean`
- `consume(type: TokenType, errorMessage: string): Token`
- `expect(type: TokenType): Token`

#### Key Parsing Subroutines
1. **`parseDocument()`**:
   - Loops until `TokenType.EOF`.
   - Dispatches based on token type:
     - `DIRECTIVE_IMPORT` -> `parseImportDirective()`
     - `DIRECTIVE_FONT` -> `parseFontDirective()`
     - `VARIABLE` -> `parseVariableDeclaration()`
     - `KW_COMPONENT` -> `parseComponentDeclaration()`
     - `KW_CANVAS` -> `parseCanvasDeclaration()`
     - `KW_RECT | KW_CIRCLE | KW_TEXT | KW_POLYGON | KW_IMAGE | KW_GROUP | KW_GRID | IDENTIFIER` -> `parseElementDeclaration()`
2. **`parseComponentDeclaration()`**:
   - Consumes `KW_COMPONENT`.
   - Consumes `IDENTIFIER` (component name).
   - If next is `LPAREN`: parses comma-separated parameters with optional default values (`name = expr`).
   - Consumes `LBRACE`.
   - Parses properties and nested element declarations until `RBRACE`.
3. **`parseElementDeclaration()`**:
   - Parses element type keyword or custom component identifier.
   - Parses optional argument list `(args...)` for custom components.
   - Parses optional element header tokens (e.g. `#myId`, layer name string `"Background"`).
   - Consumes `LBRACE`.
   - Parses properties and child elements until `RBRACE`.
4. **`parseProperty()`**:
   - Consumes property name `IDENTIFIER`.
   - Consumes `COLON`.
   - Parses property value expression (dispatches to relational parser, gradient parser, filter parser, coordinate parser, or general expression parser).
   - Consumes `SEMICOLON` (with error recovery if missing).
5. **`parseValueExpression()`**:
   - Handles literals, variables, element IDs, function calls (`rgb()`, `linear-gradient()`, `blur()`), tuples `(x, y)`, and arrays `[...]`.

### 5.3 Lexical & Syntactic Disambiguation Rules

| Ambiguity Scenario | Resolution Rule |
| :--- | :--- |
| `#aabbcc` vs `#header` | Hex regex match `^#[0-9a-fA-F]{3,8}$` checked first; if matched, emit `HEX_COLOR`, otherwise emit `ELEMENT_ID`. |
| `at: 100px 200px;` vs `at: (100px, 200px);` | Parser accepts both 2 consecutive dimension literals and parenthesized coordinate pairs `(x, y)`. |
| `at: right of #header offset 10px;` | Parser checks for spatial keyword (`right | left | above | below | center | inside`) followed by `of`, target element ID, and optional `offset`. |
| `type: Arrow(size: 240px)` vs `Arrow(size: 240px) #arrow1 { ... }` | Direct component tag `Arrow(...)` treated as `ComponentInstanceNode`; `type: Arrow` property also mapped to component type. |
| `linear-gradient(to right, #f00, #00f)` | Direction `to right` or angle `45deg` parsed as gradient direction; remaining comma-separated items parsed as `GradientStopNode`s. |
| Unitless `0` vs `0px` | `0` is parsed as `NumberLiteralNode(0)`; layout solver treats `0` as `0px` for dimensional properties. |
| Space-separated filter strings | Filter parser consumes consecutive `filterName(args)` calls until `;` is reached, building a `FilterValueNode`. |

### 5.4 Error Recovery & Synchronization Points

To ensure the compiler does not fail catastrophically on the first syntax error, the parser implements **Panic-Mode Error Recovery**:
1. **Error Recording**: When a syntax error occurs, a `ParseError` is created and appended to the parser's `errors` array.
2. **Synchronization Points**:
   - **Property Level**: If an error occurs inside a property value, the parser skips tokens until it encounters `;`, `}`, or `EOF`.
   - **Element Level**: If an error occurs inside an element header or body, the parser skips tokens until it encounters matching `}` or a top-level keyword (`component`, `canvas`, `rect`, etc.).
   - **Document Level**: Skips until the next top-level statement start.
3. **Resilient AST Output**: The parser returns a partially-constructed AST alongside the list of diagnostics, allowing downstream linters or IDE tools to operate on valid sub-trees.

### 5.5 Diagnostics & Error Reporting

Each diagnostic contains:
```typescript
export interface Diagnostic {
  code: string;           // e.g. "TOAD-E001"
  message: string;        // Human-readable message
  severity: 'error' | 'warning' | 'info';
  loc: SourceLocation;
  sourceSnippet?: string; // Formatted 3-line code preview with caret indicator
}
```

Example formatted compiler diagnostic:
```
error[TOAD-E004]: Expected ';' after property declaration
  --> styles/card.TOAD:14:22
   |
13 |   rect #card {
14 |     fill: #ffffff
   |                  ^ expected ';' here
15 |     radius: 8px;
```

---

## 6. Import Resolver, Variable Scoping & Component Expansion

The Import Resolver (`src/parser/importResolver.ts`) executes after parsing, transforming raw modular ASTs into a single canonical, fully resolved AST ready for the layout solver.

```
┌────────────────────────┐       ┌────────────────────────┐
│   Raw AST (entry.TOAD) │       │ Imported ASTs (*.TOAD) │
└───────────┬────────────┘       └───────────┬────────────┘
            │                                │
            ▼                                ▼
    ┌────────────────────────────────────────────────┐
    │  Multi-File Loader & Cycle Detection (DFS)     │
    └───────────────────────┬────────────────────────┘
                            ▼
    ┌────────────────────────────────────────────────┐
    │  Variable Scope Resolution & Substitution      │
    │  ($primary -> #3b82f6, cyclic var checks)      │
    └───────────────────────┬────────────────────────┘
                            ▼
    ┌────────────────────────────────────────────────┐
    │  Component Expansion Engine                    │
    │  - Parameter binding (default vs call-site)    │
    │  - Parameter scope substitution                │
    │  - ID namespace mangling (#arrow_inst1_shape)  │
    │  - Recursive depth limiting (max depth 32)     │
    └───────────────────────┬────────────────────────┘
                            ▼
    ┌────────────────────────────────────────────────┐
    │  Directives Consolidation (@font registry)     │
    └───────────────────────┬────────────────────────┘
                            ▼
    ┌────────────────────────────────────────────────┐
    │  Canonical Resolved AST (ResolvedDocumentNode) │
    └────────────────────────────────────────────────┘
```

### 6.1 Multi-File Import Resolution & Cycle Detection

1. **Path Resolution**:
   - `@import "./tokens.TOAD";` is resolved relative to `path.dirname(importingFilePath)`.
   - File extensions default to `.TOAD` if omitted.
2. **File Cache & Deduplication**:
   - A global cache `Map<string, DocumentNode>` prevents re-reading and re-parsing the same file multiple times.
3. **Cycle Detection**:
   - Uses a recursion stack (`Set<string>`) during depth-first traversal.
   - If an import points to a file currently in the active recursion stack, a `CircularImportError` is thrown with the exact cycle trace:
     `Circular import detected: main.TOAD -> components/card.TOAD -> theme/colors.TOAD -> main.TOAD`

### 6.2 Variable Scoping, Shadowing & Substitution

1. **Scoping Hierarchy**:
   - **Global / Imported Scope**: Variables defined via `$var = val;` at module top-level.
   - **Import Order & Shadowing**:
     - Imported variables are loaded in order of `@import` declarations.
     - Later imports override earlier imports.
     - Local variables in the importing file override imported variables.
   - **Component Parameter Scope**:
     - When expanding a component, the component's evaluated arguments form a local scope that shadows module-level variables.
2. **Substitution Mechanics**:
   - Traverses all property values in the AST.
   - Replaces `VariableReferenceNode(name)` with the resolved literal / value node.
3. **Cyclic Variable Reference Detection**:
   - E.g., `$a = $b; $b = $a;` is detected via a variable resolution visited set; throws `CircularVariableError: Circular variable dependency: $a -> $b -> $a`.
4. **Undefined Variable Error**:
   - Referencing `$undefinedVar` throws a descriptive diagnostic: `Undefined variable '$undefinedVar' at line X, col Y`.

### 6.3 Component Expansion & Parameter Mechanics

1. **Component Definition**:
   ```TOAD
   component Arrow(size = 180px, color = #000000) {
     polygon {
       size: $size $size;
       fill: $color;
       points: [ (0, -10), (10, 10), (0, 5), (-10, 10) ];
     }
   }
   ```
2. **Component Instantiation**:
   - Header style: `Arrow(size: 240px) #heroArrow { at: 100px 100px; }`
   - Property style: `type: Arrow(size: 240px);`
3. **Argument Resolution & Default Parameter Binding**:
   - For each declared parameter in `component.parameters`:
     - If the call site provides a named argument matching parameter `name`: use the evaluated call-site argument value.
     - If the call site provides positional arguments: match by parameter index.
     - If argument is omitted: use the `defaultValue` declared on the parameter.
     - If argument is omitted AND no default value is defined: emit an error `Missing required parameter 'paramName' for component 'ComponentName'`.
4. **Body Expansion & Parameter Substitution**:
   - Deep clones the component's AST sub-tree (`properties` and `elements`).
   - Replaces any variable reference `$paramName` inside the component body with the bound argument value.
   - Merges call-site overrides (e.g. `at: 100px 100px;` or outer styling properties) onto the root element of the expanded component.
5. **Recursion Limit**:
   - Tracks instantiation depth (maximum depth: `32`). If a component recursively instantiates itself directly or indirectly exceeding depth 32, aborts with `ComponentRecursionLimitError`.

### 6.4 ID Mangling & Namespace Isolation

When a component contains elements with explicit `#id` tags (e.g. `#arrowTip`), instantiating that component multiple times would cause duplicate ID collisions in the global layout graph.

**ID Mangling Strategy**:
- For each component instance, generate a unique instance prefix (e.g. `__inst1_`, `__inst2_` or derived from instance ID `#heroArrow_arrowTip`).
- Rewrite internal element IDs and internal relational references to use the prefixed ID.
- The root element of the instance receives the instance's declared ID (e.g. `#heroArrow`).

### 6.5 Directives Aggregation (@font, @import)

- All `@font` directives from entry and imported files are extracted and collected into a deduplicated font registry `fonts: FontDirectiveNode[]`.
- This list is passed to `fontLoader.ts` to register with Skia's `GlobalFonts` prior to the layout and rendering passes.

---

## 7. Features Discovered Table

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Directive | `@import` | Imports external `.TOAD` file, merging variables and components | `@import "path/file.TOAD";` | Merged AST nodes & symbol tables | Error on file not found or circular import | Request & Architecture Spec |
| 2 | Directive | `@font` | Registers custom TTF/OTF font with Skia `GlobalFonts` | `@font "path.ttf" as "Family";` | `FontDirectiveNode` in font registry | Error on invalid font path or syntax | Confirmed Design Rule 6 |
| 3 | Variable | Global Variables | Module-level design tokens with `$` prefix | `$primary = #3b82f6;` | `VariableDeclarationNode` | Error on cyclic references or undefined vars | Request R1 & AST Spec |
| 4 | Component | Parameterized Definition | Defines reusable component with default arguments | `component Arrow(size = 180px)` | `ComponentDeclarationNode` | Error on duplicate param names or syntax | Confirmed Design Rule 4 |
| 5 | Component | Instantiation (Named Args) | Instantiates component overriding specific params | `type: Arrow(size: 240px)` or `Arrow(size: 240px)` | `ComponentInstanceNode` -> expanded AST | Error on unknown param or missing required arg | Confirmed Design Rule 4 |
| 6 | Component | Instantiation (Positional) | Instantiates component with ordered arguments | `Arrow(240px, #ff0000)` | Bound positional arguments | Error on argument count overflow | Spec Discovery |
| 7 | Canvas | Canvas Declaration | Root canvas block defining dimensions and background | `canvas { size: 1920px 1080px; fill: #fff; }` | `CanvasDeclarationNode` | Error on invalid dimensions or missing canvas | Request Architecture |
| 8 | Element | `rect` Shape | Rectangle element with size, fill, stroke, radius | `rect #card { size: 400px 300px; radius: 8px; }` | `RectElementNode` | Fallback `(0,0)` if `at:` omitted | AST Spec & Layout Engine |
| 9 | Element | `circle` Shape | Circle element with radius / diameter | `circle { size: 100px; fill: #f00; }` | `CircleElementNode` | Fallback `(0,0)` if `at:` omitted | AST Spec & Layout Engine |
| 10 | Element | `polygon` Shape | Polygon with center-relative points list | `polygon { points: [ (0,-10), (10,10) ]; }` | `PolygonElementNode` | Error on malformed points list (<3 points) | Confirmed Design Rule 3 |
| 11 | Element | `text` Element | Text layer with font styling and content | `text { content: "Hello"; font: 16px "Inter"; }` | `TextElementNode` | Skia measureText fallback; wrap if size.w set | Confirmed Design Rule 2 |
| 12 | Element | `image` Element | Bitmap image layer with fit modes | `image { src: "hero.png"; fit: cover; }` | `ImageElementNode` | Error on unreadable image; default fit: fill | Confirmed Design Rule 7 |
| 13 | Element | `group` Element | Logical container for grouping child layers | `group #header { ... }` | `GroupElementNode` (Photoshop Group) | Empty group treated as no-op | PSD Engine Spec & AST |
| 14 | Element | `grid` Layout | Uniform tile grid container with auto flow | `grid { columns: 3; gap: 16px; ... }` | `GridElementNode` | Error on non-positive column count | Confirmed Design Rule 5 |
| 15 | Property | `at:` Absolute | Positions element at explicit coordinates | `at: 100px 200px;` or `at: (100px, 200px);` | `CoordinateValueNode` | Warning + fallback to `(0,0)` if omitted | Confirmed Design Rule 11 |
| 16 | Property | `at:` Relational | Relational positioning relative to another element ID | `at: right of #header offset 12px;` | `RelationalPositionNode` | Error on cycle in dependency graph | Confirmed Design Rule 11 |
| 17 | Property | `size:` Dimensions | Specifies element width and height | `size: 300px 200px;` or `size: 100px;` | `DimensionLiteralNode` / Tuple | Default text size computed from font | AST Spec |
| 18 | Property | `fill:` Color / Gradient | Fills element with solid color, gradient, or currentColor | `fill: #ff0000;` / `fill: currentColor;` | `ColorLiteralNode` / `GradientValueNode` | Resolved down tree during layout pass | Confirmed Design Rule 1 |
| 19 | Property | `linear-gradient` | Linear gradient with direction and auto-distributed stops | `linear-gradient(to right, #f00, #00f)` | `LinearGradientNode` | Stops evenly distributed if positions omitted | Confirmed Design Rule 8 |
| 20 | Property | `radial-gradient` | Radial gradient with shape and stops | `radial-gradient(circle, #fff, #000)` | `RadialGradientNode` | Stops evenly distributed if positions omitted | Confirmed Design Rule 8 |
| 21 | Property | `filter:` Property Line | Space-separated CSS filter functions | `filter: blur(4px) saturate(1.5);` | `FilterValueNode` | Error on unrecognized filter function | Confirmed Design Rule 9 |
| 22 | Property | `fit:` Mode | Image scaling behavior | `fit: cover;` (`fill`, `contain`, `none`) | `IdentifierNode` | Default to `fill` if omitted | Confirmed Design Rule 7 |
| 23 | Property | `stroke:` Shorthand | Stroke color, width, and style | `stroke: #000 2px dashed;` | `StrokeValueNode` | Default style `solid` if omitted | Drawing Engine Spec |
| 24 | Property | `blend-mode:` | Layer blend mode for rendering and PSD export | `blend-mode: multiply;` | `IdentifierNode` | Default `normal` / `source-over` | PSD Engine Spec |
| 25 | Property | `opacity:` | Element alpha transparency | `opacity: 0.85;` | `NumberLiteralNode` | Clamped to `[0.0, 1.0]` | Drawing Engine Spec |
| 26 | Property | `radius:` | Corner radius for rect / shapes | `radius: 12px;` or `radius: 8px 8px 0 0;` | `DimensionLiteralNode` / Array | Clamped to half min(width, height) | Drawing Engine Spec |
| 27 | Property | `rotation:` | Element rotation transform | `rotation: 45deg;` | `DimensionLiteralNode` | Normalized to `[0, 360)` | Drawing Engine Spec |
| 28 | Property | `clip:` Masking | Clipping mask flag / group clipping | `clip: true;` | `BooleanLiteralNode` | Creates Photoshop clipping mask in PSD | Request R3 & PSD Spec |
| 29 | Lexer | Comment Stripping | Skips single-line `//` and multi-line `/* */` comments | `// comment\n/* block */` | Trivia discarded, location updated | Unclosed block comment error at EOF | Lexer Spec |
| 30 | Parser | Error Recovery | Panic-mode recovery to `;` and `}` synchronization points | Malformed property or block | Collects diagnostic, continues parsing | Returns diagnostics list alongside partial AST | Parser Spec |

---

## 8. Edge Cases Matrix

| # | Feature | Input | Observed / Specified Behavior |
|---|---------|-------|-------------------------------|
| 1 | Lexer | `#face` vs `#button` vs `#ffffff` | `#face` (4 hex chars) -> `HEX_COLOR`; `#ffffff` (6 hex chars) -> `HEX_COLOR`; `#button` -> `ELEMENT_ID` (`button`). |
| 2 | Lexer | `at: 0 0;` (unitless zero) | Tokenized as `NUMBER(0)`; parser and layout solver normalize `0` to `0px`. |
| 3 | Lexer | Negative coordinates `at: -50px -20px;` | Scanned as `DIMENSION(-50, 'px')` and `DIMENSION(-20, 'px')` without whitespace separation errors. |
| 4 | Lexer | Unclosed string `"Hello world` at EOF | Lexer reports `Unterminated string literal at line X, col Y` and emits `STRING` up to EOF for recovery. |
| 5 | Lexer | Unclosed block comment `/* start ...` at EOF | Lexer reports `Unterminated block comment` and recovers at EOF. |
| 6 | Parser | Missing semicolon `fill: #ff0000\n radius: 8px;` | Parser records `Diagnostic(TOAD-E004: Missing semicolon)` at line end and synchronizes on `radius`. |
| 7 | Parser | Trailing commas in parameter list `component Box(w = 100px, h = 50px,)` | Parser cleanly accepts trailing commas in parameter and argument lists. |
| 8 | Resolver | Deep circular import `A -> B -> C -> A` | DFS detects `A` in active recursion stack, aborts with `CircularImportError` detailing full cycle path. |
| 9 | Resolver | Self-referential variable `$x = $x;` | DFS variable substitution detects `$x` in visiting set, throws `CircularVariableError`. |
| 10 | Resolver | Component parameter default referencing global variable `component Card(bg = $themeBg)` | Correctly resolves `$themeBg` from global scope if `bg` is omitted at call site. |
| 11 | Resolver | Component parameter shadowing global variable `$color = #fff; component Btn(color = #000) { rect { fill: $color; } }` | `$color` inside `Btn` body resolves to `#000` (parameter scope overrides global scope). |
| 12 | Resolver | Recursive component instantiation `component A { A {} }` | Exceeds max recursion depth (32); throws `ComponentRecursionLimitError`. |
| 13 | Resolver | Duplicate IDs in multiple component instances `Arrow #a1; Arrow #a2;` with `#tip` inside | Internal ID `#tip` is mangled to `a1_tip` and `a2_tip`, avoiding duplicate ID collisions in layout graph. |
| 14 | Parser | Gradient stops without positions `linear-gradient(to right, #f00, #ff0, #0f0, #00f)` | Parser generates 4 stops; layout engine evenly distributes offsets: `0.0, 0.333, 0.666, 1.0`. |
| 15 | Parser | Relational positioning with offset `at: below #hero offset 24px;` | Successfully parses relation `below`, target `#hero`, and `offset: 24px`. |
| 16 | Parser | Missing `at:` property on top-level element | Element is parsed with `at: undefined`; layout solver assigns fallback `(0, 0)` and logs compiler warning. |
| 17 | Parser | Multi-line polygon points `points: [ (0, 0), (50, 100), (0, 100) ]` | Accepts commas, newlines, or spaces as point separators inside bracketed array. |
| 18 | Parser | Multiple CSS filters in single line `filter: blur(5px) brightness(1.2) drop-shadow(0 4px 8px #00000040);` | Parses consecutive filter function invocations into a single `FilterValueNode`. |
| 19 | Directives | Duplicate `@font` registrations for same family | Later `@font` directive with identical family and weight updates/overwrites earlier entry in registry. |
| 20 | Parser | Element with both text content shorthand and block properties `text "Button Label" #btnLabel { font-size: 14px; }` | Extracts text `"Button Label"` into `TextElementNode.text` and parses nested property block. |

---

## 9. Verification & Implementation Guidance

To verify and implement `src/parser/`:
1. **`ast.ts`**: Implement exact TypeScript interfaces exported above.
2. **`lexer.ts`**: Implement regex-free single-pass cursor scanner matching `TokenType`.
3. **`parser.ts`**: Implement recursive-descent LL(1) with panic-mode error recovery to `;` and `}`.
4. **`importResolver.ts`**: Implement DFS import loader, cycle detector, variable scope map, and component expander with ID prefixing.
5. **Vitest Test Suite**:
   - `tests/lexer.test.ts`: Verify tokenization of numbers, dimensions, hex colors vs IDs, strings, directives.
   - `tests/parser.test.ts`: Verify AST generation for canvas, shapes, text, components, gradients, filters, error recovery.
   - `tests/importResolver.test.ts`: Verify multi-file `@import`, variable substitution, component parameter binding, circular import rejection, and ID mangling.
