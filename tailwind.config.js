/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        stake: {
          dark: '#133e36',
          primary: '#1d5d51',
          accent: '#2f8577',
          light: '#f0fdf9',
          border: '#ccfbf1'
        }
      }
    },
  },
  plugins: [],
}
