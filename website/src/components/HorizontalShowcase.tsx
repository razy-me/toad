'use client';

import React, { useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import { SAMPLES } from '@/lib/samples';
import { ChevronLeft, ChevronRight, Sparkles, Layers, Eye, ArrowRight, Check, Copy } from 'lucide-react';

export default function HorizontalShowcase() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const showcaseItems = [
    {
      id: 'master-logo',
      title: 'Master Cyber-Toad Brand',
      badge: 'Brand Identity',
      preset: '1200 × 540',
      description: 'Official multi-layer geometric emblem with squircle bounding boxes, optical sensors, and code prompt chevron.',
      previewImg: '/brand/logo-master-logo.png',
      tags: ['PSD Layers', 'SVG Vector', 'Multi-Scale 4x'],
      accent: 'border-emerald-neon/40 text-emerald-neon'
    },
    {
      id: 'social-card',
      title: 'OpenGraph Social Card',
      badge: 'Marketing Preset',
      preset: '1200 × 630',
      description: 'Automated social media banner with radial ambient backdrops, component slot badges, and typography tracking.',
      previewImg: '/fixtures/social_card.png',
      tags: ['og-image', 'Relational Layout', 'Photoshop FX'],
      accent: 'border-cyber-cyan/40 text-cyber-cyan'
    },
    {
      id: 'product-banner',
      title: 'SaaS Launch Hero Banner',
      badge: '1080p SaaS',
      preset: '1920 × 1080',
      description: 'High-resolution marketing canvas with 3-column auto-flow grid containers, glassmorphism cards, and metric pills.',
      previewImg: '/fixtures/product_banner.png',
      tags: ['Grid Layout', 'Calc Math', 'PSD Layers'],
      accent: 'border-toxic-lime/40 text-toxic-lime'
    },
    {
      id: 'mobile-mockup',
      title: 'iPhone Device Mockup',
      badge: 'UI/UX Prototype',
      preset: '430 × 932',
      description: 'Mobile screen prototype with dynamic island, floating navigation bar, and component hierarchy.',
      previewImg: '/fixtures/mobile_mockup.png',
      tags: ['Mobile Artboard', 'Fill Sizing', 'Vector Shapes'],
      accent: 'border-emerald-neon/40 text-emerald-neon'
    },
    {
      id: 'typography-poster',
      title: 'Editorial Typography Poster',
      badge: 'Print & Prepress',
      preset: '1080 × 1350',
      description: 'Complex typography layout featuring OpenType features, ligatures, small caps, and Passkreuze crop marks.',
      previewImg: '/fixtures/social_card.png',
      tags: ['OpenType', '300 DPI', 'Bleed Margins'],
      accent: 'border-cyber-cyan/40 text-cyber-cyan'
    }
  ];

  const updateScrollState = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    const maxScroll = scrollWidth - clientWidth;
    setScrollProgress(maxScroll > 0 ? (scrollLeft / maxScroll) * 100 : 0);
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft < maxScroll - 10);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.addEventListener('scroll', updateScrollState);
      updateScrollState();
      return () => el.removeEventListener('scroll', updateScrollState);
    }
  }, []);

  const handleScroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const scrollAmount = 480;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  };

  const handleCopyCode = (id: string) => {
    const s = SAMPLES.find((x) => x.id === id);
    if (s) {
      navigator.clipboard.writeText(s.code);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  return (
    <section className="py-20 lg:py-28 relative overflow-hidden bg-void-950/60 border-y border-void-800/80">
      
      {/* Background ambient glow */}
      <div className="absolute top-1/2 left-1/3 -translate-y-1/2 w-96 h-96 bg-emerald-neon/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mb-10">
        
        {/* Section Header with Horizontal Scroll Controls */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-void-900 px-3.5 py-1 border border-emerald-neon/30 text-xs font-mono text-emerald-neon">
              <Sparkles className="h-3.5 w-3.5 text-toxic-lime" />
              <span>Horizontal Artboard Showcase</span>
              <span className="h-1.5 w-1.5 rounded-full bg-toxic-lime" />
            </div>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
              Explore Dynamic Artboards
            </h2>
            <p className="text-slate-400 text-sm sm:text-base max-w-xl">
              Scroll horizontally through real `.toad` production templates. Grab the source code or test in the web playground.
            </p>
          </div>

          {/* Navigation Arrows & Progress */}
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end gap-1.5 font-mono text-xs text-slate-500">
              <span>Scroll Progress: {Math.round(scrollProgress)}%</span>
              <div className="w-32 h-1.5 bg-void-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-neon to-cyber-cyan transition-all duration-150"
                  style={{ width: `${scrollProgress}%` }}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleScroll('left')}
                disabled={!canScrollLeft}
                aria-label="Scroll Left"
                className={`p-3 rounded-xl border transition-all ${
                  canScrollLeft
                    ? 'bg-void-850 border-void-700 text-white hover:border-emerald-neon hover:bg-void-800 shadow-lg'
                    : 'bg-void-900 border-void-800 text-slate-600 cursor-not-allowed opacity-50'
                }`}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={() => handleScroll('right')}
                disabled={!canScrollRight}
                aria-label="Scroll Right"
                className={`p-3 rounded-xl border transition-all ${
                  canScrollRight
                    ? 'bg-void-850 border-void-700 text-white hover:border-emerald-neon hover:bg-void-800 shadow-lg'
                    : 'bg-void-900 border-void-800 text-slate-600 cursor-not-allowed opacity-50'
                }`}
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* The Horizontal Scrolling Track */}
      <div
        ref={scrollRef}
        className="flex gap-6 overflow-x-auto px-4 sm:px-6 lg:px-8 pb-8 pt-2 scrollbar-none snap-x snap-mandatory cursor-grab active:cursor-grabbing"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {showcaseItems.map((item, idx) => (
          <div
            key={item.id}
            className="w-[340px] sm:w-[440px] flex-shrink-0 snap-start rounded-2xl glass-panel-glow border border-void-700/80 p-6 flex flex-col justify-between space-y-6 hover:border-emerald-neon/60 hover:shadow-glow-emerald transition-all duration-300 group"
          >
            {/* Top Meta */}
            <div className="flex items-center justify-between">
              <span className={`text-xs font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-void-950 border ${item.accent}`}>
                {item.badge}
              </span>
              <span className="text-xs font-mono text-slate-400 font-semibold bg-void-900 px-2 py-0.5 rounded">
                {item.preset}
              </span>
            </div>

            {/* Artwork Preview Card */}
            <div className="relative aspect-[16/10] bg-void-950 rounded-xl overflow-hidden border border-void-800 p-4 flex items-center justify-center grid-bg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.previewImg}
                alt={item.title}
                className="max-h-full max-w-full object-contain rounded shadow-xl transition-transform duration-500 group-hover:scale-105"
              />
            </div>

            {/* Content Details */}
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white group-hover:text-emerald-neon transition-colors">
                {item.title}
              </h3>
              <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                {item.description}
              </p>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-1.5">
              {item.tags.map((tag, tIdx) => (
                <span
                  key={tIdx}
                  className="text-[10px] font-mono text-slate-300 bg-void-900 px-2 py-0.5 rounded border border-void-800"
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* Footer Action Buttons */}
            <div className="pt-4 border-t border-void-800/80 flex items-center justify-between">
              <button
                onClick={() => handleCopyCode(item.id)}
                className="flex items-center gap-1.5 text-xs font-mono text-slate-400 hover:text-white transition-colors"
              >
                {copiedId === item.id ? (
                  <>
                    <Check className="h-4 w-4 text-toxic-lime" />
                    <span className="text-toxic-lime font-bold">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    <span>Copy DSL</span>
                  </>
                )}
              </button>

              <Link
                href="/playground"
                className="flex items-center gap-1.5 text-xs font-mono font-bold text-emerald-neon hover:text-toxic-lime transition-colors"
              >
                <span>Live Studio</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

          </div>
        ))}
      </div>

      {/* Bottom Horizontal Drag / Swipe Hint */}
      <div className="text-center mt-4">
        <span className="inline-flex items-center gap-2 text-xs font-mono text-slate-500">
          <span>←</span> Drag or scroll horizontally to explore all templates <span>→</span>
        </span>
      </div>

    </section>
  );
}
