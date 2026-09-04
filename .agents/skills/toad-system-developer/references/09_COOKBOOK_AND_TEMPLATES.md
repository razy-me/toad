# 09 — Code Cookbook & Master Templates

This module provides 100% test-verified, canonical `.toad` design templates across various production use cases.

---

## 1. Social Media OpenGraph Banner (`og-image`)

```toad
>bgDark = #0f172a;
>primary = #38bdf8;
>textLight = #f8fafc;
>textMuted = #94a3b8;

canvas "Hero-Banner" {
    preset: og-image;         // 1200x630
    background: >bgDark;
    export: all;
}

stack #content {
    direction: vertical;
    gap: 20px;
    size: 1000px hug;
    at: center of canvas;

    stack #badge {
        direction: horizontal;
        padding: [6px, 16px, 6px, 16px];
        radius: 20px;
        fill: alpha(>primary, 0.15);
        stroke: alpha(>primary, 0.4) 1px;

        icon {
            iconName: "settings";
            size: 18px;
            fill: >primary;
        }
        text {
            content: "TOAD V2.0 ENGINE";
            font-size: 13px;
            font-weight: 700;
            color: >primary;
            letter-spacing: 1px;
            at: right of previous offset 8px; // 'previous' = immediately preceding sibling (supported)
        }
    }

    text #title {
        content: "Declarative Design & Vector Compilation";
        font-size: 56px;
        font-weight: 800;
        color: >textLight;
        letter-spacing: -1px;
        size: 900px;
    }

    text #subtitle {
        content: "Generate pixel-accurate multi-scale images, SVGs, and native Photoshop PSDs with true auto-layout.";
        font-size: 22px;
        color: >textMuted;
        line-height: 1.4;
        size: 800px;
    }
}
```

---

## 2. Print-Ready Business Card (CMYK + Bleed + Front/Back)

```toad
>cmykBg = cmyk(0%, 0%, 0%, 92%);
>cmykGold = cmyk(0%, 20%, 80%, 10%);
>cmykWhite = cmyk(0%, 0%, 0%, 0%);

// Multi-canvas pages are independent — each canvas renders ONLY its own
// elements, so declare every page's content INSIDE its canvas block.
canvas "BusinessCard-Front" {
    size: 85mm 55mm;
    dpi: 300;
    color-mode: cmyk;
    bleed: 3mm;
    crop-marks: true;
    background: >cmykBg;
    export: all;

    stack #frontContent {
        direction: vertical;
        gap: 8px;
        at: center of canvas;

        text {
            content: "FLORIAN DESIGN";
            font-size: 24pt;
            font-weight: 800;
            letter-spacing: 2pt;
            color: >cmykGold;
            align: center;
        }
        text {
            content: "CHIEF ARCHITECT & LEAD ENGINEER";
            font-size: 9pt;
            font-weight: 600;
            color: >cmykWhite;
            letter-spacing: 1pt;
            align: center;
        }
    }
}

canvas "BusinessCard-Back" {
    size: 85mm 55mm;
    dpi: 300;
    color-mode: cmyk;
    bleed: 3mm;
    crop-marks: true;
    background: >cmykGold;
    export: all;

    stack #backContent {
        direction: vertical;
        gap: 6px;
        at: inside parent offset 16mm;

        text {
            content: "info@toad-lang.org";
            font-size: 10pt;
            color: >cmykBg;
            font-weight: bold;
        }
        text {
            content: "+49 (0) 123 456789";
            font-size: 10pt;
            color: >cmykBg;
        }
    }
}
```

---

## 3. UI Modal Component with Slot Injection

```toad
>surfaceDark = #1e293b;
>primaryBlue = #3b82f6;

canvas "UI-Demo" {
    size: 800px 600px;
    background: #0f172a;
    export: png;
}

component Modal(headerTitle = "Dialog Header") {
    stack #modalBox {
        direction: vertical;
        padding: 24px;
        gap: 16px;
        size: 420px hug;
        radius: 16px;
        fill: >surfaceDark;
        stroke: rgba(255, 255, 255, 0.1) 1px;
        shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
        at: center of canvas;

        text #header {
            content: >headerTitle;
            font-size: 20px;
            font-weight: bold;
            color: #ffffff;
        }

        slot; // 👈 Injected children
    }
}

Modal("Delete Account") {
    text {
        content: "Are you sure you want to proceed? This action cannot be undone.";
        font-size: 14px;
        color: #94a3b8;
        line-height: 1.4;
    }
    rect {
        size: 100% 42px;
        fill: #ef4444;
        radius: 8px;
        shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
    }
}
```

---

## 4. Production Masterpiece: Bauhaus Exhibition Poster (1923)

Demonstrates precise constructivist geometry, multiple parallel vector arcs (`path` with SVG arc `A` commands), semantic palette variables, typography with `Haettenschweiler`, and balanced rhythm.

```toad
// Bauhaus Exhibition Poster (Weimar, 1923)
// Recreated in TOAD DSL

>bgCream = #e5decc;
>terracotta = #b5633a;
>black = #1e1c1a;

canvas "Bauhaus-1923" {
  size: 700px 1000px;
  background: >bgCream;
  export: all;
}

// Top Title Text
text #title {
  content: "BAUHAUS";
  font-family: "Haettenschweiler";
  font-size: 56px;
  font-weight: 700;
  color: >black;
  letter-spacing: 1px;
  at: (40px, 45px);
}

// Top Header Horizontal Rule
rect #topRule {
  size: 620px 3.5px;
  fill: >black;
  at: (40px, 110px);
}

// Top-Left Terracotta Sun Circle
circle #sunCircle {
  size: 192px;
  fill: >terracotta;
  at: (40px, 164px);
}

// Serpentine Concentric Ribbons (17 Parallel Tracks)
path #serpentineLines {
  d: "M 232 370 L 232 446 A 11 11 0 0 0 254 446 L 254 370 A 203 203 0 0 1 660 370 L 660 680 M 220 370 L 220 446 A 23 23 0 0 0 266 446 L 266 370 A 191 191 0 0 1 648 370 L 648 680 M 208 370 L 208 446 A 35 35 0 0 0 278 446 L 278 370 A 179 179 0 0 1 636 370 L 636 680 M 196 370 L 196 446 A 47 47 0 0 0 290 446 L 290 370 A 167 167 0 0 1 624 370 L 624 680 M 184 370 L 184 446 A 59 59 0 0 0 302 446 L 302 370 A 155 155 0 0 1 612 370 L 612 680 M 172 370 L 172 446 A 71 71 0 0 0 314 446 L 314 370 A 143 143 0 0 1 600 370 L 600 680 M 160 370 L 160 446 A 83 83 0 0 0 326 446 L 326 370 A 131 131 0 0 1 588 370 L 588 680 M 148 370 L 148 446 A 95 95 0 0 0 338 446 L 338 370 A 119 119 0 0 1 576 370 L 576 680 M 136 370 L 136 446 A 107 107 0 0 0 350 446 L 350 370 A 107 107 0 0 1 564 370 L 564 680 M 124 370 L 124 446 A 119 119 0 0 0 362 446 L 362 370 A 95 95 0 0 1 552 370 L 552 680 M 112 370 L 112 446 A 131 131 0 0 0 374 446 L 374 370 A 83 83 0 0 1 540 370 L 540 680 M 100 370 L 100 446 A 143 143 0 0 0 386 446 L 386 370 A 71 71 0 0 1 528 370 L 528 680 M 88 370 L 88 446 A 155 155 0 0 0 398 446 L 398 370 A 59 59 0 0 1 516 370 L 516 680 M 76 370 L 76 446 A 167 167 0 0 0 410 446 L 410 370 A 47 47 0 0 1 504 370 L 504 680 M 64 370 L 64 446 A 179 179 0 0 0 422 446 L 422 370 A 35 35 0 0 1 492 370 L 492 680 M 52 370 L 52 446 A 191 191 0 0 0 434 446 L 434 370 A 23 23 0 0 1 480 370 L 480 680 M 40 370 L 40 446 A 203 203 0 0 0 446 446 L 446 370 A 11 11 0 0 1 468 370 L 468 680";
  size: 700px 1000px;
  stroke: >black 4.5px;
  fill: transparent;
  at: (0, 0);
}

// 5 Horizontal Terracotta Accent Stripes
rect #stripe1 { size: 660px 9.5px; fill: >terracotta; at: (40px, 680px); }
rect #stripe2 { size: 660px 9.5px; fill: >terracotta; at: (40px, 710px); }
rect #stripe3 { size: 660px 9.5px; fill: >terracotta; at: (40px, 740px); }
rect #stripe4 { size: 660px 9.5px; fill: >terracotta; at: (40px, 770px); }
rect #stripe5 { size: 660px 9.5px; fill: >terracotta; at: (40px, 800px); }

// Bottom-Right Terracotta Semicircle
path #rightSemicircle {
  d: "M 700 425 A 230 230 0 0 0 700 885 Z";
  size: 700px 1000px;
  fill: >terracotta;
  at: (0, 0);
}

// Bottom Footer Horizontal Rule
rect #bottomRule {
  size: 620px 3.5px;
  fill: >black;
  at: (40px, 895px);
}

// Bottom Exhibition Date Text
text #dateText {
  content: "JULY - SEPTEMBER 1923";
  font-family: "Haettenschweiler";
  font-size: 24px;
  font-weight: 700;
  color: >black;
  letter-spacing: 1px;
  align: right;
  size: 620px hug;
  at: (40px, 908px);
}
```

---

## 5. Production Masterpiece: Vintage Soul Music Poster (1979)

Demonstrates 5:7 poster format, complex organic multi-stop linear gradients, typographic letterforms crafted with custom vector paths (`path`), and overlay film grain texture with blend-modes.

```toad
// Vintage Soul Music Poster (1979 Live Recording)
// Recreated in TOAD DSL • 1000 x 1400 px (5:7 Poster Ratio)

>bgDark          = #131315;
>cream           = #d1c2aa;
>terracotta      = #8d2e24;

// Organic Warm Pillar Gradients
>gradOuter = linear-gradient(180deg, #d2c4ac 0%, #d0c0a6 16%, #c8a58e 28%, #ab5646 48%, #8d2e24 70%, #85261d 100%);
>gradInner = linear-gradient(180deg, #d2c4ac 0%, #cebe9f 10%, #bf947c 22%, #a54f40 42%, #8d2e24 64%, #85261d 100%);

canvas "Soul-Poster-1979" {
  size: 1000px 1400px;
  background: >bgDark;
  export: all;
  quality: 95;
}

// Vertical Columns with Cream Borders
path #col1Pillar {
  d: "M 18 0 L 205 0 L 205 851 L 164 851 C 64 851, 61 1008, 27 1008 L 0 1008 L 0 18 A 18 18 0 0 1 18 0 Z";
  size: 205px 1008px;
  fill: >gradOuter;
  stroke: >cream 3.5px;
  at: (45px, 35px);
}

path #col2Pillar {
  d: "M 0 0 L 279 0 L 279 963 A 139.5 139.5 0 0 0 0 963 Z";
  size: 279px 963px;
  fill: >gradInner;
  stroke: >cream 3.5px;
  at: (258px, 35px);
}

path #col3Pillar {
  d: "M 0 0 L 218 0 L 218 851 L 119 851 L 119 1010 A 10 10 0 0 1 99 1010 L 99 851 L 0 851 Z";
  size: 218px 1020px;
  fill: >gradInner;
  stroke: >cream 3.5px;
  at: (545px, 35px);
}

path #col4Pillar {
  d: "M 0 0 L 166 0 A 18 18 0 0 1 184 18 L 184 1011 L 98 1011 L 98 851 L 0 851 Z";
  size: 184px 1011px;
  fill: >gradOuter;
  stroke: >cream 3.5px;
  at: (771px, 35px);
}

// Typographic Letterforms ("SOUL")
path #letterS {
  d: "M 0 157 L 27 157 C 61 157, 64 0, 164 0 L 205 0 L 205 91 L 191 91 C 157 91, 155 248, 55 248 L 0 248 Z";
  size: 205px 248px;
  fill: >cream;
  at: (45px, 886px);
}

circle #letterO {
  size: 279px;
  fill: >cream;
  at: (258px, 858.5px);
}

circle #dotO {
  size: 62px;
  fill: >terracotta;
  at: (366.5px, 967px);
}

path #letterU {
  d: "M 0 0 L 99 0 L 99 159 A 10 10 0 0 0 119 159 L 119 0 L 218 0 L 218 139 A 109 109 0 0 1 0 139 Z";
  size: 218px 248px;
  fill: >cream;
  at: (545px, 886px);
}

path #letterL {
  d: "M 0 0 L 98 0 L 98 160 L 184 160 L 184 248 L 0 248 Z";
  size: 184px 248px;
  fill: >cream;
  at: (771px, 886px);
}

// Footer Typography & Badges
text #notesTitle {
  content: "LISTENING NOTES";
  font-family: "Arial";
  font-size: 15px;
  font-weight: 800;
  letter-spacing: 0.8px;
  color: >cream;
  at: (45px, 1332px);
}

text #notesSession {
  content: "SESSION 11";
  font-family: "Arial";
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.5px;
  color: >cream;
  at: (45px, 1354px);
}

rect #stereoBox {
  size: 58px 20px;
  fill: transparent;
  stroke: >cream 1.5px;
  radius: 2px;
  at: (897px, 1304px);
}

text #stereoText {
  content: "STEREO";
  font-family: "Arial";
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.8px;
  color: >cream;
  align: center;
  size: 58px;
  at: (897px, 1308px);
}

text #recordingText {
  content: "LIVE RECORDING";
  font-family: "Arial";
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.5px;
  color: >cream;
  align: right;
  size: 200px;
  at: (755px, 1332px);
}

text #yearText {
  content: "1979";
  font-family: "Arial";
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.5px;
  color: >cream;
  align: right;
  size: 200px;
  at: (755px, 1352px);
}

// Vintage 35mm Film Grain Texture
image #filmGrain {
  src: "./grain.png";
  size: 1000px 1400px;
  at: (0px, 0px);
  opacity: 0.22;
  blend-mode: overlay;
}
```

---

## 6. Production Masterpiece: Yusaku Kamekura Tokyo Poster (1968)

Demonstrates complex serpentine Bézier curves, paper texture masking (`mask: #shapeId`), subtle fold crease accent lines, Japanese typography (`Yu Gothic`), and geometric logo paths.

```toad
// Japanese Exhibition Poster (1968) - Yusaku Kamekura / Design Gallery 1953
// Recreated in TOAD DSL • 1000 x 1400 px

>bgPaper = #eff2f5;
>inkBlue = #1a3258;

canvas "Tokyo-Olympic-Kamekura" {
  size: 1000px 1400px;
  background: >bgPaper;
  export: all;
  quality: 95;
}

// Inner Frame Border
rect #frameBorder {
  size: 920px 1156px;
  fill: transparent;
  stroke: >inkBlue 1.5px;
  at: (40px, 40px);
}

// Main Serpentine Graphic (Deep Indigo Blue Ink Bézier Ribbon)
path #serpentineBase {
  d: "M 77.4 0.0 C 104.4 0.0, 204.8 0.0, 240.0 0.0 C 275.1 6.2, 274.6 28.9, 288.3 37.5 C 301.9 46.0, 313.6 48.4, 322.0 51.2 C 330.4 54.0, 330.4 53.8, 338.9 54.3 C 347.3 54.8, 361.4 55.8, 372.6 54.3 C 383.8 52.8, 385.5 54.2, 406.3 45.1 C 427.2 36.1, 412.1 7.5, 497.6 0.0 C 583.1 0.0, 849.0 0.0, 919.2 0.0 C 920.0 12.7, 919.9 65.6, 919.2 76.5 C 918.6 87.3, 918.9 64.3, 915.4 65.0 C 912.0 65.6, 905.9 75.2, 898.5 80.3 C 891.1 85.4, 882.7 91.2, 870.9 95.6 C 859.2 99.9, 839.5 104.5, 828.0 106.3 C 816.5 108.1, 816.2 107.5, 801.9 106.3 C 787.6 105.0, 758.0 99.9, 742.1 98.6 C 726.3 97.4, 726.8 96.8, 706.9 98.6 C 686.9 100.4, 644.5 105.5, 622.5 109.3 C 600.6 113.2, 589.6 117.0, 575.0 121.6 C 560.4 126.2, 551.2 129.2, 535.1 136.9 C 519.0 144.5, 492.2 160.6, 478.4 167.4 C 464.6 174.3, 466.6 173.8, 452.3 178.1 C 438.0 182.5, 411.7 190.6, 392.5 193.4 C 373.4 196.2, 351.1 195.2, 337.3 195.0 C 323.5 194.7, 321.5 194.2, 309.7 191.9 C 298.0 189.6, 277.8 184.5, 266.8 181.2 C 255.8 177.9, 253.5 176.6, 243.8 172.0 C 234.1 167.4, 220.7 161.4, 208.5 153.7 C 196.4 145.9, 173.1 134.7, 171.0 125.4 C 168.8 116.1, 191.5 102.8, 195.5 97.9 C 199.5 92.9, 199.2 91.4, 194.7 95.6 C 190.3 99.8, 175.1 119.3, 168.7 123.1 C 162.3 126.9, 160.4 117.9, 156.4 118.5 C 152.4 119.1, 147.1 123.7, 144.9 126.9 C 142.7 130.1, 143.1 134.8, 143.4 137.6 C 143.6 140.4, 141.7 138.5, 146.4 143.7 C 151.2 149.0, 162.2 160.7, 171.7 169.0 C 181.3 177.2, 193.2 186.3, 203.9 193.4 C 214.7 200.6, 220.8 205.4, 236.1 211.8 C 251.5 218.2, 280.3 227.6, 295.9 231.7 C 311.5 235.7, 317.7 235.5, 329.7 236.2 C 341.7 237.0, 355.7 237.0, 368.0 236.2 C 380.3 235.5, 391.3 234.2, 403.3 231.7 C 415.3 229.1, 419.4 229.1, 440.1 221.0 C 460.8 212.8, 491.2 196.5, 527.5 182.7 C 563.8 169.0, 624.3 148.8, 657.8 138.4 C 691.3 127.9, 708.7 123.3, 728.3 120.0 C 748.0 116.7, 760.3 116.7, 775.9 118.5 C 791.5 120.3, 807.6 124.6, 821.9 130.7 C 836.2 136.9, 851.9 147.9, 861.7 155.2 C 871.6 162.5, 874.6 166.8, 880.9 174.3 C 887.2 181.8, 894.4 191.9, 899.3 200.3 C 904.2 208.7, 907.5 217.1, 910.0 224.8 C 912.6 232.4, 913.4 242.4, 914.6 246.2 C 915.9 250.0, 916.9 249.2, 917.7 247.7 C 918.5 246.2, 919.0 221.7, 919.2 237.0 C 919.5 252.3, 919.5 327.5, 919.2 339.5 C 919.0 351.4, 918.5 313.7, 917.7 308.9 C 916.9 304.0, 915.7 307.3, 914.6 310.4 C 913.6 313.5, 914.4 319.3, 911.6 327.2 C 908.8 335.1, 902.4 349.4, 897.8 357.8 C 893.2 366.2, 890.2 370.4, 884.0 377.7 C 877.7 385.0, 868.0 394.9, 860.2 401.4 C 852.4 407.9, 846.4 411.8, 837.2 416.7 C 828.0 421.5, 815.7 427.1, 805.0 430.4 C 794.3 433.8, 787.9 435.3, 772.8 436.6 C 757.7 437.8, 729.2 435.2, 714.5 438.1 C 699.8 441.0, 689.2 451.1, 684.6 454.1 C 680.0 457.2, 684.8 456.6, 686.9 456.4 C 689.1 456.3, 687.2 453.6, 697.7 453.4 C 708.1 453.1, 734.5 452.9, 749.8 454.9 C 765.1 456.9, 779.2 462.0, 789.7 465.6 C 800.1 469.2, 804.2 471.5, 812.7 476.3 C 821.1 481.2, 831.5 487.7, 840.3 494.7 C 849.1 501.7, 858.8 511.1, 865.6 518.4 C 872.3 525.6, 875.3 529.3, 880.9 538.2 C 886.5 547.2, 893.9 557.6, 899.3 571.9 C 904.7 586.2, 910.8 608.3, 913.1 623.9 C 915.4 639.4, 913.6 655.0, 913.1 665.2 C 912.6 675.4, 912.1 676.6, 910.0 685.0 C 908.0 693.4, 904.7 705.9, 900.8 715.6 C 897.0 725.3, 892.4 734.2, 887.0 743.1 C 881.7 752.1, 875.7 760.9, 868.6 769.1 C 861.6 777.4, 855.0 784.8, 844.9 792.8 C 834.8 800.9, 819.3 811.2, 808.1 817.3 C 796.8 823.4, 820.8 817.3, 777.4 829.5 C 734.0 841.8, 595.4 878.7, 547.4 890.7 C 499.4 902.7, 514.9 899.1, 489.1 901.4 C 463.3 903.7, 417.1 904.7, 392.5 904.5 C 368.0 904.2, 362.1 903.2, 341.9 899.9 C 321.7 896.6, 295.2 891.7, 271.4 884.6 C 247.6 877.4, 214.7 861.9, 199.3 857.1 C 184.0 852.2, 186.3 854.3, 179.4 855.5 C 172.5 856.8, 163.7 861.0, 157.9 864.7 C 152.2 868.4, 148.1 873.2, 144.9 877.7 C 141.7 882.2, 139.8 885.3, 138.8 891.5 C 137.7 897.6, 137.7 908.3, 138.8 914.4 C 139.8 920.5, 142.2 924.0, 144.9 928.2 C 147.6 932.4, 149.4 935.9, 154.9 939.6 C 160.4 943.3, 160.0 947.8, 177.9 950.3 C 195.8 952.9, 234.9 954.4, 262.2 954.9 C 289.5 955.4, 317.1 954.7, 341.9 953.4 C 366.7 952.1, 387.9 950.1, 410.9 947.3 C 433.9 944.5, 453.1 941.9, 479.9 936.6 C 506.8 931.2, 546.9 921.8, 571.9 915.2 C 597.0 908.5, 607.2 905.0, 630.2 896.8 C 653.2 888.7, 688.0 872.1, 709.9 866.2 C 731.9 860.4, 747.5 861.4, 762.1 861.6 C 776.6 861.9, 787.4 865.2, 797.3 867.8 C 807.3 870.3, 813.4 872.9, 821.9 876.9 C 830.3 881.0, 840.3 886.9, 847.9 892.2 C 855.6 897.6, 861.4 902.6, 867.9 909.1 C 874.4 915.5, 881.0 922.4, 887.0 931.2 C 893.0 940.0, 898.9 948.4, 903.9 961.8 C 908.9 975.2, 914.6 1060.9, 916.9 1011.5 C 919.2 962.1, 917.3 700.2, 917.7 665.2 C 918.1 630.1, 919.1 719.6, 919.2 801.2 C 919.4 882.9, 918.9 1116.4, 918.5 1155.2 C 918.1 1156.0, 918.3 1048.3, 916.9 1034.4 C 915.5 1020.5, 913.5 1060.3, 910.0 1071.9 C 906.6 1083.5, 900.8 1095.1, 896.2 1104.0 C 891.6 1112.9, 890.0 1116.9, 882.4 1125.4 C 874.9 1134.0, 920.0 1150.3, 851.0 1155.2 C 712.1 1156.0, 182.2 1156.0, 49.1 1155.2 C 0.0 1154.2, 47.3 1153.7, 52.1 1149.1 C 57.0 1144.5, 68.5 1134.3, 78.2 1127.7 C 87.9 1121.1, 100.9 1113.9, 110.4 1109.4 C 119.9 1104.8, 124.5 1102.7, 134.9 1100.2 C 145.4 1097.6, 162.5 1095.1, 173.3 1094.1 C 184.0 1093.1, 190.4 1093.3, 199.3 1094.1 C 208.3 1094.8, 223.4 1091.5, 226.9 1098.7 C 230.5 1105.8, 220.3 1136.6, 220.8 1136.9 C 221.3 1137.1, 215.4 1103.8, 230.0 1100.2 C 244.6 1096.6, 281.4 1111.7, 308.2 1115.5 C 335.0 1119.3, 366.5 1121.9, 391.0 1123.1 C 415.5 1124.4, 426.5 1125.2, 455.4 1123.1 C 484.3 1121.1, 535.1 1115.5, 564.3 1110.9 C 593.4 1106.3, 606.2 1102.5, 630.2 1095.6 C 654.2 1088.7, 686.2 1078.0, 708.4 1069.6 C 730.6 1061.2, 753.0 1050.6, 763.6 1045.1 C 774.2 1039.7, 770.1 1039.9, 772.0 1036.7 C 774.0 1033.5, 775.1 1029.8, 775.1 1026.0 C 775.1 1022.2, 774.0 1017.2, 772.0 1013.8 C 770.1 1010.4, 766.0 1007.3, 763.6 1005.4 C 761.2 1003.5, 760.5 1002.8, 757.5 1002.3 C 754.4 1001.8, 756.2 998.8, 745.2 1002.3 C 734.2 1005.9, 713.8 1015.8, 691.5 1023.7 C 669.3 1031.6, 645.0 1040.8, 611.8 1049.7 C 578.6 1058.6, 530.3 1070.4, 492.2 1077.3 C 454.1 1084.1, 422.4 1088.0, 383.3 1091.0 C 344.2 1094.1, 294.1 1095.9, 257.6 1095.6 C 221.1 1095.3, 180.0 1090.9, 164.1 1089.5 C 148.1 1088.1, 161.4 1092.2, 161.8 1087.2 C 162.2 1082.2, 165.7 1066.9, 166.4 1059.7 C 167.0 1052.4, 167.0 1038.9, 165.6 1043.6 C 164.2 1048.3, 165.3 1081.8, 157.9 1088.0 C 150.5 1094.1, 135.7 1086.2, 121.1 1080.3 C 106.6 1074.4, 85.7 1064.4, 70.5 1052.8 C 55.3 1041.2, 39.7 1023.1, 29.9 1010.7 C 20.1 998.4, 16.1 988.8, 11.5 978.6 C 6.9 968.4, 4.2 954.3, 2.3 949.6 C 0.4 944.9, 0.4 965.5, 0.0 950.3 C 0.0 935.2, 0.0 880.6, 0.0 858.6 C 2.7 836.5, 9.6 830.4, 16.1 818.1 C 22.6 805.7, 30.8 794.5, 39.1 784.4 C 47.4 774.4, 54.3 766.5, 65.9 757.7 C 77.6 748.9, 96.6 737.8, 108.9 731.7 C 121.1 725.6, 129.6 723.5, 139.5 721.0 C 149.5 718.4, 157.2 717.1, 168.7 716.4 C 180.2 715.6, 197.8 715.6, 208.5 716.4 C 219.3 717.1, 225.3 718.8, 233.1 721.0 C 240.9 723.1, 253.8 721.5, 255.3 729.4 C 256.8 737.3, 241.4 768.2, 242.3 768.4 C 243.2 768.5, 249.9 733.5, 260.7 730.1 C 271.4 726.8, 290.1 743.4, 306.7 748.5 C 323.3 753.6, 343.5 757.9, 360.3 760.7 C 377.2 763.5, 389.5 765.1, 407.9 765.3 C 426.3 765.6, 451.1 764.6, 470.7 762.3 C 490.4 760.0, 481.5 762.8, 525.9 751.6 C 570.4 740.3, 700.0 705.7, 737.5 695.0 C 775.1 684.3, 747.4 690.3, 751.3 687.3 C 755.3 684.4, 757.9 683.6, 761.3 677.4 C 764.8 671.1, 770.8 658.0, 772.0 649.9 C 773.3 641.7, 771.9 635.7, 769.0 628.5 C 766.0 621.2, 760.7 612.0, 754.4 606.3 C 748.1 600.6, 739.6 596.1, 731.4 594.1 C 723.2 592.0, 712.7 592.5, 705.3 594.1 C 697.9 595.6, 700.2 592.8, 686.9 603.2 C 673.6 613.7, 643.2 643.2, 625.6 656.7 C 608.0 670.3, 594.9 676.6, 581.1 684.3 C 567.3 691.9, 557.1 696.8, 542.8 702.6 C 528.5 708.5, 512.6 714.6, 495.3 719.4 C 477.9 724.3, 452.6 729.1, 438.5 731.7 C 424.5 734.2, 426.5 734.2, 410.9 734.7 C 395.3 735.2, 365.4 736.0, 345.0 734.7 C 324.6 733.5, 309.7 731.9, 288.3 727.1 C 266.8 722.2, 239.7 715.1, 216.2 705.7 C 192.7 696.3, 167.9 683.3, 147.2 670.5 C 126.5 657.8, 107.5 642.3, 92.0 629.2 C 76.5 616.1, 65.6 604.1, 54.4 591.8 C 43.3 579.4, 32.7 565.8, 25.3 555.1 C 17.9 544.4, 14.2 536.6, 10.0 527.5 C 5.8 518.5, 1.7 517.0, 0.0 500.8 C 0.0 484.6, 0.0 449.7, 0.0 430.4 C 3.2 411.2, 13.7 396.2, 19.2 385.3 C 24.7 374.5, 25.7 373.5, 33.0 365.5 C 40.2 357.4, 54.1 344.2, 62.9 337.2 C 71.7 330.2, 75.8 327.9, 85.9 323.4 C 96.0 318.9, 124.5 318.3, 123.4 310.4 C 122.4 302.5, 94.6 289.5, 79.7 276.0 C 64.9 262.5, 45.1 242.0, 34.5 229.4 C 23.9 216.8, 21.5 212.3, 16.1 200.3 C 10.7 188.3, 4.6 172.5, 2.3 157.5 C 0.0 142.5, 0.0 125.1, 2.3 110.1 C 4.6 95.1, 11.8 78.0, 16.1 67.3 C 20.4 56.6, 23.8 52.5, 28.4 45.9 C 33.0 39.2, 35.4 35.0, 43.7 27.5 C 52.0 20.0, 72.6 5.4, 78.2 0.8 C 83.8 0.0, 50.5 0.1, 77.4 0.0 Z";
  size: 920px 1156px;
  fill: >inkBlue;
  at: (40px, 40px);
}

// Paper Texture & Mottled Ink Wash (Clipped to Serpentine Ribbon)
image #serpentinePaperTexture {
  src: "./paper_texture.png";
  size: 1000px 1400px;
  at: (0px, 0px);
  opacity: 0.65;
  blend-mode: overlay;
  mask: #serpentineBase;
}

// Internal cutout channels
path #crescentHole1 {
  d: "M 749.8 259.2 C 731.1 264.5, 679.5 277.0, 639.4 291.3 C 599.3 305.6, 531.7 336.0, 509.1 344.8 C 486.5 353.6, 507.8 351.2, 503.7 344.0 C 499.6 336.9, 487.9 308.4, 484.5 302.0 C 481.2 295.6, 481.1 298.8, 483.8 305.8 C 486.5 312.8, 498.2 336.8, 500.6 344.0 C 503.1 351.3, 511.2 344.9, 498.3 349.4 C 485.4 353.9, 447.0 366.2, 423.2 370.8 C 399.4 375.4, 369.9 375.8, 355.7 376.9 C 341.6 378.1, 337.3 376.4, 338.1 377.7 C 338.9 379.0, 346.4 382.1, 360.3 384.6 C 374.3 387.0, 401.0 391.7, 421.7 392.2 C 442.4 392.7, 466.9 390.2, 484.5 387.6 C 502.2 385.1, 510.9 382.8, 527.5 376.9 C 544.1 371.1, 566.8 361.6, 584.2 352.5 C 601.6 343.3, 618.7 329.3, 631.7 321.9 C 644.8 314.5, 649.6 312.2, 662.4 308.1 C 675.2 304.0, 691.8 299.2, 708.4 297.4 C 725.0 295.6, 752.1 297.9, 762.1 297.4 C 772.0 296.9, 765.8 296.8, 768.2 294.4 C 770.6 291.9, 775.5 287.1, 776.6 282.9 C 777.8 278.7, 777.3 273.1, 775.1 269.1 C 772.9 265.2, 767.6 260.8, 763.6 259.2 C 759.6 257.5, 753.6 259.2, 751.3 259.2 C 749.0 259.2, 768.5 253.8, 749.8 259.2 Z";
  size: 920px 1156px;
  fill: >bgPaper;
  at: (40px, 40px);
}

path #crescentHole2 {
  d: "M 154.9 447.3 C 153.3 447.8, 149.6 448.4, 147.2 450.3 C 144.8 452.2, 141.5 455.3, 140.3 458.7 C 139.2 462.2, 137.7 465.4, 140.3 471.0 C 142.9 476.6, 148.1 483.6, 155.6 492.4 C 163.2 501.2, 171.4 512.1, 185.5 523.7 C 199.7 535.3, 221.1 551.5, 240.7 561.9 C 260.4 572.4, 282.6 580.8, 303.6 586.4 C 324.6 592.0, 345.8 594.8, 366.5 595.6 C 387.2 596.3, 407.9 594.6, 427.8 591.0 C 447.7 587.4, 467.2 582.1, 486.1 574.2 C 505.0 566.3, 526.7 553.0, 541.3 543.6 C 555.8 534.2, 566.6 524.0, 573.5 517.6 C 580.4 511.2, 592.6 504.1, 582.7 505.4 C 572.7 506.6, 533.1 520.9, 513.7 525.2 C 494.2 529.6, 485.8 530.3, 466.1 531.4 C 446.5 532.4, 412.2 531.9, 395.6 531.4 C 379.0 530.9, 382.1 531.1, 366.5 528.3 C 350.9 525.5, 318.2 518.6, 302.1 514.5 C 286.0 510.5, 284.9 510.0, 269.9 503.8 C 254.8 497.7, 229.0 487.0, 211.6 477.8 C 194.2 468.7, 174.8 453.9, 165.6 448.8 C 156.4 443.7, 158.2 447.5, 156.4 447.3 C 154.6 447.0, 156.4 446.8, 154.9 447.3 Z";
  size: 920px 1156px;
  fill: >bgPaper;
  at: (40px, 40px);
}

// Fold Crease Lines
path #creaseTopLeft {
  d: "M 175 130 L 215 95";
  size: 920px 1156px;
  stroke: >bgPaper 1.8px;
  at: (40px, 40px);
}

// Exhibition Typography (Japanese Yu Gothic)
text #categoryText {
  content: "第48回 デザインギャラリー展";
  font-family: "Yu Gothic";
  font-size: 15px;
  font-weight: 500;
  color: >inkBlue;
  at: (42px, 1238px);
}

text #titleText {
  content: "東京オリンピックの公式ポスタ (亀倉 雄策)";
  font-family: "Yu Gothic";
  font-size: 30px;
  font-weight: bold;
  color: >inkBlue;
  letter-spacing: 0.5px;
  at: (42px, 1272px);
}

text #detailsText {
  content: "第48回　かめくら ゆうさく、1915年4月6日 - 1997年5月11日。";
  font-family: "Yu Gothic";
  font-size: 13px;
  font-weight: 400;
  color: >inkBlue;
  at: (42px, 1312px);
}

// Design Gallery Geometric Logo
circle #logoCircle {
  size: 58px;
  fill: >inkBlue;
  at: (828px, 1256px);
}

path #logoSemicircle1 {
  d: "M 0 29 A 29 29 0 0 1 29 0 L 29 58 A 29 29 0 0 1 0 29 Z";
  size: 29px 58px;
  fill: >inkBlue;
  at: (894px, 1256px);
}

path #logoSemicircle2 {
  d: "M 0 29 A 29 29 0 0 1 29 0 L 29 58 A 29 29 0 0 1 0 29 Z";
  size: 29px 58px;
  fill: >inkBlue;
  at: (931px, 1256px);
}
```

