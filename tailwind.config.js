/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './*.{ts,tsx}', './components/**/*.{ts,tsx}', './utils/**/*.{ts,tsx}', './editor/**/*.{ts,tsx}', './state/**/*.{ts,tsx}'],
  // The app toggles dark mode itself by adding `dark` to <html>.
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Shades referenced in components that the default palette lacks.
        gray: { 150: '#ececef', 250: '#dcdde1', 850: '#18181b' },
        zinc: { 850: '#1f1f23' },
      },
    },
  },
  plugins: [],
};
