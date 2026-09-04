# TOAD DSL: Master Full Templates

This reference provides production-grade, fully compilable `.toad` master templates demonstrating advanced architectural layout, component parameterized reusability, auto-layout stacks, and CSS grids.

---

## 1. Modern SaaS Analytics Dashboard (1440 x 1024 Desktop)

A complete SaaS desktop application layout featuring sidebar navigation, top header, dynamic stat cards, revenue chart card, and customer activity list.

```toad
// ==========================================
// SAAS ANALYTICS DASHBOARD
// Dimensions: 1440 x 1024
// ==========================================

// --- Color Tokens ---
>bgMain = #f8fafc;
>bgSurface = #ffffff;
>textPrimary = #0f172a;
>textSecondary = #64748b;
>textTertiary = #94a3b8;
>brandAccent = #3b82f6;
>brandAccentLight = #eff6ff;
>borderColor = #e2e8f0;
>statusSuccess = #10b981;
>statusDanger = #ef4444;

canvas "SaaS-Dashboard" {
    size: 1440px 1024px;
    background: >bgMain;
    export: all;
}

// ==========================================
// REUSABLE COMPONENTS
// ==========================================

component NavItem(label = "Menu Item", active = false) {
    stack {
        direction: horizontal;
        padding: [10px, 16px];
        gap: 12px;
        align: center;
        size: 208px 40px;
        radius: 6px;
        fill: alpha(>brandAccent, 0.1);

        icon {
            iconName: "home";
            size: 18px;
            stroke: >brandAccent 2px;
            fill: transparent;
        }

        text {
            content: >label;
            font-size: 14px;
            font-weight: 600;
            color: >textPrimary;
        }
    }
}

component StatCard(title = "Metric", value = "$0.00", trend = "+0.0%", isPositive = true) {
    stack {
        direction: vertical;
        padding: 20px;
        gap: 12px;
        size: 260px 140px;
        fill: >bgSurface;
        radius: 12px;
        stroke: >borderColor 1px;
        shadow: 0 4px 12px rgba(0, 0, 0, 0.04);

        text {
            content: >title;
            font-size: 13px;
            font-weight: 600;
            color: >textSecondary;
        }

        text {
            content: >value;
            font-size: 28px;
            font-weight: 800;
            color: >textPrimary;
        }

        text {
            content: >trend;
            font-size: 13px;
            font-weight: 700;
            color: >statusSuccess;
        }
    }
}

// ==========================================
// SIDEBAR NAVIGATION
// ==========================================

stack #sidebar {
    direction: vertical;
    padding: 24px;
    gap: 8px;
    size: 256px 1024px;
    fill: >bgSurface;
    stroke: >borderColor 1px;
    at: (0, 0);

    text #logo {
        content: "AcmeAnalytics";
        font-size: 20px;
        font-weight: 800;
        color: >brandAccent;
    }

    rect #sidebarDivider {
        size: 100% 1px;
        fill: >borderColor;
    }

    NavItem("Dashboard", true);
    NavItem("Analytics", false);
    NavItem("Customers", false);
    NavItem("Settings", false);
}

// ==========================================
// TOP HEADER
// ==========================================

stack #topHeader {
    direction: horizontal;
    padding: [16px, 32px];
    size: 1184px 72px;
    fill: >bgSurface;
    stroke: >borderColor 1px;
    align: center;
    at: (256px, 0);

    text #headerTitle {
        content: "Overview & Real-time Metrics";
        font-size: 18px;
        font-weight: 700;
        color: >textPrimary;
        size: fill hug;
    }

    circle #userAvatar {
        size: 40px;
        fill: >brandAccent;
    }
}

// ==========================================
// MAIN CONTENT GRID & CARDS
// ==========================================

grid #statGrid {
    columns: 4;
    gap: 24px;
    size: 1120px hug;
    at: below #topHeader offset 32px 32px;

    StatCard("Total Revenue", "$124,563.00", "+14.5%", true);
    StatCard("Active Users", "45,231", "+5.2%", true);
    StatCard("Bounce Rate", "42.3%", "-1.1%", false);
    StatCard("Session Duration", "3m 42s", "+12.4%", true);
}

// Revenue Analytics Chart Container
stack #chartCard {
    direction: vertical;
    padding: 24px;
    gap: 16px;
    size: 1120px 420px;
    fill: >bgSurface;
    radius: 12px;
    stroke: >borderColor 1px;
    shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
    at: below #statGrid offset 0 24px;

    text #chartTitle {
        content: "Revenue Growth over Time";
        font-size: 16px;
        font-weight: 700;
        color: >textPrimary;
    }

    // Chart Vector Area Placeholder
    rect #chartPlot {
        size: 100% 320px;
        fill: linear-gradient(180deg, alpha(>brandAccent, 0.2) 0%, alpha(>brandAccent, 0.02) 100%);
        radius: 8px;
        stroke: >brandAccent 2px;
    }
}
```

---

## 2. Mobile App Profile Screen (393 x 852 iPhone 14 Pro)

A mobile profile interface featuring cover artwork, overlapping avatar, author bio with text word-wrap, user statistics row, tab navigation, and photo grid.

```toad
// ==========================================
// MOBILE APP PROFILE SCREEN
// Dimensions: 393 x 852
// ==========================================

>bgWhite = #ffffff;
>textDark = #0f172a;
>textMuted = #64748b;
>brandBlue = #007aff;
>borderSubtle = #e2e8f0;

canvas "Mobile-Profile" {
    size: 393px 852px;
    background: >bgWhite;
    export: all;
}

// Cover Banner
rect #coverPhoto {
    size: 393px 180px;
    fill: linear-gradient(135deg, #38bdf8, #6366f1);
    at: (0, 0);
}

// Overlapping Profile Avatar
circle #avatar {
    size: 96px;
    fill: #f1f5f9;
    stroke: #ffffff 4px;
    at: inside #coverPhoto offset 24px 132px;
}

// Profile Info Stack
stack #profileMeta {
    direction: vertical;
    gap: 6px;
    size: 345px hug;
    at: below #avatar offset 0 16px;

    text #userName {
        content: "Jane Doe";
        font-size: 24px;
        font-weight: 800;
        color: >textDark;
    }

    text #userHandle {
        content: "@janedoe_design";
        font-size: 14px;
        color: >textMuted;
    }

    text #userBio {
        content: "Product designer and open-source enthusiast crafting visual programming languages and design systems. ☕";
        font-size: 14px;
        color: >textDark;
        line-height: 1.4;
        size: 345px hug; // Word wrap boundary
    }
}

// User Metrics Row
stack #metricsRow {
    direction: horizontal;
    size: 345px hug;
    gap: 24px;
    align: center;
    at: below #profileMeta offset 0 20px;

    stack #metric1 {
        direction: vertical;
        gap: 2px;
        text { content: "142"; font-size: 18px; font-weight: 800; color: >textDark; }
        text { content: "Posts"; font-size: 12px; color: >textMuted; }
    }

    stack #metric2 {
        direction: vertical;
        gap: 2px;
        text { content: "12.8k"; font-size: 18px; font-weight: 800; color: >textDark; }
        text { content: "Followers"; font-size: 12px; color: >textMuted; }
    }

    stack #metric3 {
        direction: vertical;
        gap: 2px;
        text { content: "845"; font-size: 18px; font-weight: 800; color: >textDark; }
        text { content: "Following"; font-size: 12px; color: >textMuted; }
    }
}

// Tab Navigation Divider
rect #tabDivider {
    size: 393px 1px;
    fill: >borderSubtle;
    at: below #metricsRow offset -24px 20px;
}

// Photo Portfolio Grid
grid #portfolioGrid {
    columns: 3;
    gap: 3px;
    size: 393px hug;
    at: below #tabDivider offset 0 4px;

    rect { size: 129px 129px; fill: #cbd5e1; }
    rect { size: 129px 129px; fill: #94a3b8; }
    rect { size: 129px 129px; fill: #64748b; }
    rect { size: 129px 129px; fill: #475569; }
    rect { size: 129px 129px; fill: #334155; }
    rect { size: 129px 129px; fill: #1e293b; }
}
```
