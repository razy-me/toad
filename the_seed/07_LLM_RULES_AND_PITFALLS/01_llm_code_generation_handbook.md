# LLM Code Generation Handbook

This handbook provides the authoritative prompt-injection rules, architectural constraints, and code generation protocols for Large Language Models (LLMs) generating `.toad` design files.

---

## 1. Golden Rules of TOAD Code Generation

When generating TOAD code as an AI assistant, you must adhere strictly to these non-negotiable rules:

| Rule | Requirement | Invalid Pattern | Valid Pattern |
|:---|:---|:---|:---|
| **1. Variables** | `>name = value;` | `name: value;` or `var name = value;` | `>primary = #2563EB;` |
| **2. Font Stacks** | Single quoted string | `>font = "Inter", sans-serif;` | `>font = "Inter, sans-serif";` |
| **3. Font vs Wrap** | `font-size` vs `width` | `size: 24px;` for font size | `font-size: 24px; size: 400px;` |
| **4. Font Weights** | Integers or valid tokens | `font-weight: semi bold;` | `font-weight: 600;` or `semibold;` |
| **5. Anchor Offset** | Space, no colon | `at: below #box offset: 16px;` | `at: below #box offset 16px;` |
| **6. Anchor Target**| Explicit reference | `at: center;` (ambiguous) | `at: center of canvas;` |
| **7. Fill vs Color** | Shape vs Text | `text { fill: #000; }` | `text { color: #000; }` |
| **8. Statements**   | Semicolon terminated | `width: 200px` (missing `;`) | `width: 200px;` |
| **9. Slot Markers** | Semicolon terminated | `slot` (missing `;`) | `slot;` |
| **10. Neon Glows**  | Center alpha $\ge 0.25$ | `alpha(>neon, 0.08)` (invisible) | `alpha(>neon, 0.35)` |

---

## 2. Layout & Spacing Protocol: The 8pt Grid

Never invent arbitrary spacing numbers like `13px`, `19px`, or `27px`. Every margin, gap, and padding must align to an **8-point geometric scale**:

```
Scale:    8px    16px    24px    32px    48px    64px    96px   128px
Token:    >xs    >sm     >md     >lg     >xl     >2xl    >3xl   >4xl
```

### Layout Grid Example:
```toad
>space_sm = 16px;
>space_md = 24px;
>space_lg = 32px;

stack #cardGrid {
    at: center of canvas;
    direction: horizontal;
    gap: >space_md;
    // ...
}
```

---

## 3. Typography & Word-Wrap Sizing Rules

1. **Explicit Box Width on Wrapped Copy**:
   Every paragraph or multiline text element must specify an explicit bounding width to trigger the word wrapper:
   ```toad
   // WRONG: Floats infinitely horizontally until canvas edge
   text "This is a long paragraph explaining the quarterly financial results." {
       font-size: 16px;
   }

   // CORRECT: Wraps cleanly into a formatted paragraph
   text "This is a long paragraph explaining the quarterly financial results." {
       font-size: 16px;
       line-height: 24px;
       width: 480px;
       color: #64748B;
   }
   ```

2. **Badge & Pill Horizontal Safety Padding**:
   Text glyph bounding boxes vary slightly across Skia, browser SVG, and Photoshop DirectWrite engines. Always allocate **15% to 20% horizontal safety padding** around text in pills and badges:
   ```toad
   rect #badge {
       width: 140px;  // Text width (~100px) + 40px safety padding
       height: 36px;
       border-radius: 18px;
       fill: #EFF6FF;

       text "PRO FEATURE" {
           at: center of #badge;
           font-size: 12px;
           font-weight: 700;
           color: #1D4ED8;
       }
   }
   ```

---

## 4. Visual Contrast & Hierarchy Architecture

When generating modern UI dashboards or posters, follow a disciplined 3-tier visual hierarchy:

```
1. Primary / Hero:
   - Font size: 40px - 72px, Font weight: 700 (Bold) or 800 (ExtraBold)
   - Color: High contrast (#FFFFFF on dark, #0F172A on light)

2. Secondary / Section Titles:
   - Font size: 20px - 28px, Font weight: 600 (SemiBold)
   - Color: Medium contrast (#94A3B8 on dark, #334155 on light)

3. Body / Captions / Labels:
   - Font size: 12px - 16px, Font weight: 400 (Regular) or 500 (Medium)
   - Color: Muted contrast (#64748B on dark, #64748B on light)
```

---

## 5. Lighting, Gradients, and Glassmorphism Rules

1. **Subtle Background Gradients**:
   Avoid stark flat black (`#000000`). Use deep navy or zinc gradients to create visual depth:
   ```toad
   fill: linear-gradient(135deg, #0B0F19 0%, #111827 100%);
   ```

2. **Glassmorphic Surface Styling**:
   Combine semi-transparent fills with subtle border highlights:
   ```toad
   rect #glassCard {
       size: 380px 240px;
       border-radius: 20px;
       fill: alpha(#1E293B, 0.60);
       stroke: alpha(#FFFFFF, 0.12);
       stroke-width: 1px;
       shadow: 0 12px 32px alpha(#000000, 0.40);
   }
   ```

3. **Vibrant Glow Alphas**:
   Glow centers must use $\ge 0.25$ opacity to withstand sRGB display normalization:
   ```toad
   // WRONG: Faint and washed out in SVG
   fill: radial-gradient(center, alpha(#38BDF8, 0.06) 0%, transparent 70%);

   // CORRECT: Vivid, luminous glow
   fill: radial-gradient(center, alpha(#38BDF8, 0.35) 0%, transparent 70%);
   ```

---

## 6. Pre-Flight Self-Correction Checklist

Before emitting code to the user, an LLM MUST mentally verify every item in this checklist:

- [ ] **Token Syntax**: Are variables declared as `>name = val;`, NEVER `name: val;`?
- [ ] **Semicolons**: Does every property statement, `@directive`, variable declaration, and `slot;` end with `;`?
- [ ] **Font Strings**: Are font fallback stacks defined as a single string literal (e.g. `"Inter, sans-serif"`) without unquoted commas?
- [ ] **Text Wrapping**: Does every multiline paragraph or title have an explicit `width:` or `size:`?
- [ ] **Anchor Syntax**: Is every `offset` followed by a space and dimension (`offset 16px;`), NEVER a colon (`offset: 16px;`)?
- [ ] **Badge Safety**: Is container width at least 15% to 20% larger than the estimated text glyph width?
- [ ] **Color vs Fill**: Are shapes given `fill:` and text given `color:`?
- [ ] **No CSS Hallucinations**: Are there zero instances of `display: flex`, `justify-content:`, `align-items:`, `<div>`, or `rgba(...)`?

---

## 7. Canonical Few-Shot Code Generation Patterns

### Pattern A: Modern Dark SaaS Metric Card
```toad
>cardBg = #111827;
>borderSubtle = #33415550;
>accentGreen = #10b981;

rect #metricCard {
    size: 320px 160px;
    fill: >cardBg;
    stroke: >borderSubtle 1px solid;
    border-radius: 14px;
    shadow: 0 10px 25px #00000040;

    text #label {
        at: top-left of parent offset 24px 20px;
        content: "NET REVENUE";
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.5px;
        color: #94a3b8;
    }

    text #value {
        at: below #label offset 8px;
        content: "$482,900";
        font-size: 32px;
        font-weight: 800;
        color: #f8fafc;
    }

    rect #badge {
        at: below #value offset 16px;
        size: 96px 28px;
        fill: #10b98120;
        border-radius: 9999px;

        text {
            at: center of parent;
            content: "+14.8%";
            font-size: 11px;
            font-weight: 700;
            color: >accentGreen;
        }
    }
}
```

### Pattern B: Auto-Layout Action Row with Slot
```toad
component ActionModal(title = "Confirm Action", confirmLabel = "Continue") {
    rect #modalFrame {
        size: 480px 280px;
        fill: #0f172a;
        stroke: #334155 1px solid;
        border-radius: 16px;

        text #modalTitle {
            at: top-left of parent offset 28px 24px;
            content: >title;
            font-size: 20px;
            font-weight: 700;
            color: #ffffff;
        }

        // Projected custom content
        slot;

        stack #footerRow {
            at: bottom-right of parent offset -28px -24px;
            direction: horizontal;
            gap: 12px;

            rect #cancelBtn {
                size: 100px 40px;
                fill: transparent;
                border-radius: 8px;
                text { at: center of parent; content: "Cancel"; color: #94a3b8; font-size: 14px; }
            }

            rect #confirmBtn {
                size: 120px 40px;
                fill: #2563eb;
                border-radius: 8px;
                text { at: center of parent; content: >confirmLabel; color: #ffffff; font-size: 14px; font-weight: 600; }
            }
        }
    }
}
```
