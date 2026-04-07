/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        background: '#0F1117',
        surface: '#1A1D27',
        'surface-2': '#242736',
        border: '#2E3247',
        primary: {
          DEFAULT: '#4F6EF7',
          hover: '#3D5CE5',
          light: '#7B93FA',
        },
        secondary: '#8B90A7',
        success: '#22C55E',
        warning: '#F59E0B',
        error: '#EF4444',
        'wood-light': '#C8A96E',
        'wood-dark': '#3D1C02',
        'water-blue': '#1B4FD8',
      },
    },
  },
  plugins: [],
};
