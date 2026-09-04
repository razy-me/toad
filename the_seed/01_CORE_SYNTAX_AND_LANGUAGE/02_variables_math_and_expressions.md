# 02 — Variables, Math & Expressions

This manual explains variable scoping, assignment operators, mathematical evaluations, and dynamic color transformations in the TOAD compiler.

---

## 1. Variable Declarations & Scopes

Variables in TOAD serve as the foundational design token layer.

### Declaration Syntax
Variables are declared using the `>` sigil and the **assignment operator `=`**:

```toad
// ✅ Correct Declarations:
>brandGreen        = #87CC2E;
>bgDark            = #101612;
>gridBase          = 8px;
>fontDisplay       = "Agency FB, sans-serif";

// ❌ Fatal Syntax Errors:
>brandGreen: #87CC2E;     // Never use colon for variable assignment!
brandGreen = #87CC2E;     // Missing > prefix!
```

### Variable References
Reference variables using the `>` sigil:

```toad
rect #card {
    fill: >bgDark;
    stroke: >brandGreen 1px;
    padding: >gridBase;
}
```

### Scoping & Shadowing Order
1. **Global Tokens**: Variables declared at root level across imported files.
2. **Import Shadowing**: In `@import` chains, variables defined in later documents override earlier ones.
3. **Local Overrides**: Variables passed as arguments to component instantiations shadow outer variables within that component's scope.

### Nested Token Objects
Tokens can be grouped hierarchically using object literals:

```toad
>theme = {
    primary: #87CC2E,
    surface: #152018,
    border: alpha(#87CC2E, 0.25)
};

// Referenced via dot-notation:
rect #badge {
    fill: >theme.surface;
    stroke: >theme.border 1px;
}
```

---

## 2. Font Fallback Stacks: The Single-String Rule

A critical parser rule governs font variables:
> **Font fallback chains must always be a single string literal.**

```toad
// ✅ Correct:
>fontBody = "Inter, -apple-system, sans-serif";
>fontHero = "'Agency FB', 'Rajdhani', sans-serif";

text #label {
    font-family: >fontBody;
}

// ❌ Syntax Parse Error:
// The lexer and parser evaluate unquoted commas as expression separators:
>fontBody = "Inter", -apple-system, sans-serif; // [TOAD-E001] Unexpected token ','
```

---

## 3. Math & `calc()` Expressions

Dynamic arithmetic can be computed using `calc()` expressions or direct dimension math:

### Supported Arithmetic Operators:
* Addition: `+`
* Subtraction: `-`
* Multiplication: `*`
* Division: `/`

### Calc Syntax Examples

```toad
// Subtract fixed margin from relative canvas dimension
rect #wideCard {
    width: calc(100% - 80px);
    height: calc(50% - 40px);
    at: (40px, 40px);
}

// Multiplying grid tokens
rect #modalBox {
    width: calc(>gridBase * 60);  // 480px if gridBase is 8px
    padding: calc(>gridBase * 2); // 16px
}
```

### Dimension Conversions & Units
Physical units convert to pixels at the CSS-reference **96 DPI**:
* `1in` = `96px`
* `1mm` $\approx$ `3.7795px` ($96 / 25.4$)
* `1cm` $\approx$ `37.795px`
* `1pt` $\approx$ `1.3333px` ($96 / 72$)
* `1em` / `1rem` = `16px` (Default typographic scale reference)

---

## 4. Dynamic Color Transform Functions

TOAD includes built-in functions for generating harmonious, accessible color palettes from primary brand tokens.

### Function Reference:

| Function | Signature | Description | Example |
|---|---|---|---|
| `alpha()` | `alpha(color, opacity)` | Sets or scales alpha transparency ($0.0 \dots 1.0$). | `alpha(#87CC2E, 0.35)` |
| `mix()` | `mix(color1, color2, weight)` | Linearly blends two colors by weight ($0.0 \dots 1.0$). | `mix(#ffffff, #000000, 0.2)` |
| `lighten()` | `lighten(color, percent)` | Increases HSL lightness by percentage. | `lighten(>brandGreen, 15%)` |
| `darken()` | `darken(color, percent)` | Decreases HSL lightness by percentage. | `darken(>brandGreen, 20%)` |
| `saturate()` | `saturate(color, percent)` | Boosts HSL chroma/saturation. | `saturate(#67A522, 25%)` |
| `desaturate()` | `desaturate(color, percent)` | Dulls saturation toward grayscale. | `desaturate(#67A522, 50%)` |

### Chaining & Nested Color Logic

```toad
>brandPrimary      = #87CC2E;
>brandSubtleBg     = alpha(lighten(>brandPrimary, 10%), 0.12);
>cardBorderDefault = alpha(>brandPrimary, 0.25);
>cardBorderHover   = alpha(>brandPrimary, 0.60);
```
