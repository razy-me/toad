import React from 'react';
import { Layers, Sparkles, Cpu, Eye, Zap, Printer, ShieldCheck, Code, Sliders, Box, RefreshCw, Palette } from 'lucide-react';

export default function FeatureGrid() {
  const features = [
    {
      icon: Layers,
      title: 'Native Photoshop PSD Engine',
      category: 'Vector Fidelity',
      color: 'text-cyber-cyan',
      borderColor: 'border-cyber-cyan/30',
      description: 'Generates true Bézier vector masks with editable anchor points (A-tool), native gradient layers, and editable Photoshop Layer FX (Drop Shadow, Stroke, Inner Glow).',
      badge: 'True Bézier'
    },
    {
      icon: Box,
      title: 'Relational DAG Layout Solver',
      category: 'Layout Engine',
      color: 'text-emerald-neon',
      borderColor: 'border-emerald-neon/30',
      description: 'Position elements naturally with relational syntax like `at: below #header offset 16px;`. Topological sorter resolves acyclic placement dependencies effortlessly.',
      badge: 'Auto Layout'
    },
    {
      icon: RefreshCw,
      title: 'Live Hot Reload & Web Preview',
      category: 'Developer Experience',
      color: 'text-toxic-lime',
      borderColor: 'border-toxic-lime/30',
      description: 'Run `toad dev` to start an instant local SSE preview server in your browser. Live reloads instantaneously across all transitive imported .toad files.',
      badge: 'SSE Powered'
    },
    {
      icon: Palette,
      title: 'Design Tokens & Component Slots',
      category: 'Modularity',
      color: 'text-emerald-neon',
      borderColor: 'border-emerald-neon/30',
      description: 'Declare reusable variables `>brand = #10b981;` and encapsulate complex UI graphics into components with default parameters and `<slot/>` insertion.',
      badge: 'Reusable'
    },
    {
      icon: Printer,
      title: 'Print Prepress & Bleed Engine',
      category: 'Production Ready',
      color: 'text-cyber-cyan',
      borderColor: 'border-cyber-cyan/30',
      description: 'Full support for physical units (mm, cm, in, pt), 300 DPI prepress expansion, automated Media/Trim bounding boxes, and corner crop marks with Passkreuze crosshairs.',
      badge: '300 DPI'
    },
    {
      icon: Zap,
      title: 'Multi-Scale Raster & Vector Export',
      category: 'Multi-Format',
      color: 'text-toxic-lime',
      borderColor: 'border-toxic-lime/30',
      description: 'Export to multi-scale PNG (1x, 2x, 4x), WebP, optimized JPEG, scalable SVG vectors, and layered PSD files in a single build command.',
      badge: '1x / 2x / 4x'
    }
  ];

  return (
    <section className="py-20 lg:py-28 relative">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-emerald-neon bg-emerald-neon/10 px-3 py-1 rounded-full border border-emerald-neon/20">
            Engine Architecture
          </span>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Built for Modern Design Systems & Automation
          </h2>
          <p className="text-slate-400 text-base sm:text-lg">
            Everything you need to treat graphic design, brand assets, and marketing collateral as version-controlled code.
          </p>
        </div>

        {/* 6-Card Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <div
                key={i}
                className="group relative rounded-2xl glass-panel p-7 border border-void-700/80 transition-all duration-300 hover:border-emerald-neon/50 hover:bg-void-850/80 hover:-translate-y-1 hover:shadow-glow-emerald"
              >
                <div className="flex items-center justify-between mb-5">
                  <div className={`p-3 rounded-xl bg-void-950 border ${f.borderColor} shadow-lg group-hover:scale-110 transition-transform`}>
                    <Icon className={`h-6 w-6 ${f.color}`} />
                  </div>
                  <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 bg-void-950 px-2.5 py-1 rounded-full border border-void-700">
                    {f.badge}
                  </span>
                </div>

                <span className="text-xs font-mono text-emerald-neon/90 font-semibold uppercase tracking-wider">
                  {f.category}
                </span>
                <h3 className="text-xl font-bold text-white mt-1 mb-3 group-hover:text-emerald-neon transition-colors">
                  {f.title}
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  {f.description}
                </p>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
