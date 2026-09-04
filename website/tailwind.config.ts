import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        void: {
          950: '#030508',
          900: '#07090e',
          850: '#0b0f19',
          800: '#0f172a',
          700: '#1e293b',
          600: '#334155',
        },
        emerald: {
          neon: '#10b981',
          glow: '#059669',
          dark: '#047857',
        },
        lime: {
          toxic: '#ccff00',
          glow: '#a3e635',
        },
        cyan: {
          cyber: '#38bdf8',
          glow: '#0284c7',
        },
        rose: {
          accent: '#fd91a1',
          wine: '#1e0b0e',
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        'glow-emerald': '0 0 25px -5px rgba(16, 185, 129, 0.4)',
        'glow-lime': '0 0 25px -5px rgba(204, 255, 0, 0.4)',
        'glow-cyan': '0 0 25px -5px rgba(56, 189, 248, 0.4)',
        'glass-card': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow-bounce': 'glowBounce 3s ease-in-out infinite',
      },
      keyframes: {
        glowBounce: {
          '0%, 100%': { opacity: '0.6', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.05)' },
        }
      }
    },
  },
  plugins: [],
};

export default config;
