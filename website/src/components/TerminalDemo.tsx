'use client';

import React, { useState } from 'react';
import { Terminal, Check, Copy, Play, RefreshCw, Sparkles, FolderOpen, Globe } from 'lucide-react';

export default function TerminalDemo() {
  const [activeStep, setActiveStep] = useState<number>(0);
  const [copied, setCopied] = useState(false);

  const steps = [
    {
      cmd: 'toad init cyber-brand',
      output: `[toad] Initializing new project "cyber-brand"...
  ✓ Created package.json
  ✓ Created main.toad
  ✓ Installed local dependencies

Project "cyber-brand" is ready! Run:
  cd cyber-brand && toad dev`
    },
    {
      cmd: 'toad dev main.toad',
      output: `[toad] Compiling main.toad...
[toad] Build succeeded in 38ms
  -> main.png               24.8 KB  (1200x540)
  -> main.svg                3.2 KB
  -> main.psd              217.9 KB  (Layered PSD)

  ➜  Local Preview:   http://localhost:3000/
  ➜  Live Reload:     Active (SSE)
  ➜  File Folder:     C:\\Users\\flori\\cyber-brand

[toad] Watching for changes in 3 file(s)... (Press Ctrl+C to stop)`
    },
    {
      cmd: 'toad build --format all --scale 4',
      output: ` SUCCESS  Build completed in 142ms
  ➜ main.png              142.4 KB  (4800x2160 @ 4x)
  ➜ main.jpg               94.1 KB  (4800x2160 @ 4x)
  ➜ main.webp              41.6 KB  (4800x2160 @ 4x)
  ➜ main.svg                3.2 KB  (Scalable Vector)
  ➜ main.psd              872.5 KB  (Photoshop 4x)`
    }
  ];

  const current = steps[activeStep];

  const handleCopyCmd = () => {
    navigator.clipboard.writeText(current.cmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="py-20 lg:py-28 relative">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-toxic-lime bg-toxic-lime/10 px-3 py-1 rounded-full border border-toxic-lime/20">
            Developer Experience
          </span>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Blazing Fast Zero-Config CLI
          </h2>
          <p className="text-slate-400 text-base sm:text-lg">
            No bundler configurations, no complex setups. Just install globally and start building.
          </p>
        </div>

        {/* Terminal Container */}
        <div className="max-w-4xl mx-auto rounded-2xl glass-panel-glow overflow-hidden border border-emerald-neon/40 shadow-2xl">
          
          {/* Terminal Window Chrome */}
          <div className="flex items-center justify-between border-b border-void-700 bg-void-950 px-5 py-3.5">
            <div className="flex items-center gap-3">
              <div className="flex gap-2">
                <span className="h-3 w-3 rounded-full bg-red-500/80" />
                <span className="h-3 w-3 rounded-full bg-yellow-500/80" />
                <span className="h-3 w-3 rounded-full bg-green-500/80" />
              </div>
              <span className="font-mono text-xs text-slate-400 font-bold border-l border-void-700 pl-3 flex items-center gap-1.5">
                <Terminal className="h-3.5 w-3.5 text-emerald-neon" />
                powershell — toad CLI
              </span>
            </div>

            {/* CLI Step Buttons */}
            <div className="flex items-center gap-1 bg-void-850 p-1 rounded-lg border border-void-700 text-xs font-mono">
              {['1. Scaffolding', '2. Live Dev', '3. Production Build'].map((label, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveStep(idx)}
                  className={`px-3 py-1 rounded transition-all ${
                    activeStep === idx
                      ? 'bg-emerald-neon text-void-950 font-bold shadow-glow-emerald'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Terminal Body */}
          <div className="p-6 bg-void-950 font-mono text-xs sm:text-sm leading-relaxed space-y-4">
            
            {/* Input line */}
            <div className="flex items-center justify-between bg-void-900/90 p-3 rounded-xl border border-void-800">
              <div className="flex items-center gap-2">
                <span className="text-emerald-neon font-bold">$</span>
                <span className="text-white font-semibold">{current.cmd}</span>
              </div>
              <button
                onClick={handleCopyCmd}
                className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-void-800 border border-void-700 text-xs text-slate-300 hover:text-white hover:border-slate-500 transition-all"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-toxic-lime" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            {/* Terminal Output */}
            <pre className="text-slate-300 overflow-x-auto whitespace-pre p-2">
              <code>{current.output}</code>
            </pre>

          </div>

          {/* Terminal Live Reload Status Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-3 bg-void-900 border-t border-void-800 text-xs font-mono text-slate-400">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-emerald-neon">
                <Globe className="h-3.5 w-3.5" />
                Live Preview: http://localhost:3000
              </span>
              <span className="hidden sm:inline">•</span>
              <span className="flex items-center gap-1.5 text-cyber-cyan hidden sm:flex">
                <FolderOpen className="h-3.5 w-3.5" />
                1-Click Folder Launcher
              </span>
            </div>
            <span className="text-toxic-lime font-bold">SSE Protocol Active</span>
          </div>

        </div>

      </div>
    </section>
  );
}
