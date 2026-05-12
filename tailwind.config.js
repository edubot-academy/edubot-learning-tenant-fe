/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ui: {
          surface: 'var(--surface)',
          muted: 'var(--surface-muted)',
          line: 'var(--line)',
          lineStrong: 'var(--line-strong)',
          text: 'var(--text)',
          textMuted: 'var(--text-muted)',
          primary: 'var(--brand-primary)',
          primaryStrong: 'var(--brand-primary-strong)',
          primarySoft: 'var(--brand-primary-soft)',
          hover: 'var(--surface-hover)',
        },
        brand: {
          dark: '#122144',
          ink: '#162033',
          orange: '#f17e22',
          orangeStrong: '#d85f0f',
          orangeSoft: '#fff3e9',
          teal: '#0ea78b',
          tealDark: '#1e605e',
          canvas: '#f5f7fb',
          line: '#dbe3ef',
        },
      },
      boxShadow: {
        tenant: '0 12px 30px rgba(15, 23, 42, 0.08)',
        brand: '0 10px 22px rgba(241, 126, 34, 0.24)',
      },
      borderRadius: {
        tenant: '8px',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
