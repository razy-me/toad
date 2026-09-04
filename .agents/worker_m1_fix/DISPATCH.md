# DISPATCH — Worker M1 Fix (Remediation for Challenger Defects)

## 2026-08-18T16:28:05Z

Target Files:
- src/parser/parser.ts
- src/parser/math.ts
- tests/parser.test.ts
- tests/layoutSolver.test.ts
- tests/challenger_m1_2.test.ts

Defects to fix:
1. `src/parser/parser.ts` -> `isElementStart()`: Add check so that if `this.peek(1).type === TokenType.COLON`, it is a property (`text: "..."`) not a child element, returning `false`.
2. `src/parser/parser.ts` -> `parseElementDeclaration()`: In header loop, allow `TokenType.VARIABLE` to be captured as `textShorthand`.
3. `src/parser/parser.ts` -> `parsePointsValue()`: If starting with a single `TokenType.VARIABLE`, return `this.parseSingleValue()` so the entire variable array expands.
4. `src/parser/math.ts` -> Grid layout solver: When children do not have explicit top-level `size:`, compute intrinsic bounding box of child element rather than falling back to 100px.

All unit tests and challenger test suites must pass cleanly!
