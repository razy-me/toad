# Tests & Quality Assurance Suite

This directory houses the comprehensive test suite for the **TOAD DSL** compiler, layout solver, renderers, exporters, and developer tooling.

The test suite runs with [Vitest](https://vitest.dev/) and provides exhaustive coverage with **929 tests across 64 test files**.

---

## Directory Structure

- `e2e/`: End-to-end integration tests (`tier1_features.test.ts`, `tier2_boundaries.test.ts`) validating 20 core DSL feature groups and edge boundary conditions.
- `fixtures/`: Production `.toad` design fixtures and their verified golden outputs (`hero_banner`, `mobile_mockup`, `product_banner`, `social_card`, `typography_poster`) exported across `.png`, `.svg`, `.psd`, `.webp`, and `.jpg`.
- `goldens/`: Pixel-matching reference files and golden snapshot utilities.
- `unit/`: Granular unit tests for the lexer, parser, dependency graph, DAG math solver, diagnostics, and CLI tooling.
- `regressions/`: Regression test suites covering past milestones and edge-case fixes (Phases 1–4).
- `challenger_*.test.ts`: Adversarial stress tests validating deep nesting, concurrency, large dimensions, and watch mode resilience.

---

## Running the Tests

```bash
# Run all tests once
npm test

# Run tests in interactive watch mode
npm run test:watch

# Run tests with code coverage report
npm run test:coverage
```
