# TOAD Component Architecture

To write robust, maintainable TOAD code, structure UI elements into reusable components.

## 1. Defining Reusable Components
Use the `component` keyword to define UI patterns. Always define default parameters to make components robust.

```toad
component Button(label = "Click Me", bg = #3b82f6) {
    stack {
        direction: horizontal;
        align: center;
        gap: 8px;
        padding: [12px, 24px];
        radius: 8px;
        fill: >bg;
        size: hug hug;

        icon {
            iconName: "check";
            size: 18px;
            stroke: #ffffff 2px;
            fill: transparent;
        }

        text {
            content: >label;
            font-size: 15px;
            font-weight: 600;
            color: #ffffff;
        }
    }
}
```

## 2. Content Projection (Slots)
Use `slot;` to create container components (like Cards, Modals, or Layout wrappers) that wrap arbitrary children elements. The `slot;` statement MUST end in a semicolon.

```toad
component ModalCard(title = "Modal Title") {
    stack {
        direction: vertical;
        size: 400px hug;
        fill: >bgSurface;
        radius: 16px;
        padding: 24px;
        gap: 16px;
        shadow: 0 24px 48px alpha(#000000, 0.25);
        
        // Header
        text {
            content: >title;
            font-size: 20px;
            font-weight: 700;
            color: >textMain;
        }
        
        // Divider
        rect {
            size: 100% 1px;
            fill: >borderColor;
        }
        
        // Project arbitrary children here
        slot;
    }
}

// Instantiation:
ModalCard("Account Settings") {
    text { 
        content: "Configure your user preferences below."; 
        color: >textMuted; 
        font-size: 14px;
    }
    Button("Save Changes", #10b981);
}
```

## 3. Theming & Scoping
- Place all global components in a `ui-kit.toad` file.
- Use `@import "./ui-kit.toad";` at the top of your main files.
- Component scope is isolated. Variables declared inside a component do not leak out.
