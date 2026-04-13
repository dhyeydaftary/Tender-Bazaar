import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      /* ── Colors (CSS custom properties for theme switching) ────────── */
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
          50: '#FFF3ED',
          100: '#FFE4D4',
          200: '#FFC5A8',
          300: '#FFA071',
          400: '#FF7F47',
          500: '#FF6B35',
          600: '#F04E15',
          700: '#C73A0D',
          800: '#9E3013',
          900: '#7F2B14',
          950: '#451208',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
          50: '#EEF1F6',
          100: '#D9DFE9',
          200: '#B7C0D5',
          300: '#8A98B8',
          400: '#657196',
          500: '#4B577A',
          600: '#3D4768',
          700: '#333B56',
          800: '#2A3249',
          900: '#1B2845',
          950: '#111829',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
          50: '#EDFFF8',
          100: '#D5FFF1',
          200: '#AEFFE3',
          300: '#70FFD0',
          400: '#2BFDB5',
          500: '#00D4AA',
          600: '#00C49A',
          700: '#009B7D',
          800: '#067A65',
          900: '#076454',
          950: '#003931',
        },
        /* Semantic tender category colors */
        'tender-works': '#E8593C',
        'tender-goods': '#2563EB',
        'tender-services': '#0D9488',
        'tender-consultancy': '#7C3AED',
        /* Score colors */
        'score-high': '#22C55E',
        'score-mid': '#F59E0B',
        'score-low': '#EF4444',
        /* Navy palette */
        navy: {
          50: '#F0F4FF',
          100: '#E0E8FF',
          200: '#C7D2FE',
          300: '#A5B4FC',
          400: '#818CF8',
          500: '#4B577A',
          600: '#3D4768',
          700: '#2A3249',
          800: '#1A1F2E',
          900: '#0B0F1A',
          950: '#060812',
        },
      },

      /* ── Border Radius ────────────────────────────────────────────── */
      borderRadius: {
        sm: '6px',
        DEFAULT: '8px',
        md: '10px',
        lg: '12px',
        xl: '16px',
        '2xl': '20px',
        '3xl': '24px',
      },

      /* ── Typography ───────────────────────────────────────────────── */
      fontFamily: {
        sans: ['var(--font-jakarta)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-jakarta)', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'Fira Code', 'monospace'],
      },
      fontSize: {
        'display-2xl': ['4.5rem', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '800' }],
        'display-xl': ['3.75rem', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '800' }],
        'display-lg': ['3rem', { lineHeight: '1.15', letterSpacing: '-0.02em', fontWeight: '700' }],
        'display-md': ['2.25rem', { lineHeight: '1.2', letterSpacing: '-0.01em', fontWeight: '700' }],
        'display-sm': ['1.875rem', { lineHeight: '1.25', fontWeight: '600' }],
        'heading-lg': ['1.5rem', { lineHeight: '1.3', fontWeight: '600' }],
        'heading-md': ['1.25rem', { lineHeight: '1.4', fontWeight: '600' }],
        'heading-sm': ['1.125rem', { lineHeight: '1.4', fontWeight: '600' }],
        'body-lg': ['1.125rem', { lineHeight: '1.6', fontWeight: '400' }],
        'body-md': ['1rem', { lineHeight: '1.6', fontWeight: '400' }],
        'body-sm': ['0.875rem', { lineHeight: '1.5', fontWeight: '400' }],
        caption: ['0.75rem', { lineHeight: '1.4', fontWeight: '500' }],
        overline: ['0.6875rem', { lineHeight: '1.3', fontWeight: '600', letterSpacing: '0.08em' }],
      },

      /* ── Shadows ──────────────────────────────────────────────────── */
      boxShadow: {
        sm: '0 1px 2px rgba(0,0,0,0.05)',
        DEFAULT: '0 1px 3px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.04)',
        md: '0 2px 4px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.08)',
        lg: '0 4px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.08)',
        xl: '0 8px 16px rgba(0,0,0,0.06), 0 20px 48px rgba(0,0,0,0.12)',
        '2xl': '0 16px 32px rgba(0,0,0,0.08), 0 32px 64px rgba(0,0,0,0.14)',
        glow: '0 0 20px rgba(255,107,53,0.15), 0 0 40px rgba(255,107,53,0.08)',
        'glow-teal': '0 0 20px rgba(0,212,170,0.15), 0 0 40px rgba(0,212,170,0.08)',
        card: '0 1px 3px rgba(0,0,0,0.04), 0 4px 14px rgba(0,0,0,0.05)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.08), 0 12px 28px rgba(0,0,0,0.1)',
        'elevated': '0 8px 30px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)',
        'inner-soft': 'inset 0 2px 4px rgba(0,0,0,0.04)',
      },

      /* ── Animations ───────────────────────────────────────────────── */
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          from: { opacity: '0', transform: 'translateY(-8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          from: { opacity: '0', transform: 'translateX(16px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        pulseRing: {
          '0%': { transform: 'scale(1)', opacity: '1' },
          '100%': { transform: 'scale(1.5)', opacity: '0' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        countUp: {
          from: { '--num': '0' },
          to: { '--num': 'var(--target)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        gridPulse: {
          '0%, 100%': { opacity: '0.03' },
          '50%': { opacity: '0.06' },
        },
      },
      animation: {
        shimmer: 'shimmer 2s linear infinite',
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'slide-down': 'slideDown 0.4s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'pulse-ring': 'pulseRing 1.5s ease-out infinite',
        marquee: 'marquee 30s linear infinite',
        float: 'float 3s ease-in-out infinite',
        'grid-pulse': 'gridPulse 4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
