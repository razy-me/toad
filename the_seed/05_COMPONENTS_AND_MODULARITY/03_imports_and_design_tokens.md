# 03 — Modular Imports & Design Tokens

This manual covers multi-file project structuring, token centralization, circular import deduplication, and light/dark theme switching patterns.

---

## 1. Multi-File Project Architecture

Large design systems in TOAD are broken into modular files:

```
my-design-system/
├── tokens/
│   ├── colors.toad        # Raw color palette definitions
│   ├── typography.toad    # Font stacks, font-size scales, line heights
│   └── spacing.toad       # 8pt grid spacing scale variables
├── components/
│   ├── buttons.toad       # Reusable button components
│   └── cards.toad         # Reusable card wrappers
└── main.toad              # Entry point assembling the final canvas
```

---

## 2. The `@import` Directive

Documents are loaded using relative paths:

```toad
@import "./tokens/colors.toad";
@import "./tokens/typography.toad";
@import "./components/buttons.toad";

canvas "Dashboard" {
    size: 1440px 900px;
    background: >bgApp;
}
```

### Import Rules & Resolution:
1. **Quotation & Semicolon**: File paths must be quoted strings and terminate with a semicolon: `@import "./path.toad";`.
2. **Path Resolution**: Relative paths resolve relative to the *importing file's directory*, not the current working directory of the process.
3. **Circular Import Safety**: The import resolver tracks all visited paths in a set. Circular dependencies (e.g. `A.toad` imports `B.toad`, which imports `A.toad`) are automatically deduplicated without errors or infinite loops.

---

## 3. Design Token Architecture

Centralizing tokens enables instant global restyling:

```toad
// tokens/theme_dark.toad
>bgBase          = #0C120E;
>bgSurface       = #152018;
>bgElevated      = #19271D;

>brandPrimary    = #87CC2E;
>brandSecondary  = #A2E346;

>textHeadline    = #F5F8F5;
>textBody        = #9EB0A3;
>textMuted       = #677A6C;

>borderDefault   = alpha(#87CC2E, 0.25);
>borderFocused   = alpha(#87CC2E, 0.60);

>spaceXs         = 4px;
>spaceSm         = 8px;
>spaceMd         = 16px;
>spaceLg         = 24px;
>spaceXl         = 32px;
>space2Xl        = 48px;
```

---

## 4. Theme Switching Pattern (Dark vs. Light)

To support multiple themes seamlessly, define identical token names in dedicated theme files and import the desired theme into the main artboard:

```toad
// Option A: Compile Dark Version
@import "./tokens/theme_dark.toad";

// Option B: Compile Light Version
// @import "./tokens/theme_light.toad";

canvas "App" {
    size: 1200px 800px;
    background: >bgBase;

    rect #panel {
        fill: >bgSurface;
        stroke: >borderDefault 1px;
    }

    text #title {
        color: >textHeadline;
    }
}
```
