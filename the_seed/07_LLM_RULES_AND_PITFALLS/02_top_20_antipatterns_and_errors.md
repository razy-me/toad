# The Top 20 TOAD Anti-Patterns & Compiler Errors

This guide catalogs the 20 most frequent mistakes made by LLMs and human engineers when writing `.toad` code, along with compiler error signatures, explanations, and exact fixes.

---

## Quick Reference Anti-Pattern Matrix

| # | Error / Anti-Pattern | Severity | Symptoms |
|:---|:---|:---|:---|
| 1 | Variable Syntax (`: ` vs `=`) | Critical | `Unexpected token ':'` (Parse Error) |
| 2 | Unquoted Font Fallback Comma | Critical | `Unexpected token ','` (Parse Error) |
| 3 | `size:` vs `font-size:` on Text | Medium | Glyphs render at default size (16px) |
| 4 | Multi-Word Font Weight Strings | High | Font weight ignored, falls back to 400 |
| 5 | Colon After `offset` Keyword | Critical | `Unexpected token ':' after offset` |
| 6 | Naked `at: center;` | High | Node anchors to parent top-left unexpectedly |
| 7 | `fill:` on Text or `color:` on Shapes | Medium | Text invisible or shapes uncolored |
| 8 | Missing Statement Semicolons | Critical | Parser encounters premature EOF or token |
| 9 | Naked `slot` Without Semicolon | Critical | `Unexpected token '}' expecting ';'` |
| 10 | Ultra-Low Glow Alphas ($\le 0.10$) | Low | Neon glows completely invisible in SVG |
| 11 | Pill Badge Tight Clipping | Medium | Text clips or wraps into 2 lines in SVG |
| 12 | Missing Canvas `@font` / Fallback | Low | Cross-platform font metrics mismatch |
| 13 | CSS Flexbox Syntax Hallucinations | Critical | `Unknown property 'display'` |
| 14 | HTML Tag Hallucinations (`<div>`) | Critical | `Unknown element 'div'` |
| 15 | Direct Circular DAG Dependency | Critical | `Circular layout dependency detected` |
| 16 | CSS `rgba(...)` vs TOAD `alpha(...)` | High | `Unrecognized color function 'rgba'` |
| 17 | Hardcoded Coordinates in Stacks | Medium | Children overlap and ignore `gap` |
| 18 | Unparenthesized Nested Math | High | Incorrect operator precedence |
| 19 | Overwriting Parent Canvas Size | Critical | Artboard collapses to child dimensions |
| 20 | Duplicate Element IDs | High | DAG anchors resolve to incorrect node |

---

## Detailed Anti-Pattern Analysis & Fixes

### 1. Variable Assignment Syntax
- ❌ **Anti-Pattern**:
  ```toad
  >brandColor: #3B82F6; // Invalid CSS colon notation
  var primary = #3B82F6; // Invalid JavaScript notation
  ```
- ✅ **Correction**:
  ```toad
  >brandColor = #3B82F6;
  ```

---

### 2. Unquoted Font Fallback Commas
- ❌ **Anti-Pattern**:
  ```toad
  >mainFont = "Inter", sans-serif; // Comma outside string causes parse error
  ```
- ✅ **Correction**:
  ```toad
  >mainFont = "Inter, sans-serif"; // Entire chain in single string
  ```

---

### 3. `size:` vs `font-size:` on Text
- ❌ **Anti-Pattern**:
  ```toad
  text "Headline" {
      size: 32px; // Sets text bounding box, NOT glyph size!
  }
  ```
- ✅ **Correction**:
  ```toad
  text "Headline" {
      font-size: 32px; // Correct glyph scaling
  }
  ```

---

### 4. Multi-Word Font Weight Strings
- ❌ **Anti-Pattern**:
  ```toad
  font-weight: semi bold; // Space breaks parser
  font-weight: "bold";     // String literal ignored
  ```
- ✅ **Correction**:
  ```toad
  font-weight: 600;        // Numeric weight (Recommended)
  font-weight: semibold;   // Valid single-word token
  ```

---

### 5. Colon After `offset` Keyword
- ❌ **Anti-Pattern**:
  ```toad
  at: below #header offset: 24px; // Invalid colon
  ```
- ✅ **Correction**:
  ```toad
  at: below #header offset 24px;  // Space separated
  ```

---

### 6. Naked `at: center;`
- ❌ **Anti-Pattern**:
  ```toad
  rect #modal {
      at: center; // Ambiguous: center of what?
  }
  ```
- ✅ **Correction**:
  ```toad
  rect #modal {
      at: center of canvas; // Explicit target
  }
  ```

---

### 7. `fill:` on Text or `color:` on Shapes
- ❌ **Anti-Pattern**:
  ```toad
  text "Title" { fill: #FFFFFF; } // fill ignored on text
  rect #box    { color: #1E293B; } // color ignored on shape
  ```
- ✅ **Correction**:
  ```toad
  text "Title" { color: #FFFFFF; }
  rect #box    { fill: #1E293B; }
  ```

---

### 8. Missing Statement Semicolons
- ❌ **Anti-Pattern**:
  ```toad
  rect #card {
      width: 400px
      height: 200px;
  }
  ```
- ✅ **Correction**:
  ```toad
  rect #card {
      width: 400px;
      height: 200px;
  }
  ```

---

### 9. Naked `slot` Without Semicolon
- ❌ **Anti-Pattern**:
  ```toad
  component Card() {
      rect #frame {
          slot // Parse error on closing brace
      }
  }
  ```
- ✅ **Correction**:
  ```toad
  component Card() {
      rect #frame {
          slot; // Statement terminated
      }
  }
  ```

---

### 10. Ultra-Low Glow Alphas ($\le 0.10$)
- ❌ **Anti-Pattern**:
  ```toad
  fill: radial-gradient(center, alpha(#00FF88, 0.05) 0%, transparent 70%);
  // Appears as washed-out gray smudge in sRGB browser SVG
  ```
- ✅ **Correction**:
  ```toad
  fill: radial-gradient(center, alpha(#00FF88, 0.35) 0%, transparent 70%);
  // Vibrant, radiant light emission
  ```

---

### 11. Pill Badge Horizontal Squeeze
- ❌ **Anti-Pattern**:
  ```toad
  // Text width is ~72px, rect is 80px -> only 4px margin
  rect #pill {
      width: 80px;
      height: 28px;
      text "NEW FEATURE" { at: center of #pill; font-size: 11px; }
  }
  ```
- ✅ **Correction**:
  ```toad
  // Safe 20% horizontal padding added (110px total)
  rect #pill {
      width: 110px;
      height: 28px;
      text "NEW FEATURE" { at: center of #pill; font-size: 11px; }
  }
  ```

---

### 12. Missing Canvas `font-family`
- ❌ **Anti-Pattern**:
  ```toad
  canvas "Card" {
      width: 600px;
      height: 400px;
      // No font declared; Linux/Windows fallbacks differ widely
  }
  ```
- ✅ **Correction**:
  ```toad
  canvas "Card" {
      width: 600px;
      height: 400px;
      font-family: "Inter, -apple-system, sans-serif";
  }
  ```

---

### 13. CSS Flexbox Syntax Hallucinations
- ❌ **Anti-Pattern**:
  ```toad
  rect #row {
      display: flex; // TOAD does not use CSS display
      justify-content: space-between;
  }
  ```
- ✅ **Correction**:
  ```toad
  stack #row {
      direction: horizontal;
      justify: space-between;
  }
  ```

---

### 14. HTML Tag Hallucinations
- ❌ **Anti-Pattern**:
  ```toad
  div #wrapper { // Unknown element 'div'
      p "Paragraph" {}
  }
  ```
- ✅ **Correction**:
  ```toad
  rect #wrapper {
      text "Paragraph" {}
  }
  ```

---

### 15. Direct Circular DAG Layout Dependency
- ❌ **Anti-Pattern**:
  ```toad
  rect #boxA { at: below #boxB offset 10px; }
  rect #boxB { at: below #boxA offset 10px; }
  // Fatal: Cycle detected between #boxA and #boxB
  ```
- ✅ **Correction**:
  ```toad
  rect #boxA { at: top-left of canvas offset 20px 20px; }
  rect #boxB { at: below #boxA offset 10px; }
  ```

---

### 16. CSS `rgba(...)` vs TOAD `alpha(...)`
- ❌ **Anti-Pattern**:
  ```toad
  fill: rgba(30, 41, 59, 0.5); // Invalid function
  ```
- ✅ **Correction**:
  ```toad
  fill: alpha(#1E293B, 0.5);    // Standard TOAD alpha transform
  fill: #1E293B80;             // Or standard 8-digit hex
  ```

---

### 17. Hardcoded Coordinates Inside Stacks
- ❌ **Anti-Pattern**:
  ```toad
  stack #sidebar {
      direction: vertical;
      gap: 16px;
      text "Item 1" { at: 10px 50px; } // Overrides autolayout position
  }
  ```
- ✅ **Correction**:
  ```toad
  stack #sidebar {
      direction: vertical;
      gap: 16px;
      text "Item 1" {} // Clean automatic flow
  }
  ```

---

### 18. Unparenthesized Nested Math
- ❌ **Anti-Pattern**:
  ```toad
  width: 100% - >pad * 2 + 10px; // Evaluated left-to-right without grouping
  ```
- ✅ **Correction**:
  ```toad
  width: (100% - (>pad * 2)) + 10px; // Explicit mathematical grouping
  ```

---

### 19. Overwriting Canvas Size Inside Children
- ❌ **Anti-Pattern**:
  ```toad
  canvas "Banner" {
      width: 1200px;
      height: 600px;
      rect #bg {
          width: 1200px;
          height: 600px;
          // Fragile: if canvas changes, #bg goes out of sync
      }
  }
  ```
- ✅ **Correction**:
  ```toad
  canvas "Banner" {
      width: 1200px;
      height: 600px;
      rect #bg {
          size: 100% 100%; // Dynamically tracks canvas dimensions
      }
  }
  ```

---

### 20. Duplicate Element IDs
- ❌ **Anti-Pattern**:
  ```toad
  rect #item { size: 100px 40px; }
  rect #item { size: 100px 40px; } // ID collision!
  ```
- ✅ **Correction**:
  ```toad
  rect #item_1 { size: 100px 40px; }
  rect #item_2 { size: 100px 40px; }
  ```
