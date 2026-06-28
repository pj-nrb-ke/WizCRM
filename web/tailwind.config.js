/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{ts,tsx,js,jsx}'],
  corePlugins: {
    preflight: false, // Preserve existing index.css styles
  },
  theme: {
    extend: {
      colors: {
        /* Meridian palette tokens */
        midnight: '#050D1F',
        command: '#0A1628',
        sapphire: {
          DEFAULT: '#1A56DB',
          light: '#3B82F6',
          dark: '#1245B8',
          soft: '#EBF3FF',
        },
        amber: {
          DEFAULT: '#D97706',
          soft: '#FFFBEB',
        },
        workspace: '#EFF3F9',
        /* Legacy brand scale kept for any remaining usages */
        brand: {
          50: '#EBF3FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#1A56DB',
          600: '#1649C0',
          700: '#1245B8',
          800: '#0D3A9E',
          900: '#082F8A',
          950: '#050D1F',
        },
      },
      fontWeight: {
        100: '100',
        200: '200',
        300: '300',
        400: '400',
        500: '500',
        600: '600',
        700: '700',
        800: '800',
        900: '900',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        pulseSoft: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.6' } },
      },
      backdropBlur: {
        xs: '2px',
      },
      fontFamily: {
        display: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Cascadia Code', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        sapphire: '0 4px 20px rgba(26, 86, 219, 0.22)',
        'sapphire-lg': '0 8px 32px rgba(26, 86, 219, 0.35)',
        glass: '0 8px 32px rgba(15, 23, 42, 0.12)',
        'glass-lg': '0 16px 48px rgba(15, 23, 42, 0.16)',
      },
    },
  },
  plugins: [
    function ({ addUtilities }) {
      addUtilities({
        '.font-inherit': { font: 'inherit' },
      });
    },
  ],
};
