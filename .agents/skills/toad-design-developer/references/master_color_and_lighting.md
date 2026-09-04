# Master Color and Lighting in TOAD DSL

This guide provides exhaustive recipes for implementing advanced color theories, complex lighting models, and modern UI effects using the TOAD declarative graphics engine. By combining TOAD's powerful shadow engine, filter capabilities, and alpha compositing, you can create stunning, production-ready visuals.

## 1. Professional Color Palettes

A well-structured color system is the foundation of any great UI. In TOAD, we declare these as variables and apply them dynamically.

### SaaS Dark Mode
Dark mode requires deep, rich backgrounds (not pure black) and high-contrast, vibrant accents to ensure legibility and visual hierarchy.

```toad
// SaaS Dark Mode Palette
>bg_base = #0f172a;        // Deep slate background
>bg_surface = #1e293b;     // Elevated cards
>border_subtle = #334155;  // Subtle dividers
>text_primary = #f8fafc;   // High contrast text
>text_muted = #94a3b8;     // Secondary text
>accent_brand = #3b82f6;   // Vibrant blue CTA
>accent_glow = alpha(>accent_brand, 0.4);

rect #dashboardBackground {
    size: 100% 100%;
    fill: >bg_base;
}

rect #card {
    size: 400px 300px;
    at: center of #dashboardBackground;
    fill: >bg_surface;
    radius: 16px;
    stroke: >border_subtle 1px;
    shadow: 0 10px 30px alpha(#000000, 0.5);
}
```

### E-commerce Light Mode
Clean, high-trust, and accessible. Relies on pure whites, ultra-light grays, and bold primary colors for conversion actions.

```toad
// E-commerce Light Mode Palette
>eco_bg = #f8fafc;
>eco_surface = #ffffff;
>eco_text = #0f172a;
>eco_muted = #64748b;
>eco_primary = #10b981;    // High-trust emerald green
>eco_danger = #ef4444;

rect #productCard {
    size: 300px 450px;
    fill: >eco_surface;
    radius: 12px;
    shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}
```

### Pastel / Playful
Soft, desaturated, and inviting. Uses high lightness and low saturation.

```toad
// Pastel Palette
>pastel_bg = #fff5f5;
>pastel_pink = #fed7aa;
>pastel_blue = #bfdbfe;
>pastel_green = #bbf7d0;

rect #playfulButton {
    size: 160px 50px;
    fill: >pastel_pink;
    radius: 25px;
    shadow: 0 8px 16px alpha(>pastel_pink, 0.4);
}
```

## 2. Multi-stop Gradients

TOAD supports linear, radial, and conic gradients with alpha compositing and multiple color stops.

### Linear Gradient with Transparency
```toad
rect #gradientHero {
    size: 800px 400px;
    // Fades from a solid brand color to completely transparent
    fill: linear-gradient(135deg, #8b5cf6 0%, alpha(#8b5cf6, 0.5) 50%, transparent 100%);
    radius: 24px;
}
```

### Radial & Conic Gradients
```toad
rect #radialOrb {
    size: 200px 200px;
    radius: 100px;
    fill: radial-gradient(circle, #38bdf8 0%, #0369a1 70%, #0f172a 100%);
}

rect #conicSpinner {
    size: 200px 200px;
    radius: 100px;
    // Rendered via Skia createConicGradient() in raster; 60-wedge fan in SVG
    fill: conic-gradient(from 0deg, #f43f5e, #8b5cf6, #06b6d4, #f43f5e);
}
```

## 3. Neumorphism (Soft UI)

Neumorphism simulates physical extrusion from the background surface using directional drop shadows and inner shadows. The surface color should match the underlying background color.

```toad
>neu_bg = #e0e5ec;
>neu_dark_shadow = rgba(163, 177, 198, 0.6);

rect #neuBackground {
    size: 100% 100%;
    fill: >neu_bg;
}

rect #neuButton {
    size: 120px 120px;
    at: center of #neuBackground;
    fill: >neu_bg;
    radius: 24px;
    // Soft extruded drop shadow
    shadow: 8px 8px 16px >neu_dark_shadow;
}

rect #neuPressed {
    size: 120px 120px;
    at: right of #neuButton offset 40px;
    fill: >neu_bg;
    radius: 24px;
    // Inset shadow simulates a pressed physical indentation
    inner-shadow: 6px 6px 12px >neu_dark_shadow;
}
```

## 4. Advanced Glassmorphism

Glassmorphism creates a frosted glass effect using background blurs, low opacity fills, and specular highlights (subtle white strokes).

```toad
>glass_fill = rgba(255, 255, 255, 0.1);
>glass_stroke = rgba(255, 255, 255, 0.25);

// A colorful background to demonstrate the blur
rect #colorfulBg {
    size: 600px 400px;
    fill: linear-gradient(45deg, #f43f5e 0%, #8b5cf6 100%);
}

circle #floatingOrb {
    size: 150px;
    at: center of #colorfulBg offset -100px -50px;
    fill: #38bdf8;
}

// The Glass Panel
rect #glassCard {
    size: 400px 250px;
    at: center of #colorfulBg;
    fill: >glass_fill;
    stroke: >glass_stroke 1.5px;
    radius: 24px;
    
    // Soft ambient shadow to lift it off the background
    shadow: 0 24px 40px rgba(0, 0, 0, 0.2);
}
```

## 5. Neon / Glow Effects

Neon effects combine ultra-bright accent colors with outer glows and drop shadows against dark backgrounds to simulate light emission.

```toad
>dark_void = #050505;
>neon_cyan = #00f3ff;
>neon_pink = #ff007f;

rect #nightBg {
    size: 800px 600px;
    fill: >dark_void;
}

// Cyan Neon Sign Outline
rect #neonBox {
    size: 300px 150px;
    at: center of #nightBg offset -200px 0;
    fill: transparent;
    stroke: >neon_cyan 3px;
    radius: 12px;
    
    // Outer glow for ambient radiation
    glow: 0 0 30px alpha(>neon_cyan, 0.8);
    shadow: 0 0 10px >neon_cyan;
}

// Pink Glowing Orb
circle #neonOrb {
    size: 100px;
    at: center of #nightBg offset 200px 0;
    fill: >neon_pink;
    
    // Intense glow effect
    glow: 0 0 40px alpha(>neon_pink, 0.9);
}
```

## Mathematical & UX Theory Notes

- **Contrast Ratios:** When designing SaaS Dark Modes, ensure text contrast ratios exceed 4.5:1 (WCAG AA). Avoid pure white (`#fff`) on pure black (`#000`) to prevent astigmatism halation; use `#f8fafc` on `#0f172a` instead.
- **Shadow Physics:** Realistic drop shadows in TOAD should use larger blur radii and lower opacities as the Y-offset increases, simulating a softer, more diffuse light source further away.
- **Neumorphic Light Angles:** Always pick a single directional light source (e.g., top-left at 315°). If the light shadow is top-left, the dark shadow must be bottom-right.
- **Alpha vs Opacity:** Prefer using TOAD's `alpha(#color, 0.5)` function or `rgba()` for backgrounds instead of node `opacity`, as node opacity makes children transparent too. 
