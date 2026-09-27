/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        graphite: {
          bg: '#171918',
          panel: '#1E211F',
          elevated: '#252925',
          border: '#343934',
          'border-light': '#424842',
          primary: '#E5E6DF',
          secondary: '#9B9F96',
          muted: '#686D65',
        },
        editorial: {
          sage: '#91A891',
          'sage-subtle': 'rgba(145, 168, 145, 0.12)',
          warm: '#B6A98A',
          'warm-subtle': 'rgba(182, 169, 138, 0.12)',
          negative: '#C0615A',
          'negative-subtle': 'rgba(192, 97, 90, 0.12)',
          neutral: '#B6A98A',
          positive: '#91A891',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}