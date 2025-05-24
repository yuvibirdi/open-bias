/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./packages/admin-ui/index.html",
    "./packages/admin-ui/src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
  // Enable legacy colors to ensure compatibility
  legacyColors: true
}
