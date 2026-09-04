import type { Metadata } from 'next';
import '@/styles/globals.css';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  metadataBase: new URL('https://toad.design'),
  title: 'toad — Declarative Design DSL Compiler & Photoshop Exporter',
  description: 'A modern declarative Domain-Specific Language (DSL) that compiles structured .toad design files into Photoshop PSDs, multi-scale PNGs, WebP, and SVG vectors.',
  keywords: ['toad', 'dsl', 'design-system', 'photoshop', 'psd-exporter', 'compiler', 'skia-canvas', 'svg'],
  authors: [{ name: 'TOAD Team' }],
  icons: {
    icon: '/brand/logo-app-icon.png',
    apple: '/brand/logo-app-icon.png',
  },
  openGraph: {
    title: 'toad — Declarative Design DSL Compiler',
    description: 'Transform code into layered Photoshop files, crisp multi-scale images, and scalable vectors.',
    images: ['/brand/logo-master-logo.png'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen flex flex-col bg-void-950 text-slate-100 antialiased selection:bg-emerald-neon/30 selection:text-white">
        <Navbar />
        <main className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
