/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: '#0A0F1E',
        surface: '#111827',
        surface2: '#1F2937',
        border: '#1E293B',
        danger: '#EF4444',
        warning: '#F97316',
        success: '#22C55E',
        info: '#3B82F6',
        muted: '#94A3B8',
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'sans-serif'],
        heading: ['Rajdhani', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
