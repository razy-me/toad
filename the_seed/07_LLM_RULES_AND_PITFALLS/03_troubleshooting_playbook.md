# Troubleshooting Playbook & Diagnostic Trees

When a `.toad` design fails to compile or renders unexpectedly, use these diagnostic trees and debugging protocols to isolate and resolve the root cause quickly.

---

## 1. Diagnostic Tree A: Syntax & Parse Failures

```
                    [ Compilation Error ]
                              │
             Is it an "Unexpected Token" error?
                     ┌────────┴────────┐
                    YES                NO
                     │                 │
    Check line & column reported       Does it say "Circular layout"?
            │                                  │
    ┌───────┴────────────────────────┐       YES ──> [ Go to Tree B ]
    │                                │
Token ':' after var or offset?     Missing trailing semicolon ';'?
    │                                │
Replace ':' with '=' or space.     Add ';' at end of property or slot.
```

### Common Parse Error Signatures:
1. `SyntaxError: Unexpected token ':' at line 14:12`:
   - Check if you wrote `>var: 20px;` (should be `>var = 20px;`).
   - Check if you wrote `at: below #foo offset: 10px;` (should be `offset 10px;`).
2. `SyntaxError: Unexpected token ',' in font definition`:
   - You wrote `>font = "Inter", sans-serif;`. Wrap the entire list in quotes: `>font = "Inter, sans-serif";`.
3. `SyntaxError: Expected ';' after slot`:
   - You wrote `slot` instead of `slot;`.

---

## 2. Diagnostic Tree B: Layout & DAG Failures

```
                 [ Circular Layout Dependency ]
                              │
        Which element IDs are listed in cycle report?
                              │
                  e.g., #cardA <──> #cardB
                              │
          Break mutual anchor dependency:
     - Anchor #cardA to parent or previous sibling.
     - Anchor #cardB relative to #cardA only.
```

### Overlapping Elements:
1. **Symptom**: Elements in a `stack` overlap each other.
   - **Root Cause**: An explicit `at:` coordinate was placed on a child inside the stack.
   - **Fix**: Remove `at:` from stack children so the autolayout engine can space them using `gap:`.
2. **Symptom**: Element appears at $(0, 0)$ top-left unexpectedly.
   - **Root Cause**: Anchor target ID does not exist, or reference target was declared *after* current element without a two-pass DAG resolution.
   - **Fix**: Verify spelling of `#targetId` and ensure target is defined in layout scope.

---

## 3. Diagnostic Tree C: Visual Discrepancies (SVG vs. PNG)

```
               [ SVG / PNG Visual Mismatch ]
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
    Colors Muted?       Text Clipped?       Shadow Cut Off?
          │                   │                   │
  Check color stop     Add 20% safety      Check filter box
  interpolation:       padding to badge    bounds in SVG:
  Use color-           width or expand     Ensure x="-100%"
  interpolation="sRGB" wrap width.         y="-100%" w="300%".
```

### Color Saturation Issues:
- If neon gradients look dull or washed-out in web browsers:
  1. Inspect the generated SVG `<linearGradient>` tag.
  2. Verify that `color-interpolation="sRGB"` is present.
  3. Ensure center alpha in radial glows is $\ge 0.25$ (e.g. `alpha(#00F5A0, 0.35)`).

### Text Truncation / Overflow:
- If text fits in Skia Canvas PNG but truncates in Chrome/Safari SVG:
  1. Different operating systems calculate letter kerning differently.
  2. Add `@font` directive to embed the exact `.ttf`/`.woff2` font file so both engines use identical font metric tables.
  3. Increase container width by $15\%\text{--}20\%$ for pill badges and compact tags.

---

## 4. Diagnostic Tree D: Component & Slot Failures

1. **Symptom**: Slot content does not appear inside the component instance.
   - **Root Cause**: The component definition omitted `slot;` inside its template tree, or placed `slot;` inside an element with `opacity: 0;`.
   - **Fix**: Add `slot;` inside the desired parent container in the component body.
2. **Symptom**: Parameter default value not applying.
   - **Root Cause**: Parameter declared without `=` (e.g. `component Card(title: string)`).
   - **Fix**: Use default assignment syntax: `component Card(title = "Default Title")`.

---

## 5. CLI Debugging Toolkit

TOAD's CLI provides powerful diagnostic flags for deep inspection:

```bash
# 1. Print AST and Layout Evaluation metrics
toad compile design.toad --debug

# 2. Export layout wireframes showing bounding boxes & anchor lines
toad compile design.toad -o wireframe.png --show-bounds

# 3. Inspect formatted SVG XML structure
toad compile design.toad -o output.svg --pretty

# 4. Check syntax and validation without writing files
toad check design.toad
```

### Wireframe Bounding Box Inspection (`--show-bounds`)
When debugging complex bento grids or nested autolayout stacks, `--show-bounds` draws:
- **Red borders**: Element bounding boxes $[x, y, w, h]$.
- **Blue lines**: Anchor vectors indicating parent/target relationships.
- **Green dashed lines**: Padding and margin offsets.
