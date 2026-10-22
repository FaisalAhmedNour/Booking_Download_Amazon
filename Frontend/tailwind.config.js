/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#0473EA',
        secondary: '#FFD000',
        tertiary: '#38D200',
        tertiary_light: '#FDDA5C'
      },
      fontFamily: {
        roboto: ['Roboto', 'sans-serif'],
        roboto_mono: ['Roboto Mono', 'sans-serif'],
        abril_fatface: ['Abril Fatface', 'sans-serif'],
      },
    },
  },
  plugins: [],
}