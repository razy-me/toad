# Handoff Report — Milestone M2 Adversarial Challenge

**Agent**: challenger_m2_1  
**Verdict**: **DEFECTS_FOUND**  
**Timestamp**: 2026-08-18T18:46:20Z  
**Test Suite Created**: `tests/challenger_m2_1.test.ts` (24 adversarial stress test cases)

---

## 1. Observation

### 1.1 Fatal Native C++ Crash on Canvas Filter Application (CRITICAL)
- **File**: `src/engine/drawUtils.ts:454-465` and `src/engine/canvasRenderer.ts:108-110`
- **Code observed**:
  ```ts
  // src/engine/drawUtils.ts:454
  export function parseAndApplyFilter(ctx: CanvasRenderingContext2D, filterStr?: string): void {
    if (!filterStr || filterStr.trim() === 'none' || filterStr.trim() === '') {
      ctx.filter = 'none';
      return;
    }
    try {
      ctx.filter = filterStr.trim();
    } catch {
      ctx.filter = 'none';
    }
  }
  ```
- **Error observed**:
  When `@napi-rs/canvas` executes a draw command (`ctx.fill()`, `ctx.stroke()`, `ctx.fillRect()`) on a context where `ctx.filter` was set to a CSS filter string (e.g. `'blur(5px)'` or `'blur(5px) saturate(2)'`), the underlying Skia native C++ addon on Windows experiences an unhandled access violation / segmentation fault, causing the Node.js process to terminate abnormally:
  ```
  Error: Worker exited unexpectedly
   ❯ ChildProcess.onUnexpectedExit node_modules/tinypool/dist/index.js:118:30
   ❯ ChildProcess.emit node:events:521:24
   ❯ ChildProcess._handle.onexit node:internal/child_process:295:12
  ```
- **Direct Reproducer**:
  ```ts
  import { createCanvas } from '@napi-rs/canvas';
  const canvas = createCanvas(100, 100);
  const ctx = canvas.getContext('2d');
  ctx.filter = 'blur(5px)';
  ctx.fillRect(10, 10, 50, 50); // Causes immediate native process termination
  ```
  This also causes `tests/canvasRenderer.test.ts:194` (`filter: blur(5px) saturate(2);`) to crash during test execution.

---

### 1.2 Incomplete Sibling Clipping Mask Architecture & Omitted Base Pixels (HIGH)
- **File**: `src/engine/canvasRenderer.ts:210-239`
- **Code observed**:
  ```ts
  // src/engine/canvasRenderer.ts:210
  if (node.children && node.children.length > 0) {
    const firstChild = node.children[0]!;
    const isFirstChildMask = firstChild.style.clip === true || (firstChild as any).clip === true;

    if (isFirstChildMask && node.children.length > 1) {
      // 1. Draw mask path
      ctx.save();
      ctx.beginPath();
      if (firstChild.type === 'circle') {
        const cx = firstChild.x + firstChild.width / 2;
        const cy = firstChild.y + firstChild.height / 2;
        drawCircle(ctx, cx, cy, { rx: firstChild.width / 2, ry: firstChild.height / 2 });
      } else if (firstChild.type === 'polygon' && firstChild.polygonLayout?.canvasPoints) {
        drawPolygon(ctx, firstChild.polygonLayout.canvasPoints);
      } else {
        drawRect(ctx, firstChild.x, firstChild.y, firstChild.width, firstChild.height, firstChild.style.borderRadius);
      }
      ctx.clip();

      // 2. Render subsequent masked siblings
      for (let i = 1; i < node.children.length; i++) {
        await this.renderNode(ctx, node.children[i]!, basePath);
      }
      ctx.restore();
    }
  ```
- **Observations**:
  1. Only `node.children[0]` is evaluated as a clipping mask. If child index 1 (or any later sibling) specifies `clip: true`, `isFirstChildMask` is `false`, and no clipping occurs for subsequent children.
  2. `firstChild` is only used to create a clip path; its own visual properties (fills, strokes, text, gradients) are never drawn to the canvas.
  3. Multiple independent clipping pairs within a single group are not supported.

---

### 1.3 Circle Sizing Ignores `radius` Property in Layout Solver (MEDIUM)
- **File**: `src/parser/math.ts:417-421, 517-523` vs `src/parser/importResolver.ts:616`
- **Code observed**:
  In `importResolver.ts:616`:
  ```ts
  case 'radius': {
    target.radius = this.extractRadius(val);
    break;
  }
  ```
  In `math.ts:417-421` & `math.ts:517-523`:
  ```ts
  if (elem.type === 'circle') {
    if (w > 0 && h === 0) h = w;
    if (h > 0 && w === 0) w = h;
    if (w === 0 && h === 0) {
      w = 100;
      h = 100;
    }
  }
  ```
- **Error observed**:
  In `tests/psdExporter.test.ts:258`:
  ```TOAD
  circle #myCircle {
    at: 50px 50px;
    radius: 30px;
    fill: #10b981;
  }
  ```
  `math.ts` defaults circle size to `100x100` because `elem.radius` is not checked. As a result, `right = 50 + 100 = 150`, causing test assertion failure:
  `AssertionError: expected 150 to be 110`.

---

### 1.4 Normalized Float Comparison Mismatch in PSD Text Layer Color Assertion (LOW)
- **File**: `tests/psdExporter.test.ts:164`
- **Error observed**:
  ```
  FAIL tests/psdExporter.test.ts > PSD Exporter Engine (ag-psd) > Native Editable Text Layers & Raster Fallback > exports text elements as editable Photoshop text layers with formatting
  AssertionError: expected 238.99875 to be 239 // Object.is equality
  - Expected: 239
  + Received: 238.99875
  ```
- **Observation**:
  `ag-psd` serializes and deserializes RGB components in normalized floating point descriptor space (`239 / 255 * 255 = 238.99875`). The test assertion uses strict `.toBe(239)` instead of `.toBeCloseTo(239, 0)` or `Math.round()`.

---

## 2. Logic Chain

1. **Evidence Chain for Defect 1 (CRITICAL)**:
   - Observation 1.1 shows that `@napi-rs/canvas` on Windows crashes in native C++ when drawing with an active `ctx.filter`.
   - `drawUtils.ts:454` sets `ctx.filter = filterStr.trim()`, and `canvasRenderer.ts:109` invokes it on any element with `style.filter`.
   - Drawing elements with filters in `tests/canvasRenderer.test.ts:194` immediately terminates the test worker process.
   - Therefore, raster rendering with filters is fatal until `@napi-rs/canvas` filter application is either guarded, handled via software fallback, or safely isolated.

2. **Evidence Chain for Defect 2 (HIGH)**:
   - Observation 1.2 demonstrates that `canvasRenderer.ts:211` strictly checks `node.children[0]`.
   - Any DSL layout containing non-first-child clipping masks or multiple mask sets inside a group will fail to clip correctly in raster output.
   - Furthermore, base mask shape fills are omitted from the canvas output.

3. **Evidence Chain for Defect 3 (MEDIUM)**:
   - Observation 1.3 shows that `importResolver.ts` parses and stores `elem.radius`, but `math.ts` never reads `elem.radius` during intrinsic size or bounding box calculation.
   - Consequently, circles defined with `radius: 30px` default to `100x100` instead of `60x60`, causing incorrect layout geometry and PSD layer bounds.

4. **Evidence Chain for Defect 4 (LOW)**:
   - Observation 1.4 shows a minor precision artifact where `readPsd()` returns `238.99875` for red channel 239 due to 8-bit normalization in Photoshop descriptor doubles.

---

## 3. Caveats

1. **CLI / Build Pipeline**: The `src/build.ts` and `src/cli.ts` modules are planned for Milestone M3 and were not tested for raster rendering integration.
2. **Platform Specificity of `@napi-rs/canvas` Filter Crash**: The native crash in `@napi-rs/canvas` on `ctx.filter` was verified on Windows x64. On Linux/macOS, Skia filter behavior may differ, but the crash on Windows requires defensive handling.

---

## 4. Conclusion

- **Verdict**: **DEFECTS_FOUND**
- The M2 implementation demonstrates robust multi-scale rasterization (0.25x–4.0x), deep PSD layer hierarchies (8+ levels), Unicode/Japanese/Emoji text layer export, gradient stop distribution, and color parsing.
- However, 4 concrete defects must be addressed:
  1. **[CRITICAL]** Fix native crash when `filter:` is applied in `canvasRenderer.ts` / `drawUtils.ts`.
  2. **[HIGH]** Generalize sibling clipping masks in `canvasRenderer.ts` to support arbitrary child indices and render base mask pixels.
  3. **[MEDIUM]** Update `math.ts` to compute circle dimensions as `2 * elem.radius` when `size` is not explicit.
  4. **[LOW]** Update `tests/psdExporter.test.ts:164` to use `Math.round()` or `toBeCloseTo()` for normalized PSD float round-trip values.

---

## 5. Verification Method

To independently verify the test results and findings:

1. **Run Challenger Test Suite**:
   ```bash
   npx vitest run tests/challenger_m2_1.test.ts
   ```
   *Expected*: 24 passed tests in ~0.5s confirming multi-scale scaling, 8-level PSD hierarchy, Unicode text layers, gradient stop math, and font loading resilience.

2. **Verify Filter Crash Reproducer**:
   ```bash
   npx vitest run tests/canvasRenderer.test.ts
   ```
   *Expected*: ChildProcess worker crash on `tests/canvasRenderer.test.ts:194` due to `ctx.filter = 'blur(5px) saturate(2)'`.

3. **Verify PSD Exporter Failures**:
   ```bash
   npx vitest run tests/psdExporter.test.ts
   ```
   *Expected*: 2 failed tests at lines 164 (float precision) and 258 (circle radius default).
