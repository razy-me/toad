# TOAD DSL Master UI Kit Library

This document provides fully coded, production-grade TOAD `component` definitions for a comprehensive UI kit, adhering strictly to the canonical TOAD DSL syntax and layout rules.

## Variables & Theming
```toad
>bgSurface = #ffffff;
>bgSurfaceHover = #f1f5f9;
>bgPrimary = #2563eb;
>bgPrimaryHover = #1d4ed8;
>bgDanger = #ef4444;
>textMain = #0f172a;
>textMuted = #64748b;
>textInverse = #ffffff;
>border = #e2e8f0;
>spacingXs = 4px;
>spacingSm = 8px;
>spacingMd = 16px;
>spacingLg = 24px;
```

---

## Buttons

### Primary Button
```toad
component ButtonPrimary(label = "Submit") {
    stack {
        direction: horizontal;
        padding: [10px, 20px];
        fill: >bgPrimary;
        radius: 8px;
        align: center;
        size: hug hug;

        text {
            content: >label;
            color: >textInverse;
            font-size: 14px;
            font-weight: 600;
        }
    }
}
```

### Secondary Button
```toad
component ButtonSecondary(label = "Cancel") {
    stack {
        direction: horizontal;
        padding: [10px, 20px];
        fill: >bgSurface;
        stroke: >border 1px;
        radius: 8px;
        align: center;
        size: hug hug;

        text {
            content: >label;
            color: >textMain;
            font-size: 14px;
            font-weight: 600;
        }
    }
}
```

### Ghost Button
```toad
component ButtonGhost(label = "Details") {
    stack {
        direction: horizontal;
        padding: [10px, 20px];
        fill: transparent;
        radius: 8px;
        align: center;
        size: hug hug;

        text {
            content: >label;
            color: >bgPrimary;
            font-size: 14px;
            font-weight: 600;
        }
    }
}
```

### Danger Button
```toad
component ButtonDanger(label = "Delete") {
    stack {
        direction: horizontal;
        padding: [10px, 20px];
        fill: >bgDanger;
        radius: 8px;
        align: center;
        size: hug hug;

        text {
            content: >label;
            color: >textInverse;
            font-size: 14px;
            font-weight: 600;
        }
    }
}
```

### Icon-Only Button
```toad
component ButtonIcon(icon = "settings") {
    group {
        size: 36px 36px;

        rect {
            size: 100% 100%;
            fill: >bgSurface;
            stroke: >border 1px;
            radius: 8px;
        }

        icon {
            at: center;
            iconName: >icon;
            size: 18px;
            stroke: >textMain 2px;
            fill: transparent;
        }
    }
}
```

---

## Form Controls & Inputs

### Text Field
```toad
component TextField(fieldLabel = "Email Address", placeholder = "name@domain.com") {
    stack {
        direction: vertical;
        gap: 6px;
        size: 320px hug;

        text {
            content: >fieldLabel;
            color: >textMain;
            font-size: 13px;
            font-weight: 600;
        }

        group {
            size: 100% 40px;

            rect {
                size: 100% 100%;
                fill: >bgSurface;
                stroke: >border 1px;
                radius: 8px;
            }

            text {
                at: inside parent offset 12px 10px;
                content: >placeholder;
                color: >textMuted;
                font-size: 14px;
            }
        }
    }
}
```

### Search Bar with Icon
```toad
component SearchBar(placeholder = "Search resources...") {
    stack {
        direction: horizontal;
        padding: [8px, 14px];
        gap: 10px;
        align: center;
        fill: >bgSurface;
        stroke: >border 1px;
        radius: 8px;
        size: 280px 40px;

        icon {
            iconName: "search";
            size: 16px;
            stroke: >textMuted 2px;
            fill: transparent;
        }

        text {
            content: >placeholder;
            color: >textMuted;
            font-size: 14px;
        }
    }
}
```

### Checkbox
```toad
component Checkbox(label = "Remember my preference") {
    stack {
        direction: horizontal;
        gap: 8px;
        align: center;
        size: hug hug;

        group {
            size: 18px 18px;

            rect {
                size: 100% 100%;
                fill: >bgPrimary;
                radius: 4px;
            }

            icon {
                at: center;
                iconName: "check";
                size: 12px;
                stroke: #ffffff 2px;
                fill: transparent;
            }
        }

        text {
            content: >label;
            color: >textMain;
            font-size: 14px;
        }
    }
}
```

---

## Feedback & Indicators

### Badge
```toad
component Badge(text = "NEW", bg = #3b82f6) {
    stack {
        direction: horizontal;
        padding: [4px, 10px];
        fill: alpha(>bg, 0.15);
        stroke: alpha(>bg, 0.4) 1px;
        radius: 12px;
        size: hug hug;
        align: center;

        text {
            content: >text;
            color: >bg;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.5px;
        }
    }
}
```

### Tooltip
```toad
component Tooltip(tipText = "Helper text") {
    stack {
        direction: horizontal;
        padding: [6px, 12px];
        fill: >textMain;
        radius: 6px;
        size: hug hug;
        align: center;

        text {
            content: >tipText;
            color: >textInverse;
            font-size: 12px;
        }
    }
}
```

### Progress Bar
```toad
component ProgressBar(pct = 65%) {
    group {
        size: 100% 8px;

        rect #track {
            size: 100% 100%;
            fill: >border;
            radius: 4px;
        }

        rect #fill {
            size: >pct 100%;
            fill: >bgPrimary;
            radius: 4px;
        }
    }
}
```

### User Avatar
```toad
component Avatar(initials = "FL", bg = #3b82f6) {
    group {
        size: 40px 40px;

        circle {
            size: 100%;
            fill: >bg;
        }

        text {
            at: center;
            content: >initials;
            color: #ffffff;
            font-size: 15px;
            font-weight: 700;
        }
    }
}
```

---

## Containers & Cards

### Card with Slot Projection
```toad
component Card(title = "Card Title") {
    stack {
        direction: vertical;
        padding: 24px;
        gap: 16px;
        fill: >bgSurface;
        stroke: >border 1px;
        radius: 12px;
        shadow: 0 10px 25px rgba(0, 0, 0, 0.05);
        size: 380px hug;

        text {
            content: >title;
            color: >textMain;
            font-size: 18px;
            font-weight: 700;
        }

        slot;
    }
}
```

### Modal Dialog with Backdrop
```toad
component Modal(modalTitle = "Dialog Header") {
    stack {
        direction: vertical;
        padding: 24px;
        gap: 16px;
        fill: >bgSurface;
        radius: 16px;
        shadow: 0 25px 50px rgba(0, 0, 0, 0.25);
        size: 440px hug;
        at: center of canvas;

        text {
            content: >modalTitle;
            color: >textMain;
            font-size: 20px;
            font-weight: 700;
        }

        slot;
    }
}
```
