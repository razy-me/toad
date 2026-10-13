# TOAD — Compiler, AST & Layout Solver Specification (`v3.3`)

> **Retrieval Anchors**: `[TOAD-SYNTAX-CORE]` `[TOAD-TYPESCRIPT-SCHEMA]` `[TOAD-EBNF-GRAMMAR]` `[TOAD-LAYOUT-MATH]` `[TOAD-CONTRASTIVE-PAIRS]`
> **Purpose**: Complete ground-truth compiler specification for `.toad` (Static Vector, Typography, UI, Layout & Prepress DSL), derived directly from `src/parser/*` and `src/engine/*`.

---

## 1. `[TOAD-TYPESCRIPT-SCHEMA]` Surface-Exact TypeScript Schema

Modern LLMs achieve near-100% syntax validity when constrained by strict TypeScript type definitions rather than prose descriptions. **Never invent an element type, property key, or value format outside the schema below.**

```typescript
// ============================================================================
// 1. TOP-LEVEL DOCUMENT & DIRECTIVES (.toad)
// ============================================================================
type ToadDocument = Array<
  | FontDirective       // @font "Space Grotesk" bold;  OR  @font "./font.ttf" as "MyFont" bold;
  | ImportDirective     // @import "./tokens.toad";
  | VariableDeclaration // >primary = #38bdf8;          OR  >card_w = 384px;
  | ComponentDef        // component Card(title = "Default", accent = #38bdf8) { ... }
  | CanvasBlock         // canvas 1440px 1024px #030712 { ... }  OR  canvas social-post #0c0a09 { ... }
  | ToadElement         // Top-level elements (inside canvas { ... })
>;

type CanvasPreset =
  | "social-post"     // 1080px × 1080px (1:1 Square)
  | "insta-post"      // 1080px × 1080px (1:1 Square)
  | "story"           // 1080px × 1920px (9:16 Vertical)
  | "insta-story"     // 1080px × 1920px (9:16 Vertical)
  | "youtube-thumb"   // 1280px × 720px  (16:9 Landscape)
  | "presentation"    // 1920px × 1080px (16:9 Full HD)
  | "banner"          // 1920px × 1080px (16:9 Full HD)
  | "twitter-header"  // 1500px × 500px  (3:1 Ultra-Wide Banner)
  | "fb-cover"        // 820px  × 312px  (Social Cover)
  | "dribbble-shot"   // 1600px × 1200px (4:3 Showcase)
  | "desktop-hd"      // 1440px × 1024px (Desktop UI Viewport — Ideal for Dashboards!)
  | "macbook-air"     // 1280px × 832px  (Laptop UI Viewport)
  | "iphone-15-pro"   // 393px  × 852px  (Mobile UI Viewport)
  | "a3"              // 297mm  × 420mm  (Print Poster — supports bleed: 3mm;)
  | "a4"              // 210mm  × 297mm  (Print Document — supports bleed: 3mm;)
  | "a5";             // 148mm  × 210mm  (Print Flyer — supports bleed: 3mm;)

// ============================================================================
// 2. THE 16 VALID ELEMENT SIGNATURES (.toad)
// ============================================================================
// CRITICAL: Optional `#id` ALWAYS comes FIRST, followed by `"String"` (Layer Name or Content)!
// For `star`, `triangle`, `arrow`, `cross`: use the keyword DIRECTLY (NEVER write `shape "star"`!).

type ElementSignature =
  // --- Primitives ---
  | `rect #${string}? "${string}"? { ${RectProps} }`
  | `circle #${string}? "${string}"? { ${CircleProps} }`
  | `text #${string}? "${string}" { ${TextProps} }`            // String is the rendered text! Use \n for line breaks
  | `path #${string}? "${string}"? { d: "${SvgPathString}"; ${PathProps} }`
  | `polygon #${string}? "${string}"? { points: (${PointList}); ${PolygonProps} }`
  | `image #${string}? "${string}" { ${ImageProps} }`          // String is local file path

  // --- Built-in Procedural Shapes (NO "shape" keyword!) ---
  | `star #${string}? "${string}"? { points: ${number}; inner-radius: ${PctOrPx}; ${ShapeProps} }`
  | `triangle #${string}? "${string}"? { direction: "up"|"down"|"left"|"right"; ${ShapeProps} }`
  | `arrow #${string}? "${string}"? { head-size: ${Px}; shaft-width: ${Px}; ${ShapeProps} }`
  | `cross #${string}? "${string}"? { thickness: ${PctOrPx}; ${ShapeProps} }`

  // --- Built-in Lucide Vector Icons & Codes ---
  | `icon #${string}? "${BuiltinIconName}" { size: ${Px}; stroke: ${Color} ${Px}; fill?: ${Color}; }`
  | `qrcode #${string}? "${string}" { size: ${Px}; color?: ${Color}; background?: ${Color}; }`
  | `barcode #${string}? "${string}" { size: ${Px} ${Px}; format?: "code128"|"ean13"|"upca"; color?: ${Color}; }`

  // --- Layout Containers ---
  | `stack #${string}? "${string}"? { direction: vertical|horizontal; gap: ${Px}; padding?: ${Padding}; ${ContainerProps} }`
  | `grid #${string}? "${string}"? { columns: ${number}; rows?: ${number}; gap: ${Px}; padding?: ${Padding}; ${ContainerProps} }`
  | `group #${string}? "${string}"? { ${ContainerProps} }`

  // --- Non-Destructive Adjustment Layer & Component Slot ---
  | `adjust #${string}? "${string}"? { brightness?: ${Pct}; contrast?: ${Pct}; saturation?: ${Pct}; }`
  | `slot "${string}" { ... }`;

// ============================================================================
// 3. EXACT PROPERTY & VALUE SYNTAX (.toad)
// ============================================================================
interface CommonElementProps {
  // --- Geometry & Layout ---
  at?:
    | `${Expr} ${Expr}`                                       // Top-left (for rect/text/stack/grid/group) or center (for circle)
    | `center of canvas` | `center of #${string}`             // Centers element
    | `${Anchor} of canvas` | `${Anchor} of #${string}`       // Anchor: top-left | top-right | bottom-left | bottom-right
    | `below #${string} offset ${Px}`                         // y = target.bottom + offset, x = target.left
    | `above #${string} offset ${Px}`                         // y = target.top - self.h - offset, x = target.left
    | `right of #${string} offset ${Px}`                      // Also accepts `right-of #id offset 16px`
    | `left of #${string} offset ${Px}`;                      // Also accepts `left-of #id offset 16px`
  size?:
    | `${Expr} ${Expr}`                                       // Explicit width & height: `size: 384px 176px;`
    | `hug`                                                   // Shrink-wraps children (`stack`/`group`)
    | `fill`                                                  // Stretches in parent (`stack`/`grid`)
    | `${Expr} hug`                                           // Fixed width, auto-hug height (`size: 400px hug;`)
    | `${Expr}`;                                              // On `text`: sets wrap width ONLY (`size: 400px;` -> auto-computes multi-line height!)
  radius?: `${Px}` | `${Px} ${Px} ${Px} ${Px}` | `${Pct}`;    // Disciplined card radius: `8px` to `16px` (`12px` ideal; >=30px triggers SLOP-WEB-007!)
  rotation?: `${number}deg`;                                  // Clockwise rotation around center

  // --- Paint & Stroke ---
  fill?:
    | HexColor                                                // #RGB, #RRGGBB, #RRGGBBAA
    | `rgb(${number}, ${number}, ${number})`
    | `rgba(${number}, ${number}, ${number}, ${number})`
    | `cmyk(${number}%, ${number}%, ${number}%, ${number}%)`
    | `alpha(${ColorOrVar}, ${0_to_1_or_Pct})`                // e.g. alpha(#38bdf8, 0.28)
    | `lighten(${ColorOrVar}, ${Pct})`
    | `darken(${ColorOrVar}, ${Pct})`
    | `linear-gradient(${number}deg, ${ColorStop}, ${ColorStop}, ...)` // MUST use `deg`! NEVER `to right`!
    | `radial-gradient(${ColorStop}, ${ColorStop}, ...)`;
  stroke?: `${Color} ${Px}`;                                  // Shorthand: `stroke: >bg_elevated 1px;`
  "stroke-dasharray"?: `${number} ${number}`;                 // e.g. `stroke-dasharray: 6 6;`
  "stroke-linecap"?: "butt" | "round" | "square";
  "stroke-linejoin"?: "miter" | "round" | "bevel";

  // --- Effects & Blending (Space-separated tuples, NO commas!) ---
  opacity?: number | `${number}%`;
  "blend-mode"?: "normal" | "multiply" | "screen" | "overlay" | "darken" | "lighten" | "color-dodge" | "color-burn" | "hard-light" | "soft-light" | "difference" | "exclusion";
  shadow?: `${Px} ${Px} ${Px} ${Color}`;                      // Keep alpha <= 0.16 (`shadow: 0px 12px 24px rgba(0, 0, 0, 0.14);`) to avoid SLOP-COLOR-002!
  glow?: `${Color} ${Px}` | `${Px} ${Color}`;                 // Keep alpha >= 0.20 (`glow: rgba(56, 189, 248, 0.30) 16px;`) to avoid SLOP-COLOR-004!
  blur?: `${Px}`;
  "backdrop-blur"?: `${Px}`;                                  // Requires `stroke: alpha(#ffffff, 0.14) 1px;` (`SLOP-WEB-005`)
  clip?: boolean;
}

interface TextSpecificProps extends CommonElementProps {
  "font-family"?: `"${string}"`;
  "font-size"?: `${Px}`;
  "font-weight"?: "thin" | "light" | "regular" | "normal" | "medium" | "semibold" | "bold" | "extrabold" | "black" | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
  "line-height"?: `${Px}`;                                    // ALWAYS explicit 4px-multiple px (`16px`, `20px`, `24px`, `32px`, `44px`, `48px`, `60px`, `104px`)!
  "letter-spacing"?: `${Px}` | `${number}em`;                 // Mandatory `1.5px` or `2px` on ALL-CAPS text (`SLOP-TYPE-004`)!
  "text-align"?: "left" | "center" | "right";
  trim?: "cap" | "none";                                      // Omit inside vertical stacks so heights stay exact 4px multiples!
}

// ============================================================================
// 4. BUILT-IN LUCIDE ICON REGISTRY (28 EXACT NAMES)
// ============================================================================
type BuiltinIconName =
  | "search" | "check" | "x"
  | "arrow-right" | "arrow-left" | "arrow-up" | "arrow-down"
  | "chevron-right" | "chevron-left" | "chevron-down" | "chevron-up"
  | "home" | "user" | "settings" | "star" | "heart"
  | "mail" | "bell" | "calendar" | "clock" | "eye" | "lock"
  | "plus" | "minus" | "menu"
  | "info" | "alert-triangle" | "external-link";
```

---

## 2. `[TOAD-LAYOUT-MATH]` Exact Mathematical Equations of the Layout Engine (`src/parser/math.ts`)

Because a Web LLM cannot execute the CLI, apply these exact `math.ts` equations mentally:

### 2.1 Coordinate System & Circle vs. Rect Origin
- **Canvas Origin**: `(0, 0)` is always the **top-left corner** of the canvas.
- **`rect`, `text`, `stack`, `grid`, `group`, `path`, `star`, `triangle`, `arrow`, `cross`**: `at: X Y;` sets the **top-left** corner `(x = X, y = Y)` (relative to parent `group` if nested, or global canvas if at root).
- **`circle`**: `at: Cx Cy; radius: R;` places the **center** of the circle at `(Cx, Cy)`, yielding a bounding box of `[Cx - R, Cy - R, 2R, 2R]`. Always choose `Cx, Cy, R` as multiples of `8px`!

### 2.2 Text Measurement & Height Equations (`math.ts:744-925`)
1. **Wrapping Width ($W_{\text{text}}$)**:
   - Setting `size: 400px;` (a single width value) on `text` constrains the line width to `400px`, wraps words automatically into $N_{\text{lines}}$ lines, and auto-computes the exact multi-line height!
2. **Height ($H_{\text{text}}$)**:
   $$H_{\text{text}} = \max\left(N_{\text{lines}} \times \text{lineHeight},\ \lceil \text{ascent} + \text{descent} \rceil\right)$$
   When you set an explicit pixel `line-height` that is $\ge 1.22 \times \text{fontSize}$ and a multiple of `4px`, $H_{\text{text}}$ is guaranteed to equal **exactly $N_{\text{lines}} \times \text{lineHeight}$** (an exact multiple of `4px`)!

### 2.3 Two-Pass `stack` & `grid` Auto-Layout Equations (`math.ts:1648-1895`)
- **Vertical `stack` (`direction: vertical; gap: G; padding: P; align: start;`)**:
  - Child $0$: $x_0 = X_{\text{stack}} + P_{\text{left}},\quad y_0 = Y_{\text{stack}} + P_{\text{top}}$.
  - Child $i$: $x_i = X_{\text{stack}} + P_{\text{left}},\quad y_i = y_{i-1} + H_{i-1} + G$.
  - **CRITICAL (`align: start;`)**: Always use `align: start;` on vertical text stacks! Why? Because `align: end;` or `align: center;` places text at $x_i = X_{\text{stack}} + W_{\text{inner}} - W_{\text{intrinsicText}}$, and since intrinsic glyph widths can be odd numbers, `align: end;` can put text on an odd X coordinate (`SLOP-WEB-021`). With `align: start;`, $x_i = X_{\text{stack}} + P_{\text{left}}$ is **100% locked to the 4px/8px grid**!
- **Horizontal `stack` (`direction: horizontal; justify: space-between; align: center;`)**:
  - When centering a single-line text or badge inside a fixed-height horizontal bar or button (e.g., `size: 192px 48px; padding: 12px 20px;`), choose `paddingTop = (H_button - lineHeight) / 2` as an exact multiple of `4px` (e.g., $(48 - 24)/2 = 12\text{px}$)!
- **`grid` Container (`columns: C; gap: G; size: W H;`)**:
  - Cell width $W_{\text{cell}} = \frac{W - (C - 1) \cdot G}{C}$. Always pick $W$ and $G$ so $W_{\text{cell}}$ is a multiple of `8px` (e.g., $W = 1200\text{px}, C = 3, G = 24\text{px} \implies W_{\text{cell}} = 384\text{px}$).

---

## 3. `[TOAD-CONTRASTIVE-PAIRS]` The 15 Fatal Compiler & Auditor Traps (❌ WRONG vs. ✅ RIGHT)

| # | Trap Category | ❌ WRONG (Fails Compiler or Auditor) | ✅ RIGHT (100% Valid & Grade A+) |
| :--- | :--- | :--- | :--- |
| **1** | **Variable Syntax** | `$primary = #38bdf8;` or `var(--primary)` | `>primary = #38bdf8;` and `fill: >primary;` |
| **2** | **Text Signature** | `text "Headline" #hero { content: "Hi"; }` | `text #hero "Headline" { font-size: 48px; line-height: 60px; }` |
| **3** | **Rect/Stack Size** | `rect #card { width: 300px; height: 200px; }` | `rect #card "Card" { size: 300px 200px; }` |
| **4** | **Procedural Shapes** | `shape #s1 "star" { ... }` | `star #s1 "Star" { points: 8; inner-radius: 36%; size: 96px 96px; }` |
| **5** | **Linear Gradient** | `fill: linear-gradient(to right, #0f172a, #1e293b);` | `fill: linear-gradient(90deg, #0f172a 0%, #1e293b 100%);` |
| **6** | **Shadow Alpha** | `shadow: 0px 20px 40px rgba(0, 0, 0, 0.55);` (`SLOP-COLOR-002`!) | `shadow: 0px 12px 24px rgba(0, 0, 0, 0.14);` (alpha $\le 0.16$!) |
| **7** | **Text Wrapping Size** | `text #p "Long copy..." { size: 400px 400px; }` | `text #p "Long copy..." { size: 400px; font-size: 16px; line-height: 24px; }` |
| **8** | **Unitless Leading** | `font-size: 18px; line-height: 1.5;` ($27\text{px} \to$ odd Y!) | `font-size: 18px; line-height: 28px;` (exact multiple of $4\text{px}$!) |
| **9** | **ALL-CAPS Tracking** | `text #k "SYSTEM READY" { font-size: 12px; }` (`SLOP-TYPE-004`!) | `text #k "SYSTEM READY" { font-size: 12px; line-height: 16px; letter-spacing: 2px; }` |
| **10** | **Dark-Mode APCA** | `#64748b`, `#94a3b8`, or `#38bdf8` for `< 24px` text on `#0f172a` | `#f8fafc`, `#e2e8f0`, `#bae6fd`, `#6ee7b7`, `#fde68a` ($\|L_c\| \ge 84$!) |
| **11** | **Light-Mode Brick** | `#c83e2b` for `12px` text on warm cream `#f3efe6` ($4.38:1 < 4.5$) | `#7f1d1d` (Deep Crimson Ink, $8.1:1$ WCAG, $\|L_c\| = 82$!) |
| **12** | **Green Polarity** | `text #err "0 ERRORS" { fill: #6ee7b7; }` (`SLOP-DASH-005`!) | `text #err "STATUS: NOMINAL" { fill: #6ee7b7; }` |
| **13** | **Banned Hexes** | `#8b5cf6`, `#06b6d4`, `#6366f1`, `#ec4899` (`SLOP-WEB-001`) | `#38bdf8`, `#10b981`, `#fbbf24`, `#f43f5e`, `#00f0ff` |
| **14** | **Soap-Bar Radius** | `radius: 32px;` on a content card (`SLOP-WEB-007`) | `radius: 12px;` (or `8px`..`16px`) |
| **15** | **Spine Gutter** | Placing text across $X = W/2$ on a $W > 1.5H$ canvas (`SLOP-PRINT-010`) | Use `1440px 1024px` (`W \le 1.5H`) or keep text $>30\text{px}$ away from $W/2$ |
