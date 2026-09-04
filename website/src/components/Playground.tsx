'use client';

import React, { useState } from 'react';
import { SAMPLES } from '@/lib/samples';
import { Sparkles, Copy, Check, Play, Layers, Eye, Download, Code2, RefreshCw, ZoomIn, ZoomOut, Grid, Sliders } from 'lucide-react';

export default function Playground() {
  const [selectedSample, setSelectedSample] = useState(SAMPLES[0]);
  const [code, setCode] = useState(SAMPLES[0].code);
  const [scale, setScale] = useState<number>(1);
  const [format, setFormat] = useState<'png' | 'psd' | 'svg'>('png');
  const [copied, setCopied] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [activeTab, setActiveTab] = useState<'code' | 'layers'>('code');

  const handleSelectSample = (sample: typeof SAMPLES[0]) => {
    setSelectedSample(sample);
    setCode(sample.code);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full max-w-7xl mx-auto rounded-2xl glass-panel-glow border border-emerald-neon/30 overflow-hidden shadow-2xl">
      
      {/* Top Studio Control Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-void-700/80 bg-void-950 px-5 py-3.5">
        
        {/* Template Preset Selector */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono font-bold uppercase text-emerald-neon tracking-wider">
            Template:
          </span>
          <select
            value={selectedSample.id}
            onChange={(e) => {
              const s = SAMPLES.find((x) => x.id === e.target.value);
              if (s) handleSelectSample(s);
            }}
            className="rounded-lg bg-void-850 px-3 py-1.5 text-xs font-mono font-semibold text-white border border-void-700 focus:border-emerald-neon focus:outline-none"
          >
            {SAMPLES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.dimensions})
              </option>
            ))}
          </select>
        </div>

        {/* View & Format Mode Toggles */}
        <div className="flex items-center gap-2">
          
          {/* Format Tabs */}
          <div className="flex items-center bg-void-850 p-1 rounded-lg border border-void-700 text-xs font-mono">
            {(['png', 'psd', 'svg'] as const).map((fmt) => (
              <button
                key={fmt}
                onClick={() => setFormat(fmt)}
                className={`px-3 py-1 rounded uppercase font-bold text-[11px] transition-all ${
                  format === fmt
                    ? 'bg-emerald-neon text-void-950 font-bold shadow-glow-emerald'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {fmt}
              </button>
            ))}
          </div>

          {/* Scale Multiplier */}
          <div className="hidden sm:flex items-center gap-1 bg-void-850 px-2 py-1 rounded-lg border border-void-700 text-xs font-mono text-slate-300">
            <span className="text-[10px] text-slate-500 uppercase mr-1">Scale:</span>
            {[1, 2, 4].map((s) => (
              <button
                key={s}
                onClick={() => setScale(s)}
                className={`px-2 py-0.5 rounded text-xs font-bold ${
                  scale === s ? 'bg-cyber-cyan text-void-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>

          {/* Grid Toggle */}
          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`p-1.5 rounded-lg border transition-all ${
              showGrid
                ? 'bg-void-800 border-emerald-neon text-emerald-neon'
                : 'bg-void-850 border-void-700 text-slate-400 hover:text-white'
            }`}
            title="Toggle Artboard Grid"
          >
            <Grid className="h-4 w-4" />
          </button>

          {/* Copy Code */}
          <button
            onClick={handleCopyCode}
            className="flex items-center gap-1.5 rounded-lg bg-void-850 px-3 py-1.5 border border-void-700 text-xs font-mono text-slate-300 hover:text-white hover:border-slate-500 transition-all"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-toxic-lime" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>

      </div>

      {/* Main Studio Workspace Split-Screen */}
      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[580px]">
        
        {/* Left Column: Code Editor & Layers Tabs */}
        <div className="lg:col-span-6 flex flex-col bg-void-950 border-b lg:border-b-0 lg:border-r border-void-700">
          
          {/* Sub-Header Tabs */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-void-900 border-b border-void-800 text-xs font-mono">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('code')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded font-semibold transition-all ${
                  activeTab === 'code'
                    ? 'bg-void-800 text-emerald-neon border border-emerald-neon/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Code2 className="h-3.5 w-3.5" />
                <span>DSL Code</span>
              </button>
              <button
                onClick={() => setActiveTab('layers')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded font-semibold transition-all ${
                  activeTab === 'layers'
                    ? 'bg-void-800 text-cyber-cyan border border-cyber-cyan/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                <span>PSD Layer Tree ({selectedSample.layers.length})</span>
              </button>
            </div>
            <span className="text-slate-500 text-[11px] hidden sm:inline">
              AST: Valid • Zero Diagnostics
            </span>
          </div>

          {/* Tab Content */}
          {activeTab === 'code' ? (
            <div className="flex-1 p-4 font-mono text-xs overflow-auto bg-void-950">
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full h-full min-h-[460px] bg-transparent text-slate-200 resize-none font-mono text-xs leading-relaxed focus:outline-none selection:bg-emerald-neon/30 selection:text-white"
                spellCheck={false}
              />
            </div>
          ) : (
            <div className="flex-1 p-5 overflow-auto bg-void-950 font-mono text-xs space-y-2">
              <div className="text-slate-400 text-xs mb-3 border-b border-void-800 pb-2 flex items-center justify-between">
                <span>PSD Document Architecture (Layer Hierarchy)</span>
                <span className="text-toxic-lime font-bold">100% Vector Anchors</span>
              </div>
              {selectedSample.layers.map((l, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 rounded-lg bg-void-900 border border-void-800 hover:border-cyber-cyan/40 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-slate-600 font-bold">{String(i + 1).padStart(2, '0')}</span>
                    <span className="h-2 w-2 rounded-full bg-cyber-cyan" />
                    <span className="text-white font-medium">{l.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 bg-void-800 px-2 py-0.5 rounded border border-void-700">
                      {l.type}
                    </span>
                    {l.effects && (
                      <span className="text-[10px] text-toxic-lime bg-toxic-lime/10 px-2 py-0.5 rounded font-bold">
                        {l.effects.join(' + ')}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Bottom Compiler Diagnostics Footer */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-void-900/90 border-t border-void-800 text-[11px] font-mono text-slate-400">
            <span className="flex items-center gap-1.5 text-emerald-neon font-semibold">
              <span className="h-2 w-2 rounded-full bg-emerald-neon animate-pulse" />
              Compiler Ready
            </span>
            <span>Target: Node 20+ / Skia / AG-PSD</span>
          </div>

        </div>

        {/* Right Column: Live Visual Canvas */}
        <div className={`lg:col-span-6 flex flex-col items-center justify-center p-8 relative ${showGrid ? 'grid-bg' : 'bg-void-900'}`}>
          
          {/* Top Canvas Spec Header */}
          <div className="absolute top-4 left-4 flex items-center gap-2 text-xs font-mono text-slate-400 bg-void-950/80 px-3 py-1 rounded-md border border-void-700 backdrop-blur-md">
            <Eye className="h-3.5 w-3.5 text-emerald-neon" />
            <span className="font-bold text-white">{selectedSample.name}</span>
            <span className="text-slate-500">•</span>
            <span className="text-toxic-lime font-mono">{selectedSample.dimensions}</span>
          </div>

          {/* Main Visual Display */}
          <div className="my-auto flex items-center justify-center max-w-full p-4">
            {format === 'psd' ? (
              <div className="w-full max-w-md p-6 bg-void-950 rounded-xl border border-cyber-cyan/40 shadow-2xl font-mono text-xs space-y-4">
                <div className="flex items-center justify-between border-b border-void-800 pb-3">
                  <div className="flex items-center gap-2 text-cyber-cyan font-bold">
                    <Layers className="h-5 w-5" />
                    <span>Layered Adobe Photoshop (.psd)</span>
                  </div>
                  <span className="text-[11px] bg-cyber-cyan/10 text-cyber-cyan px-2 py-0.5 rounded font-bold">
                    Native Shape Layers
                  </span>
                </div>
                <p className="text-slate-300 text-xs leading-relaxed">
                  Exported with live Bézier curves, editable typography PostScript font records, and Photoshop Gradient Vector Fills.
                </p>
                <div className="p-3 bg-void-900 rounded-lg border border-void-800 text-[11px] space-y-1 text-slate-400">
                  <div>• KeyOriginRRectRadii: <span className="text-emerald-neon">Editable</span></div>
                  <div>• Photoshop Color Overlay: <span className="text-emerald-neon">Applied</span></div>
                  <div>• PSD Color Space: <span className="text-cyber-cyan">RGB 8-Bit</span></div>
                </div>
              </div>
            ) : (
              <div className="relative rounded-xl overflow-hidden shadow-2xl border border-void-700/60 bg-void-950/70 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedSample.previewImg}
                  alt={selectedSample.name}
                  className="max-h-[380px] w-auto object-contain rounded-lg shadow-2xl"
                  style={{
                    transform: `scale(${scale === 4 ? 1.05 : scale === 2 ? 1.02 : 1})`,
                    transition: 'transform 0.3s ease'
                  }}
                />
              </div>
            )}
          </div>

          {/* Live Action Bar */}
          <div className="w-full flex items-center justify-between pt-4 border-t border-void-800/80 text-xs font-mono text-slate-400">
            <span className="text-slate-500">Output: {selectedSample.id}.{format}</span>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-toxic-lime animate-ping" />
              <span className="text-toxic-lime font-bold">Live Render Active</span>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
