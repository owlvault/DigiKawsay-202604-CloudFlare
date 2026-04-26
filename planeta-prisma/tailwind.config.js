/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Planeta Prisma palette
        cosmos: {
          900: '#020818',
          800: '#060d24',
          700: '#0b1740',
        },
        neon: {
          cyan:   '#00f5ff',
          green:  '#39ff14',
          amber:  '#ffbe00',
          red:    '#ff2d55',
        },
        biome: {
          dome:   '#1a4a7a',   // Cúpula Geodésica (+/-)
          orbital:'#1a4a2e',   // Invernadero Orbital (*)
          fluid:  '#4a1a2e',   // Laboratorio de Fluidos (/)
        },
      },
      fontFamily: {
        mono: ['"Space Mono"', 'monospace'],
        display: ['"Exo 2"', 'sans-serif'],
      },
      boxShadow: {
        neon: '0 0 8px currentColor, 0 0 20px currentColor',
        'neon-lg': '0 0 15px currentColor, 0 0 40px currentColor',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'scan': 'scan 2s linear infinite',
        'flicker': 'flicker 0.15s infinite',
      },
      keyframes: {
        scan: {
          '0%':   { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        flicker: {
          '0%, 100%': { opacity: 1 },
          '50%':      { opacity: 0.8 },
        },
      },
    },
  },
  plugins: [],
}
