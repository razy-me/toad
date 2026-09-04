# 01 — Component Architecture & Reusability

Components in TOAD enable modular, reusable design primitives with parameterized properties, default values, and local scoping.

---

## 1. Component Declaration Syntax

A component is declared using the `component` keyword, followed by an identifier and an optional parameter list:

```toad
component MetricCard(title = "Total Users", value = "12,450", trend = "+8.2%") {
    size: 240px 140px;
    background: #19271D;
    radius: 14px;
    stroke: alpha(#87CC2E, 0.2) 1px;

    text #lblTitle {
        at: (20px, 20px);
        content: title;
        font-size: 13px;
        color: #9EB0A3;
    }

    text #lblValue {
        at: (20px, 48px);
        content: value;
        font-size: 28px;
        font-weight: 700;
        color: #ffffff;
    }

    text #lblTrend {
        at: (20px, 94px);
        content: trend;
        font-size: 12px;
        font-weight: 600;
        color: #87CC2E;
    }
}
```

---

## 2. Parameter Syntax & Default Values

Parameters can be defined with default values:

```toad
component Button(label = "Click Me", variant = "primary", width = 160px) {
    size: width 44px;
    radius: 8px;
    fill: variant == "primary" ? #87CC2E : transparent;
    // ...
}
```

### Instantiation Syntax:
Components can be instantiated with positional or named arguments:

```toad
// Positional arguments
MetricCard #card1("Active Streams", "420", "+12.4%") {
    at: (40px, 80px);
}

// Named arguments
MetricCard #card2(value = "99.98%", title = "Uptime") {
    at: right of #card1 offset 20px;
}
```

---

## 3. Internal ID Remapping & Relational Integrity

When a component is instantiated, the compiler resolves internal elements to prevent ID collisions:
* Internal IDs are automatically prefixed with the instance ID (e.g. `#card1_lblTitle`, `#card2_lblTitle`).
* Relational dependencies *inside* the component (e.g. `at: below #lblTitle;`) are remapped so they continue pointing to their local sibling within that specific component instance.
* Relational anchors referencing external global landmarks (e.g. `at: right of #sidebar;`) are preserved intact.

---

## 4. Single-Child vs. Group Wrapper Rules

* **Single-Child Optimization**: If a component's template contains only a single root element (e.g. a stylized `rect`), the compiler optimizes the AST by merging instance properties directly into that single element without creating an unnecessary wrapping group.
* **Multi-Child Wrapper**: If a component contains multiple siblings, the compiler wraps the output in a `GroupElement` named after the instance.
* **Recursion Guard**: Component nesting is strictly guarded against infinite loops with a maximum depth limit of 32 (`maxComponentDepth`).
