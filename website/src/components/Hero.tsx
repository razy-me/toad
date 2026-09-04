'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Sparkles, Terminal, Copy, Check, ArrowRight, Layers, Cpu, Eye, FileCode2 } from 'lucide-react';
import { SAMPLES } from '@/lib/samples';

export default function Hero() {
  const [activeTab, setActiveTab] = useState<'logo' | 'card'>('logo');
  const [copied, setCopied] = useState(false);
  const [activeFormat, setActiveFormat] = useState<'png' | 'psd' | 'svg'>('png');

  const activeSample = activeTab === 'logo' ? SAMPLES[0] : SAMPLES[1];

  const handleCopyCmd = () => {
    navigator.clipboard.writeText('toad init');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="relative overflow-hidden pt-12 pb-24 lg:pt-20 lg:pb-32">
      {/* Background Gradients */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-emerald-neon/10 blur-[130px] rounded-full pointer-events-none" />
      <div className="absolute top-1/3 right-10 w-[400px] h-[300px] bg-cyber-cyan/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Header Badges & Main Pitch */}
        <div className="text-center max-w-3xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-void-850 px-4 py-1.5 border border-emerald-neon/30 text-xs font-mono text-emerald-neon shadow-glow-emerald">
            <Sparkles className="h-3.5 w-3.5 text-toxic-lime" />
            <span>Declarative Design DSL & Multi-Format Exporter</span>
            <span className="h-1.5 w-1.5 rounded-full bg-toxic-lime" />
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white">
            Graphic Design as{' '}
            <span className="bg-gradient-to-r from-emerald-neon via-toxic-lime to-cyber-cyan bg-clip-text text-transparent">
              Pure Code.
            </span>
          </h1>

          <p className="text-base sm:text-xl text-slate-400 leading-relaxed max-w-2xl mx-auto">
            Write declarative <code className="text-emerald-neon bg-void-850 px-2 py-0.5 rounded border border-emerald-neon/20 font-mono text-sm font-semibold">.toad</code> files.
            Instantly compile into layered <strong className="text-white">Photoshop PSDs</strong>, multi-scale <strong className="text-white">PNG/JPG/WebP</strong>, and scalable <strong className="text-white">SVG</strong> vectors.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <Link
              href="/playground"
              className="flex items-center gap-2.5 rounded-xl bg-emerald-neon px-6 py-3.5 text-base font-bold text-void-950 shadow-glow-emerald hover:brightness-110 transition-all hover:scale-105 active:scale-95"
            >
              <Sparkles className="h-5 w-5" />
              Open Live Playground
            </Link>
            <Link
              href="/docs"
              className="flex items-center gap-2 rounded-xl bg-void-850 px-6 py-3.5 text-base font-semibold text-white border border-void-700 hover:border-slate-500 hover:bg-void-800 transition-all active:scale-95"
            >
              <FileCode2 className="h-5 w-5 text-emerald-neon" />
              Documentation & Syntax
            </Link>
          </div>

          {/* CLI quick install chip */}
          <div className="inline-flex items-center gap-3 rounded-xl bg-void-900/90 px-4 py-2 border border-void-700 font-mono text-xs text-slate-300 backdrop-blur-md">
            <Terminal className="h-4 w-4 text-emerald-neon" />
            <span className="text-slate-400">$</span>
            <span className="text-emerald-neon font-semibold">toad init</span>
            <button
              onClick={handleCopyCmd}
              className="p-1 hover:text-white transition-colors ml-2"
              title="Copy command"
            >
              {copied ? <Check className="h-4 w-4 text-toxic-lime" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Interactive Split-Screen Live Demo */}
        <div className="mt-16 lg:mt-20 glass-panel-glow rounded-2xl overflow-hidden border border-emerald-neon/30 shadow-glass-card">
          
          {/* Top Demo Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-void-700/80 bg-void-900/90 px-5 py-3.5 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                <span className="h-3 w-3 rounded-full bg-red-500/80" />
                <span className="h-3 w-3 rounded-full bg-yellow-500/80" />
                <span className="h-3 w-3 rounded-full bg-green-500/80" />
              </div>
              <span className="font-mono text-xs text-slate-400 font-semibold border-l border-void-700 pl-3">
                toad-studio://preview/{activeSample.id}.toad
              </span>
            </div>

            {/* Sample Selector Tabs */}
            <div className="flex items-center gap-1 bg-void-850 p-1 rounded-lg border border-void-700 text-xs font-mono">
              <button
                onClick={() => setActiveTab('logo')}
                className={`px-3 py-1 rounded transition-all ${
                  activeTab === 'logo'
                    ? 'bg-emerald-neon text-void-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Cyber-Toad Logo
              </button>
              <button
                onClick={() => setActiveTab('card')}
                className={`px-3 py-1 rounded transition-all ${
                  activeTab === 'card'
                    ? 'bg-emerald-neon text-void-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Social OG-Card
              </button>
            </div>

            {/* Output Format Switcher */}
            <div className="flex items-center gap-1 text-xs font-mono text-slate-400">
              <span className="text-[11px] uppercase text-slate-500 mr-1 hidden sm:inline">Export:</span>
              {(['png', 'psd', 'svg'] as const).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => setActiveFormat(fmt)}
                  className={`px-2.5 py-1 rounded uppercase font-bold text-[11px] transition-all ${
                    activeFormat === fmt
                      ? 'bg-cyber-cyan text-void-950 shadow-glow-cyan'
                      : 'bg-void-800 text-slate-300 hover:bg-void-700'
                  }`}
                >
                  {fmt}
                </button>
              ))}
            </div>
          </div>

          {/* Code vs Visual Split View */}
          <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[480px]">
            
            {/* Left Code Editor Pane */}
            <div className="lg:col-span-6 bg-void-950/95 p-5 font-mono text-xs leading-relaxed overflow-x-auto border-b lg:border-b-0 lg:border-r border-void-700">
              <div className="flex items-center justify-between text-slate-500 pb-3 mb-3 border-b border-void-800 text-[11px]">
                <span>SOURCE: {activeSample.id}.toad</span>
                <span className="text-emerald-neon font-semibold">✓ Parsed (AST Valid)</span>
              </div>
              <pre className="text-slate-300 font-mono overflow-auto max-h-[420px] select-text">
                <code>
                  {activeSample.code.split('\n').map((line, idx) => {
                    const lineNum = idx + 1;
                    const isKeyword = line.includes('canvas') || line.includes('stack') || line.includes('group') || line.includes('rect') || line.includes('circle') || line.includes('text');
                    const isVar = line.trim().startsWith('>');
                    const isDirective = line.trim().startsWith('@');
                    const isComment = line.trim().startsWith('//');

                    return (
                      <div key={idx} className="table-row hover:bg-void-900/50">
                        <span className="table-cell pr-4 text-slate-600 select-none text-right w-8">
                          {lineNum}
                        </span>
                        <span
                          className={`table-cell whitespace-pre ${
                            isComment
                              ? 'text-slate-500 italic'
                              : isVar
                              ? 'text-toxic-lime font-semibold'
                              : isDirective
                              ? 'text-cyber-cyan font-bold'
                              : isKeyword
                              ? 'text-emerald-neon font-semibold'
                              : 'text-slate-200'
                          }`}
                        >
                          {line}
                        </span>
                      </div>
                    );
                  })}
                </code>
              </pre>
            </div>

            {/* Right Visual Result Pane */}
            <div className="lg:col-span-6 bg-void-900/80 p-6 flex flex-col items-center justify-center relative grid-bg">
              <div className="absolute top-4 right-4 flex items-center gap-2 rounded-md bg-void-850 px-3 py-1 border border-void-700 text-[11px] font-mono text-slate-400">
                <Eye className="h-3.5 w-3.5 text-emerald-neon" />
                <span>{activeSample.dimensions}</span>
                <span className="text-slate-500">•</span>
                <span className="text-toxic-lime uppercase font-bold">{activeFormat}</span>
              </div>

              {/* Rendered Preview Artwork */}
              <div className="relative group max-w-full flex items-center justify-center p-2 rounded-xl bg-void-950/60 border border-void-700/60 shadow-2xl">
                {activeFormat === 'psd' ? (
                  <div className="w-full max-w-md p-6 bg-void-950 rounded-lg border border-void-700 font-mono text-xs space-y-3">
                    <div className="flex items-center justify-between text-cyber-cyan font-bold border-b border-void-800 pb-2">
                      <span className="flex items-center gap-2">
                        <Layers className="h-4 w-4" />
                        Photoshop Layer Hierarchy
                      </span>
                      <span>8BPS / CMYK/RGB</span>
                    </div>
                    <div className="space-y-1.5">
                      {activeSample.layers.map((layer, i) => (
                        <div key={i} className="flex items-center justify-between p-2 rounded bg-void-900 border border-void-800">
                          <span className="text-slate-200 font-semibold flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-emerald-neon" />
                            {layer.name}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400 bg-void-800 px-1.5 py-0.5 rounded">
                              {layer.type}
                            </span>
                            {layer.effects && (
                              <span className="text-[10px] text-toxic-lime bg-toxic-lime/10 px-1.5 py-0.5 rounded">
                                FX: {layer.effects.join(', ')}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="relative overflow-hidden rounded-lg">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={activeSample.previewImg}
                      alt={activeSample.name}
                      className="max-h-[340px] w-auto object-contain rounded-lg shadow-2xl transition-transform duration-500 group-hover:scale-[1.02]"
                    />
                  </div>
                )}
              </div>

              {/* Status bar */}
              <div className="mt-4 flex items-center gap-4 text-xs font-mono text-slate-400">
                <span className="flex items-center gap-1.5 text-emerald-neon">
                  <span className="h-2 w-2 rounded-full bg-emerald-neon animate-pulse" />
                  Compiled in 42ms
                </span>
                <span>•</span>
                <span>Multi-Scale: 1x / 2x / 4x</span>
                <span>•</span>
                <span className="text-cyber-cyan">Photoshop Layer FX Active</span>
              </div>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
}
