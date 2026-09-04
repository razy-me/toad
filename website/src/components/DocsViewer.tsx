'use client';

import React, { useState } from 'react';
import { DOC_CATEGORIES, DOC_SECTIONS, DocSection } from '@/lib/docsData';
import { Search, BookOpen, Copy, Check, Terminal, Code2, Sparkles, ChevronRight, Hash } from 'lucide-react';

export default function DocsViewer() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredSections = DOC_SECTIONS.filter((sec) => {
    const matchesCat = selectedCategory === 'All' || sec.category === selectedCategory;
    const matchesSearch =
      sec.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sec.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sec.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (sec.codeSnippet && sec.codeSnippet.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  const handleCopy = (id: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      
      {/* Sidebar Navigation & Filters */}
      <div className="lg:col-span-3 sticky top-24 space-y-6">
        
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search syntax, CLI, layout..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl bg-void-900 pl-10 pr-4 py-2.5 text-xs font-mono text-white border border-void-700 focus:border-emerald-neon focus:outline-none focus:ring-1 focus:ring-emerald-neon placeholder:text-slate-500"
          />
        </div>

        {/* Category List */}
        <div className="glass-panel p-4 rounded-xl border border-void-700/80 space-y-1 font-mono text-xs">
          <div className="text-[10px] uppercase font-bold text-slate-500 px-3 py-1 mb-1">
            Topics
          </div>
          <button
            onClick={() => setSelectedCategory('All')}
            className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between transition-colors ${
              selectedCategory === 'All'
                ? 'bg-emerald-neon text-void-950 font-bold shadow-glow-emerald'
                : 'text-slate-300 hover:bg-void-800'
            }`}
          >
            <span>All Sections</span>
            <span className="text-[10px] opacity-75">({DOC_SECTIONS.length})</span>
          </button>
          {DOC_CATEGORIES.map((cat) => {
            const count = DOC_SECTIONS.filter((s) => s.category === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between transition-colors ${
                  selectedCategory === cat
                    ? 'bg-emerald-neon text-void-950 font-bold shadow-glow-emerald'
                    : 'text-slate-300 hover:bg-void-800'
                }`}
              >
                <span className="truncate">{cat}</span>
                <span className="text-[10px] opacity-75">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Quick Links */}
        <div className="p-4 rounded-xl bg-void-900 border border-void-800 text-xs font-mono text-slate-400 space-y-2">
          <div className="text-[10px] uppercase font-bold text-emerald-neon">
            CLI Cheat Sheet
          </div>
          <div className="text-[11px] space-y-1 text-slate-300">
            <div><code className="text-toxic-lime">toad build</code> — Compile to PSD/PNG</div>
            <div><code className="text-cyber-cyan">toad dev</code> — Live SSE preview</div>
            <div><code className="text-emerald-neon">toad init</code> — Scaffold project</div>
            <div><code className="text-slate-400">toad fmt</code> — Auto-format</div>
          </div>
        </div>

      </div>

      {/* Main Documentation Articles */}
      <div className="lg:col-span-9 space-y-10">
        
        {filteredSections.length === 0 ? (
          <div className="text-center py-20 glass-panel rounded-2xl border border-void-700">
            <p className="text-slate-400 font-mono text-sm">No documentation sections match &ldquo;{searchQuery}&rdquo;</p>
            <button
              onClick={() => { setSearchQuery(''); setSelectedCategory('All'); }}
              className="mt-4 px-4 py-2 bg-void-800 text-emerald-neon rounded-lg font-mono text-xs font-semibold hover:bg-void-700"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          filteredSections.map((sec) => (
            <article
              key={sec.id}
              id={sec.id}
              className="rounded-2xl glass-panel p-6 sm:p-8 border border-void-700/80 transition-all hover:border-emerald-neon/40 space-y-5"
            >
              {/* Article Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-void-800 pb-4">
                <div>
                  <span className="text-xs font-mono text-emerald-neon uppercase tracking-wider font-semibold">
                    {sec.category}
                  </span>
                  <h3 className="text-2xl font-bold text-white mt-1 flex items-center gap-2">
                    <Hash className="h-5 w-5 text-slate-500" />
                    {sec.title}
                  </h3>
                </div>
                {sec.badge && (
                  <span className="text-xs font-mono font-bold text-cyber-cyan bg-cyber-cyan/10 px-3 py-1 rounded-full border border-cyber-cyan/20">
                    {sec.badge}
                  </span>
                )}
              </div>

              {/* Description & Paragraphs */}
              <div className="space-y-3 text-slate-300 text-sm leading-relaxed">
                <p className="font-medium text-slate-200">{sec.description}</p>
                {sec.content.map((p, pIdx) => (
                  <p key={pIdx} className="text-slate-400">{p}</p>
                ))}
              </div>

              {/* Code Snippet Box */}
              {sec.codeSnippet && (
                <div className="rounded-xl overflow-hidden border border-void-700 bg-void-950 font-mono text-xs">
                  <div className="flex items-center justify-between px-4 py-2 bg-void-900 border-b border-void-800 text-slate-400 text-[11px]">
                    <span className="flex items-center gap-1.5 text-emerald-neon font-semibold">
                      <Code2 className="h-3.5 w-3.5" />
                      Example Code
                    </span>
                    <button
                      onClick={() => handleCopy(sec.id, sec.codeSnippet!)}
                      className="flex items-center gap-1 hover:text-white transition-colors"
                    >
                      {copiedId === sec.id ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-toxic-lime" />
                          <span className="text-toxic-lime font-bold">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>Copy Snippet</span>
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="p-4 overflow-x-auto text-slate-200 leading-relaxed">
                    <code>{sec.codeSnippet}</code>
                  </pre>
                </div>
              )}

              {/* Tips & Warnings */}
              {sec.tips && sec.tips.length > 0 && (
                <div className="p-4 rounded-xl bg-void-900/80 border border-emerald-neon/30 text-xs font-mono text-emerald-neon space-y-1">
                  {sec.tips.map((tip, tIdx) => (
                    <div key={tIdx} className="flex items-start gap-2">
                      <Sparkles className="h-4 w-4 text-toxic-lime shrink-0 mt-0.5" />
                      <span className="text-slate-300">{tip}</span>
                    </div>
                  ))}
                </div>
              )}

            </article>
          ))
        )}

      </div>

    </div>
  );
}
