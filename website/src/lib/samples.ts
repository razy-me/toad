export interface SampleProject {
  id: string;
  name: string;
  category: string;
  description: string;
  dimensions: string;
  code: string;
  previewSvg: string;
  previewImg: string;
  layers: { name: string; type: string; effects?: string[] }[];
}

export const SAMPLES: SampleProject[] = [
  {
    id: 'master-logo',
    name: 'Official Cyber-Toad Logo',
    category: 'Brand & Identity',
    dimensions: '1200 × 540',
    description: 'The authoritative TOAD corporate emblem featuring squircle bounding boxes, optical sensors, and code prompt chevron.',
    previewImg: '/brand/logo-master-logo.png',
    previewSvg: '/brand/logo-master-logo.svg',
    code: `// TOAD DSL — Official Master Logo
>bg_void        = #07090e;
>emerald_neon   = #10b981;
>toxic_lime     = #ccff00;
>cyber_cyan     = #38bdf8;
>text_pure      = #ffffff;

canvas "Master-Logo" {
    size: 1200px 540px;
    background: >bg_void;
    export: all;

    stack #logoRoot {
        direction: horizontal;
        gap: 56px;
        size: hug hug;
        at: center of canvas;

        // Cyber-Toad Emblem
        group #emblemContainer {
            size: 180px 180px;

            rect #base {
                size: 180px 180px;
                radius: 40px;
                fill: #0d1322;
                stroke: #1e293b 2px;
                shadow: 0px 20px 50px rgba(16, 185, 129, 0.25);
            }

            rect #head {
                size: 120px 76px;
                radius: 24px;
                fill: linear-gradient(135deg, #10b981 0%, #059669 100%);
                at: center of #base offset (0px, 14px);
            }

            circle #leftEye {
                size: 42px;
                fill: #0d1322;
                stroke: #10b981 3px;
                at: center of #base offset (-32px, -24px);
            }
            circle #leftPupil {
                size: 20px;
                fill: >toxic_lime;
                at: center of #leftEye;
                shadow: 0px 0px 12px #ccff00;
            }

            circle #rightEye {
                size: 42px;
                fill: #0d1322;
                stroke: #10b981 3px;
                at: center of #base offset (32px, -24px);
            }
            circle #rightPupil {
                size: 20px;
                fill: >toxic_lime;
                at: center of #rightEye;
                shadow: 0px 0px 12px #ccff00;
            }

            text #prompt {
                content: ">_";
                font-size: 22px;
                font-weight: 900;
                color: #07090e;
                at: center of #head offset (0px, -2px);
            }
        }

        // Typography Lockup
        stack #wordmark {
            direction: vertical;
            gap: 6px;
            at: center y of #emblemContainer;

            text #brandName {
                content: "toad";
                font-size: 104px;
                font-weight: 900;
                color: >text_pure;
                letter-spacing: -3.5px;
            }

            text #subline {
                content: "DECLARATIVE DESIGN DSL";
                font-size: 17px;
                font-weight: 700;
                color: >emerald_neon;
                letter-spacing: 7px;
            }
        }
    }
}`,
    layers: [
      { name: 'Wordmark / Subline', type: 'Type Layer', effects: ['Color Overlay'] },
      { name: 'Wordmark / BrandName', type: 'Type Layer', effects: ['Drop Shadow'] },
      { name: 'Emblem / Prompt', type: 'Type Layer' },
      { name: 'Emblem / Pupils', type: 'Vector Shape', effects: ['Outer Glow'] },
      { name: 'Emblem / Eyes', type: 'Vector Shape', effects: ['Stroke'] },
      { name: 'Emblem / Head', type: 'Vector Shape', effects: ['Gradient Fill'] },
      { name: 'Emblem / Base', type: 'Vector Shape', effects: ['Drop Shadow', 'Stroke'] }
    ]
  },
  {
    id: 'social-card',
    name: 'OpenGraph Social Card',
    category: 'Marketing & Web',
    dimensions: '1200 × 630',
    description: 'Dynamic social media card with grid accents, component slots, and relational badge badges.',
    previewImg: '/fixtures/social_card.png',
    previewSvg: '/fixtures/social_card.svg',
    code: `// OpenGraph Social Card Preset
>bg_dark  = #0f172a;
>primary  = #38bdf8;
>accent   = #10b981;

canvas "OG-Card" {
    preset: og-image; // 1200x630
    background: >bg_dark;
    export: all;

    rect #heroGlow {
        size: 500px 500px;
        radius: 250px;
        fill: radial-gradient(circle, rgba(56, 189, 248, 0.15) 0%, transparent 70%);
        at: center of canvas offset (200px, -100px);
    }

    stack #content {
        direction: vertical;
        gap: 24px;
        at: top left of canvas offset (80px, 80px);
        size: 900px hug;

        rect #badge {
            size: hug hug;
            padding: 8px 16px;
            radius: 999px;
            fill: rgba(16, 185, 129, 0.1);
            stroke: >accent 1px;

            text {
                content: "v1.0 COMPILER RELEASE";
                font-size: 14px;
                font-weight: 700;
                color: >accent;
                letter-spacing: 1.5px;
            }
        }

        text #title {
            content: "Declarative Graphic Design for Developers.";
            font-size: 64px;
            font-weight: 800;
            color: #ffffff;
            line-height: 1.1;
            letter-spacing: -1.5px;
        }

        text #desc {
            content: "Turn pure text into layered Photoshop files, crisp multi-scale PNGs, and scalable SVG vectors with an automated CI/CD pipeline.";
            font-size: 22px;
            color: #94a3b8;
            line-height: 1.4;
        }
    }
}`,
    layers: [
      { name: 'Content / Desc', type: 'Type Layer' },
      { name: 'Content / Title', type: 'Type Layer', effects: ['Drop Shadow'] },
      { name: 'Content / Badge', type: 'Vector Shape', effects: ['Stroke', 'Solid Color'] },
      { name: 'Background / Hero Glow', type: 'Vector Shape', effects: ['Radial Gradient Fill'] }
    ]
  },
  {
    id: 'product-banner',
    name: 'SaaS Launch Hero Banner',
    category: 'Product & SaaS',
    dimensions: '1920 × 1080',
    description: 'High-resolution showcase banner with 2D skew transformations, glassmorphism cards, and metric pills.',
    previewImg: '/fixtures/product_banner.png',
    previewSvg: '/fixtures/product_banner.png',
    code: `// High-Resolution 1080p Marketing Banner
>bg_main = #07090e;
>neon_cyan = #38bdf8;
>toxic_lime = #ccff00;

canvas "Product-Hero" {
    size: 1920px 1080px;
    background: >bg_main;
    export: all;

    grid #featureMatrix {
        columns: 3;
        gap: 32px;
        at: center of canvas;
        size: 1400px hug;

        // Card 1
        group #c1 {
            rect {
                size: 100% 320px;
                radius: 20px;
                fill: #0f172a;
                stroke: rgba(255, 255, 255, 0.1) 1px;
                shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
            }
            text {
                at: top left of parent offset (32px, 32px);
                content: "01 / NATIVE PSD";
                font-size: 16px;
                font-weight: 700;
                color: >neon_cyan;
            }
            text {
                at: below previous offset 16px;
                content: "True Bézier Vector Masks & Layer FX";
                font-size: 28px;
                font-weight: 800;
                color: #ffffff;
            }
        }
    }
}`,
    layers: [
      { name: 'Feature Matrix / Card 1 / Title', type: 'Type Layer' },
      { name: 'Feature Matrix / Card 1 / Label', type: 'Type Layer' },
      { name: 'Feature Matrix / Card 1 / Surface', type: 'Vector Shape', effects: ['Drop Shadow', 'Stroke'] }
    ]
  },
  {
    id: 'mobile-mockup',
    name: 'Mobile App Device Artboard',
    category: 'UI/UX Design',
    dimensions: '430 × 932',
    description: 'Mobile screen prototype with system status bar, notch dynamic island, and floating tab bar.',
    previewImg: '/fixtures/mobile_mockup.png',
    previewSvg: '/fixtures/mobile_mockup.svg',
    code: `// Mobile App Artboard (iPhone 15 Pro)
>bg_app = #000000;
>emerald = #10b981;

canvas "Mobile-App" {
    size: 430px 932px;
    background: >bg_app;
    export: all;

    // Dynamic Island
    rect #island {
        size: 120px 35px;
        radius: 18px;
        fill: #1a1a1a;
        at: top center of canvas offset (0px, 12px);
    }

    // App Header
    text #title {
        at: top left of canvas offset (24px, 70px);
        content: "Design Tokens";
        font-size: 34px;
        font-weight: 800;
        color: #ffffff;
    }
}`,
    layers: [
      { name: 'Header / Title', type: 'Type Layer' },
      { name: 'System / Dynamic Island', type: 'Vector Shape', effects: ['Solid Color'] }
    ]
  }
];
