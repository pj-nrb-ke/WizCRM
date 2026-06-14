/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{ts,tsx,js,jsx}'],
  corePlugins: {
    preflight: false, // Preserve existing index.css styles
  },
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
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
      boxShadow: {
        brand: '0 4px 20px rgba(79, 70, 229, 0.22)',
        'brand-lg': '0 8px 32px rgba(79, 70, 229, 0.35)',
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
