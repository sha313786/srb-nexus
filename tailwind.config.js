/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './public/**/*.{html,js}',
    './src/**/*.{ts,tsx,js,jsx}'
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        heading: ['Outfit', 'sans-serif'],
        grotesk: ['"Space Grotesk"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
        spacemono: ['"Space Mono"', 'monospace'],
      },
      colors: {
        brand: {
          DEFAULT: '#5865F2', // Discord Blurple
          hover: '#4752c4',
          cyan: '#00d2ff',
          emerald: '#10b981',
        },
        dark: {
          950: '#07090e',
          900: '#0c0f17',
          850: '#121724',
          800: '#181f30',
          750: '#202940',
          700: '#2b3652',
        },
        discord: {
          bg: '#313338',
          sidebar: '#2b2d31',
          channel: '#1e1f22',
          embed: '#2b2d31',
          text: '#dbdee1',
          muted: '#949ba4',
        }
      }
    }
  },
  plugins: [],
};
