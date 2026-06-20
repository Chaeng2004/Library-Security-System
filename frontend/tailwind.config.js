/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#111827',    // Gray-900
        secondary: '#6B7280',  // Gray-500
        accent: '#3B82F6',     // Blue-500
      },
    },
  },
  plugins: [],
}
