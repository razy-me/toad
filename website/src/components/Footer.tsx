import React from 'react';
import Link from 'next/link';
import { Terminal, Shield, Sparkles, Cpu, BookOpen, Layers } from 'lucide-react';
import { BRAND_TOKENS } from '@/lib/brandTokens';

export default function Footer() {
  return (
    <footer className="border-t border-void-700 bg-void-950/90 text-slate-400">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          
          {/* Brand Col */}
          <div className="space-y-4 md:col-span-2">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-void-850 border border-emerald-neon/40 shadow-glow-emerald">
                <span className="font-mono font-black text-emerald-neon text-base">&gt;_</span>
              </div>
              <span className="font-mono font-bold text-xl text-white tracking-tight">toad</span>
              <span className="rounded bg-emerald-neon/10 px-2 py-0.5 text-[11px] font-mono font-semibold text-emerald-neon border border-emerald-neon/20">
                v{BRAND_TOKENS.version}
              </span>
            </div>
            <p className="max-w-md text-sm text-slate-400 leading-relaxed">
              Standalone Node.js compiler, DAG layout solver, raster renderer, and Photoshop PSD exporter for declarative design systems.
            </p>
            <div className="flex items-center gap-4 text-xs font-mono text-slate-500 pt-2">
              <span className="flex items-center gap-1">
                <Shield className="h-3.5 w-3.5 text-emerald-neon" />
                MIT License
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Cpu className="h-3.5 w-3.5 text-cyber-cyan" />
                Zero Runtime Overhead
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5 text-toxic-lime" />
                True Bézier PSD
              </span>
            </div>
          </div>

          {/* Navigation Col */}
          <div>
            <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-200">
              Ecosystem & Apps
            </h3>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <Link href="/playground" className="hover:text-emerald-neon transition-colors">
                  Interactive Playground
                </Link>
              </li>
              <li>
                <Link href="/showcase" className="hover:text-emerald-neon transition-colors">
                  Design Showcase & Templates
                </Link>
              </li>
              <li>
                <Link href="/docs" className="hover:text-emerald-neon transition-colors">
                  Documentation & Wiki
                </Link>
              </li>
            </ul>
          </div>

          {/* Tech Spec Col */}
          <div>
            <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-200">
              Compiler Features
            </h3>
            <ul className="mt-4 space-y-2 text-sm">
              <li><span className="text-slate-300">Photoshop (.psd)</span> with Layer FX</li>
              <li><span className="text-slate-300">High-DPI Multi-Scale</span> (1x, 2x, 4x)</li>
              <li><span className="text-slate-300">Scalable Vector</span> (SVG)</li>
              <li><span className="text-slate-300">Live SSE Hot Reload</span></li>
              <li><span className="text-slate-300">Prepress Bleed & Crops</span></li>
            </ul>
          </div>

        </div>

        <div className="mt-12 border-t border-void-800 pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 font-mono">
          <p>© {new Date().getFullYear()} TOAD Declarative Design Language. Crafted with precision.</p>
          <p className="mt-2 sm:mt-0">Node.js • TypeScript • Skia Canvas • AG-PSD</p>
        </div>
      </div>
    </footer>
  );
}
