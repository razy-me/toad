# 06 — Components, Slots & Modular Imports

This module covers reusable parameterized components, default arguments, slot content injection (`slot;`), and multi-file architecture using `@import`.

---

## 1. Component Declaration (`component`)

```toad
component Button(label = "Click me", bg = #3b82f6, textColor = #ffffff) {
    stack #btnRoot {
        direction: horizontal;
        padding: [10px, 20px, 10px, 20px];
        radius: 8px;
        fill: >bg;
        shadow: 0 4px 12px alpha(>bg, 0.35);

        text {
            content: >label;
            font-size: 16px;
            font-weight: bold;
            color: >textColor;
        }
    }
}
```

---

## 2. Component Invocation & Parameter Passing

```toad
// 1. With default arguments
Button;

// 2. With positional arguments
Button("Get Started", #10b981);

// 3. With nested children body
Button("Download") {
    at: (50px, 100px);
}
```

---

## 3. Slot Injection (`slot;`)

Components use `slot;` to declare placeholder locations where children passed during invocation are rendered (content projection):

```toad
component Modal(title = "Notice") {
    stack #modalBox {
        direction: vertical;
        padding: 24px;
        gap: 16px;
        size: 400px hug;
        radius: 12px;
        fill: #1e293b;
        shadow: 0 20px 50px rgba(0, 0, 0, 0.5);

        text #header {
            content: >title;
            font-size: 20px;
            font-weight: bold;
            color: #ffffff;
        }

        slot; // 👈 Injected children render here
    }
}

// Invocation with slot children:
Modal("Confirmation Required") {
    text {
        content: "Are you sure you want to proceed with this action?";
        font-size: 14px;
        color: #94a3b8;
    }
    Button("Confirm", #10b981);
}
```

---

## 4. Multi-File Organization with `@import`

### `tokens.toad`
```toad
>primary = #3b82f6;
>surface = #0f172a;
>textMuted = #94a3b8;
>radiusMd = 8px;
```

### `main.toad`
```toad
@import "./tokens.toad";

canvas "Dashboard" {
    preset: og-image;
    background: >surface;
}

rect {
    size: 300px 100px;
    fill: >primary;
    radius: >radiusMd;
    at: center of canvas;
}
```

### Import Resolver Characteristics:
* **Path Canonicalization:** Relative paths resolve relative to the importing file's directory.
* **Deduplication:** Multiple imports of the same file are parsed once and shared.
* **Cycle Tolerance:** Circular `@import` chains are tolerated and deduplicated — even an entry file importing a module that imports it back does **not** throw; each file is parsed once and shared.
