# TOAD — Master Knowledge Bible (v3.3 — Static Design Edition)

> **Complete Drop-in Reference**: Contains the full Ground-Truth Schema, 12 Visual Archetypes, 4px-Quantum Grid Proofs, 26 Anti-Slop Heuristics, and Grade A+ Blueprints in a single, uncompromised document.

---

# TOAD — Universal System Prompt Paste-Box (`v3.3` — `<8,000` Chars)

> **Instructions**: Copy the entire content in the markdown block below directly into the **System Instructions / Custom Instructions** field of your Web AI (**Google Gemini Gem / AI Studio**, **ChatGPT Custom GPT / Project Instructions**, or **Claude Project Instructions**), and upload the 3 modular files (`01`, `02`, `03`) or the all-in-one file `TOAD_MASTER_BIBLE.md` into the Knowledge / Files area.

---

```markdown
You are the **Principal TOAD Design Architect (v3.3)**.
Your mission is to author agency-grade, 100%-compiler-valid, 100%-audit-passing (Grade A+) `.toad` design files across any aesthetic movement without requiring terminal execution.

## 1. MANDATORY PRE-FLIGHT MENTAL SIMULATION PROTOCOL
Because you operate in a Web environment without a live CLI, you MUST output a compact **Pre-Flight Architecture & Audit Table** (8–12 lines) BEFORE every `.toad` code block:
1. **Archetype & Palette Lock**: Select 1 Primary Archetype (`A01`–`A12` from `[TOAD-ARCHETYPES]`). List exact hex variables (`>bg`, `>surface`, `>ink_primary`, `>ink_secondary`, `>accent`) and verify that EVERY text `< 24px` has **WCAG >= 4.5:1 AND APCA |Lc| >= 75** against its immediate container fill!
   - On dark surfaces (`#030712`..`#1e293b`), NEVER use `#64748b`, `#94a3b8`, or `#38bdf8` for `< 24px` text (`|Lc| < 65` fails APCA!). Use `#f8fafc`, `#e2e8f0`, `#bae6fd`, `#6ee7b7`, or `#fde68a` (`|Lc| >= 84`).
   - On light surfaces (`#ffffff`..`#f3efe6`), use `#0f172a`, `#18181b`, `#27272a`, or deep crimson `#7f1d1d` (`|Lc| >= 82`).
2. **4px-Quantum Grid Lock (`SLOP-WEB-021` & `SLOP-TYPE-014` Immunity)**:
   - Every `at: X Y;`, `size: W H;`, `gap:`, `padding:`, and explicit pixel `line-height:` MUST be an exact multiple of `4px` (prefer `8px`).
   - NEVER use unitless `line-height` (`1.4`, `1.5`) and NEVER omit `line-height`. Always pair `font-size` with its mandatory 4px-multiple `line-height`:
     `12px->16px`, `13px->20px`, `14px->20px`, `16px->24px`, `18px->28px`, `20px->28px`, `24px->32px`, `32px->40px`, `36px->44px`, `40px->48px`, `48px->60px`, `56px->68px`, `64px->76px`, `72px->88px`, `88px->104px`, `96px->112px`.
   - Inside vertical `stack` containers, use `align: start;` so text X-coordinates never land on odd pixels (`% 8 in {1, 7}`).
3. **Root Occupancy & Spine Gutter Check (`SLOP-WEB-008` & `SLOP-PRINT-010`)**:
   - Root-level containers (`< 90%` of canvas) must cover **35%–60%** of canvas area (**40%–65% negative space**).
   - On wide landscape canvases (`W > 1.5 * H`), keep `W <= 1.5 * H` (e.g., `1440px 1024px`) or ensure no text midpoint sits within `30px` of `canvasWidth / 2`.

## 2. GROUND-TRUTH `.toad` SYNTAX LAWS (`[TOAD-SYNTAX-CORE]`)
1. **Top-Level Directives & Variables**:
   - Fonts (max 2 families per file!): `@font "Space Grotesk" bold;` and `@font "Inter" regular medium bold;`
   - Variables use `>` for BOTH declaration and reference: `>bg = #030712;` -> `fill: >bg;` (NEVER `$var` or `--var`!).
   - Canvas: `canvas 1440px 1024px #030712 { ... }` or `canvas social-post #0c0a09 { ... }`.
2. **Element Signatures (`#id` ALWAYS before `"String"`)**:
   - Containers: `stack #id "Label" { ... }`, `grid #id "Label" { columns: 3; gap: 24px; ... }`, `group #id "Label" { ... }`
   - Primitives: `rect #id "Label" { ... }`, `circle #id "Label" { at: Cx Cy; radius: R; ... }`, `path #id "Label" { d: "M ..."; ... }`, `polygon #id "Label" { points: (0 0, 40 0, 20 36); ... }`
   - Procedural Shapes (direct keywords, NEVER `shape`): `star #id "Label" { points: 8; inner-radius: 36%; size: 96px 96px; }`, `triangle`, `arrow`, `cross`
   - Content Elements: `text #id "Content\nLine 2" { ... }`, `icon #id "arrow-right" { size: 20px; stroke: #f8fafc 2px; }`, `qrcode #id "https://..." { size: 120px; }`, `barcode #id "9783161484100" { size: 200px 64px; }`
3. **Property Rules**:
   - Sizing: `size: 400px 240px;` (or on wrapping `text`: `size: 400px;` single width value — auto-hugs wrapped height!). NEVER use `width:` or `height:` on elements.
   - Positioning: `at: 120px 64px;`, `at: center of canvas;`, `at: below #title offset 16px;`, `at: right of #badge offset 12px;`.
   - Gradients: `fill: linear-gradient(180deg, alpha(#38bdf8, 0.28) 0%, alpha(#38bdf8, 0.0) 100%);` (ALWAYS use `deg`, NEVER `to right`!).
   - Shadows & Glows (space-separated, NO commas, shadow alpha <= 0.16, glow alpha >= 0.20):
     `shadow: 0px 12px 24px rgba(0, 0, 0, 0.14);`
     `glow: rgba(56, 189, 248, 0.30) 16px;`
   - Uppercase Tracking (`SLOP-TYPE-004`): Every ALL-CAPS `text` MUST include `letter-spacing: 1.5px;` or `2px;`. Do NOT use more than one em-dash (`—`) per text node (`SLOP-TYPE-009`).

## 3. STRICT ANTI-SLOP BAN LIST (`[TOAD-AUDIT-100]`)
- **Banned Hexes (`SLOP-WEB-001`)**: NEVER use `#8b5cf6`, `#06b6d4`, `#6366f1`, `#ec4899`, `#00ffff`, `#ff00ff`, `#00ff00`.
- **Banned Green Polarity (`SLOP-DASH-005`)**: NEVER color text containing `-X%`, `error`, `errors`, `churn`, `drop`, `loss`, `failure`, or `latenz` in green (`#10b981`, `#22c55e`, `#6ee7b7`). Even `"0 ERRORS"` in green triggers a fatal penalty! Write `"STATUS: NOMINAL"` or `"ZERO PACKET CONTENTION"` instead.
- **Card Radius Discipline (`SLOP-WEB-007`)**: Keep card `radius:` between `8px` and `16px` (`12px` ideal; never `>= 24px` on large cards).
```


---

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


---

# TOAD — Design Auditor Mathematics, Visual Archetypes & Vector Recipe Book (`v3.3`)

> **Retrieval Anchors**: `[TOAD-AUDIT-100]` `[TOAD-4PX-QUANTUM]` `[TOAD-ARCHETYPES]` `[TOAD-COMPOSITIONS]` `[TOAD-VECTOR-RECIPES]` `[TOAD-SELF-HEALING]`
> **Purpose**: Mathematical reverse-engineering of the 8-category TOAD Design Auditor (`src/tools/designAuditor.ts` & `antiSlopRules.ts`), the **12 Pre-Verified Visual Archetypes** (replacing the legacy 100 XML personas), **5 Golden-Ratio Compositional Skeletons**, **Parametric SVG `path` Recipes**, and the **Self-Healing Multimodal Loop**.

---

## 1. `[TOAD-AUDIT-100]` How the TOAD Design Auditor Calculates `100%` (`A+`)

The TOAD Design Auditor evaluates every compiled `.toad` AST across **8 weighted dimensions**:

| # | Audit Category | Weight | How to Lock in `100 / 100` on First Pass |
| :--- | :--- | :--- | :--- |
| **1** | **`alignment`** | `15%` | Zero sibling overlaps (`OVERLAP-SIBLINGS`), zero container overflows (`OVERFLOW-PARENT`), and 100% compliance with the **4px-Quantum Law** (`SLOP-WEB-021`). |
| **2** | **`contrast`** | `15%` | Every text element `< 24px` has **WCAG $\ge 4.5:1$** AND **APCA $\|L_c\| \ge 75$** against its immediate container (`stack`/`rect`/`canvas`) fill. |
| **3** | **`whitespace`** | `15%` | Root-level negative space sits between **`40%` and `65%`** (`SLOP-WEB-008`), margins are $\ge 5\%$ of canvas width, and card padding is `24px`–`36px`. |
| **4** | **`typography`** | `15%` | Max **2 font families** (`SLOP-WEB-002`), at least **3 distinct font sizes** with scale ratio $\ge 1.35$, ALL-CAPS text has `letter-spacing: 1.5px` or `2px` (`SLOP-TYPE-004`), and **zero sub-pixel coordinates** (`SLOP-TYPE-014`). |
| **5** | **`colorHarmony`** | `10%` | Max **5 distinct semantic color families**, zero banned AI-slop hexes (`SLOP-WEB-001`), shadow alpha $\le 0.16$ (`SLOP-COLOR-002`), and `glow` alpha $\ge 0.20$ (`SLOP-COLOR-004`). |
| **6** | **`visualHierarchy`** | `10%` | Clear dominant focal element (`hero` title $\ge 2.2\times$ body font size), distinct surface elevation layers (`canvas` $\to$ `card` $\to$ `badge`). |
| **7** | **`printReadiness`** | `10%` | Keep all live text at least `48px` (`12mm`) inside the canvas edges (`PRINT-TRIM-COLLISION` & `SLOP-PRINT-012`), and avoid placing text across the horizontal midpoint $X = W/2$ on wide canvases where $W > 1.5H$ (`SLOP-PRINT-010`). |
| **8** | **`antiSlop`** | `10%` | Zero triggered `SLOP-*` heuristics. **CRITICAL**: Any single `fatal` `SLOP-*` rule caps the overall score at **`78%` (`C+`)**! |

---

## 2. `[TOAD-4PX-QUANTUM]` The 4px-Quantum Law & Negative Space Mathematics

### 2.1 Why `SLOP-WEB-021` & `SLOP-TYPE-014` Happen — And How to Make Them Mathematically Impossible
- **`SLOP-WEB-021` (Fatal, `-35 pts`, caps total score at `78%`)** inspects every `rect`, `stack`, and `text` where $x > 0$ and $y > 0$. It flags any element where:
  $$\text{round}(x) \bmod 8 \in \{1, 7\} \quad \text{OR} \quad \text{round}(y) \bmod 8 \in \{1, 7\}$$
  Notice that $\bmod 8 \in \{1, 7\}$ can **ONLY** happen when $\text{round}(x)$ or $\text{round}(y)$ is an **ODD integer**! Every even integer has $\bmod 8 \in \{0, 2, 4, 6\}$, which **100% passes `SLOP-WEB-021`**!
- **The 4px-Quantum Theorem**:
  1. Set every `at: X Y;`, `size: W H;`, `gap:`, `padding:`, and explicit pixel `line-height:` to a **multiple of `4px`** (prefer `8px`).
  2. Inside vertical `stack` containers (`direction: vertical;`), always use `align: start;` so text X-coordinates equal $X_{\text{stack}} + P_{\text{left}}$ (never dependent on intrinsic glyph widths!).
  3. Inside fixed-height buttons or pills (`size: 192px 48px;`), position the label using explicit `padding: 12px 20px;` (where $12 + 24 + 12 = 48\text{px}$) rather than `align: center; justify: center;` on an odd-width text string!

### 2.2 Mandatory Font-Size $\to$ 4px-Multiple `line-height` Lookup Table

| Role | `font-size` | Mandatory `line-height` | Resulting 1-Line Height ($H_1$) | Resulting 2-Line Height ($H_2$) | Recommended `letter-spacing` |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Micro / Overline / Tag** | `12px` | `line-height: 16px;` | `16px` ($\equiv 0 \bmod 8$) | `32px` ($\equiv 0 \bmod 8$) | `1.5px` or `2px` (uppercase) |
| **Caption / Secondary UI** | `13px` or `14px` | `line-height: 20px;` | `20px` ($\equiv 4 \bmod 8$) | `40px` ($\equiv 0 \bmod 8$) | `1.5px` or `2px` (if uppercase) |
| **Button Label (in 48px btn)**| `14px` | `line-height: 24px;` | `24px` ($\equiv 0 \bmod 8$) | `48px` ($\equiv 0 \bmod 8$) | `1.5px` (with `padding: 12px 20px;`) |
| **Standard Body Copy** | `16px` | `line-height: 24px;` | `24px` ($\equiv 0 \bmod 8$) | `48px` ($\equiv 0 \bmod 8$) | `0px` (or `1.5px` if uppercase) |
| **Lead Paragraph** | `18px` or `20px` | `line-height: 28px;` | `28px` ($\equiv 4 \bmod 8$) | `56px` ($\equiv 0 \bmod 8$) | `-0.2px` |
| **Card Title / H3** | `24px` | `line-height: 32px;` | `32px` ($\equiv 0 \bmod 8$) | `64px` ($\equiv 0 \bmod 8$) | `-0.5px` |
| **Section Header / H2** | `36px` | `line-height: 44px;` | `44px` ($\equiv 4 \bmod 8$) | `88px` ($\equiv 0 \bmod 8$) | `-1px` |
| **Sub-Hero / KPI Value** | `40px` | `line-height: 48px;` | `48px` ($\equiv 0 \bmod 8$) | `96px` ($\equiv 0 \bmod 8$) | `-1px` |
| **Hero Display / H1** | `48px` | `line-height: 60px;` | `60px` ($\equiv 4 \bmod 8$) | `120px` ($\equiv 0 \bmod 8$) | `-1px` |
| **Monumental Poster** | `88px` | `line-height: 104px;` | `104px` ($\equiv 0 \bmod 8$) | `208px` ($\equiv 0 \bmod 8$) | `-2px` (use Mixed Case!) |

---

## 3. `[TOAD-ARCHETYPES]` The 12 Pre-Verified Visual Archetypes (100% APCA & Anti-Slop Safe)

Select **1 Primary Archetype** (80% dominance) and optionally **1 Accent Archetype** (20% geometric twist).
**CRITICAL APCA RULE**: Notice that each Archetype below separates **Text-Safe Accent Tokens (`>ink_accent`)** (which have APCA $|L_c| \ge 78$ for `< 24px` overlines/labels) from **Graphic Shape Accent Tokens (`>accent_shape`)** (used for circles, bars, borders, and curves):

| ID | Archetype Name | Best Used For | Canvas & Surface Tokens (`>bg`, `>surface`, `>border`) | APCA-Safe Text Tokens (`>ink_1`, `>ink_2`, `>ink_accent` — ALL $\ge 78\ L_c$!) | Graphic Vector Tokens (`>accent_1`, `>accent_2`) | Font Pairing (`@font`) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`A01`** | **Obsidian FinTech / Linear Precision** | SaaS Dashboards, AI Platforms, DevTools | `>bg = #030712;`<br>`>surface = #0f172a;`<br>`>border = #1e293b;` | `>ink_1 = #f8fafc;` ($L_c\ 104$)<br>`>ink_2 = #e2e8f0;` ($L_c\ 89$)<br>`>ink_sky = #bae6fd;` ($L_c\ 84$)<br>`>ink_emerald = #6ee7b7;` ($L_c\ 86$) | `>accent_1 = #38bdf8;`<br>`>accent_2 = #10b981;` | `"Space Grotesk"` + `"Inter"` |
| **`A02`** | **International Swiss Grid (1964)** | Cultural Posters, Architecture, Conferences | `>bg = #f4f1ea;`<br>`>surface = #ebe6dc;`<br>`>border = #18181b;` | `>ink_1 = #111111;` ($L_c\ 98$)<br>`>ink_2 = #27272a;` ($L_c\ 88$)<br>`>ink_accent = #7f1d1d;` ($L_c\ 82$) | `>accent_1 = #b91c1c;`<br>`>accent_2 = #1d4ed8;` | `"Space Grotesk"` + `"IBM Plex Mono"` |
| **`A03`** | **Weimar Bauhaus Constructivism** | Exhibition Posters, Geometric Art, Covers | `>bg = #f3efe6;`<br>`>surface = #e7e0d2;`<br>`>border = #18181b;` | `>ink_1 = #18181b;` ($L_c\ 96$)<br>`>ink_2 = #27272a;` ($L_c\ 87$)<br>`>ink_accent = #7f1d1d;` ($L_c\ 82$) | `>accent_1 = #991b1b;`<br>`>accent_2 = #d97706;` | `"Space Grotesk"` + `"IBM Plex Mono"` |
| **`A04`** | **Tokyo Neo-Metabolism (Kamekura)** | Tech Posters, Symbolic Logos, Keynotes | `>bg = #090d16;`<br>`>surface = #131c2e;`<br>`>border = #293548;` | `>ink_1 = #ffffff;` ($L_c\ 105$)<br>`>ink_2 = #e2e8f0;` ($L_c\ 90$)<br>`>ink_accent = #fecdd3;` ($L_c\ 84$) | `>accent_1 = #e11d48;`<br>`>accent_2 = #f59e0b;` | `"Syne"` + `"Inter"` |
| **`A05`** | **Atelier Luxury Editorial** | High Fashion, Horology, Fragrance, Monograph | `>bg = #0c0a09;`<br>`>surface = #1c1917;`<br>`>border = #292524;` | `>ink_1 = #fafaf9;` ($L_c\ 103$)<br>`>ink_2 = #e7e5e4;` ($L_c\ 89$)<br>`>ink_accent = #fde68a;` ($L_c\ 88$) | `>accent_1 = #fbbf24;`<br>`>accent_2 = #d6d3d1;` | `"Playfair Display"` + `"Plus Jakarta Sans"` |
| **`A06`** | **Hardware Industrial Schematic** | Audio Gear, Hardware Specs, Telemetry | `>bg = #e5e5e0;`<br>`>surface = #d6d6d0;`<br>`>border = #18181b;` | `>ink_1 = #09090b;` ($L_c\ 95$)<br>`>ink_2 = #18181b;` ($L_c\ 90$)<br>`>ink_accent = #7c2d12;` ($L_c\ 80$) | `>accent_1 = #ea580c;`<br>`>accent_2 = #0284c7;` | `"Space Grotesk"` + `"JetBrains Mono"` |
| **`A07`** | **Nordic Botanical / Warm Organic** | Sustainability, Skincare, Culinary | `>bg = #f7f5f0;`<br>`>surface = #ece8df;`<br>`>border = #d6cfc2;` | `>ink_1 = #1c241e;` ($L_c\ 97$)<br>`>ink_2 = #2d3830;` ($L_c\ 86$)<br>`>ink_accent = #14532d;` ($L_c\ 82$) | `>accent_1 = #15803d;`<br>`>accent_2 = #b45309;` | `"Fraunces"` + `"DM Sans"` |
| **`A08`** | **Orbital Telemetry / Deep Space HUD** | Aerospace, Defense, Mission Control | `>bg = #020617;`<br>`>surface = #0f172a;`<br>`>border = #1e3a5f;` | `>ink_1 = #f8fafc;` ($L_c\ 104$)<br>`>ink_2 = #bae6fd;` ($L_c\ 84$)<br>`>ink_accent = #a5f3fc;` ($L_c\ 88$) | `>accent_1 = #00f0ff;`<br>`>accent_2 = #f59e0b;` | `"Space Grotesk"` + `"JetBrains Mono"` |
| **`A09`** | **Kinetic Neo-Brutalist Swiss** | Music Festivals, Streetwear, Cultural Drops | `>bg = #facc15;`<br>`>surface = #fef08a;`<br>`>border = #09090b;` | `>ink_1 = #09090b;` ($L_c\ 98$)<br>`>ink_2 = #18181b;` ($L_c\ 92$)<br>`>ink_accent = #7f1d1d;` ($L_c\ 79$) | `>accent_1 = #09090b;`<br>`>accent_2 = #dc2626;` | `"Syne"` + `"Space Mono"` |
| **`A10`** | **Financial Broadsheet / Sovereign** | Annual Reports, Macro Research, Banking | `>bg = #fbf8f3;`<br>`>surface = #f1ebe1;`<br>`>border = #d6cbbd;` | `>ink_1 = #0f172a;` ($L_c\ 99$)<br>`>ink_2 = #1e293b;` ($L_c\ 91$)<br>`>ink_accent = #134e4a;` ($L_c\ 83$) | `>accent_1 = #0f766e;`<br>`>accent_2 = #991b1b;` | `"Instrument Serif"` + `"Inter"` |
| **`A11`** | **Mid-Century Blue Note / Vinyl Jazz** | Album Art, Podcast Covers, Documentary | `>bg = #111318;`<br>`>surface = #1c2028;`<br>`>border = #2e3440;` | `>ink_1 = #f3efe6;` ($L_c\ 99$)<br>`>ink_2 = #e5e0d5;` ($L_c\ 88$)<br>`>ink_accent = #fed7aa;` ($L_c\ 85$) | `>accent_1 = #ea580c;`<br>`>accent_2 = #38bdf8;` | `"Oswald"` + `"IBM Plex Mono"` |
| **`A12`** | **Bio-Medical / Clean Clinical Lab** | HealthTech, Biotech, Precision Diagnostics | `>bg = #f8fafc;`<br>`>surface = #ffffff;`<br>`>border = #cbd5e1;` | `>ink_1 = #0f172a;` ($L_c\ 101$)<br>`>ink_2 = #334155;` ($L_c\ 82$)<br>`>ink_accent = #0c4a6e;` ($L_c\ 81$) | `>accent_1 = #0284c7;`<br>`>accent_2 = #0d9488;` | `"Plus Jakarta Sans"` + `"IBM Plex Mono"` |

---

## 4. `[TOAD-COMPOSITIONS]` The 4 Pre-Calibrated Golden-Ratio Skeletons (`40%–55%` Whitespace)

1. **`DESKTOP_BENTO_1440x1024` (SaaS Dashboards, Telemetry, AI Platforms)**:
   - Canvas: `canvas 1440px 1024px #030712` ($W/H = 1.406 \le 1.50 \implies$ immune to `SLOP-PRINT-010` spine gutter check!).
   - Outer Margin: `120px` left/right, `64px` top/bottom (Inner Width $= 1200\text{px}$).
   - Blocks:
     - `stack #header_bar`: `at: 120px 64px; size: 1200px 64px;`
     - `stack #hero_card`: `at: 120px 176px; size: 464px 424px;`
     - `stack #chart_card`: `at: 616px 176px; size: 704px 424px;`
     - `grid #kpi_grid`: `at: 120px 648px; size: 1200px 176px; columns: 3; gap: 24px;` (Cells: $384 \times 176\text{px}$).
   - Resulting Whitespace: **Exactly `40%` (`100/100 A+`)**.

2. **`SWISS_POSTER_1200x1600` (Exhibition Posters, Cultural Events, Architecture)**:
   - Canvas: `canvas 1200px 1600px #f3efe6`
   - Outer Margin: `80px` all around (Inner Width $= 1040\text{px}$).
   - Blocks:
     - `stack #top_meta`: `at: 80px 80px; size: 1040px 72px;`
     - `group #bauhaus_emblem`: `at: 280px 248px; size: 640px 560px;`
     - `stack #title_block`: `at: 80px 952px; size: 1040px 344px;`
     - `grid #colophon_grid`: `at: 80px 1376px; size: 1040px 144px; columns: 3; gap: 40px;` (Cells: $320 \times 144\text{px}$).

3. **`SOCIAL_SQUARE_1080x1080` (Instagram Posts, Luxury Drops, Album Art)**:
   - Canvas: `canvas social-post #0c0a09` (`1080px × 1080px`)
   - Outer Margin: `80px` left/right, `64px` top/bottom (Inner Width $= 920\text{px}$).
   - Blocks:
     - `stack #atelier_top`: `at: 80px 64px; size: 920px 48px;`
     - `group #horology_emblem`: `at: 300px 168px; size: 480px 416px;`
     - `stack #editorial_card`: `at: 80px 640px; size: 920px 360px;`

4. **`MOBILE_UI_400x864` (Mobile FinTech/Health Apps, Stories)**:
   - Canvas: `canvas 400px 864px #030712`
   - Outer Margin: `24px` left/right, `32px` top/bottom (Inner Width $= 352\text{px}$).

---

## 5. `[TOAD-SELF-HEALING]` Self-Healing Multimodal & Iterative Audit Protocol

Whenever the user pastes output from `toad report "<file>.toad" --fixes` or uploads a rendered screenshot:
1. **`SLOP-WEB-021` / `SLOP-TYPE-014`**: Check the flagged `#elementId`. Ensure its `at:` and `size:` are multiples of `8px`, change `align: end;` or `align: center;` on vertical text stacks to `align: start;`, and use explicit `padding:` inside buttons instead of `justify: center;`.
2. **`APCA-CONTRAST-NOTICE` / `WCAG-CONTRAST-FAIL`**: Switch `< 24px` accent text from saturated mid-tone colors (`#38bdf8`, `#10b981`, `#fbbf24`, `#c83e2b`) to high-luminance tint tokens on dark surfaces (`#bae6fd`, `#6ee7b7`, `#fde68a`, `#f8fafc`) or deep ink tokens on light surfaces (`#7f1d1d`, `#18181b`, `#0f172a`).
3. **`SLOP-COLOR-002` (Harsh Shadow)**: Lower shadow alpha to `<= 0.16` (`shadow: 0px 12px 24px rgba(0, 0, 0, 0.14);`).
4. **`SLOP-TYPE-004` (Uppercase Tracking)**: Add `letter-spacing: 1.5px;` or `2px;` to every ALL-CAPS text element, or use Mixed Case for large display headlines.
5. **`SLOP-PRINT-010` (Gutter Strangulation)**: Keep canvas aspect ratio $W \le 1.5H$ (e.g., `1440px 1024px`) or ensure no text midpoint sits within `30px` of $X = W/2$.


---

# TOAD — Gold-Standard 100%-Audit Blueprints (`v3.3`)

> **Retrieval Anchors**: `[TOAD-BLUEPRINTS-100]` `[TOAD-EXEMPLAR-DASHBOARD]` `[TOAD-EXEMPLAR-POSTER]` `[TOAD-EXEMPLAR-EDITORIAL]`
> **Purpose**: Every `.toad` file in this document has been compiled and audited against `toad report "<file>.toad" --fixes` and verified to achieve **100 / 100 (`Grade A+`, 0 errors, 0 warnings)**. Study both the **Pre-Flight Mental Simulation Scratchpad** and the **exact coordinate & typography patterns** before generating any design.

---

## 1. `[TOAD-EXEMPLAR-DASHBOARD]` Blueprint 1: Obsidian FinTech & AI Telemetry Dashboard (`100/100 A+`)

### Pre-Flight Mental Simulation Scratchpad
```text
1. ARCHETYPE: A01 (Obsidian FinTech / Linear Precision)
   - Canvas: 1440px × 1024px (#030712), Safe Zone: X ∈ [120, 1320], Y ∈ [64, 960] (Inner W = 1200px)
   - Surfaces: >bg_surface = #0f172a, >bg_elevated = #1e293b
   - APCA-Safe Text Tokens (ALL |Lc| >= 84 on #0f172a):
     * >ink_primary = #f8fafc (Lc 104)
     * >ink_secondary = #e2e8f0 (Lc 89)
     * >ink_sky = #bae6fd (Lc 84)
     * >ink_emerald = #6ee7b7 (Lc 86)
     * >ink_amber = #fde68a (Lc 88)
2. 4PX-QUANTUM & SPINE GUTTER CHECK:
   - Canvas center spine X = 720px. Left Hero Card ends at X = 120 + 464 = 584px. Right Chart Card starts at X = 616px (text starts at 616 + 32 = 648px). Zero text crosses the center spine!
   - All font-size / line-height pairs use exact 4px multiples: 12px/16px, 13px/20px, 14px/24px, 16px/24px, 24px/32px, 36px/44px, 40px/48px.
   - All ALL-CAPS labels include `letter-spacing: 1.5px;` or `2px;`.
   - Shadows use subtle elevation (`shadow: 0px 12px 24px rgba(0, 0, 0, 0.14);` <= 0.16 alpha).
3. ROOT OCCUPANCY BUDGET:
   - Header (1200×64 = 76,800) + Hero Card (464×424 = 196,736) + Chart Card (704×424 = 298,496) + KPI Grid (1200×176 = 211,200)
   - Occupied = 60% -> Whitespace = 40% [Optimal 40–65% range!].
```

### Complete `.toad` Source (`aether_dashboard.toad` — Verified `100 / 100 A+`)
```toad
@font "Space Grotesk" bold;
@font "Inter" regular medium bold;

>bg_canvas = #030712;
>bg_surface = #0f172a;
>bg_elevated = #1e293b;
>ink_primary = #f8fafc;
>ink_secondary = #e2e8f0;
>ink_sky = #bae6fd;
>ink_emerald = #6ee7b7;
>ink_amber = #fde68a;
>accent_sky = #38bdf8;
>accent_emerald = #10b981;
>accent_amber = #f59e0b;

canvas 1440px 1024px #030712 {
  // 1. Top Navigation & Telemetry Header (x=120, y=64, w=1200, h=64)
  stack #header_bar "Top Navigation Bar" {
    at: 120px 64px;
    size: 1200px 64px;
    direction: horizontal;
    justify: space-between;
    align: center;
    padding: 12px 24px;
    fill: >bg_surface;
    stroke: >bg_elevated 1px;
    radius: 12px;

    stack #brand_cluster "Brand Identity" {
      size: 360px 40px;
      direction: horizontal;
      gap: 16px;
      align: center;

      rect #brand_mark "Brand Pulse Mark" {
        size: 16px 16px;
        radius: 4px;
        fill: >accent_sky;
        glow: rgba(56, 189, 248, 0.35) 12px;
      }

      text #brand_name "AETHER // QUANTUM TELEMETRY" {
        font-family: "Space Grotesk";
        font-weight: bold;
        font-size: 16px;
        line-height: 24px;
        letter-spacing: 2px;
        fill: >ink_primary;
      }
    }

    stack #status_pill "Cluster Status Pill" {
      size: 240px 40px;
      direction: horizontal;
      padding: 12px 20px;
      fill: #064e3b;
      stroke: >accent_emerald 1px;
      radius: 12px;

      text #status_label "STATUS: NOMINAL 99.98%" {
        font-family: "Inter";
        font-weight: bold;
        font-size: 12px;
        line-height: 16px;
        letter-spacing: 1.5px;
        fill: >ink_primary;
      }
    }
  }

  // 2. Left Hero Narrative & Primary Metric Card (x=120, y=176, w=464, h=424)
  stack #hero_card "Primary Intelligence Card" {
    at: 120px 176px;
    size: 464px 424px;
    direction: vertical;
    gap: 20px;
    padding: 32px;
    fill: >bg_surface;
    stroke: >bg_elevated 1px;
    radius: 12px;
    shadow: 0px 12px 24px rgba(0, 0, 0, 0.14);

    text #hero_overline "NEURAL INFERENCE ENGINE // V4.2" {
      font-family: "Inter";
      font-weight: bold;
      font-size: 12px;
      line-height: 16px;
      letter-spacing: 2px;
      fill: >ink_sky;
    }

    text #hero_title "Deterministic sub-millisecond compute fabric." {
      size: 400px;
      font-family: "Space Grotesk";
      font-weight: bold;
      font-size: 36px;
      line-height: 44px;
      letter-spacing: -1px;
      fill: >ink_primary;
    }

    text #hero_desc "Zero-jitter tensor routing across 128 global edge regions with hardware-verified cryptographic attestation." {
      size: 400px;
      font-family: "Inter";
      font-weight: regular;
      font-size: 16px;
      line-height: 24px;
      fill: >ink_secondary;
    }

    stack #cta_row "Hero Action Row" {
      size: 400px 48px;
      direction: horizontal;
      gap: 16px;
      align: start;

      stack #btn_primary "Primary Action Button" {
        size: 192px 48px;
        direction: horizontal;
        padding: 12px 20px;
        fill: >ink_sky;
        radius: 8px;

        text #btn_primary_txt "DEPLOY CLUSTER" {
          font-family: "Space Grotesk";
          font-weight: bold;
          font-size: 14px;
          line-height: 24px;
          letter-spacing: 1.5px;
          fill: #030712;
        }
      }

      stack #btn_secondary "Secondary Docs Button" {
        size: 192px 48px;
        direction: horizontal;
        padding: 12px 20px;
        fill: >bg_elevated;
        stroke: #334155 1px;
        radius: 8px;

        text #btn_sec_txt "TOPOLOGY DOCS" {
          font-family: "Inter";
          font-weight: bold;
          font-size: 14px;
          line-height: 24px;
          letter-spacing: 1.5px;
          fill: >ink_primary;
        }
      }
    }
  }

  // 3. Right Telemetry Waveform & Throughput Card (x=616, y=176, w=704, h=424)
  stack #chart_card "Throughput Telemetry Card" {
    at: 616px 176px;
    size: 704px 424px;
    direction: vertical;
    gap: 20px;
    padding: 32px;
    fill: >bg_surface;
    stroke: >bg_elevated 1px;
    radius: 12px;
    shadow: 0px 12px 24px rgba(0, 0, 0, 0.14);

    stack #chart_header "Chart Header Row" {
      size: 640px 56px;
      direction: horizontal;
      justify: space-between;
      align: center;

      stack #chart_titles "Chart Title Stack" {
        size: 400px 56px;
        direction: vertical;
        gap: 8px;

        text #chart_kicker "REAL-TIME THROUGHPUT WAVEFORM" {
          font-family: "Inter";
          font-weight: bold;
          font-size: 12px;
          line-height: 16px;
          letter-spacing: 2px;
          fill: >ink_sky;
        }

        text #chart_heading "4.82M req/sec sustained load" {
          font-family: "Space Grotesk";
          font-weight: bold;
          font-size: 24px;
          line-height: 32px;
          fill: >ink_primary;
        }
      }

      text #chart_delta "+38.4% VS BASELINE" {
        font-family: "Space Grotesk";
        font-weight: bold;
        font-size: 16px;
        line-height: 24px;
        letter-spacing: 1.5px;
        fill: >ink_emerald;
      }
    }

    // Vector Waveform Canvas Group (640px x 264px)
    group #waveform_group "Vector Chart Canvas" {
      size: 640px 264px;

      rect #grid_line_1 "Grid Rule 1" {
        at: 0px 56px;
        size: 640px 1px;
        fill: >bg_elevated;
      }
      rect #grid_line_2 "Grid Rule 2" {
        at: 0px 136px;
        size: 640px 1px;
        fill: >bg_elevated;
      }
      rect #grid_line_3 "Grid Rule 3" {
        at: 0px 216px;
        size: 640px 1px;
        fill: >bg_elevated;
      }

      path #wave_area "Throughput Area Gradient" {
        at: 0px 24px;
        size: 640px 216px;
        d: "M 0 176 C 96 168, 144 112, 224 120 C 304 128, 368 64, 448 72 C 528 80, 584 24, 640 16 L 640 216 L 0 216 Z";
        fill: linear-gradient(180deg, alpha(#38bdf8, 0.28) 0%, alpha(#38bdf8, 0.0) 100%);
      }

      path #wave_curve "Throughput Signal Curve" {
        at: 0px 24px;
        size: 640px 216px;
        d: "M 0 176 C 96 168, 144 112, 224 120 C 304 128, 368 64, 448 72 C 528 80, 584 24, 640 16";
        stroke: >accent_sky 3px;
        stroke-linecap: round;
        glow: rgba(56, 189, 248, 0.30) 16px;
      }
    }
  }

  // 4. Bottom 3-Column KPI Bento Row (x=120, y=648, w=1200, h=176)
  grid #kpi_grid "Bottom Telemetry KPI Grid" {
    at: 120px 648px;
    size: 1200px 176px;
    columns: 3;
    gap: 24px;

    stack #kpi_1 "KPI Card 1" {
      size: 384px 176px;
      direction: vertical;
      gap: 12px;
      padding: 24px;
      fill: >bg_surface;
      stroke: >bg_elevated 1px;
      radius: 12px;

      text #kpi_1_lbl "P99 GLOBAL LATENCY" {
        font-family: "Inter";
        font-weight: bold;
        font-size: 12px;
        line-height: 16px;
        letter-spacing: 2px;
        fill: >ink_secondary;
      }

      text #kpi_1_val "0.42 ms" {
        font-family: "Space Grotesk";
        font-weight: bold;
        font-size: 40px;
        line-height: 48px;
        letter-spacing: -1px;
        fill: >ink_primary;
      }

      text #kpi_1_sub "VERIFIED ACROSS 128 POP NODES" {
        font-family: "Inter";
        font-weight: medium;
        font-size: 13px;
        line-height: 20px;
        letter-spacing: 1.5px;
        fill: >ink_sky;
      }
    }

    stack #kpi_2 "KPI Card 2" {
      size: 384px 176px;
      direction: vertical;
      gap: 12px;
      padding: 24px;
      fill: >bg_surface;
      stroke: >bg_elevated 1px;
      radius: 12px;

      text #kpi_2_lbl "ACTIVE GPU TENSOR CORES" {
        font-family: "Inter";
        font-weight: bold;
        font-size: 12px;
        line-height: 16px;
        letter-spacing: 2px;
        fill: >ink_secondary;
      }

      text #kpi_2_val "16,384" {
        font-family: "Space Grotesk";
        font-weight: bold;
        font-size: 40px;
        line-height: 48px;
        letter-spacing: -1px;
        fill: >ink_primary;
      }

      text #kpi_2_sub "ZERO PACKET CONTENTION" {
        font-family: "Inter";
        font-weight: medium;
        font-size: 13px;
        line-height: 20px;
        letter-spacing: 1.5px;
        fill: >ink_emerald;
      }
    }

    stack #kpi_3 "KPI Card 3" {
      size: 384px 176px;
      direction: vertical;
      gap: 12px;
      padding: 24px;
      fill: >bg_surface;
      stroke: >bg_elevated 1px;
      radius: 12px;

      text #kpi_3_lbl "THERMAL HEADROOM RESERVE" {
        font-family: "Inter";
        font-weight: bold;
        font-size: 12px;
        line-height: 16px;
        letter-spacing: 2px;
        fill: >ink_secondary;
      }

      text #kpi_3_val "94.6%" {
        font-family: "Space Grotesk";
        font-weight: bold;
        font-size: 40px;
        line-height: 48px;
        letter-spacing: -1px;
        fill: >ink_primary;
      }

      text #kpi_3_sub "IMMERSION COOLING ACTIVE" {
        font-family: "Inter";
        font-weight: medium;
        font-size: 13px;
        line-height: 20px;
        letter-spacing: 1.5px;
        fill: >ink_amber;
      }
    }
  }
}
```

---

## 2. `[TOAD-EXEMPLAR-POSTER]` Blueprint 2: Weimar Bauhaus & Swiss International Exhibition Poster (`100/100 A+`)

### Pre-Flight Mental Simulation Scratchpad
```text
1. ARCHETYPE: A03 (Weimar Bauhaus Constructivism) + A02 (International Swiss Grid)
   - Canvas: 1200px × 1600px (#f3efe6), Outer Margin: 80px (Inner Width = 1040px)
   - APCA-Safe Text Tokens on #f3efe6:
     * >ink_charcoal = #18181b (Lc 96)
     * >ink_muted = #27272a (Lc 87)
     * >accent_brick = #7f1d1d (Deep Crimson Ink, WCAG 8.1:1, APCA Lc 82 on #f3efe6!)
2. CONSTRUCTIVIST VECTOR EMBLEM:
   - Combines architectural backdrop slab (`rect`), primary sun disc (`circle`), multiply-blended ochre eclipse (`circle` with `blend-mode: multiply;`), cobalt counter-bar (`rect`), vertical axis monolith (`rect`), and diagonal vector chord (`path`).
3. 4PX-QUANTUM & TYPOGRAPHY CHECK:
   - All stacks use `align: start;` so text X-coordinates lock to exact multiples of 8px (`80px`, `440px`, `800px`).
   - Headline uses mixed case `"Konstruktion\nund Rhythmus."` (`88px` / `line-height: 104px`) while uppercase overlines have `letter-spacing: 2px;`.
```

### Complete `.toad` Source (`bauhaus_zurich_poster.toad` — Verified `100 / 100 A+`)
```toad
@font "Space Grotesk" bold;
@font "IBM Plex Mono" regular bold;

>bg_paper = #f3efe6;
>surface_warm = #e7e0d2;
>ink_charcoal = #18181b;
>ink_muted = #27272a;
>accent_brick = #7f1d1d;
>accent_ochre = #d97706;
>accent_cobalt = #1d4ed8;

canvas 1200px 1600px #f3efe6 {
  // 1. Top Exhibition Metadata Bar (x=80, y=80, w=1040, h=72)
  stack #top_meta "Top Archival Metadata" {
    at: 80px 80px;
    size: 1040px 72px;
    direction: horizontal;
    justify: space-between;
    align: start;

    stack #meta_left "Museum Name" {
      size: 480px 64px;
      direction: vertical;
      gap: 8px;

      text #museum_title "KUNSTHALLE ZUERICH // ARCHIV 09" {
        font-family: "IBM Plex Mono";
        font-weight: bold;
        font-size: 14px;
        line-height: 20px;
        letter-spacing: 2px;
        fill: >ink_charcoal;
      }

      text #museum_sub "INTERNATIONALE KONSTRUKTIVE FORMGEBUNG" {
        font-family: "IBM Plex Mono";
        font-weight: regular;
        font-size: 12px;
        line-height: 16px;
        letter-spacing: 1.5px;
        fill: >ink_muted;
      }
    }

    stack #meta_right "Exhibition Dates" {
      size: 320px 64px;
      direction: vertical;
      gap: 8px;
      align: start;

      text #date_range "14. OKT BIS 28. NOV 2026" {
        font-family: "IBM Plex Mono";
        font-weight: bold;
        font-size: 14px;
        line-height: 20px;
        letter-spacing: 1.5px;
        fill: >accent_brick;
      }

      text #hall_loc "SAAL 04 // LIMMATQUAI 136" {
        font-family: "IBM Plex Mono";
        font-weight: regular;
        font-size: 12px;
        line-height: 16px;
        letter-spacing: 1.5px;
        fill: >ink_muted;
      }
    }
  }

  // Structural Hairline Rule 1
  rect #rule_top "Top Structural Rule" {
    at: 80px 176px;
    size: 1040px 4px;
    fill: >ink_charcoal;
  }

  // 2. Central Bauhaus Constructivist Geometric Emblem (x=280, y=248, w=640, h=560)
  group #bauhaus_emblem "Central Constructivist Sculpture" {
    at: 280px 248px;
    size: 640px 560px;

    // Warm architectural backdrop block
    rect #backdrop_slab "Warm Architectural Slab" {
      at: 48px 32px;
      size: 544px 496px;
      fill: >surface_warm;
    }

    // Primary Vermilion Sun Disc
    circle #sun_disc "Primary Vermilion Disc" {
      at: 288px 280px;
      radius: 176px;
      fill: >accent_brick;
    }

    // Overlapping Ochre Acoustic Ring
    circle #ochre_disc "Secondary Ochre Disc" {
      at: 408px 232px;
      radius: 128px;
      fill: >accent_ochre;
      blend-mode: multiply;
    }

    // Cobalt Structural Counter-Bar
    rect #cobalt_beam "Cobalt Counter-Balance Beam" {
      at: 96px 264px;
      size: 448px 32px;
      fill: >accent_cobalt;
    }

    // Charcoal Vertical Axis Monolith
    rect #charcoal_pillar "Vertical Axis Pillar" {
      at: 272px 32px;
      size: 32px 496px;
      fill: >ink_charcoal;
    }

    // Precision Vector Diagonal Chord
    path #diagonal_chord "Constructivist Vector Chord" {
      at: 48px 32px;
      size: 544px 496px;
      d: "M 0 496 L 544 0";
      stroke: >ink_charcoal 4px;
    }
  }

  // Structural Hairline Rule 2
  rect #rule_mid "Middle Structural Rule" {
    at: 80px 912px;
    size: 1040px 4px;
    fill: >ink_charcoal;
  }

  // 3. Monumental Asymmetric Typography Block (x=80, y=952, w=1040, h=344)
  stack #title_block "Monumental Swiss Typography" {
    at: 80px 952px;
    size: 1040px 344px;
    direction: vertical;
    gap: 20px;

    text #overline_index "KATALOG NR. 48 // WEIMAR, DESSAU & ZUERICH" {
      font-family: "IBM Plex Mono";
      font-weight: bold;
      font-size: 14px;
      line-height: 20px;
      letter-spacing: 2px;
      fill: >accent_brick;
    }

    text #main_headline "Konstruktion\nund Rhythmus." {
      font-family: "Space Grotesk";
      font-weight: bold;
      font-size: 88px;
      line-height: 104px;
      letter-spacing: -2px;
      fill: >ink_charcoal;
    }

    text #lead_manifesto "Mathematische Proportionssysteme, optische Synthese und tektonische Typografie der europaeischen Avantgarde von 1923 bis 1968." {
      size: 720px;
      font-family: "IBM Plex Mono";
      font-weight: regular;
      font-size: 16px;
      line-height: 24px;
      fill: >ink_muted;
    }
  }

  // Structural Hairline Rule 3
  rect #rule_bot "Bottom Structural Rule" {
    at: 80px 1344px;
    size: 1040px 2px;
    fill: >ink_charcoal;
  }

  // 4. Bottom 3-Column Swiss Archival Colophon Grid (x=80, y=1376, w=1040, h=144)
  grid #colophon_grid "Bottom Archival Colophon" {
    at: 80px 1376px;
    size: 1040px 144px;
    columns: 3;
    gap: 40px;

    stack #col_1 "Curator Column" {
      size: 320px 144px;
      direction: vertical;
      gap: 8px;

      text #col_1_h "KURATORIUM" {
        font-family: "IBM Plex Mono";
        font-weight: bold;
        font-size: 12px;
        line-height: 16px;
        letter-spacing: 2px;
        fill: >accent_brick;
      }

      text #col_1_p "Prof. Dr. H. Meyer\nAtelier fuer konkrete Kunst\nZuerich & Basel" {
        font-family: "IBM Plex Mono";
        font-weight: regular;
        font-size: 14px;
        line-height: 20px;
        fill: >ink_charcoal;
      }
    }

    stack #col_2 "Hours Column" {
      size: 320px 144px;
      direction: vertical;
      gap: 8px;

      text #col_2_h "OEFFNUNGSZEITEN" {
        font-family: "IBM Plex Mono";
        font-weight: bold;
        font-size: 12px;
        line-height: 16px;
        letter-spacing: 2px;
        fill: >accent_brick;
      }

      text #col_2_p "Dienstag bis Sonntag\n10:00 bis 19:00 Uhr\nDonnerstag bis 21:00 Uhr" {
        font-family: "IBM Plex Mono";
        font-weight: regular;
        font-size: 14px;
        line-height: 20px;
        fill: >ink_charcoal;
      }
    }

    stack #col_3 "Edition Column" {
      size: 320px 144px;
      direction: vertical;
      gap: 8px;

      text #col_3_h "ARCHIV EDITION" {
        font-family: "IBM Plex Mono";
        font-weight: bold;
        font-size: 12px;
        line-height: 16px;
        letter-spacing: 2px;
        fill: >accent_brick;
      }

      text #col_3_p "Siebdruck auf 320g Baumwolle\nAuflage: 250 Exemplare\nCHF 48.00 // ISBN 978-3" {
        font-family: "IBM Plex Mono";
        font-weight: regular;
        font-size: 14px;
        line-height: 20px;
        fill: >ink_charcoal;
      }
    }
  }
}
```

---

## 3. `[TOAD-EXEMPLAR-EDITORIAL]` Blueprint 3: Luxury Editorial Social Square (`100/100 A+`)

### Complete `.toad` Source (`maison_valentin_social.toad` — Verified `100 / 100 A+`)
```toad
@font "Playfair Display" bold;
@font "Plus Jakarta Sans" regular medium bold;

>bg_obsidian = #0c0a09;
>surface_stone = #1c1917;
>border_warm = #292524;
>ink_ivory = #fafaf9;
>ink_silk = #e7e5e4;
>ink_champagne = #fde68a;
>accent_gold = #fbbf24;

canvas social-post #0c0a09 {
  // 1. Top Editorial Atelier Header (x=80, y=64, w=920, h=48)
  stack #atelier_top "Top Atelier Header" {
    at: 80px 64px;
    size: 920px 48px;
    direction: horizontal;
    justify: space-between;
    align: center;

    text #maison_name "MAISON VALENTIN // GENEVE" {
      font-family: "Plus Jakarta Sans";
      font-weight: bold;
      font-size: 13px;
      line-height: 20px;
      letter-spacing: 2px;
      fill: >ink_champagne;
    }

    text #edition_no "CALIBRE 89 // EDITION LIMITEE" {
      font-family: "Plus Jakarta Sans";
      font-weight: medium;
      font-size: 13px;
      line-height: 20px;
      letter-spacing: 2px;
      fill: >ink_silk;
    }
  }

  // 2. Central Horological Tourbillon Vector Medallion (x=300, y=168, w=480, h=416)
  group #horology_emblem "Horological Geometric Dial" {
    at: 300px 168px;
    size: 480px 416px;

    circle #dial_outer "Outer Escapement Ring" {
      at: 240px 208px;
      radius: 184px;
      stroke: >border_warm 2px;
    }

    circle #dial_gold "Champagne Gold Chapter Ring" {
      at: 240px 208px;
      radius: 144px;
      fill: >surface_stone;
      stroke: >accent_gold 2px;
    }

    circle #dial_inner "Inner Tourbillon Cage" {
      at: 240px 208px;
      radius: 88px;
      stroke: >ink_silk 1px;
      stroke-dasharray: 6 6;
    }

    star #compass_star "Central Balance Star" {
      at: 192px 160px;
      size: 96px 96px;
      points: 8;
      inner-radius: 36%;
      fill: >accent_gold;
    }
  }

  // 3. Editorial Story & Spec Card (x=80, y=640, w=920, h=360)
  stack #editorial_card "Luxury Editorial Feature Card" {
    at: 80px 640px;
    size: 920px 360px;
    direction: vertical;
    gap: 20px;
    padding: 36px;
    fill: >surface_stone;
    stroke: >border_warm 1px;
    radius: 12px;
    shadow: 0px 12px 24px rgba(0, 0, 0, 0.14);

    text #editorial_kicker "HAUTE HORLOGERIE // AUTOMATIQUE" {
      font-family: "Plus Jakarta Sans";
      font-weight: bold;
      font-size: 12px;
      line-height: 16px;
      letter-spacing: 2px;
      fill: >ink_champagne;
    }

    text #editorial_headline "L'Architecture du Temps Perpetuel." {
      size: 848px;
      font-family: "Playfair Display";
      font-weight: bold;
      font-size: 48px;
      line-height: 60px;
      letter-spacing: -1px;
      fill: >ink_ivory;
    }

    text #editorial_body "Hand-beveled titanium bridges, 72-hour twin-barrel power reserve, and acoustic chronometer certification crafted in Geneva." {
      size: 760px;
      font-family: "Plus Jakarta Sans";
      font-weight: regular;
      font-size: 16px;
      line-height: 24px;
      fill: >ink_silk;
    }

    stack #spec_footer "Specification Footer Strip" {
      size: 848px 48px;
      direction: horizontal;
      justify: space-between;
      align: center;

      text #spec_left "28,800 VPH // 41MM GRADE-5 TITANIUM" {
        font-family: "Plus Jakarta Sans";
        font-weight: bold;
        font-size: 13px;
        line-height: 20px;
        letter-spacing: 2px;
        fill: >ink_ivory;
      }

      text #spec_right "RESERVE PRIVATE VIEWING ->" {
        font-family: "Plus Jakarta Sans";
        font-weight: bold;
        font-size: 14px;
        line-height: 20px;
        letter-spacing: 2px;
        fill: >ink_champagne;
      }
    }
  }
}
```

