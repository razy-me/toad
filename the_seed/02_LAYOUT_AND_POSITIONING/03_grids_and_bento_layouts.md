# 03 — Grids & Bento Layout Architecture

The `grid` container provides two-dimensional layout capabilities, essential for high-end SaaS dashboards, bento grids, and multi-column magazine artboards.

---

## 1. Grid Declaration & Track Definitions

```toad
grid #dashboardBento {
    at: (40px, 120px);
    width: 820px;
    height: 520px;
    columns: 3;             // 3 equal fractional tracks (1fr 1fr 1fr)
    rows: 2;                // 2 equal fractional tracks
    gap: 20px;              // Uniform gap between tracks
    padding: 0px;

    rect #tile1 { fill: #19271D; radius: 16px; col-span: 2; }
    rect #tile2 { fill: #19271D; radius: 16px; }
    rect #tile3 { fill: #19271D; radius: 16px; }
    rect #tile4 { fill: #19271D; radius: 16px; col-span: 2; }
}
```

---

## 2. Advanced Grid Properties

| Property | Values | Description |
|---|---|---|
| `columns:` | Number (`3`) or Array (`[240px, 1fr, 1fr]`) | Defines column tracks. |
| `rows:` | Number (`2`) or Array (`[80px, 1fr]`) | Defines row tracks. |
| `gap:` | Dimension (`16px`, `24px`) | Space between both rows and columns. |
| `row-gap:` | Dimension (`20px`) | Explicit vertical row spacing. |
| `column-gap:` | Dimension (`16px`) | Explicit horizontal column spacing. |
| `col-span:` / `column-span:` | Integer (`1`, `2`, `3`) | Number of columns a child element occupies. |
| `row-span:` | Integer (`1`, `2`) | Number of rows a child element spans vertically. |

---

## 3. The Modern Bento Box Pattern

Bento layouts (popularized by Apple and Linear) organize disparate UI metrics into visual hierarchy:

```
┌──────────────────────────────────────┬───────────────────┐
│ #heroMetric (col-span: 2)            │ #sideStat1        │
│ High-impact primary chart / graph    │ Quick KPI card    │
├───────────────────┬──────────────────┴───────────────────┤
│ #sideStat2        │ #activityStream (col-span: 2)        │
│ Circular gauge    │ Recent events & timeline logs        │
└───────────────────┴──────────────────────────────────────┘
```

### Complete Bento Layout Code:

```toad
>bgCard   = #152018;
>border   = alpha(#87CC2E, 0.25);
>brand    = #87CC2E;

grid #bentoShowcase {
    at: (40px, 60px);
    size: 820px 480px;
    columns: 3;
    rows: 2;
    gap: 16px;

    // Tile 1: Primary Hero Bento (2 Columns Wide)
    group #tileHero {
        col-span: 2;
        rect #t1Bg { size: fill fill; fill: >bgCard; stroke: >border 1px; radius: 16px; }
        text #t1Title { at: (24px, 24px); content: "Real-Time Pipeline"; font-size: 20px; font-weight: 700; color: #ffffff; }
        text #t1Value { at: (24px, 58px); content: "1.42 GB/s"; font-size: 38px; font-weight: 800; color: >brand; }
    }

    // Tile 2: Side KPI Stat
    group #tileStat1 {
        rect #t2Bg { size: fill fill; fill: >bgCard; stroke: >border 1px; radius: 16px; }
        text #t2Title { at: (20px, 20px); content: "Active Nodes"; font-size: 14px; color: #9EB0A3; }
        text #t2Value { at: (20px, 48px); content: "1,024"; font-size: 32px; font-weight: 800; color: #ffffff; }
    }

    // Tile 3: Secondary Metric
    group #tileStat2 {
        rect #t3Bg { size: fill fill; fill: >bgCard; stroke: >border 1px; radius: 16px; }
        text #t3Title { at: (20px, 20px); content: "Uptime SLA"; font-size: 14px; color: #9EB0A3; }
        text #t3Value { at: (20px, 48px); content: "99.99%"; font-size: 32px; font-weight: 800; color: >brand; }
    }

    // Tile 4: Activity Stream (2 Columns Wide)
    group #tileStream {
        col-span: 2;
        rect #t4Bg { size: fill fill; fill: >bgCard; stroke: >border 1px; radius: 16px; }
        text #t4Title { at: (24px, 24px); content: "Cluster Health Status"; font-size: 16px; font-weight: 700; color: #ffffff; }
        text #t4Desc { at: (24px, 54px); content: "All 16 availability zones operating within nominal thresholds."; font-size: 13px; color: #9EB0A3; size: 480px; }
    }
}
```
