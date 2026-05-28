/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        system: {
          bg: '#0a0a0c',
          card: '#141417',
          blue: '#00f2ff',
          purple: '#7000ff',
          text: '#e0e0e0',
          accent: '#00ff95'
        }
      },
      fontFamily: {
        'system': ['Orbitron', 'sans-serif'],
      }
    },
  },
  plugins: [],
}