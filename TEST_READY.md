# TEST_READY — E2E Test Suite Specification & Inventory

**Status**: E2E Test Suite Tiers 1–4 Complete & Ready for Verification  
**Test Framework**: Vitest (`vitest`)  
**Invocation**: `npm test` or `npx vitest run`  
**Total E2E Test Cases**: 245 test cases (Requirement threshold: ≥225 test cases)

---

## 1. Test Suite Architecture & Summary

| Test Tier | Test File | Scope / Methodology | Test Count | Status |
|---|---|---|:---:|:---:|
| **Tier 1: Feature Coverage** | `tests/e2e/tier1_features.test.ts` | Complete feature coverage across all 20 compiler features (5 tests per feature) | 100 | **READY** |
| **Tier 2: Boundary Analysis** | `tests/e2e/tier2_boundaries.test.ts` | Extreme values, minimum/maximum scales, degenerate shapes, cycle detection, panic recovery | 100 | **READY** |
| **Tier 3: Pairwise Combinations**| `tests/e2e/tier3_combinations.test.ts` | Cross-feature pairwise interactions (variables in gradients, components in grids, etc.) | 20 | **READY** |
| **Tier 4: Real-World Workloads** | `tests/e2e/tier4_workloads.test.ts` | 5 full production visual design pipelines (Social Card, Product Banner, Hero, Poster, Mobile Mockup) | 25 | **READY** |
| **Total** | | | **245** | **READY** |

---

## 2. Test Fixtures & Golden Benchmarks

### 2.1 Reusable Fixtures (`tests/fixtures/`)
- `tokens.toad`: Design system variables ($primary, $secondary, $spacing, $fontFamilySans, $fontSizeTitle, etc.)
- `components.toad`: Reusable parametric components (`Badge`, `Button`, `Arrow`, `Avatar`) with default values.
- `social_card.toad`: 1200x630 Social Media Card with Skia multi-line text wrapping, avatar image, gradient glow, relational layout.
- `product_banner.toad`: 1920x1080 Showcase Banner with 16:9 canvas GCD, 6-card uniform tile grid, currentColor icons, drop-shadow filters.
- `hero_banner.toad`: 1600x900 Hero Banner with imported tokens, polygon accents, multi-scale 1x/2x/4x raster generation, PSD groups.
- `typography_poster.toad`: 1080x1350 Swiss Typography Poster with @font directive, 4:5 aspect ratio, multiply blend mode, exact Skia bounding boxes.
- `mobile_mockup.toad`: 430x932 Mobile UI Mockup with status bar, 2-column tile grid, circular clipping masks.
- `circular_a.toad` & `circular_b.toad`: Mutually recursive cyclic imports for circularity prevention tests.
- `sample_shapes.toad`, `sample_filters.toad`, `sample_gradients.toad`, `sample_relational.toad`, `sample_grid.toad`: Focused unit & integration fixture sets.

### 2.2 Golden Reference Metadata (`tests/goldens/`)
- `index.ts`: Authoritative structural benchmarks, canvas dimensions, aspect ratios, expected PSD layer counts, and layer hierarchies for all Tier 4 workload scenarios.

---

## 3. 20-Feature Coverage Matrix (Tier 1)

| Feature # | Feature Name | Tier 1 Tests | Key Verified Behaviors |
|:---:|---|:---:|---|
| **F01** | Lexical Tokenizer | 5 | Keywords, dimension units (`px`, `%`, `deg`, `em`, `pt`), hex colors vs IDs, strings, variables |
| **F02** | AST & Recursive-Descent Parser | 5 | Canvas declaration, rect, circle, polygon, text, image, nested group elements |
| **F03** | Directives (@import, @font) | 5 | File imports, font aliases, cross-file variable resolution, dependency tracking |
| **F04** | Variables & Scoping | 5 | `$var` property substitution, chained variables, color inheritance, component parameter isolation |
| **F05** | Component Parameters | 5 | Declared defaults `Arrow(size = 180px)`, named overrides `Arrow(size: 240px)`, multi-instances |
| **F06** | Canvas Dimensions & Aspect Ratio (GCD) | 5 | Euclidean GCD calculation, standard ratios (16:9, 1:1, 40:21, 4:5, 8:5) |
| **F07** | Bounding Box & Skia Text Measuring | 5 | Headless Skia font metrics, un-wrapped text preservation, conditional `size.w` auto-wrap |
| **F08** | currentColor Resolution | 5 | Cascading `currentColor` down group hierarchy, stroke/fill resolution, local overriding, black fallback |
| **F09** | Relational Positioning & DAG | 5 | `at: right of`, `at: below`, `at: center of`, topological sorting, top-level (0,0) fallback |
| **F10** | Local Polygon Coordinate Space | 5 | Center-relative vertex coordinate frame, natural extrema calculation, explicit size scaling |
| **F11** | Uniform Tile Grid Layout | 5 | Fixed column counts, equal cell sizing, configurable gap, row/column flow |
| **F12** | Font Loading (Dir & Directive) | 5 | `registerFont()`, `loadFontsFromDir()`, inline `@font` AST aggregation |
| **F13** | Raster Canvas Rendering (Multi-scale) | 5 | 1x, 2x, 4x multi-scale rendering to Canvas, PNG buffer encoding, JPEG buffer encoding |
| **F14** | Gradients & Even Stop Distribution | 5 | Missing stop interpolation algorithm, linear-gradient directions, radial-gradient shapes |
| **F15** | Blend Modes & CSS Filters | 5 | Blend mode mapping (multiply, screen, overlay), filter string parsing (blur, saturate, drop-shadow) |
| **F16** | Image Fit | 5 | `fit: fill`, `fit: cover`, `fit: contain`, `fit: none`, default fallback |
| **F17** | PSD Layer Tree & Groups | 5 | `exportToPsd()`, `8BPS` signature, layer names, group hierarchies, opacity, blend modes |
| **F18** | PSD Editable Text & Clipping Masks | 5 | Editable Photoshop text layer generation, font metadata, clipping mask linking |
| **F19** | CLI Commands & Flags | 5 | Programmatic `compileToad()` options (`--scale`, `--format`, `--out`, `--fonts`, `--watch`) |
| **F20** | Watch Mode & Change Detection | 5 | Entry & transitive dependency tracking, deduplication, compilation triggering |

---

## 4. How to Execute the Test Suite

```bash
# Run all unit and E2E test suites
npm test

# Or run directly with vitest
npx vitest run

# Run specific E2E test tiers
npx vitest run tests/e2e/tier1_features.test.ts
npx vitest run tests/e2e/tier2_boundaries.test.ts
npx vitest run tests/e2e/tier3_combinations.test.ts
npx vitest run tests/e2e/tier4_workloads.test.ts
```
