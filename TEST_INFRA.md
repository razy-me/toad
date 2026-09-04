# E2E Test Infra: toad Compiler

## Test Philosophy
- Opaque-box, requirement-driven. Derived from `ORIGINAL_REQUEST.md` and user specifications, not internal implementation details.
- Methodology: Category-Partition + Boundary Value Analysis (BVA) + Pairwise Combinatorial Testing + Real-World Workload Testing.

## Feature Inventory & Test Coverage Goals
| # | Feature | Requirement Source | Tier 1 (Coverage ≥5) | Tier 2 (Boundaries ≥5) | Tier 3 (Pairwise) | Tier 4 (Workloads) |
|---|---------|-------------------|:-------------------:|:---------------------:|:----------------:|:-----------------:|
| 1 | Lexer & Tokenizer | ORIGINAL_REQUEST §Tech Stack, Rules | 5 | 5 | ✓ | ✓ |
| 2 | AST & Parser | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| 3 | Imports & Directives | ORIGINAL_REQUEST §R1, Rule 6 | 5 | 5 | ✓ | ✓ |
| 4 | Variables & Scoping | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| 5 | Component Parameters | ORIGINAL_REQUEST §R1, Rule 4 | 5 | 5 | ✓ | ✓ |
| 6 | Canvas Dimensions & Aspect Ratio (GCD) | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ | ✓ |
| 7 | Bounding Box & Skia Text Measuring | ORIGINAL_REQUEST §R2, Rule 2 | 5 | 5 | ✓ | ✓ |
| 8 | currentColor Resolution | ORIGINAL_REQUEST §R2, Rule 1 | 5 | 5 | ✓ | ✓ |
| 9 | Relational Positioning & DAG | ORIGINAL_REQUEST §R2, Rule 11 | 5 | 5 | ✓ | ✓ |
| 10 | Local Polygon Coordinate Space | ORIGINAL_REQUEST §R2, Rule 3 | 5 | 5 | ✓ | ✓ |
| 11 | Uniform Tile Grid Layout | ORIGINAL_REQUEST §R2, Rule 5 | 5 | 5 | ✓ | ✓ |
| 12 | Font Loading (Dir & Directive) | ORIGINAL_REQUEST §R3, Rule 6 | 5 | 5 | ✓ | ✓ |
| 13 | Raster Canvas Rendering (Multi-scale) | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ | ✓ |
| 14 | Gradients & Even Stop Distribution | ORIGINAL_REQUEST §R3, Rule 8 | 5 | 5 | ✓ | ✓ |
| 15 | Blend Modes & CSS Filters | ORIGINAL_REQUEST §R3, Rule 9 | 5 | 5 | ✓ | ✓ |
| 16 | Image Fit (fill, cover, contain, none) | ORIGINAL_REQUEST §R3, Rule 7 | 5 | 5 | ✓ | ✓ |
| 17 | PSD Layer Tree & Groups | ORIGINAL_REQUEST §R4 | 5 | 5 | ✓ | ✓ |
| 18 | PSD Editable Text & Clipping Masks | ORIGINAL_REQUEST §R4 | 5 | 5 | ✓ | ✓ |
| 19 | CLI Commands & Flags | ORIGINAL_REQUEST §R5 | 5 | 5 | ✓ | ✓ |
| 20 | Watch Mode & Change Detection | ORIGINAL_REQUEST §R5, Rule 10 | 5 | 5 | ✓ | ✓ |

## Test Architecture
- Test Runner: `vitest`
- Invocation: `npx vitest run` or `npm test`
- Pass/Fail Semantics: Exit code 0, 0 test failures.
- Current Suite Status: 880 tests passing across 48 test files (E2E Tiers 1–4 contribute a 245-test subtotal).
- Golden References: **Structural checks only** — `tests/goldens/index.ts` records layer counts, canvas dimensions, expected group/text-layer names, and element flags (gradients/filters/relational placement). There are no pixel-hash or byte-level PNG comparisons.
- PSD Assertions: `ag-psd` `readPsd()` structural layer traversal and text verification.

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | Social Media Card (1200x630) | Rect background gradient, avatar image (fit: cover), multi-line headline with Skia wrapping, badge component with parameters, relational positioning | High |
| 2 | Product Showcase Banner (1920x1080) | 16:9 canvas, tile grid of 6 product cards, currentColor icons, clipping masks, dropshadow & blur filters, PSD export with editable text | High |
| 3 | Hero Banner with Nested Components & Polygon Accents | @import design tokens, component Arrow(size), polygon badges, multi-scale 1x/2x export, layered PSD with groups | High |
| 4 | Typography Poster (1080x1350) | Custom @font loading, multi-stop gradients, blend modes (multiply, screen), un-wrapped text headers, relational subtitles | High |
| 5 | Mobile UI Mockup | Tile grid header, status bar, nested component buttons, circular clipping masks, PSD export verified with ag-psd | High |

## Coverage Thresholds
- Tier 1: ≥100 test cases (≥5 per feature across 20 features)
- Tier 2: ≥100 test cases (boundary and corner cases)
- Tier 3: ≥20 test cases (major pairwise feature interactions)
- Tier 4: ≥5 realistic application scenarios
- **Total Minimum Target**: ≥225 test cases
