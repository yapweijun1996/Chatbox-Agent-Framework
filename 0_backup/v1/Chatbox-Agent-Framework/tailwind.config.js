/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./demo/**/*.{html,ts}",
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        'bg-app': '#343541',
        'bg-sidebar': '#202123',
        'bg-drawer': '#000000',
        'bg-user-msg': '#343541',
        'bg-ai-msg': '#444654',
        'bg-input': '#40414f',
        'border-color': '#4d4d4f',
        'text-primary': '#ECECF1',
        'text-secondary': '#C5C5D2',
        'text-tertiary': '#8e8ea0',
        'accent': '#10a37f',
        'accent-hover': '#1a7f64',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'Consolas', 'monospace'],
      },
      width: {
        'sidebar': '260px',
        'drawer': '320px',
      },
      height: {
        'header': '50px',
      }
    },
  },
  plugins: [],
}