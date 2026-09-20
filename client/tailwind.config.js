/**
 * Digital Heroes design tokens.
 *
 * The palette is deliberately warm-dark rather than the blue/violet that most
 * dashboards default to: near-black ink for structure, ivory for text, and
 * three semantic accents — jade for charity, coral for impact/action, gold for
 * rewards. Colours carry meaning here, so they are named for what they mean.
 */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          900: '#07090C', // page background
          800: '#0D1116', // raised surface
          700: '#141922', // card
          600: '#1C232E', // border-ish surface
          500: '#27303D',
        },
        ivory: {
          DEFAULT: '#F3EFE6',
          dim: '#D9D3C6',
          faint: '#A8A294',
        },
        jade: {
          500: '#2FA37A',
          400: '#43BE92',
          600: '#1E7B5B',
          950: '#0C2A21',
        },
        coral: {
          500: '#E8663C',
          400: '#F0845F',
          600: '#C24E29',
          950: '#33150C',
        },
        gold: {
          500: '#C9A227',
          400: '#E0BC4D',
          600: '#9A7A15',
          950: '#2B2209',
        },
        mist: {
          400: '#8A94A0',
          500: '#66707C',
          600: '#454E58',
        },
      },
      fontFamily: {
        display: ['Sora', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['"DM Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        display: ['clamp(2.8rem, 7vw, 5.5rem)', { lineHeight: '0.95', letterSpacing: '-0.03em' }],
        headline: ['clamp(2rem, 4vw, 3.25rem)', { lineHeight: '1.04', letterSpacing: '-0.02em' }],
        title: ['clamp(1.35rem, 2vw, 1.85rem)', { lineHeight: '1.15', letterSpacing: '-0.01em' }],
        micro: ['0.6875rem', { lineHeight: '1.2', letterSpacing: '0.14em' }],
      },
      borderRadius: {
        xl2: '1.375rem',
        panel: '1.75rem',
      },
      boxShadow: {
        panel: '0 24px 60px -30px rgba(0,0,0,0.85)',
        lift: '0 12px 32px -18px rgba(0,0,0,0.9)',
        glow: '0 0 0 1px rgba(47,163,122,0.35), 0 18px 50px -28px rgba(47,163,122,0.55)',
      },
      backdropBlur: {
        panel: '18px',
      },
      keyframes: {
        'rise-in': {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'sweep': {
          '0%': { transform: 'translateX(-60%)' },
          '100%': { transform: 'translateX(160%)' },
        },
      },
      animation: {
        'rise-in': 'rise-in 0.5s cubic-bezier(0.22,1,0.36,1) both',
        sweep: 'sweep 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
