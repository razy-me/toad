# 03 — Layout Engine, Positioning & Geometry Math

This module documents the coordinate system, relational positioning anchors, DAG topological resolution, auto-layout stacks (`hug`/`fill`), grid systems, and step-by-step mathematical bounding box computation.

---

## 1. Coordinate System & Bounding Box Model

Every element in `toad` possesses a 2D bounding box:
$$\text{Box} = (x, y, w, h)$$

* The origin $(0, 0)$ is situated at the **top-left corner** of the canvas or parent container.
* Alignment is top-left oriented.

```
(0, 0)
┌──────────────────────── Canvas (W x H) ────────────────────────┐
│                                                                │
│      (x, y)                                                    │
│      ┌──────── Element (w x h) ────────┐                       │
│      │                                 │                       │
│      │   Content / Fill / Children     │  h (Height)           │
│      │                                 │                       │
│      └─────────────────────────────────┘                       │
│                   w (Width)                                    │
└────────────────────────────────────────────────────────────────┘
```

---

## 2. Relational Positioning (`at:`)

Elements can be positioned relative to other elements or the canvas.

```
                       ┌─────────────────┐
                       │  above #target  │
                       └─────────────────┘
                                ▲
                                │ offset
                                │
   ┌────────────────┐  offset  ┌─────────────────┐  offset  ┌─────────────────┐
   │ left of #target│◄─────────┤   #target Box   ├─────────►│ right of #target│
   │                │          │                 │          │                 │
   └────────────────┘          └─────────────────┘          └─────────────────┘
                                │
                                │ offset
                                ▼
                       ┌─────────────────┐
                       │  below #target  │
                       └─────────────────┘
```

```toad
// 1. Absolute Point
at: (100px, 200px);

// 2. Relative to an element with ID
at: right of #icon offset 12px;
at: left of #button offset 8px;
at: below #header offset 24px;
at: above #footer offset 16px;

// 3. Centering (explicit target, or bare `center` sugar)
at: center of canvas;
at: center of #card;

// 4. Inside a parent or container
at: inside parent offset 20px;
at: inside #container offset 16px;

// 5. Corner anchors
at: top-left of #card;
at: bottom-right of #footer;

// 6. Previous sibling (same parent)
at: right of previous offset 8px;
```

> [!TIP]
> **Sugar:** The bare form `at: center;` is valid and centers the element within its current parent. Explicit targets (`center of canvas`, `center of #target`) remain available for clarity.

### Nested Coordinates & Container Origin
* Coordinates of nested elements are **relative to their container's origin**.
* A container **without** an explicit position *hugs* its children's extents — its origin shifts to the minimum child coordinate.
* A container **with** an explicit `at:` *keeps* that origin as the frame for its children; its size derives from its children.

---

## 3. DAG Resolution & Cycle Detection

The layout engine constructs a Directed Acyclic Graph (DAG) of all relational positioning dependencies.

```
#header  ───(below)───►  #subtitle  ───(right of)───►  #badge
```

### The 3-Color DFS Algorithm (`src/parser/dependencyGraph.ts`):
1. **`WHITE (0)`**: Unvisited.
2. **`GRAY (1)`**: Visiting (currently on active recursion stack).
3. **`BLACK (2)`**: Fully visited and resolved.

If DFS encounters a node in the `GRAY` state, a **circular dependency** exists (e.g. `#a` below `#b` and `#b` below `#a`). The compiler aborts deterministically with a `CyclicDependencyError` whose message names the exact cycle path: `Cyclic layout dependency cycle detected: #a -> #b -> #a`. (`@import` cycles, by contrast, stay tolerated and deduplicated.)

---

## 4. Auto-Layout Stacks (`stack`)

Auto-layout stacks sequence child elements automatically along an axis:

```
Stack (direction: horizontal, gap: 16px, padding: 20px, size: hug hug)
┌────────────────────────────────────────────────────────────────────────┐
│ [Padding: 20px]                                                        │
│ ┌──────────────────┐    gap: 16px    ┌──────────────────┐              │
│ │   Child 1 (Item) │◄───────────────►│   Child 2 (Item) │ [Padding: 20]│
│ │   w: 140, h: 48  │                 │   w: 140, h: 48  │              │
│ └──────────────────┘                 └──────────────────┘              │
│                                                          [Padding: 20] │
└────────────────────────────────────────────────────────────────────────┘
Total Width  (hug) = 20px + 140px + 16px + 140px + 20px = 336px
Total Height (hug) = 20px + 48px + 20px = 88px
```

```toad
stack #cardList {
    direction: vertical;      // 'vertical' (column) or 'horizontal' (row)
    gap: 16px;                // Spacing between children
    padding: 24px;            // Internal padding (uniform or [top, right, bottom, left])
    size: 400px hug;          // Width: 400px, Height: hugs children
    at: center of canvas;

    rect { size: 100% 48px; fill: #3b82f6; radius: 8px; }
    rect { size: 100% 48px; fill: #10b981; radius: 8px; }
}
```

### Sizing Modes in Stacks:
* **`hug` (Hug Contents)**: Container shrinks/expands to fit the accumulated dimensions of its children plus `gap` and `padding`.
* **`fill` (Fill Parent)**: Element stretches to $100\%$ of available space inside the parent container.
* **Fixed Dimensions**: `300px`, `50%`.

---

## 5. CSS Grid Container (`grid`)

```toad
grid #photoGrid {
    columns: 3;               // 3 equal-width columns
    gap: 12px;                // Uniform gap
    size: 600px hug;
    at: (50px, 100px);

    rect { size: 100% 120px; fill: #1e293b; radius: 8px; }
    rect { size: 100% 120px; fill: #1e293b; radius: 8px; }
    rect { size: 100% 120px; fill: #1e293b; radius: 8px; }
}
```

> **Grid sizing:** `%` / `fill` child heights resolve against their **per-row height**, and unsized, `%`, or `fill` grid children receive their tile dimensions.

---

## 6. Step-by-Step Execution Trace

### Input Code:
```toad
canvas { size: 1200px 800px; }

rect #header {
    size: 600px 100px;
    at: (300px, 50px);
}

rect #card {
    size: 400px 180px;
    at: below #header offset 20px;
    margin: 10px 0 0 30px; // [top, right, bottom, left]
}
```

### Mathematical Resolution:
1. **`#header` Bounding Box**:
   * Explicitly declared: $\text{Box}_{\text{header}} = (x=300, y=50, w=600, h=100)$.

2. **`#card` Relational Anchor (`below #header offset 20px`)**:
   * Base $x$: $x_{\text{base}} = x_{\text{header}} = 300\text{ px}$.
   * Base $y$: $y_{\text{base}} = y_{\text{header}} + h_{\text{header}} + \text{offset} = 50 + 100 + 20 = 170\text{ px}$.

3. **Margin Offset Addition (`margin: 10px 0 0 30px`)**:
   * $x_{\text{final}} = x_{\text{base}} + \text{marginLeft} = 300 + 30 = 330\text{ px}$.
   * $y_{\text{final}} = y_{\text{base}} + \text{marginTop} = 170 + 10 = 180\text{ px}$.

4. **Final `#card` Bounding Box**:
   $$\text{Box}_{\text{card}} = (x=330, y=180, w=400, h=180)$$
