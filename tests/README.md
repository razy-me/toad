# Tests & Quality Assurance

This directory contains the complete test suite for the **TOAD DSL** compiler, layout solver, and exporters.

- **Suite**: 929 tests across 64 test files (100% passing) powered by [Vitest](https://vitest.dev/).
- **Structure**:
  - `e2e/`: Core feature and boundary edge tests.
  - `fixtures/`: Reference `.toad` designs and multi-format outputs (PNG, SVG, PSD).
  - `unit/`: Granular tests for lexer, parser, layout DAG, and CLI tools.
  - `challenger_*.test.ts`: Stress tests (concurrency, deep nesting, large dimensions).

## Commands

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```
