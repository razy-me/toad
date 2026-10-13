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
