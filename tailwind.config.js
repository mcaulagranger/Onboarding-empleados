/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Marca Granger ──────────────────────────────
        ivori:     '#f7f2e7',   // color base / fondo app
        natural:   '#fff8ec',   // superficies (cards)
        fg:        '#22201c',   // texto principal (igual a ink, sobre tarjeta clara)
        ink: {
          DEFAULT: '#22201c',   // Negro Gris (sidebar, hero, overlays)
          soft:    '#3b3836',   // Active
        },
        chocolate: '#71463f',
        cookie:    '#402f65',
        health:    '#b0c8e9',
        vainilla:  '#ffc81e',
        limon:     '#f3c300',
        caprese:   '#f95932',
        durazno:   '#e6523e',
        frutilla:  '#ca3553',

        // ── Naranja Granger (acento principal) ─────────
        brand: {
          50:  '#fff8ec',
          100: '#fdeccd',
          200: '#fbd9a1',
          300: '#f9be78',
          400: '#f49b31',
          500: '#f18a00',
          600: '#e07f00',
          700: '#c26c00',
          800: '#8a4e06',
          900: '#5c3608',
        },

        // ── Neutros cálidos (reemplazan al gris frío) ──
        slate: {
          50:  '#faf7f0',
          100: '#f2ece0',
          200: '#e6dccb',
          300: '#d3c6b0',
          400: '#ab9f8b',
          500: '#7f7565',
          600: '#5f574a',
          700: '#47413a',
          800: '#302c27',
          900: '#22201c',
        },

        // ── Estados (derivados de la paleta) ───────────
        emerald: {
          50:  '#f0f4ec',
          100: '#dde7d5',
          200: '#c2d3b5',
          500: '#6b8f5a',
          600: '#557a46',
          700: '#45643a',
          800: '#37502f',
        },
        amber: {
          50:  '#fff9e6',
          100: '#fdf0c2',
          200: '#fbe392',
          400: '#ffc81e',
          500: '#f3c300',
          600: '#d1a400',
          700: '#8a6d00',
          800: '#6b5400',
        },
        red: {
          50:  '#fdf0ee',
          100: '#fadbd6',
          200: '#f6bdb4',
          500: '#e6523e',
          600: '#d13f36',
          700: '#a83228',
        },
        blue: {
          50:  '#f2f6fc',
          100: '#e2eaf7',
          200: '#b0c8e9',
          500: '#6f97cd',
          600: '#4f7ab5',
          700: '#3d5f8f',
          800: '#2f4a70',
        },
      },
      fontFamily: {
        sans:    ['Archivo', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(34,32,28,0.04), 0 4px 16px -8px rgba(34,32,28,0.10)',
      },
    },
  },
  plugins: [],
}