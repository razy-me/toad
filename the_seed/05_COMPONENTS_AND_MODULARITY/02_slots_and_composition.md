# 02 — Slots & Component Composition

Slots allow component templates to act as flexible wrappers that accept arbitrary child elements injected at instantiation time.

---

## 1. Slot Declaration & Semicolon Rule

A slot insertion point inside a component is declared using the `slot` keyword:

> [!IMPORTANT]
> **The Semicolon Rule:**
> The slot statement **MUST** terminate with a semicolon: `slot;`. Omitting the semicolon causes a parse error (`[TOAD-E001]`).

```toad
component ModalDialog(title = "Dialog Title", width = 500px) {
    size: width hug;
    radius: 16px;
    fill: #19271D;
    stroke: alpha(#87CC2E, 0.3) 1px;
    padding: 24px;

    text #header {
        content: title;
        font-size: 20px;
        font-weight: 700;
        color: #ffffff;
    }

    // Dynamic slot insertion point
    slot;
}
```

---

## 2. Instantiating Components with Slotted Content

Children declared inside the body of a component instance are injected directly into the component's `slot;` location:

```toad
ModalDialog #confirmModal("Confirm Deployment", 560px) {
    at: center of canvas;

    // Injected into slot;
    text #dialogBody {
        content: "Are you sure you want to deploy production payload v2.4.1 to cluster EU-WEST-1?";
        font-size: 14px;
        color: #9EB0A3;
        line-height: 1.5;
        at: below #header offset 16px;
    }

    stack #buttonGroup {
        at: below #dialogBody offset 24px;
        direction: horizontal;
        gap: 12px;

        rect #btnCancel { size: 120px 40px; fill: transparent; stroke: #9EB0A3 1px; radius: 8px; }
        rect #btnConfirm { size: 160px 40px; fill: #87CC2E; radius: 8px; }
    }
}
```

---

## 3. High-Level Composition Patterns

### 1. Card Layout Wrappers
Wrap repetitive padding, shadows, background glassmorphism, and header iconography into a wrapper component, and pass unique body items into the slot.

### 2. Tab Panels & View Switchers
Define the chrome, search input, and tab navigation bar in the component, and inject the active view state elements into the slot.

### 3. Prepress Print Templates
Define standard bleed margins, trim marks, color calibration bars, and folding division lines in a master page template, and inject page-specific marketing graphics into the slot.
