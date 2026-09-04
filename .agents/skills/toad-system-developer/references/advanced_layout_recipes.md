# Advanced Layout Recipes in TOAD

When asked to create complex UIs, use these advanced layout strategies instead of basic absolute positioning.

## 1. Bento Box Grids
Bento layouts in TOAD are composed using nested `stack` and `grid` containers:

```toad
stack #bentoRoot {
    direction: vertical;
    gap: 20px;
    size: 960px hug;
    at: center of canvas;

    // Top Featured Row (Hero Card + Side Metric)
    stack #topRow {
        direction: horizontal;
        gap: 20px;
        size: 100% hug;

        rect #heroCard {
            size: 620px 320px;
            fill: #1e293b;
            radius: 16px;
            shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
        }

        rect #sideCard {
            size: 320px 320px;
            fill: #3b82f6;
            radius: 16px;
            shadow: 0 10px 25px rgba(59, 130, 246, 0.2);
        }
    }

    // Bottom Uniform Grid (3 columns)
    grid #bottomGrid {
        columns: 3;
        gap: 20px;
        size: 100% hug;

        rect { size: 100% 180px; fill: #1e293b; radius: 16px; }
        rect { size: 100% 180px; fill: #1e293b; radius: 16px; }
        rect { size: 100% 180px; fill: #1e293b; radius: 16px; }
    }
}
```

## 2. Glassmorphism & Translucent Fills
Combine translucent alpha fills with subtle border strokes and drop shadows:

```toad
stack #glassPanel {
    size: 400px hug;
    padding: 32px;
    radius: 24px;
    gap: 16px;
    
    // Translucent layered properties
    fill: alpha(#ffffff, 0.1);
    stroke: alpha(#ffffff, 0.25) 1px;
    shadow: 0 20px 40px alpha(#000000, 0.3);

    text {
        content: "Glassmorphism";
        font-size: 24px;
        font-weight: 700;
        color: #ffffff;
    }
}
```

## 3. Overlapping Avatars (Relational Offsets)
Use `previous` combined with negative offsets to create overlapping face piles.

```toad
group #avatarPile {
    // First avatar
    circle #av1 { size: 48px; fill: #ef4444; stroke: #1e293b 3px; }
    // Second avatar overlaps the first
    circle #av2 { 
        size: 48px; fill: #10b981; stroke: #1e293b 3px; 
        at: right of previous offset -16px; 
    }
    // Third avatar overlaps the second
    circle #av3 { 
        size: 48px; fill: #3b82f6; stroke: #1e293b 3px; 
        at: right of previous offset -16px; 
    }
}
```

## 4. Complex Clipping Masks
When you need an image or vector shape to clip inside an arbitrary shape (like a star or rounded rectangle), use the `mask:` property.

```toad
group #maskedImage {
    // The mask shape (clipping target)
    star #starMask {
        size: 200px;
        points: 5;
    }
    
    // The image being clipped
    image {
        src: "./photo.jpg";
        size: 200px 200px;
        mask: #starMask; // Masks image to the star's alpha silhouette
        fit: cover;
    }
}
```
