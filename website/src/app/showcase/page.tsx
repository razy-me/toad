import React from 'react';
import TemplateGallery from '@/components/TemplateGallery';
import HorizontalShowcase from '@/components/HorizontalShowcase';
import { Layers, Sparkles } from 'lucide-react';

export const metadata = {
  title: 'Showcase & Blueprints — toad DSL',
  description: 'Explore production-ready .toad design templates for logos, social banners, mobile mockups, and SaaS graphics.'
};

export default function ShowcasePage() {
  return (
    <div className="py-12 space-y-12">
      
      {/* Showcase Hero Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl glass-panel-glow p-8 sm:p-12 border border-cyber-cyan/30 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-neon/10 blur-[100px] rounded-full pointer-events-none" />
          
          <div className="max-w-2xl space-y-3 relative z-10">
            <div className="inline-flex items-center gap-2 rounded-full bg-void-950 px-3 py-1 border border-cyber-cyan/30 text-xs font-mono text-cyber-cyan">
              <Layers className="h-3.5 w-3.5" />
              Verified Design Templates
            </div>
            <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
              Design Blueprint Gallery
            </h1>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Explore curated, pixel-perfect design files written purely in `.toad`. Copy the source code or test them instantly in the live playground.
            </p>
          </div>
        </div>
      </div>

      {/* Horizontal Carousel Track */}
      <HorizontalShowcase />

      {/* Main Filterable Gallery Grid */}
      <TemplateGallery />

    </div>
  );
}
