import React from 'react';
import DocsViewer from '@/components/DocsViewer';
import { BookOpen, Sparkles, Terminal } from 'lucide-react';

export const metadata = {
  title: 'Documentation & Wiki — toad DSL',
  description: 'Complete reference manual, grammar guide, layout DAG rules, and Photoshop exporter documentation for the toad design language.'
};

export default function DocsPage() {
  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-10">
      
      {/* Header Banner */}
      <div className="rounded-3xl glass-panel-glow p-8 sm:p-12 border border-emerald-neon/30 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-cyber-cyan/10 blur-[100px] rounded-full pointer-events-none" />
        
        <div className="max-w-2xl space-y-3 relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-void-950 px-3 py-1 border border-emerald-neon/30 text-xs font-mono text-emerald-neon">
            <BookOpen className="h-3.5 w-3.5" />
            Developer Knowledge Base & Syntax Guide
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            Documentation & Wiki
          </h1>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Everything you need to master the TOAD language grammar, layout solver constraints, Photoshop vector layer export, and CLI automation.
          </p>
        </div>
      </div>

      {/* Searchable Docs Hub Component */}
      <DocsViewer />

    </div>
  );
}
