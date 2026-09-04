# Master Complex Layouts

This guide provides advanced TOAD DSL recipes for building sophisticated, production-grade layouts. It covers grid systems, asymmetrical designs, bento boxes, fluid wrapping, and complex relational anchoring.

## 1. 12-Column Grid Systems

While TOAD's `grid` element offers equal-width columns via the `columns` property, you can create a flexible proportional grid layout using a horizontal stack with percentage-based sizing.

```toad
>bg = #0f172a;
>colBg = #1e293b;

canvas { size: 1200px 800px; fill: >bg; }

stack #grid12 {
    direction: horizontal;
    gap: 16px;
    padding: 32px;
    size: 100% hug;
    at: top-left of canvas;

    // 3-column span (~25%)
    rect #col3 {
        size: 25% 200px;
        fill: >colBg;
        radius: 8px;
    }

    // 6-column span (50%)
    rect #col6 {
        size: 50% 200px;
        fill: >colBg;
        radius: 8px;
    }

    // 3-column span (~25%)
    rect #col3_2 {
        size: 25% 200px;
        fill: >colBg;
        radius: 8px;
    }
}
```

## 2. Asymmetrical Hero Sections

Combining a left-aligned text stack with a right-aligned absolute composition creates a stunning asymmetrical hero section.

```toad
>textPrimary = #ffffff;
>textSecondary = #94a3b8;
>accent = #3b82f6;

canvas { size: 1440px 900px; fill: #0f172a; }

// Left Text Stack
stack #heroContent {
    direction: vertical;
    gap: 24px;
    size: 500px hug;
    at: (120px, 250px);

    text {
        content: "Build Faster.\nScale Better.";
        color: >textPrimary;
        font-size: 72px;
        font-weight: 800;
        line-height: 1.1;
    }

    text {
        content: "The ultimate declarative design tool for developers. Compile layout to pixels instantly.";
        color: >textSecondary;
        font-size: 20px;
        line-height: 1.5;
        size: 100% auto; // Wrap text
    }

    // CTA Button
    stack #cta {
        direction: horizontal;
        padding: 16px 32px;
        size: hug hug;
        
        rect { size: 100% 100%; fill: >accent; radius: 8px; at: top-left of parent; }
        
        text {
            content: "Get Started";
            color: #ffffff;
            font-size: 18px;
            font-weight: 600;
        }
    }
}

// Right Asymmetrical Composition
group #heroVisual {
    at: (750px, 150px);
    
    rect #backdrop {
        size: 500px 600px;
        fill: linear-gradient(135deg, #1e293b, #0f172a);
        radius: 24px;
        rotation: 45deg;
        at: (50px, 0px);
    }
    
    rect #frontCard {
        size: 400px 500px;
        fill: rgba(255, 255, 255, 0.05);
        radius: 16px;
        stroke: rgba(255, 255, 255, 0.1) 1px solid;
        at: center of #backdrop;
    }
}
```

## 3. Bento Box Dashboards

Bento grids use nested horizontal and vertical stacks to create complex interlocking sections. Use `fill` to make inner components stretch correctly.

```toad
canvas { size: 1200px 900px; fill: #000000; }

>cardBg = #111111;

stack #bentoContainer {
    direction: vertical;
    gap: 20px;
    padding: 40px;
    size: 100% 100%;
    at: top-left of canvas;

    // Top Row
    stack #topRow {
        direction: horizontal;
        gap: 20px;
        size: fill 400px; // 400px height, fill width

        rect #mainFeature {
            size: fill 100%; // Takes up remaining width
            fill: >cardBg;
            radius: 24px;
        }

        stack #sideStats {
            direction: vertical;
            gap: 20px;
            size: 300px 100%; // Fixed width

            rect #stat1 { size: fill fill; fill: >cardBg; radius: 24px; }
            rect #stat2 { size: fill fill; fill: >cardBg; radius: 24px; }
        }
    }

    // Bottom Row
    stack #bottomRow {
        direction: horizontal;
        gap: 20px;
        size: fill fill; // Fills remaining height

        rect #moduleA { size: 300px 100%; fill: >cardBg; radius: 24px; }
        rect #moduleB { size: fill 100%; fill: >cardBg; radius: 24px; }
        rect #moduleC { size: 300px 100%; fill: >cardBg; radius: 24px; }
    }
}
```

## 4. Responsive-like Fluid Wrapping

By mixing `%` sizes, `fill`, and `hug`, layouts gracefully adapt to container dimensions.

```toad
canvas { size: 1000px 1000px; fill: #ffffff; }

stack #fluidCard {
    direction: vertical;
    padding: 32px;
    gap: 24px;
    size: 50% hug; // Fluid width based on parent/canvas
    at: center of canvas;
    
    rect {
        size: 100% 100%;
        fill: #f8fafc;
        radius: 16px;
        at: top-left of parent;
        stroke: #e2e8f0 1px solid;
    }

    rect #imagePlaceholder {
        size: 100% 240px; // Fixed height, fluid width
        fill: #cbd5e1;
        radius: 8px;
    }

    text {
        content: "Fluid Container";
        color: #0f172a;
        font-size: 24px;
        font-weight: 700;
        size: 100% auto; // Wraps text fluidly
    }
}
```

## 5. Complex Absolute Anchoring & Relational Logic

Mix `at:` relational anchors with auto-layout stacks to break out of grid confines (e.g., overlapping badges, tooltips).

```toad
canvas { size: 800px 600px; fill: #e2e8f0; }

stack #profileCard {
    direction: horizontal;
    gap: 16px;
    padding: 24px;
    size: 400px hug;
    at: center of canvas;
    
    rect { size: 100% 100%; fill: #ffffff; radius: 12px; at: top-left of parent; }

    circle #avatar {
        size: 64px 64px;
        fill: #3b82f6;
    }

    stack #userInfo {
        direction: vertical;
        gap: 4px;
        size: fill hug;
        
        text { content: "Jane Doe"; color: #0f172a; font-size: 18px; font-weight: 600; }
        text { content: "Lead Designer"; color: #64748b; font-size: 14px; }
    }
}

// Absolute overlapping badge anchored to the avatar inside the stack
rect #statusBadge {
    size: 16px 16px;
    fill: #10b981; // Green
    radius: 8px;
    stroke: #ffffff 2px solid;
    at: bottom-right of #avatar offset -4px; // Break out of stack flow
}

// Floating tooltip positioned relative to the card
stack #tooltip {
    direction: horizontal;
    padding: 8px 12px;
    size: hug hug;
    at: above #profileCard offset 12px;
    
    rect { size: 100% 100%; fill: #1e293b; radius: 6px; at: top-left of parent; }
    
    text {
        content: "Active now";
        color: #ffffff;
        font-size: 12px;
    }
}
```
