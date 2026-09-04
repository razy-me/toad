# 01 — Vector Primitives & Custom Paths

TOAD provides a comprehensive suite of hardware-accelerated 2D geometric shapes, parametric primitives, and arbitrary SVG vector path definitions.

---

## 1. Geometric Primitives Overview

```toad
// 1. Rectangle
rect #box {
    size: 200px 120px;
    fill: #19271D;
    stroke: #87CC2E 1.5px;
    radius: 12px;
}

// 2. Circle & Ellipse
circle #avatar {
    size: 64px; // diameter
    fill: #87CC2E;
}

ellipse #glowOrb {
    size: 300px 180px;
    fill: radial-gradient(circle, alpha(#87CC2E, 0.4) 0%, transparent 70%);
}

// 3. Parametric Shapes
star #badgeStar {
    size: 48px;
    points: 5;
    fill: #F59E0B;
}

triangle #indicator {
    size: 24px 20px;
    fill: #87CC2E;
    rotation: 90deg;
}

arrow #nextArrow {
    size: 32px 32px;
    stroke: #ffffff 2px;
}
```

---

## 2. Corner Radii Engineering

The `radius:` property accepts single dimensions or array tuples for independent per-corner control:

```toad
// Uniform corner radius
rect #uniformCard { radius: 16px; }

// Top-only rounded corners (Tabs, Modals)
// [Top-Left, Top-Right, Bottom-Right, Bottom-Left]
rect #modalHeader {
    size: 400px 60px;
    radius: [16px, 16px, 0px, 0px];
    fill: #19271D;
}

// Alternating diagonal corners
rect #leafBadge {
    size: 120px 40px;
    radius: [20px, 0px, 20px, 0px];
    fill: alpha(#87CC2E, 0.2);
}
```

---

## 3. Custom SVG Paths (`path`)

Arbitrary vector artwork is expressed through standard SVG path data strings (`d:`).

```toad
path #customCloudLogo {
    at: (360px, 100px);
    size: 176px 100px;
    d: "M 67.3 26.2 L 108.5 98 L 24 98 A 24 24 0 0 1 0 74 A 24 24 0 0 1 24 50 A 28 28 0 0 1 67.3 26.2 Z";
    fill: #99C556;
    stroke: alpha(#000000, 0.2) 1px;
}
```

> [!IMPORTANT]
> **Local Coordinates Rule:** Path data coordinates in `d:` should be normalized around local origin `(0, 0)`. The compiler anchors the path at `at: (x, y);` and handles translation across Skia, SVG, and Photoshop PSD.

---

## 4. Polygons & Vertices (`polygon`)

Polygons accept an array of 2D vertex coordinate tuples:

```toad
// Triangle centered around origin
polygon #diamond {
    at: (200px, 200px);
    size: 80px 80px;
    points: [(0, -40), (40, 0), (0, 40), (-40, 0)];
    fill: #87CC2E;
}
```

* **Rule:** Polygon vertices must be defined relative to their center `(0, 0)`.

---

## 5. Built-in Vector Icon System (`icon`)

TOAD integrates standard vector icons (based on the Lucide specification) rendered at exact scale:

```toad
icon #checkIcon {
    at: (16px, 16px);
    size: 20px;
    iconName: "check";
    stroke: #87CC2E 2px;
    fill: transparent;
}
```

---

## 6. Comprehensive Stroke Options

| Property | Values | Description |
|---|---|---|
| `stroke:` | `<color> <width>` | Stroke color and pixel thickness (e.g. `#87CC2E 1.5px`). |
| `stroke-cap:` | `round`, `butt`, `square` | Line termination styling. |
| `stroke-join:` | `miter`, `round`, `bevel` | Corner vertex join styling. |
| `stroke-style:` | `solid`, `dashed`, `dotted` | Dash pattern generator. |
