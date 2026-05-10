/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#fdf6ee',
          100: '#fae9d0',
          200: '#f5d09d',
          300: '#efb265',
          400: '#e8913a',
          500: '#c47a2e',   // DaVinci gold
          600: '#a36022',
          700: '#834a1c',
          800: '#6b3d1a',
          900: '#59321a',
        },
        dark: {
          DEFAULT: '#1a1a1a',
          50: '#2d2d2d',
          100: '#3d3d3d',
        },
        cream: '#faf7f2',
      },
      fontSize: {
        xs:   ['1rem',       { lineHeight: '1.5rem'   }],  // 16px (+3)
        sm:   ['1.125rem',   { lineHeight: '1.75rem'  }],  // 18px (+3)
        base: ['1.25rem',    { lineHeight: '2rem'     }],  // 20px (+3)
        lg:   ['1.375rem',   { lineHeight: '2.125rem' }],  // 22px (+3)
        xl:   ['1.5rem',     { lineHeight: '2.25rem'  }],  // 24px (+3)
        '2xl':['1.75rem',    { lineHeight: '2.5rem'   }],  // 28px (+3)
        '3xl':['2.125rem',   { lineHeight: '2.75rem'  }],  // 34px (+3)
        '4xl':['2.5rem',     { lineHeight: '3rem'     }],  // 40px (+3)
        '5xl':['3.25rem',    { lineHeight: '1'        }],  // 52px (+3)
        '6xl':['4rem',       { lineHeight: '1'        }],  // 64px (+3)
        '7xl':['4.875rem',   { lineHeight: '1'        }],  // 78px (+3)
      },
      fontFamily: {
        heading: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        body:    ['"DM Sans"', 'sans-serif'],
        accent:  ['"Cinzel"', 'serif'],
      },
      container: {
        center: true,
        padding: { DEFAULT: '1rem', sm: '2rem', lg: '4rem', xl: '5rem' },
      },
      animation: {
        'fade-up':   'fadeUp 0.6s ease-out both',
        'fade-in':   'fadeIn 0.4s ease-out both',
        'scale-in':  'scaleIn 0.3s ease-out both',
      },
      keyframes: {
        fadeUp:  { from: { opacity: '0', transform: 'translateY(24px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        fadeIn:  { from: { opacity: '0' }, to: { opacity: '1' } },
        scaleIn: { from: { opacity: '0', transform: 'scale(0.95)' }, to: { opacity: '1', transform: 'scale(1)' } },
      },
    },
  },
  plugins: [],
};
