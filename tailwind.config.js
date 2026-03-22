/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: {
          50: '#f8f8f8',
          100: '#f0f0f0',
          200: '#e8e8e8',
          700: '#2d2d2d',
          800: '#1e1e1e',
          900: '#141414',
          950: '#0a0a0a',
        },
        accent: {
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
        }
      },
    },
  },
  plugins: [],
}

