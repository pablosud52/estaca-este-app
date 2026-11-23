/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  future: {
    hoverOnlyWhenSupported: true,
  },
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        stake: {
          dark: '#051E3B',
          primary: '#072B52',
          accent: '#083563',
          light: '#f0f7ff',
          border: '#bae6fd'
        }
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.23, 1, 0.32, 1)',
        'in-out-cubic': 'cubic-bezier(0.77, 0, 0.175, 1)',
        'drawer': 'cubic-bezier(0.32, 0.72, 0, 1)',
      }
    },
  },
  plugins: [],
}
