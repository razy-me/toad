import React from 'react';
import Playground from '@/components/Playground';
import { Sparkles, Code2 } from 'lucide-react';

export const metadata = {
  title: 'Web Studio & Playground — toad DSL',
  description: 'In-browser interactive IDE and visual previewer for the toad declarative design DSL.'
};

export default function PlaygroundPage() {
  return (
    <div className="py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6">
      
      {/* Playground Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-mono text-emerald-neon font-bold uppercase tracking-wider">
            <Sparkles className="h-3.5 w-3.5 text-toxic-lime" />
            Web Studio v1.0
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white mt-1">
            Live Declarative Playground
          </h1>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
          <span className="flex items-center gap-1 text-emerald-neon">
            <span className="h-2 w-2 rounded-full bg-emerald-neon animate-pulse" />
            Live Skia Renderer Ready
          </span>
        </div>
      </div>

      {/* Main Interactive Studio Component */}
      <Playground />

    </div>
  );
}
