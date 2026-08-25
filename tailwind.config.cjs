/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        trikode: {
          blue: '#15345f',
          green: '#98ce4f',
          cyan: '#33d3e7',
          dark: '#0b1730',
        },
      },
    },
  },
  plugins: [],
}
