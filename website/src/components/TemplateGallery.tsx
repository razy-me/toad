'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { SAMPLES } from '@/lib/samples';
import { Layers, Eye, Sparkles, ArrowRight, Check, Copy } from 'lucide-react';

export default function TemplateGallery() {
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const categories = ['All', 'Brand & Identity', 'Marketing & Web', 'Product & SaaS', 'UI/UX Design'];

  const filtered = activeCategory === 'All'
    ? SAMPLES
    : SAMPLES.filter((s) => s.category === activeCategory);

  const handleCopyCode = (id: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <section className="py-20 lg:py-28 relative">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
          <div>
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-cyber-cyan bg-cyber-cyan/10 px-3 py-1 rounded-full border border-cyber-cyan/20">
              Templates & Showcase
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mt-3">
              Production-Grade Design Blueprints
            </h2>
            <p className="text-slate-400 text-base mt-2 max-w-xl">
              Inspect real-world `.toad` design files ready for compilation into multi-scale PNGs, vectors, and layered Photoshop PSDs.
            </p>
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 bg-void-900 p-1.5 rounded-xl border border-void-700">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                  activeCategory === cat
                    ? 'bg-emerald-neon text-void-950 font-bold shadow-glow-emerald'
                    : 'text-slate-400 hover:text-white hover:bg-void-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Gallery Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="group rounded-2xl glass-panel overflow-hidden border border-void-700/80 transition-all duration-300 hover:border-emerald-neon/50 hover:shadow-glow-emerald flex flex-col"
            >
              {/* Image Preview Container */}
              <div className="relative aspect-[16/9] bg-void-950 p-6 flex items-center justify-center overflow-hidden border-b border-void-800 grid-bg">
                <div className="absolute top-3 left-3 flex items-center gap-2 bg-void-900/90 px-2.5 py-1 rounded-md border border-void-700 text-[11px] font-mono text-slate-300 backdrop-blur-md">
                  <span className="text-emerald-neon font-bold">{item.dimensions}</span>
                  <span>•</span>
                  <span className="text-slate-400">{item.category}</span>
                </div>

                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.previewImg}
                  alt={item.name}
                  className="max-h-full w-auto object-contain rounded-lg shadow-xl transition-transform duration-500 group-hover:scale-105"
                />
              </div>

              {/* Card Meta & Actions */}
              <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                <div>
                  <h3 className="text-xl font-bold text-white group-hover:text-emerald-neon transition-colors">
                    {item.name}
                  </h3>
                  <p className="text-sm text-slate-400 mt-2 leading-relaxed">
                    {item.description}
                  </p>
                </div>

                <div className="pt-4 border-t border-void-800/80 flex items-center justify-between">
                  <button
                    onClick={() => handleCopyCode(item.id, item.code)}
                    className="flex items-center gap-1.5 text-xs font-mono text-slate-400 hover:text-white transition-colors"
                  >
                    {copiedId === item.id ? (
                      <>
                        <Check className="h-4 w-4 text-toxic-lime" />
                        <span className="text-toxic-lime font-bold">Code Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        <span>Copy .toad Source</span>
                      </>
                    )}
                  </button>

                  <Link
                    href="/playground"
                    className="flex items-center gap-1.5 text-xs font-mono font-bold text-emerald-neon hover:text-toxic-lime transition-colors"
                  >
                    <span>Open in Playground</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
