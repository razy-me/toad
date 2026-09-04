export interface DocSection {
  id: string;
  title: string;
  description: string;
  category: string;
  badge?: string;
  codeSnippet?: string;
  content: string[];
  tips?: string[];
}

export const DOC_CATEGORIES = [
  'Quickstart & CLI',
  'Language Syntax',
  'Elements & Shapes',
  'Photo Editing & Post-Processing',
  'Layout & Positioning',
  'Photoshop & PSD Engine',
  'Typography & Fonts',
  'Print & Prepress'
];

export const DOC_SECTIONS: DocSection[] = [
  {
    id: 'getting-started',
    title: 'Installation & Setup',
    category: 'Quickstart & CLI',
    badge: 'CLI v1.0',
    description: 'Get up and running with the global toad compiler in seconds.',
    codeSnippet: `# 1. Clone & Build compiler
git clone https://github.com/florian/toad.git
cd toad
npm install
npm run build
npm link

# 2. Verify global installation
toad --version
# => 1.0.0`,
    content: [
      'TOAD is a standalone Node.js compiler and layout solver designed to transform high-level declarative design files into Photoshop PSDs, raster images, and SVG vectors.',
      'Once installed with npm link, the `toad` command is globally available from any directory in your shell.'
    ],
    tips: [
      'Use `toad init` to automatically scaffold a new design project with starter templates and dependencies.'
    ]
  },
  {
    id: 'cli-commands',
    title: 'CLI Usage & Watch Mode',
    category: 'Quickstart & CLI',
    badge: 'Live Reload',
    description: 'Master the built-in commands for building, developing, and formatting.',
    codeSnippet: `# Build all formats (PNG, JPG, WebP, SVG, PSD)
toad build main.toad --format all --scale 2

# Start interactive live preview server with hot reload
toad dev main.toad

# Format code according to official guidelines
toad fmt main.toad

# Static analysis and diagnostics
toad lint main.toad`,
    content: [
      '`toad dev` automatically opens an instant local web server (SSE) in your browser. Whenever you edit the .toad file or any imported sub-files, the browser live-reloads with zero configuration.'
    ]
  },
  {
    id: 'variables-and-tokens',
    title: 'Variables & Design Tokens',
    category: 'Language Syntax',
    badge: 'Core Syntax',
    description: 'Define and reuse colors, dimensions, and typography tokens.',
    codeSnippet: `// 1. Declaration (always with > and =)
>brand_primary  = #10b981;
>brand_accent   = #ccff00;
>card_radius    = 16px;
>default_shadow = 0px 10px 30px rgba(0, 0, 0, 0.25);

// 2. Usage
rect #heroCard {
    size: 400px 300px;
    radius: >card_radius;
    fill: >brand_primary;
    shadow: >default_shadow;
}`,
    content: [
      'Variables must start with the `>` sign and end with a semicolon `;`.',
      'They can be declared at the root level of a document or within imported token files.'
    ]
  },
  {
    id: 'relational-positioning',
    title: 'Relational Positioning & DAG Layout',
    category: 'Layout & Positioning',
    badge: 'Auto Layout',
    description: 'Anchor elements relative to other elements, parents, or the canvas with automatic topological dependency resolution.',
    codeSnippet: `canvas { size: 800px 600px; }

rect #headerBox {
    size: 600px 80px;
    at: top center of canvas offset (0px, 40px);
}

text #title {
    content: "Welcome to TOAD";
    at: center of #headerBox;
}

rect #sidebar {
    size: 180px 300px;
    at: below #headerBox offset 20px;
}

rect #mainBody {
    size: 400px 300px;
    at: right of #sidebar offset 20px;
}`,
    content: [
      'TOAD features an acyclic dependency solver that computes bounding boxes in topological order.',
      'Valid relational directions include: `above`, `below`, `left of`, `right of`, `inside`, and `center of`.'
    ],
    tips: [
      'Avoid circular constraints like `#a right of #b` and `#b right of #a`, which will trigger a CyclicDependencyError during compilation.'
    ]
  },
  {
    id: 'psd-export-engine',
    title: 'Photoshop (PSD) Vector Layers & FX',
    category: 'Photoshop & PSD Engine',
    badge: 'True Bézier Vectors',
    description: 'Export directly to Adobe Photoshop with native vector shapes and editable layer styles.',
    codeSnippet: `canvas "PsdExport" {
    size: 1000px 1000px;
    export: psd;

    rect #glassCard {
        size: 600px 400px;
        radius: 32px;
        fill: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
        stroke: #38bdf8 2px;
        shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
    }
}`,
    content: [
      'Unlike generic raster tools that flatten designs, TOAD produces true Adobe Photoshop `.psd` files containing editable Bézier vector masks (`keyOriginRRectRadii`), native gradient fill layers, editable Type Layers, and Photoshop Layer FX (`dropShadow`, `stroke`, `innerGlow`).'
    ]
  },
  {
    id: 'components-and-slots',
    title: 'Components & Slot Injection',
    category: 'Language Syntax',
    badge: 'Modularity',
    description: 'Encapsulate UI patterns into reusable components with default arguments and slot insertion.',
    codeSnippet: `component Button(label = "Click Me", bg = #10b981) {
    group {
        rect {
            size: hug hug;
            padding: 12px 24px;
            radius: 8px;
            fill: >bg;
        }
        text {
            at: center of parent;
            content: >label;
            font-weight: bold;
            color: #ffffff;
        }
        slot; // Nested elements inject here
    }
}

// Instantiate
Button(label = "Get Started", bg = #38bdf8);`,
    content: [
      'Components allow parametrizing entire sub-trees of elements.',
      'The `slot;` directive enables injecting custom children into the component template.'
    ]
  },
  {
    id: 'photo-canvas-and-adjustments',
    title: 'Photo Canvas Mode & Radial Adjustments',
    category: 'Photo Editing & Post-Processing',
    badge: 'Dodge & Burn',
    description: 'Transform photographs with auto-detected canvas sizing, global tone grading, and feathered radial retouching spots.',
    codeSnippet: `// 1. Photo Canvas: Dimensions automatically detected from photo header
canvas photo "./assets/portrait.jpg" {
    exposure: 0.2;         // EV exposure compensation (2^EV)
    contrast: 1.15;        // Contrast centered at mid-gray 128
    saturation: 1.2;       // Rec.709 relative luminance
    warmth: 0.08;          // Temperature shift (+ warm, - cool)
    highlights: -0.15;     // Highlight recovery (> 50% lum)
    shadows: 0.1;          // Shadow lift (< 50% lum)
    vignette: 25%;         // Edge-darkening falloff
}

// 2. Local Dodge: brighten face area with feathered falloff
adjust #faceLighting {
    at: (540px, 380px);
    radius: 120px;
    feather: 50px;
    exposure: 0.35;
    warmth: 0.05;
}

// 3. Regular typography and graphics composite seamlessly over the photo
text #caption {
    at: bottom center of canvas offset (0px, -40px);
    content: "Golden Hour in Iceland";
    color: #ffffff;
    font-size: 24px;
    font-weight: bold;
}`,
    content: [
      'Photo Canvas Mode (`canvas photo "..."`) turns a source photo into the base canvas, auto-detecting dimensions from PNG, JPEG, or WebP headers without requiring manual `size:` definitions.',
      'The `adjust` element applies localized tone and color corrections to a circular coordinate with smooth feathered falloff, enabling professional dodge & burn retouches in code.'
    ],
    tips: [
      'Combine `exposure` with `warmth` in local `adjust` spots for natural facial lighting or sunset glows.'
    ]
  }
];
