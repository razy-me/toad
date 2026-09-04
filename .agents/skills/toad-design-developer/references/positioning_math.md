# Positioning Math: Relational Anchoring

Relational positioning allows elements to anchor themselves relative to other elements (or the canvas/parent) using spatial semantics, processed during Pass 3 of the layout engine (`src/parser/math.ts`).

## Target Resolution
The `targetId` specifies the layout anchor. If it's `'canvas'`, the bounding box is `(0, 0, canvasW, canvasH)`. If `'parent'`, it's the `parentBox`. Otherwise, it uses the previously computed layout box from the `resolvedBoxes` cache.

## Offset Math
Given an element size `w, h` and a target box `targetBox` (`tx, ty, tw, th`), with an optional offset `ox, oy`, the layout engine resolves specific relations:

- **right of:** `x = tx + tw + ox`, `y = ty + (isNum ? 0 : oy)`
- **left of:** `x = tx - w - ox`, `y = ty + (isNum ? 0 : oy)`
- **below:** `x = tx + (isNum ? 0 : ox)`, `y = ty + th + oy`
- **above:** `x = tx + (isNum ? 0 : ox)`, `y = ty - h - oy`
- **center of:** `x = tx + (tw - w) / 2 + ox`, `y = ty + (th - h) / 2 + oy`
- **inside / top-left of:** `x = tx + ox`, `y = ty + oy`
- **top-right of:** `x = tx + tw - w - ox`, `y = ty + oy`
- **bottom-left of:** `x = tx + ox`, `y = ty + th - h - oy`
- **bottom-right of:** `x = tx + tw - w - ox`, `y = ty + th - h - oy`

If only a single numeric/dimension offset is provided (e.g., `offset 10px`), it is applied along the primary axis of movement (e.g., X for `right of`, Y for `below`). 2D offsets can be declared as `offset 10px 20px` or `offset (10px, 20px)`. Note: Never place a colon after the `offset` keyword.
