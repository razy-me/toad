import React from 'react';
import Link from 'next/link';
import Hero from '@/components/Hero';
import FeatureGrid from '@/components/FeatureGrid';
import Playground from '@/components/Playground';
import HorizontalShowcase from '@/components/HorizontalShowcase';
import TemplateGallery from '@/components/TemplateGallery';
import TerminalDemo from '@/components/TerminalDemo';
import { Sparkles, ArrowRight, Layers, FileCode2, Terminal, Shield, Cpu } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="flex flex-col space-y-12">
      
      {/* 1. Hero Section */}
      <Hero />

      {/* 2. Horizontal Scrolling Artboard Gallery */}
      <HorizontalShowcase />

      {/* 3. Interactive Studio Playground Section */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="text-center max-w-2xl mx-auto mb-10 space-y-3">
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-emerald-neon bg-emerald-neon/10 px-3 py-1 rounded-full border border-emerald-neon/20">
            Interactive Web IDE
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
            Try the DSL in Real Time
          </h2>
          <p className="text-slate-400 text-sm sm:text-base">
            Switch templates, adjust scales, and inspect the generated Photoshop layer hierarchy live in your browser.
          </p>
        </div>

        <Playground />
      </section>

      {/* 3. Core Engine Architecture Feature Grid */}
      <FeatureGrid />

      {/* 4. Showcase & Blueprint Templates */}
      <TemplateGallery />

      {/* 5. Terminal & CLI Workflow */}
      <TerminalDemo />

      {/* 6. Call To Action Footer Banner */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto rounded-3xl glass-panel-glow p-10 sm:p-14 border border-emerald-neon/40 text-center relative overflow-hidden shadow-2xl">
          
          <div className="absolute top-0 right-0 w-80 h-80 bg-toxic-lime/10 blur-[100px] rounded-full pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-neon/10 blur-[100px] rounded-full pointer-events-none" />

          <span className="inline-flex items-center gap-2 rounded-full bg-void-950 px-4 py-1.5 border border-emerald-neon/30 text-xs font-mono text-emerald-neon mb-6">
            <Sparkles className="h-4 w-4 text-toxic-lime" />
            Ready for Automated CI/CD & Design Systems
          </span>

          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            Start Designing with <span className="text-emerald-neon">toad</span> Today
          </h2>

          <p className="text-slate-300 text-base sm:text-lg max-w-xl mx-auto mt-4 leading-relaxed">
            Install globally with npm, initialize a clean project in seconds, and watch your graphics compile in real time.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/playground"
              className="flex items-center gap-2.5 rounded-xl bg-emerald-neon px-7 py-4 text-base font-bold text-void-950 shadow-glow-emerald hover:brightness-110 transition-all hover:scale-105 active:scale-95"
            >
              <Sparkles className="h-5 w-5" />
              Launch Web Studio
            </Link>
            <Link
              href="/docs"
              className="flex items-center gap-2 rounded-xl bg-void-950 px-7 py-4 text-base font-semibold text-white border border-void-700 hover:border-slate-500 hover:bg-void-900 transition-all active:scale-95"
            >
              <FileCode2 className="h-5 w-5 text-emerald-neon" />
              Explore Documentation
            </Link>
          </div>

          <div className="mt-8 font-mono text-xs text-slate-500 flex items-center justify-center gap-6">
            <span>npm install -g toad</span>
            <span>•</span>
            <span>Node.js 20+</span>
            <span>•</span>
            <span>MIT License</span>
          </div>

        </div>
      </section>

    </div>
  );
}
