'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Terminal, Code2, BookOpen, Layers, Sparkles, ExternalLink, Menu, X } from 'lucide-react';
import { BRAND_TOKENS } from '@/lib/brandTokens';

export default function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { href: '/playground', label: 'Playground', icon: Code2 },
    { href: '/showcase', label: 'Showcase', icon: Layers },
    { href: '/docs', label: 'Docs & Wiki', icon: BookOpen },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-void-700/60 bg-void-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        
        {/* Brand Logo & Tag */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-void-850 border border-emerald-neon/40 shadow-glow-emerald transition-all duration-300 group-hover:scale-105 group-hover:border-emerald-neon">
            <span className="font-mono font-black text-emerald-neon text-lg tracking-tighter">&gt;_</span>
            <div className="absolute -inset-0.5 rounded-xl bg-emerald-neon/20 blur opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="flex flex-col">
            <span className="font-mono font-black text-xl tracking-tight text-white flex items-center gap-1.5">
              toad
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-toxic-lime animate-pulse" />
            </span>
            <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-neon/80 -mt-1">
              Design DSL
            </span>
          </div>
        </Link>

        {/* Desktop Nav Links */}
        <nav className="hidden md:flex items-center gap-1 bg-void-850/70 p-1.5 rounded-full border border-void-700/80">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-emerald-neon text-void-950 font-semibold shadow-glow-emerald'
                    : 'text-slate-300 hover:text-white hover:bg-void-700/50'
                }`}
              >
                <Icon className="h-4 w-4" />
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Quick CTA & GitHub */}
        <div className="hidden sm:flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg bg-void-850 px-3 py-1.5 border border-void-700 text-xs font-mono text-slate-400">
            <span className="h-2 w-2 rounded-full bg-emerald-neon animate-ping" />
            <span className="text-slate-300">v{BRAND_TOKENS.version} Stable</span>
          </div>
          <Link
            href="/playground"
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-neon to-emerald-dark px-4 py-2 text-sm font-semibold text-void-950 shadow-glow-emerald hover:brightness-110 transition-all active:scale-95"
          >
            <Sparkles className="h-4 w-4" />
            Launch Studio
          </Link>
        </div>

        {/* Mobile Hamburger */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-void-800"
          aria-label="Toggle Navigation"
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileOpen && (
        <div className="md:hidden border-b border-void-700 bg-void-950/95 px-4 py-5 backdrop-blur-2xl space-y-3">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-base font-medium transition-all ${
                  isActive
                    ? 'bg-emerald-neon text-void-950 font-bold'
                    : 'text-slate-300 hover:bg-void-800'
                }`}
              >
                <Icon className="h-5 w-5" />
                {link.label}
              </Link>
            );
          })}
          <div className="pt-3 border-t border-void-800">
            <Link
              href="/playground"
              onClick={() => setMobileOpen(false)}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-neon py-3 text-sm font-bold text-void-950 shadow-glow-emerald"
            >
              <Sparkles className="h-4 w-4" />
              Open Live Playground
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
