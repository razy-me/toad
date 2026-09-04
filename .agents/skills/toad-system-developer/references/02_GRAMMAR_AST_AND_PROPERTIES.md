# 02 — Formal Grammar, AST Specification & Property Matrix

This module defines the authoritative EBNF grammar, lexer tokens, TypeScript AST node interfaces, and the 21-property default matrix for the `toad` language.

---

## 1. Formal EBNF Grammar

```ebnf
Document            ::= Directive* VariableDecl* ComponentDecl* CanvasDecl? Element*

Directive           ::= ImportDirective | FontDirective
ImportDirective     ::= "@import" STRING ";"
FontDirective       ::= "@font" STRING "as" STRING FontModifier* ("from" STRING)? ";"
FontModifier        ::= "italic" | "oblique" | NUMBER
                      | "weight:" (NUMBER | IDENT)
                      | "style:" IDENT

VariableDecl        ::= ">" IDENT "=" Value ";"
ComponentDecl       ::= "component" IDENT "(" ParameterList? ")" "{" Property* Element* "}"
ParameterList       ::= Parameter ("," Parameter)*
Parameter           ::= IDENT ("=" Value)?

CanvasDecl          ::= "canvas" ("photo" STRING | STRING)? "{" Property* Element* "}"

Element             ::= ElementType (IDENT_HASH)? "{" Property* Element* "}"
                      | IDENT (IDENT_HASH)? ("(" ArgumentList? ")")? "{" Element* "}"
                      | "slot" ";"

ElementType         ::= "rect" | "circle" | "text" | "polygon" | "path"
                      | "image" | "adjust" | "group" | "grid" | "stack" | "icon" | "shape"
                      | "star" | "triangle" | "arrow" | "cross"

Property            ::= IDENT ":" Value ";"

Value               ::= Literal
                      | VariableRef
                      | ElementRef
                      | Coordinate
                      | RelationalPos
                      | Gradient
                      | ColorFunction
                      | CalcExpression
                      | ArrayLiteral
                      | ObjectLiteral

Literal             ::= NUMBER | DIMENSION | STRING | BOOLEAN | COLOR | IDENT
DIMENSION           ::= NUMBER ("px" | "%" | "deg" | "rad" | "em" | "rem" | "pt" | "mm" | "cm" | "in" | "vw" | "vh")
VariableRef         ::= ">" IDENT
ElementRef          ::= "#" IDENT

Coordinate          ::= "(" Value "," Value ")"
RelationalPos       ::= ("right of" | "left of" | "above" | "below" | "center of" | "inside"
                        | ("top-left" | "top-right" | "bottom-left" | "bottom-right") "of")
                        (ElementRef | "canvas" | "parent" | "previous") ("offset" Value)?

ColorFunction       ::= ("alpha" | "lighten" | "darken") "(" Value "," Value ")"
CalcExpression      ::= "calc(" [^)]+ ")"
ArrayLiteral        ::= "[" (Value ("," Value)*)? "]"
ObjectLiteral       ::= "{" (IDENT ":" Value ("," IDENT ":" Value)*)? "}"
```

---

## 2. Lexer & Token Catalog

| Token Type | Syntax Pattern | Examples |
|---|---|---|
| `DIRECTIVE` | `@import`, `@font` | `@import "./tokens.toad";` |
| `VARIABLE_DECL` | `>` followed by identifier | `>primary`, `>basePadding` |
| `ELEMENT_ID` | `#` followed by identifier | `#heroTitle`, `#cardContainer` |
| `DIMENSION` | Number + Unit | `16px`, `100%`, `45deg`, `3mm`, `12pt` |
| `COLOR_HEX` | `#` followed by 3, 4, 6, or 8 hex characters | `#fff`, `#3b82f6`, `#0f172a80` |
| `COLOR_FUNC` | `rgb(...)`, `rgba(...)`, `hsl(...)`, `hsla(...)`, `cmyk(...)` | `cmyk(0%, 100%, 100%, 0%)` |
| `COLOR_MOD` | `alpha(...)`, `lighten(...)`, `darken(...)` | `alpha(>primary, 0.4)` |
| `GRADIENT` | `linear-gradient(...)`, `radial-gradient(...)`, `conic-gradient(...)` | `linear-gradient(135deg, #f00, #00f)` |
| `RELATIONAL` | Spatial keywords | `right of`, `below`, `center of`, `inside`, `top-left of`, `previous` |
| `KEYWORD` | Reserved words | `canvas`, `component`, `slot`, `calc`, `hug`, `fill` |

---

## 3. Authoritative TypeScript AST Interfaces (`src/parser/ast.ts`)

```typescript
export interface SourceLocation {
  start: { line: number; column: number; offset: number };
  end: { line: number; column: number; offset: number };
  file?: string;
}

export interface DocumentNode {
  type: 'Document';
  directives: DirectiveNode[];
  variables: VariableDeclarationNode[];
  components: ComponentDeclarationNode[];
  canvas?: CanvasDeclarationNode;
  canvases?: CanvasDeclarationNode[];
  elements: ElementNode[];
}

export interface VariableDeclarationNode {
  type: 'VariableDeclaration';
  name: string;
  value: ValueNode;
}

export interface ComponentDeclarationNode {
  type: 'ComponentDeclaration';
  name: string;
  parameters: ComponentParameterNode[];
  properties: PropertyNode[];
  elements: ElementNode[];
}

export interface BaseElementNode {
  id?: string;
  name?: string;
  properties: PropertyNode[];
  children?: ElementNode[];
}

export type ElementType =
  | 'rect' | 'circle' | 'text' | 'polygon' | 'path' | 'image'
  | 'group' | 'grid' | 'stack' | 'component_instance' | 'icon'
  | 'shape' | 'slot';
```

---

## 4. Comprehensive Property, Types & Defaults Matrix

| Property | Type / Format | Default Value | Applicable Elements | Description |
|---|---|---|---|---|
| `at` | Coordinate / Relational | `(0, 0)` | All | Absolute point `(x, y)` or relational anchor (`below #id`, `center of canvas`). |
| `size` | Dimension / Keyword | `hug` / auto | All | `w h`, `100% 50px`, `fill 100%`, `hug`. On `text`: maximum word-wrap width; `size: Wpx auto;` measures the wrapped height. |
| `fill` | Color / Gradient | `#000000` / transparent | Shapes, Icons | Fill color or gradient (`linear-gradient`, `radial-gradient`, `conic-gradient`). |
| `color` | Color | `#000000` | `text` | Text color (Hex, RGBA, HSLA, CMYK, `currentColor`). |
| `stroke` | Stroke descriptor | none | Shapes, Paths | Stroke border: e.g. `#38bdf8 2px dashed`. |
| `radius` | Dimension / Array | `0px` | `rect`, `polygon`, `stack` | Corner radius (uniform `12px` or 4-corner array `[10, 20, 10, 20]`). |
| `rotation` | Angle (`deg`, `rad`) | `0deg` | Shapes, Groups, Texts | 2D rotation angle. |
| `scale` | Number / Coordinate | `1.0` | All | Scaling multiplier (`1.2` or `1.2 0.8`). |
| `opacity` | Number `0.0` .. `1.0` | `1.0` | All | Total element opacity. |
| `direction` | `horizontal` \| `vertical` | `vertical` | `stack` | Flow direction of the auto-layout stack. |
| `gap` | Dimension | `0px` | `stack`, `grid` | Spacing between child elements. |
| `padding` | Dimension / Array | `0px` | `stack`, `group` | Internal padding (`16px` or `[10, 20, 10, 20]`). |
| `margin` | Dimension / Array | `0px` | All | External offset added to calculated position. |
| `font-size` | Dimension | `16px` | `text` | Typographic font size. |
| `font-weight`| Number / Ident | `normal` (400) | `text` | Font weight: `100`–`900`, `bold`, or single-word descriptive keywords (`semibold`→600, `extrabold`→800, `black`→900, …). `weight:` is a valid alias. |
| `line-height`| Number / Dimension | $1.25 \times \text{fontSize}$ | `text` | Line spacing for multi-line wrapped text. |
| `letter-spacing`| Dimension | `0px` | `text` | Character tracking. |
| `align` | `left` \| `center` \| `right` \| `justify` | `left` | `text` | Paragraph text alignment. |
| `dpi` | Number | `96` | `canvas` | Print-metadata resolution recorded on the canvas; drives only the `--bleed` CLI override conversion. In-document `mm`/`cm`/`in`/`pt` always convert at the CSS-reference 96 DPI. |
| `bleed` | Dimension | `0px` | `canvas` | Print bleed margin added to all 4 edges. |
| `crop-marks` | Boolean | `false` | `canvas` | Renders automatic corner trim marks and registration crosshairs. |
| `exposure` | Number (EV stops) | `0.0` | `canvas`, `adjust` | Photographic exposure compensation ($2^{\text{EV}}$ multiplier). |
| `contrast` | Number (factor) | `1.0` | `canvas`, `adjust` | Tone curve contrast multiplier centered at mid-gray (128). |
| `brightness` | Number (factor) | `1.0` | `canvas`, `adjust` | Direct brightness scalar multiplier. |
| `saturation` | Number (factor) | `1.0` | `canvas`, `adjust` | Color saturation multiplier (Rec.709 relative luminance formula). |
| `warmth` | Number (-1.0 .. 1.0) | `0.0` | `canvas`, `adjust` | White balance temperature shift (negative = cool/blue, positive = warm/amber). |
| `vignette` | Percentage / Number | `0.0` | `canvas` | Radial edge-darkening vignette effect (`25%` or `0.25`). |
| `highlights` | Number (-1.0 .. 1.0) | `0.0` | `canvas`, `adjust` | Highlight recovery/boost above 50% luminance. |
| `shadows` | Number (-1.0 .. 1.0) | `0.0` | `canvas`, `adjust` | Shadow lift/deepening below 50% luminance. |
| `feather` | Dimension | `50% of radius` | `adjust` | Edge softness falloff distance for radial adjustment spots. |
