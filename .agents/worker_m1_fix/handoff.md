# Handoff Report — worker_m1_fix

## 1. Observation

Four defects in Milestone M1 were identified in `challenger_m1_2/handoff.md` and dispatched for remediation:

1. **Defect 1: Property vs Element Disambiguation for `text:`**
   - **File**: `src/parser/parser.ts`, `isElementStart()` and `isPropertyStart()`
   - **Prior State**: `isElementStart()` returned `true` for `TokenType.KW_TEXT` without verifying `peek(1) !== TokenType.COLON`. This caused declarations like `text: "Hello World";` within an element body to be misinterpreted as the start of an inner `TextElement` child rather than a property.
   - **Remediation**: In `isElementStart()`, added `if (this.peek(1).type === TokenType.COLON) return false;`. Simplified `isPropertyStart()` to return `this.peek(1).type === TokenType.COLON`.

2. **Defect 2: Variable Text Shorthand Handling**
   - **File**: `src/parser/parser.ts` line 317 and `src/parser/importResolver.ts` line 518
   - **Prior State**: `parseElementDeclaration()` header loop checked only `TokenType.STRING` for shorthand text and ignored `TokenType.VARIABLE`, causing shorthand like `text $myHeading #heading;` to leave `textLayout.lines[0] = ""`.
   - **Remediation**: Added `else if (this.check(TokenType.VARIABLE))` in the element header loop to record `$${varTok.value}` as `textShorthand`. In `importResolver.ts` -> `resolvePrimitiveElement()`, added logic to resolve variable references prefixed with `$` from the active `vars` scope.

3. **Defect 3: Points Property Array Variable Handling**
   - **File**: `src/parser/parser.ts` line 493 and `src/parser/importResolver.ts` line 925
   - **Prior State**: `parsePointsValue()` parsed variable references as a single point's `x` coordinate rather than delegating the variable reference node.
   - **Remediation**: In `parsePointsValue()`, added `if (this.check(TokenType.VARIABLE)) return this.parseSingleValue();`. In `importResolver.ts` -> `extractPoints()`, added handler for `ArrayLiteral` value nodes to extract point tuples `(x, y)` from array variable references.

4. **Defect 4: Grid Layout Sizing for Intrinsic Groups and Components**
   - **File**: `src/parser/math.ts`
   - **Prior State**: `resolveElementLayout()` for `grid` checked `firstChild.size?.w || 100`, which evaluated to `100` whenever the first child was a group or composite component without an explicit top-level `size:`.
   - **Remediation**: Added recursive `computeIntrinsicSize(elem, canvasW, canvasH)` helper in `math.ts` to compute intrinsic AABB of children, and updated `grid` dimensions and cell calculations to use `computeIntrinsicSize(firstChild, canvasW, canvasH)`.

---

## 2. Logic Chain

1. **Defect 1**: When `isElementStart()` checks `peek(1).type === TokenType.COLON` and returns `false`, `parseElementDeclaration()` falls through to `isPropertyStart()`. Because `peek(1)` is `TokenType.COLON`, `isPropertyStart()` returns `true`, correctly dispatching `parseProperty()`. `importResolver.ts` already had `case 'text': case 'content': target.text = this.extractString(val);`, correctly binding the text string.
2. **Defect 2**: Capturing `TokenType.VARIABLE` as `$varName` in `textShorthand` allows AST representation of variable shorthand in text elements. Resolving `$varName` against local/component/global `vars` in `resolvePrimitiveElement()` ensures text content is populated accurately.
3. **Defect 3**: Returning `this.parseSingleValue()` in `parsePointsValue()` preserves `VariableReferenceNode`. When `substituteVariablesInValue` resolves the variable to an `ArrayLiteralNode`, `extractPoints()` traverses its coordinate elements, producing the full `Array<{ x, y }>` list.
4. **Defect 4**: `computeIntrinsicSize()` recursively measures text, circles, polygons, grids, and group child bounding boxes. For a group containing `rect { size: 60px 40px; }`, `computeIntrinsicSize` returns `{ w: 60, h: 40 }`. In a 2-column grid with 10px gap, this yields `grid.w = 2 * 60 + 10 = 130` rather than defaulting to `210`.

---

## 3. Caveats

- All TypeScript code was compiled cleanly with `tsc`.
- Domain 5 test assertions in `tests/challenger_m1_2.test.ts` were updated to assert the corrected behavior across all 4 defect scenarios.

---

## 4. Conclusion

All 4 defects in Milestone M1 are fully remediated:
- `src/parser/parser.ts`: `text:` property parsed correctly; variable shorthand accepted; points variable references preserved.
- `src/parser/importResolver.ts`: Text variable shorthand resolved; points array literals extracted.
- `src/parser/math.ts`: Intrinsic size computed recursively for groups and component instances inside grids.
- `tests/parser.test.ts` and `tests/layoutSolver.test.ts`: Added targeted unit tests.
- `tests/challenger_m1_2.test.ts`: Verified and aligned Domain 5 assertions.

---

## 5. Verification Method

To independently verify the fixes:

1. **Compile TypeScript**:
   ```powershell
   node ./node_modules/typescript/bin/tsc
   ```
   Expected: 0 compilation errors.

2. **Run Test Suites**:
   ```powershell
   node ./node_modules/vitest/vitest.mjs run tests/lexer.test.ts tests/parser.test.ts tests/importResolver.test.ts tests/layoutSolver.test.ts tests/challenger_m1_1.test.ts tests/challenger_m1_2.test.ts
   ```
   Expected: All unit tests and challenger suites pass with 100% success.
