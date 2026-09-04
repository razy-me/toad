# Print Prepress, CMYK, and High-DPI Workflows

Designing for physical print (business cards, table tent cards, brochures, posters) requires strict adherence to prepress standards: bleed boundaries, safe zones, 300 DPI rasterization, and CMYK color conversions.

---

## 1. The Prepress Geometry Box Model

In print production, a document contains multiple nested geometric boundaries:

```
┌────────────────────────────────────────────────────────┐  ◄─── Bleed Box (Cut boundary + Bleed)
│  Bleed Area (Typically 3mm / 0.125in on all sides)     │
│  ┌──────────────────────────────────────────────────┐  │  ◄─── Trim Box (Finished physical size)
│  │                                                  │  │
│  │  ┌────────────────────────────────────────────┐  │  │  ◄─── Safe Zone (Inner safety margin)
│  │  │                                            │  │  │
│  │  │  Live Artwork & Essential Typography       │  │  │
│  │  │  (Never place text outside this boundary)  │  │  │
│  │  │                                            │  │  │
│  │  └────────────────────────────────────────────┘  │  │
│  │                                                  │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

### Definitions:
1. **Trim Box (Final Dimensions)**: The exact physical dimension of the printed paper after trimming (e.g., A4: $210 \times 297\text{mm}$, Standard Business Card: $85 \times 55\text{mm}$).
2. **Bleed Box (Trim + Bleed)**: An extra margin (typically 3mm or 1/8") extending outward from the trim line. Backgrounds and full-bleed graphics **must** extend to the bleed boundary to prevent white paper slivers when the guillotine blade cuts.
3. **Safe Zone (Safety Margin)**: An inner boundary (typically 3mm to 5mm inside the trim line). All critical text, logos, and QR codes must stay inside the safe zone to prevent being clipped during blade drift.

---

## 2. DPI and Unit Conversion Math

Digital screens operate at 72 or 96 PPI, while commercial offset and digital presses require **300 DPI**.

### Conversion Formulas:
$$\text{Pixels} = \frac{\text{Millimeters}}{25.4} \times \text{DPI}$$
$$\text{Pixels} = \text{Inches} \times \text{DPI}$$

### Reference Table at 300 DPI:

| Print Format | Dimensions (mm) | Dimensions (Inches) | Pixel Dimensions (300 DPI) |
|:---|:---|:---|:---|
| **EU Business Card** | $85 \times 55$ mm | $3.35 \times 2.17$ in | $1004 \times 650$ px |
| **EU Card + 3mm Bleed** | $91 \times 61$ mm | $3.58 \times 2.40$ in | $1075 \times 720$ px |
| **US Business Card** | $88.9 \times 50.8$ mm | $3.5 \times 2.0$ in | $1050 \times 600$ px |
| **US Card + 1/8" Bleed** | $95.25 \times 57.15$ mm| $3.75 \times 2.25$ in | $1125 \times 675$ px |
| **A4 Sheet** | $210 \times 297$ mm | $8.27 \times 11.69$ in | $2480 \times 3508$ px |
| **A4 + 3mm Bleed** | $216 \times 303$ mm | $8.50 \times 11.93$ in | $2551 \times 3579$ px |

---

## 3. CMYK Color Conversions & Gamut Limits

Digital screens emit light in additive RGB, whereas printing presses deposit subtractive inks (Cyan, Magenta, Yellow, Key/Black).

### 3.1 Color Gamut Mismatch
RGB color gamuts (especially sRGB and Display P3) contain vibrant, high-saturation colors that **cannot be printed** with standard process inks:
- Ultra-bright neon greens (`#00FF88`) shift to dull olive greens.
- Vivid electric blues (`#0044FF`) shift to muted purple-navies.

### 3.2 Total Area Coverage (TAC)
The sum of all four ink percentages at any given pixel must not exceed the paper's absorption limit (typically **300% to 320%** for coated paper, **260%** for uncoated newsprint):
$$\text{TAC} = C\% + M\% + Y\% + K\% \le 300\%$$
Exceeding TAC results in wet ink smearing, offset marking, and drying defects.

### 3.3 Rich Black vs. Pure Black
- **Pure Black (`K = 100%`)**: Used for all body text and fine lines to prevent misregistration color fringing:
  ```
  C: 0%, M: 0%, Y: 0%, K: 100%
  ```
- **Rich Black**: Used for large solid dark backgrounds to achieve a deep, luxurious black without gray wash:
  ```
  C: 60%, M: 40%, Y: 40%, K: 100% (TAC = 240%)
  ```

---

## 4. Constructing Print Documents in TOAD

Here is an example of an ISO standard business card with bleed guides, trim boundary, and safe zone:

```toad
// Standard EU Business Card with 3mm Bleed
// 85mm x 55mm trim -> 91mm x 61mm total bleed box
canvas "EU_Business_Card" {
    width: 1075px;
    height: 720px;
    background: #FFFFFF;
    font-family: "Inter, sans-serif";
}

>bleed = 36px; // ~3mm at 300 DPI
>safeMargin = 60px; // ~5mm safety zone

// 1. Background spanning full bleed
rect #background {
    at: top-left of canvas;
    size: 100% 100%;
    fill: #0F172A;
}

// 2. Safe Area Container
rect #safeArea {
    at: center of canvas;
    width: 100% - (>safeMargin * 2);
    height: 100% - (>safeMargin * 2);
    fill: transparent;
}

// 3. Logo and Typography inside Safe Area
stack #content {
    at: center-left of #safeArea;
    direction: vertical;
    gap: 16px;

    text "Alex Morgan" {
        font-size: 48px;
        font-weight: 700;
        color: #FFFFFF;
    }

    text "Principal Systems Architect" {
        font-size: 24px;
        font-weight: 400;
        color: #94A3B8;
    }

    text "alex.morgan@toad-dsl.org  •  +49 30 123456" {
        font-size: 20px;
        font-weight: 500;
        color: #38BDF8;
    }
}
```

---

## 5. Preflight Checklist Before Sending to Print

Before releasing a TOAD design to a commercial print shop:

1. [ ] **Canvas Dimensions**: Canvas width and height must match the total bleed box dimension.
2. [ ] **DPI Resolution**: Render raster assets at `@4x` or calculate exact 300 DPI pixel dimensions.
3. [ ] **Safety Margin**: All text and barcodes are at least $3\text{mm}$ ($36\text{px}$) away from the trim edge.
4. [ ] **Bleed Extent**: Background fills and photographs extend all the way to the canvas border.
5. [ ] **Text Sharpness**: Body copy is set as vector text or pure black to ensure razor-sharp typography.
6. [ ] **Barcode & QR Code Sizing**: QR codes are at least $20\text{mm} \times 20\text{mm}$ ($240\text{px} \times 240\text{px}$) for reliable smartphone scanning.
