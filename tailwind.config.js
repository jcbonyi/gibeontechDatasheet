/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f0f8',
          100: '#e0e0f1',
          200: '#c1c0e3',
          300: '#9a98d0',
          400: '#6b69b8',
          500: '#4b499e',
          600: '#3f3d99',
          700: '#35337d',
          800: '#2b2966',
          900: '#1f1e4d',
        },
        accent: {
          50: '#e8faf8',
          100: '#d0f5f1',
          200: '#a1ebe3',
          300: '#6ddfd4',
          400: '#2ec4b6',
          500: '#26a69a',
          600: '#1f8a80',
          700: '#1a6f67',
          800: '#155550',
          900: '#0f3d39',
        },
      },
      fontFamily: {
        sans: ['"Segoe UI"', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
